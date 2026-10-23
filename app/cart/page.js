"use client";

import { useState, useEffect, Suspense } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, serverTimestamp, query, where } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "../components/BottomNav";

function CartContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");

  const [cart, setCart] = useState([]);
  const [skus, setSkus] = useState([]);
  const [context, setContext] = useState({ distId: "", storeId: "" });
  const [storeName, setStoreName] = useState("");
  const [distName, setDistName] = useState("");
  const [scheme, setScheme] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const skuSnap = await getDocs(collection(db, "sku_master"));
      const skuList = skuSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSkus(skuList);

      let cId = "", sId = "";

      if (editId) {
        const docRef = doc(db, "orders", editId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          cId = data.distributor_id; sId = data.store_id;
          setContext({ distId: cId, storeId: sId });
          setScheme(data.items[0]?.extraScheme || 0);
          setCart(data.items.map(i => ({ sku: i.sku, qty: i.qty })));
        }
      } else {
        const savedCart = JSON.parse(localStorage.getItem("perfora_cart") || "[]");
        const savedContext = JSON.parse(localStorage.getItem("perfora_order_context") || "{}");
        setCart(savedCart);
        cId = savedContext.distId; sId = savedContext.storeId;
        setContext({ distId: cId, storeId: sId });
      }

      // Fetch names
      if (sId) {
        const sDoc = await getDoc(doc(db, "stores", sId));
        if (sDoc.exists()) setStoreName(sDoc.data().name);
      }
      if (cId) {
        const dDoc = await getDoc(doc(db, "distributors", cId));
        if (dDoc.exists()) setDistName(dDoc.data().name);
      }
    };
    init();
  }, [editId]);

  const calculateLineData = (skuId, qty, extraSchemePercent) => {
    const skuData = skus.find(s => s.sku === skuId);
    if (!skuData) return { net: 0, claim: 0, baseExGst: 0, mrpTotal: 0, billingPct: 0 };
    
    const mrp = Number(skuData.mrp) || 0;
    const gst = Number(skuData.gst) || 0;
    const fixedMarginPct = 25;
    
    // 1. Fixed Rate ex-GST
    const fixedRateExGst = (mrp * (100 - fixedMarginPct) / 100) / (1 + gst / 100);
    
    // 2. Convert Market Scheme to Billing Discount (e.g., 5% -> 6.66%)
    const billingDiscountPct = extraSchemePercent > 0 
      ? Math.floor((extraSchemePercent * 100 / (100 - fixedMarginPct)) * 100 + 1e-8) / 100 
      : 0;
      
    // 3. Base calculations
    const invoiceBaseExGst = fixedRateExGst * qty;
    const discountExGst = invoiceBaseExGst * (billingDiscountPct / 100);
    const taxable = invoiceBaseExGst - discountExGst;
    const tax = taxable * (gst / 100);
    const net = taxable + tax;
    
    // 4. Claim (Scheme benefit incl tax effect)
    const claim = discountExGst * (1 + gst / 100);

    return { 
      net, 
      claim, 
      baseExGst: invoiceBaseExGst, 
      mrpTotal: mrp * qty,
      billingPct: billingDiscountPct
    };
  };

  const totals = cart.reduce((acc, item) => {
    const calc = calculateLineData(item.sku, item.qty, scheme);
    acc.mrpTotal += calc.mrpTotal;
    acc.baseExGst += calc.baseExGst;
    acc.schemeBenefit += calc.claim;
    acc.invoiceTotal += calc.net;
    return acc;
  }, { mrpTotal: 0, baseExGst: 0, schemeBenefit: 0, invoiceTotal: 0 });

  const updateQty = (skuId, delta) => {
    let newCart = [...cart];
    const existing = newCart.find(item => item.sku === skuId);
    if (existing) {
      existing.qty += delta;
      if (existing.qty <= 0) newCart = newCart.filter(item => item.sku !== skuId);
    }
    setCart(newCart);
    localStorage.setItem("perfora_cart", JSON.stringify(newCart));
  };

  const generateWhatsAppText = (order) => {
    let text = `${storeName || order.store_id}\n`;
    text += `PERFORA ORDER\n`;
    text += `Date: ${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}\n`;
    text += `Distributor: ${distName || order.distributor_id}\n\n`;
    text += `ITEMS\n`;
    order.items.forEach((item, index) => {
      text += `${index + 1}. ${item.sku}-${item.skuName}-${item.qty}pc\n`;
    });
    text += `\nExtra Margin: 25% + ${order.items[0]?.extraScheme || 0}% = ${25 + (order.items[0]?.extraScheme || 0)}%\n`;
    text += `Order Value (incl. GST): ₹${Number(order.grand_total).toFixed(2)}`;
    return encodeURIComponent(text);
  };

  const submitOrder = async (isDraft = false) => {
    if (cart.length === 0) return alert("Cart is empty");
    if (!context.storeId) return alert("No outlet selected. Go back to catalogue.");
    
    if (!isDraft) setIsSubmitting(true);

    const finalItems = cart.map(item => {
      const skuData = skus.find(s => s.sku === item.sku);
      const calc = calculateLineData(item.sku, item.qty, scheme);
      return {
        sku: item.sku, skuName: skuData.name, category: skuData.category || "General",
        gst: skuData.gst || 0,
        qty: item.qty, extraScheme: scheme, mrp: skuData.mrp,
        net: Number(calc.net), claim: Number(calc.claim)
      };
    });

    try {
      let finalStoreName = storeName;
      if (!finalStoreName) {
         const sDoc = await getDoc(doc(db, "stores", context.storeId));
         if (sDoc.exists()) finalStoreName = sDoc.data().name;
      }

      const orderData = {
        SO_email: auth.currentUser.email, 
        distributor_id: context.distId, 
        store_id: context.storeId,
        storeName: finalStoreName || "Unknown Store",
        items: finalItems, 
        grand_total: totals.invoiceTotal, 
        total_claim: totals.schemeBenefit,
        status: isDraft ? "DRAFT" : "CREATED", 
        createdAt: serverTimestamp()
      };

      if (editId) {
        await updateDoc(doc(db, "orders", editId), { ...orderData, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "orders"), orderData);
        localStorage.removeItem("perfora_cart");
        localStorage.removeItem("perfora_order_context");

        if (!isDraft) {
          const visitQ = query(
            collection(db, "visits"), 
            where("store_id", "==", context.storeId),
            where("SO_email", "==", auth.currentUser.email),
            where("status", "==", "IN_PROGRESS")
          );
          const visitSnap = await getDocs(visitQ);
          if (!visitSnap.empty) {
            await updateDoc(doc(db, "visits", visitSnap.docs[0].id), { status: "COMPLETED" });
          }
        }
      }
      
      if (isDraft) alert("Draft saved successfully.");
      else router.push("/orders");
      
    } catch (error) {
      alert("Error saving order");
      console.error(error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-32">
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 p-4 rounded-b-3xl shadow-lg text-white">
        <h1 className="text-2xl font-black">Order cart</h1>
        <p className="text-sm opacity-90 mt-1">Review selected SKUs before submission</p>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto -mt-4">
        
        {/* Header Card */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{storeName || "No outlet selected"}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{distName || "Select Distributor"}</p>
          </div>
          <button onClick={() => router.push(`/orders/new?storeId=${context.storeId}&distId=${context.distId}`)} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
            ← Catalogue
          </button>
        </div>

        {/* Items Card */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-800">Added items</h3>
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">
              {cart.length} SKU • {cart.reduce((a,b) => a+b.qty, 0)} units
            </span>
          </div>

          {cart.map(item => {
            const sku = skus.find(s => s.sku === item.sku);
            const calc = calculateLineData(item.sku, item.qty, scheme);
            if (!sku) return null;
            return (
              <div key={item.sku} className="flex gap-3 py-3 border-b border-gray-50 last:border-0">
                <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center text-xl overflow-hidden shrink-0 border border-gray-100">
                  {sku.img ? <img src={sku.img} className="w-full h-full object-contain p-1" /> : "📦"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-gray-900">{sku.name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{sku.sku} • Rate ex-GST ₹{calc.baseExGst / item.qty}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-gray-900">₹{calc.net.toFixed(2)}</p>
                      <p className="text-[9px] text-gray-400">incl. GST</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.sku, -1)} className="w-6 h-6 bg-gray-100 rounded text-xs font-bold">−</button>
                      <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.sku, 1)} className="w-6 h-6 bg-blue-50 text-blue-600 rounded text-xs font-bold">+</button>
                    </div>
                    <button onClick={() => updateQty(item.sku, -item.qty)} className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded">Remove</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scheme Card */}
        <div className="bg-blue-50 p-4 rounded-2xl shadow-sm border border-blue-100">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-800">Market scheme (%)</h3>
            <p className="text-[9px] text-gray-500">One rate for the whole order</p>
          </div>
          <input 
            type="number" min="0" max="10" 
            value={scheme} 
            onChange={e => setScheme(Number(e.target.value))} 
            className="w-full mt-2 p-2 border border-blue-200 rounded-xl font-black text-center text-lg bg-white" 
          />
          <p className="text-[10px] text-blue-700 mt-2">
            Converted billing discount: {calculateLineData(cart[0]?.sku, 1, scheme).billingPct}% ({scheme}% market scheme).<br/>
            Applied to fixed SKU rate before GST; GST is recalculated per SKU. Example: 5% → 6.66%, 10% → 13.33%.
          </p>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
            <p className="text-[10px] font-bold text-gray-500 text-center">MRP total (incl GST)</p>
            <p className="text-sm font-black text-gray-900 text-center mt-1">₹{totals.mrpTotal.toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
            <p className="text-[10px] font-bold text-gray-500 text-center">Fixed billing base (ex GST)</p>
            <p className="text-sm font-black text-gray-900 text-center mt-1">₹{totals.baseExGst.toFixed(2)}</p>
          </div>
          <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
            <p className="text-[10px] font-bold text-purple-600 text-center">Scheme benefit (incl tax effect)</p>
            <p className="text-sm font-black text-purple-700 text-center mt-1">₹{totals.schemeBenefit.toFixed(2)}</p>
          </div>
          <div className="bg-green-50 p-3 rounded-xl border border-green-100">
            <p className="text-[10px] font-bold text-green-700 text-center">Invoice total (incl GST)</p>
            <p className="text-sm font-black text-green-700 text-center mt-1">₹{totals.invoiceTotal.toFixed(2)}</p>
          </div>
        </div>

        {/* Warning if no store */}
        {!context.storeId && (
          <div className="bg-orange-100 text-orange-800 text-xs font-bold p-3 rounded-xl text-center border border-orange-200">
            Select an outlet before submitting or saving a draft.
          </div>
        )}

      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-16 w-full max-w-md left-1/2 -translate-x-1/2 bg-white p-3 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40 flex flex-col gap-2">
        <div className="flex gap-2">
          <button onClick={() => {
              const tempOrder = { store_id: context.storeId, distributor_id: context.distId, items: cart.map(i => ({...i, skuName: skus.find(s=>s.sku===i.sku)?.name})), grand_total: totals.invoiceTotal };
              window.open(`https://wa.me/?text=${generateWhatsAppText(tempOrder)}`, '_blank');
            }} 
            className="bg-green-500 text-white font-bold px-4 rounded-xl shadow-lg flex items-center justify-center shrink-0">
            WA
          </button>
          <button onClick={() => submitOrder(false)} disabled={isSubmitting} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50">
            {isSubmitting ? "Saving..." : editId ? "Update Order" : "Submit Order"}
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => submitOrder(true)} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl border border-gray-200">
            Save Draft
          </button>
          <button onClick={() => alert("Draft management coming soon!")} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl border border-gray-200">
            Open saved drafts
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

export default function CartPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-blue-600">Loading cart...</div>}>
      <CartContent />
    </Suspense>
  );
}