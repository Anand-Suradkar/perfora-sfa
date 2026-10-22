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

      // Fetch names for WhatsApp text & saving
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
    if (!skuData) return { net: 0, claim: 0, baseExGst: 0, mrpTotal: 0 };
    const mrp = Number(skuData.mrp), gst = Number(skuData.gst) || 0, fixedMarginPct = 25;
    const fixedRateExGst = (mrp * (100 - fixedMarginPct) / 100) / (1 + gst / 100);
    const billingDiscountPct = extraSchemePercent > 0 ? Math.floor((extraSchemePercent * 100 / (100 - fixedMarginPct)) * 100 + 1e-8) / 100 : 0;
    const invoiceBaseExGst = fixedRateExGst * qty;
    const discountExGst = invoiceBaseExGst * (billingDiscountPct / 100);
    const taxable = invoiceBaseExGst - discountExGst;
    const tax = taxable * (gst / 100);
    const net = taxable + tax;
    const claim = discountExGst * (1 + gst / 100);
    return { net, claim, baseExGst: invoiceBaseExGst, mrpTotal: mrp * qty };
  };

  const grandTotal = cart.reduce((acc, item) => acc + calculateLineData(item.sku, item.qty, scheme).net, 0);
  const totalClaim = cart.reduce((acc, item) => acc + calculateLineData(item.sku, item.qty, scheme).claim, 0);

  const updateQty = (skuId, delta) => {
    let newCart = [...cart];
    const existing = newCart.find(item => item.sku === skuId);
    if (existing) {
      existing.qty += delta;
      if (existing.qty <= 0) newCart = newCart.filter(item => item.sku !== skuId);
    }
    setCart(newCart);
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

  const submitOrder = async () => {
    if (cart.length === 0) return alert("Cart is empty");
    setIsSubmitting(true);

    const finalItems = cart.map(item => {
      const skuData = skus.find(s => s.sku === item.sku);
      const calc = calculateLineData(item.sku, item.qty, scheme);
      return {
        sku: item.sku, skuName: skuData.name, category: skuData.category || "General",
        qty: item.qty, extraScheme: scheme, mrp: skuData.mrp,
        net: Number(calc.net), claim: Number(calc.claim)
      };
    });

    try {
      let finalStoreName = storeName;
      // Fetch store name again just to be 100% sure it's not "Store"
      if (!finalStoreName || finalStoreName === "Store") {
         const sDoc = await getDoc(doc(db, "stores", context.storeId));
         if (sDoc.exists()) finalStoreName = sDoc.data().name;
      }

      const orderData = {
        SO_email: auth.currentUser.email, 
        distributor_id: context.distId, 
        store_id: context.storeId,
        storeName: finalStoreName || "Unknown Store", // Saving the correct name!
        items: finalItems, 
        grand_total: grandTotal, 
        total_claim: totalClaim,
        status: "CREATED", 
        createdAt: serverTimestamp()
      };

      if (editId) {
        await updateDoc(doc(db, "orders", editId), { ...orderData, updatedAt: serverTimestamp() });
      } else {
        await addDoc(collection(db, "orders"), orderData);
        localStorage.removeItem("perfora_cart");
        localStorage.removeItem("perfora_order_context");

        // Mark today's visit as COMPLETED
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
      router.push("/orders");
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
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-gray-800">Added items</h3>
            <button onClick={() => router.push(`/orders/new?storeId=${context.storeId}&distId=${context.distId}`)} className="text-xs font-bold text-blue-600">← Catalogue</button>
          </div>

          {cart.map(item => {
            const sku = skus.find(s => s.sku === item.sku);
            const calc = calculateLineData(item.sku, item.qty, scheme);
            if (!sku) return null;
            return (
              <div key={item.sku} className="flex justify-between items-center py-3 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-50 rounded flex items-center justify-center overflow-hidden">
                    {sku.img ? <img src={sku.img} className="w-full h-full object-contain p-1" /> : "📦"}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">{sku.name}</p>
                    <p className="text-[10px] text-gray-500">Rate ex-GST ₹{(calc.baseExGst / item.qty).toFixed(2)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => updateQty(item.sku, -1)} className="w-5 h-5 bg-gray-100 rounded text-xs">−</button>
                      <span className="text-xs font-bold">{item.qty}</span>
                      <button onClick={() => updateQty(item.sku, 1)} className="w-5 h-5 bg-gray-100 rounded text-xs">+</button>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-gray-900">₹{calc.net.toFixed(2)}</p>
                  <p className="text-[9px] text-gray-400">incl. GST</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-xs font-bold text-gray-800 mb-2">Market scheme (%)</h3>
          <input type="number" min="0" max="10" value={scheme} onChange={e => setScheme(Number(e.target.value))} className="w-full p-2 border rounded-xl font-black text-center" />
          <p className="text-[9px] text-gray-500 mt-2">Applied to fixed SKU rate before GST. Example: 5% → 6.66%</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-blue-50 p-3 rounded-xl text-center">
            <p className="text-[10px] font-bold text-gray-500">MRP Total</p>
            <p className="text-sm font-black text-gray-900">₹{cart.reduce((a,b) => a + calculateLineData(b.sku, b.qty, scheme).mrpTotal, 0).toFixed(2)}</p>
          </div>
          <div className="bg-green-50 p-3 rounded-xl text-center">
            <p className="text-[10px] font-bold text-gray-500">Invoice Total</p>
            <p className="text-sm font-black text-green-700">₹{grandTotal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-16 w-full max-w-md left-1/2 -translate-x-1/2 bg-white p-3 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40 flex gap-2">
        <button onClick={() => {
            const tempOrder = { store_id: context.storeId, distributor_id: context.distId, items: cart.map(i => ({...i, skuName: skus.find(s=>s.sku===i.sku)?.name})), grand_total: grandTotal };
            window.open(`https://wa.me/?text=${generateWhatsAppText(tempOrder)}`, '_blank');
          }} 
          className="bg-green-500 text-white font-bold px-4 rounded-xl shadow-lg flex items-center justify-center">
          WA
        </button>
        <button onClick={submitOrder} disabled={isSubmitting} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg">
          {isSubmitting ? "Saving..." : editId ? "Update Order" : "Submit Order"}
        </button>
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