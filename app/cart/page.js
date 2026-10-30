"use client";

import { useState, useEffect, Suspense } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, serverTimestamp, query, where } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "../components/BottomNav";
import { calculateOrderPricing } from "../lib/pricing.mjs";
import { loadAppUser } from "../lib/access";
import { getOrderVisitAction } from "../lib/order-visit.mjs";

function CartContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");

  const [cart, setCart] = useState([]);
  const [skus, setSkus] = useState([]);
  const [context, setContext] = useState({ distId: "", storeId: "" });
  const [storeName, setStoreName] = useState("");
  const [distName, setDistName] = useState("");
  const [soName, setSoName] = useState("");
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
          if(data.SO_email) {
              const uDoc = await getDoc(doc(db, "users", data.SO_email));
              if(uDoc.exists()) setSoName(uDoc.data().name || data.SO_email.split('@')[0]);
          }
        }
      } else {
        const savedCart = JSON.parse(localStorage.getItem("perfora_cart") || "[]");
        const savedContext = JSON.parse(localStorage.getItem("perfora_order_context") || "{}");
        setCart(savedCart);
        cId = savedContext.distId; sId = savedContext.storeId;
        setContext({ distId: cId, storeId: sId });
        
        if (auth.currentUser) {
            const uDoc = await getDoc(doc(db, "users", auth.currentUser.email));
            if(uDoc.exists()) setSoName(uDoc.data().name || auth.currentUser.email.split('@')[0]);
        }
      }

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

  const emptyTotals = {
    qty: 0, mrpTotal: 0, fixedMarginValue: 0, baseExGst: 0,
    schemeBenefit: 0, schemeBenefitExGst: 0, taxableExGst: 0,
    tax: 0, invoiceTotal: 0, skuCount: 0, billingPct: 0,
  };
  let pricing = { lines: [], lineBySku: {}, totals: emptyTotals };
  let pricingError = "";
  try {
    pricing = calculateOrderPricing(cart, skus, scheme);
  } catch (error) {
    // A stale cart or SKU-master change should show an actionable error rather than
    // crash the page during render. Submission is blocked while pricing is invalid.
    pricingError = error?.message || "The cart could not be calculated.";
  }
  const totals = pricing.totals;
  const calculateLineData = (skuId) => pricing.lineBySku[skuId] || {
    net: 0,
    claim: 0,
    baseExGst: 0,
    mrpTotal: 0,
    billingPct: totals.billingPct,
    taxableExGst: 0,
    tax: 0,
    claimExGst: 0,
    fixedRateExGst: 0,
    schemeDiscountExGst: 0,
  };

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

  const syncVisitForOrder = async ({ orderId, isDraft, isEdit }) => {
    if (isDraft) return;
    const email = String(auth.currentUser?.email || "").trim().toLowerCase();
    if (!email) throw new Error("Your sign-in session expired. Please sign in again.");

    const visitQ = query(
      collection(db, "visits"),
      where("store_id", "==", context.storeId),
      where("SO_email", "==", email),
      where("status", "==", "IN_PROGRESS")
    );
    const visitSnap = await getDocs(visitQ);
    const action = getOrderVisitAction({ isDraft, isEdit, hasOpenVisit: !visitSnap.empty });

    if (action === "skip") return;
    if (action === "complete-existing") {
      await updateDoc(doc(db, "visits", visitSnap.docs[0].id), {
        status: "COMPLETED",
        checkOutTime: serverTimestamp(),
        noOrderReason: "",
        updatedAt: serverTimestamp()
      });
      return;
    }

    // Apps Script creates a visit row when an order is submitted without a prior
    // check-in. Keep that parity, and explicitly mark that GPS was not captured.
    const visitRef = await addDoc(collection(db, "visits"), {
      store_id: context.storeId,
      SO_email: email,
      checkInTime: serverTimestamp(),
      status: "IN_PROGRESS",
      order_id: orderId,
      source: "ORDER_SUBMISSION",
      checkInStatus: "No GPS"
    });
    await updateDoc(doc(db, "visits", visitRef.id), {
      status: "COMPLETED",
      checkOutTime: serverTimestamp(),
      noOrderReason: "",
      updatedAt: serverTimestamp()
    });
  };

  const submitOrder = async (isDraft = false) => {
    if (cart.length === 0) return alert("Cart is empty");
    if (pricingError) return alert(`Cannot submit this cart: ${pricingError}`);
    if (!context.storeId) return alert("No outlet selected. Go back to catalogue.");
    
    if (!isDraft) setIsSubmitting(true);

    try {
      if (!auth.currentUser?.email) throw new Error("Please sign in again before submitting the order.");

      const finalItems = cart.map(item => {
        const skuData = skus.find(s => s.sku === item.sku || s.id === item.sku);
        if (!skuData) throw new Error(`SKU ${item.sku} is missing from the SKU master.`);
        const calc = calculateLineData(item.sku);
        return {
          sku: item.sku,
          skuName: skuData.name,
          category: skuData.category || "General",
          gst: calc.gstPercent,
          qty: item.qty,
          extraScheme: scheme,
          mrp: Number(skuData.mrp),
          fixedRateExGst: calc.fixedRateExGst,
          billingDiscountPercent: calc.billingDiscountPercent,
          invoiceBaseExGst: calc.invoiceBaseExGst,
          schemeDiscountExGst: calc.schemeDiscountExGst,
          taxableValueExGst: calc.taxableExGst,
          taxValue: calc.tax,
          net: calc.net,
          claim: calc.claim,
          claimExGst: calc.claimExGst,
        };
      });

      let finalStoreName = storeName;
      if (!finalStoreName) {
         const sDoc = await getDoc(doc(db, "stores", context.storeId));
         if (sDoc.exists()) finalStoreName = sDoc.data().name;
      }

      const orderData = {
        SO_email: auth.currentUser.email.toLowerCase(),
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
        const profile = await loadAppUser(auth.currentUser, db);
        const existingSnap = await getDoc(doc(db, "orders", editId));
        if (!existingSnap.exists()) throw new Error("Order not found. It may have been removed.");
        const existing = existingSnap.data();
        const existingStatus = String(existing.status || "").toUpperCase();
        if (profile.role !== "Admin" && String(existing.SO_email || "").toLowerCase() !== profile.email) {
          throw new Error("You cannot edit another salesperson's order.");
        }
        if (!["CREATED", "SHARED", "ACCEPTED"].includes(existingStatus)) {
          throw new Error(`Order is ${existingStatus || "in an unknown state"} and can no longer be edited.`);
        }
        // Preserve ownership, store/distributor, original status and original creation time.
        // Only calculated order contents may change during an allowed edit.
        await updateDoc(doc(db, "orders", editId), {
          storeName: existing.storeName || finalStoreName || "Unknown Store",
          items: finalItems,
          grand_total: totals.invoiceTotal,
          total_claim: totals.schemeBenefit,
          status: existing.status,
          createdAt: existing.createdAt,
          updatedAt: serverTimestamp()
        });
        if (!isDraft) {
          try {
            await syncVisitForOrder({ orderId: editId, isDraft, isEdit: true });
          } catch (visitError) {
            console.error("Order updated, but visit tracking failed:", visitError);
            alert("The order was updated, but visit tracking could not be completed. Do not resubmit the order. Please return to Orders and report this visit-tracking issue.");
            router.push("/orders");
            setIsSubmitting(false);
            return;
          }
        }
      } else {
        const savedOrderRef = await addDoc(collection(db, "orders"), orderData);
        localStorage.removeItem("perfora_cart");
        localStorage.removeItem("perfora_order_context");

        if (!isDraft) {
          try {
            await syncVisitForOrder({ orderId: savedOrderRef.id, isDraft, isEdit: false });
          } catch (visitError) {
            // The order has already been saved; do not leave the user on the cart where
            // retrying could create a duplicate order.
            console.error("Order saved, but visit tracking failed:", visitError);
            alert("Your order was saved, but visit tracking could not be completed. Do not submit the order again. Please check Orders and report this visit-tracking issue.");
            router.push("/orders");
            setIsSubmitting(false);
            return;
          }
        }
      }
      
      if (isDraft) alert("Draft saved successfully.");
      else router.push("/orders");
      
    } catch (error) {
      console.error("Order save failed:", error);
      alert(error?.message || "Error saving order. Please retry after checking the connection.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#F5E8C8] pb-32">
      <div className="bg-gradient-to-r from-[#2A6080] to-[#1E455C] p-4 rounded-b-3xl shadow-lg text-white">
        <h1 className="text-2xl font-black">Order cart</h1>
        <p className="text-sm opacity-90 mt-1">Review selected SKUs before submission</p>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto -mt-4">
        
        {pricingError && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-sm font-semibold">
            {pricingError} Please return to the catalogue and refresh the SKU selection before submitting.
          </div>
        )}

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{storeName || "No outlet selected"}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{distName || "Select Distributor"} • {soName || "SO"}</p>
          </div>
          <button onClick={() => router.push(`/orders/new?storeId=${context.storeId}&distId=${context.distId}`)} className="text-xs font-bold text-[#2A6080] bg-[#F5E8C8] px-3 py-2 rounded-lg border border-[#e6d5af]">
            ← Catalogue
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-800">Added items</h3>
            <span className="bg-[#2A6080] text-white text-[10px] font-bold px-2 py-1 rounded-full">
              {cart.length} SKU • {cart.reduce((a,b) => a+b.qty, 0)} units
            </span>
          </div>

          {/* VERTICAL LIST (Reverted) */}
          <div className="space-y-3">
            {cart.map(item => {
              const sku = skus.find(s => s.sku === item.sku);
              const calc = calculateLineData(item.sku);
              if (!sku) return null;
              return (
                <div key={item.sku} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl bg-gray-50 relative">
                  <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center text-xl overflow-hidden shrink-0 border border-gray-200">
                    {sku.img ? (
  <img
    src={sku.img}
    alt={sku.name || "Product image"}
    className="w-full h-full object-contain p-1"
  />
) : "📦"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate pr-4">{sku.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Rate: ₹{(calc.baseExGst / item.qty).toFixed(2)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => updateQty(item.sku, -1)} className="w-6 h-6 bg-white border border-gray-200 rounded text-xs font-bold">−</button>
                      <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.sku, 1)} className="w-6 h-6 bg-white border border-gray-200 rounded text-xs font-bold">+</button>
                    </div>
                  </div>
                  <div className="text-right flex flex-col justify-between h-full">
                    <p className="text-sm font-black text-gray-900">₹{calc.net.toFixed(2)}</p>
                    <button onClick={() => updateQty(item.sku, -item.qty)} className="text-[10px] font-bold text-[#E05C1A] mt-2">Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-800">Market scheme (%)</h3>
          </div>
          <input type="number" min="0" max="10" step="1" value={scheme} onChange={e => {
            const value = e.target.value === "" ? 0 : Number(e.target.value);
            setScheme(Number.isFinite(value) ? Math.max(0, Math.min(10, Math.floor(value))) : 0);
          }} className="w-full mt-2 p-2 border border-gray-200 rounded-xl font-black text-center text-lg bg-gray-50" />
          <p className="text-[10px] text-gray-500 mt-2">
            Billing discount: <b>{totals.billingPct}%</b> ({scheme}% market scheme).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3 rounded-xl border border-gray-200 text-center">
            <p className="text-[10px] font-bold text-gray-500">MRP Total</p>
            <p className="text-sm font-black text-gray-900 mt-1">₹{totals.mrpTotal.toFixed(2)}</p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-200 text-center">
            <p className="text-[10px] font-bold text-gray-500">Invoice Total</p>
            <p className="text-sm font-black text-[#2A6080] mt-1">₹{totals.invoiceTotal.toFixed(2)}</p>
          </div>
        </div>

      </div>

      <div className="fixed bottom-16 w-full max-w-md left-1/2 -translate-x-1/2 bg-white p-3 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40 flex flex-col gap-2">
        <div className="flex gap-2">
          <button onClick={() => {
              const tempOrder = { store_id: context.storeId, distributor_id: context.distId, items: cart.map(i => ({...i, skuName: skus.find(s=>s.sku===i.sku)?.name, extraScheme: scheme})), grand_total: totals.invoiceTotal };
              window.open(`https://wa.me/?text=${generateWhatsAppText(tempOrder)}`, '_blank');
            }} 
            className="bg-[#8BC44A] text-white font-bold px-4 rounded-xl shadow-lg flex items-center justify-center shrink-0">
            WA
          </button>
          <button onClick={() => submitOrder(false)} disabled={isSubmitting || Boolean(pricingError) || cart.length === 0} className="flex-1 bg-[#2A6080] text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50">
            {isSubmitting ? "Saving..." : editId ? "Update Order" : "Submit Order"}
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

export default function CartPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-[#2A6080]">Loading cart...</div>}>
      <CartContent />
    </Suspense>
  );
}