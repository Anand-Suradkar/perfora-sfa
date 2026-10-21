"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../../components/BottomNav";

export default function NewOrderPage() {
  const router = useRouter();
  const [distributors, setDistributors] = useState([]);
  const [stores, setStores] = useState([]);
  const [skus, setSkus] = useState([]);
  
  const [selectedDist, setSelectedDist] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [orderItems, setOrderItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      const isAdmin = auth.currentUser.email === "anand@perforacare.com";

      let distQuery = isAdmin 
        ? query(collection(db, "distributors")) 
        : query(collection(db, "distributors"), where("mapped_SO_emails", "array-contains", auth.currentUser.email));
      const distSnap = await getDocs(distQuery);
      setDistributors(distSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      let storeQuery = isAdmin 
        ? query(collection(db, "stores")) 
        : query(collection(db, "stores"), where("SO_email", "==", auth.currentUser.email));
      const storeSnap = await getDocs(storeQuery);
      setStores(storeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const skuSnap = await getDocs(collection(db, "sku_master"));
      setSkus(skuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, []);

  const filteredStores = stores.filter(s => s.distributor_id === selectedDist);

  const addItem = () => {
    setOrderItems([...orderItems, { sku: "", qty: 1, extraScheme: 0 }]);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...orderItems];
    newItems[index][field] = value;
    setOrderItems(newItems);
  };

  const removeItem = (index) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  // --- EXACT MATH LOGIC FROM APPS SCRIPT `calc_` & `billingDiscountPct_` ---
  const calculateLineData = (skuId, qty, extraSchemePercent) => {
    const skuData = skus.find(s => s.sku === skuId);
    if (!skuData) return { net: 0, claim: 0, mrp: 0, baseExGst: 0 };

    const mrp = Number(skuData.mrp);
    const gst = Number(skuData.gst) || 0;
    const fixedMarginPct = 25; // Your fixed margin
    
    // 1. Calculate Fixed SKU billing rate (ex GST)
    const fixedRateExGst = (mrp * (100 - fixedMarginPct) / 100) / (1 + gst / 100);
    
    // 2. Convert market scheme to billing discount (e.g., 5% -> 6.66%)
    const billingDiscountPct = extraSchemePercent > 0 
      ? Math.floor((extraSchemePercent * 100 / (100 - fixedMarginPct)) * 100 + 1e-8) / 100
      : 0;
      
    // 3. Invoice base ex GST
    const invoiceBaseExGst = fixedRateExGst * qty;
    
    // 4. Discount amount (ex GST)
    const discountExGst = invoiceBaseExGst * (billingDiscountPct / 100);
    
    // 5. Taxable value & Tax
    const taxable = invoiceBaseExGst - discountExGst;
    const tax = taxable * (gst / 100);
    
    // 6. Final Net Value (incl GST)
    const net = taxable + tax;
    
    // 7. Claim value (Discount + GST on discount)
    const claim = discountExGst * (1 + gst / 100);

    return {
      mrp: mrp * qty,
      baseExGst: invoiceBaseExGst.toFixed(2),
      net: net.toFixed(2),
      claim: claim.toFixed(2)
    };
  };

  const grandTotal = orderItems.reduce((acc, item) => acc + Number(calculateLineData(item.sku, item.qty, item.extraScheme).net), 0);
  const totalClaim = orderItems.reduce((acc, item) => acc + Number(calculateLineData(item.sku, item.qty, item.extraScheme).claim), 0);

  const submitOrder = async () => {
    if (!selectedDist || !selectedStore || orderItems.length === 0) {
      alert("Please select Distributor, Store, and add at least one item.");
      return;
    }

    setIsSubmitting(true);
    try {
      const finalItems = orderItems.map(item => {
        const data = calculateLineData(item.sku, item.qty, item.extraScheme);
        const skuData = skus.find(s => s.sku === item.sku);
        return {
          sku: item.sku,
          skuName: skuData.name,
          qty: item.qty,
          extraScheme: item.extraScheme,
          mrp: skuData.mrp,
          net: Number(data.net),
          claim: Number(data.claim)
        };
      });

      await addDoc(collection(db, "orders"), {
        SO_email: auth.currentUser.email,
        distributor_id: selectedDist,
        store_id: selectedStore,
        items: finalItems,
        grand_total: grandTotal,
        total_claim: totalClaim,
        status: "SUBMITTED",
        createdAt: serverTimestamp()
      });
      
      alert("Order submitted successfully!");
      router.push("/orders"); 
      
    } catch (error) {
      console.error(error);
      alert("Error submitting order");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-20">
      <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">New Order</h1>
        <button onClick={() => router.push("/orders")} className="text-sm font-bold text-gray-500">Cancel</button>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">Distributor</label>
            <select 
              className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 font-medium"
              value={selectedDist} 
              onChange={(e) => { setSelectedDist(e.target.value); setSelectedStore(""); }}
            >
              <option value="">Select Distributor...</option>
              {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">Store</label>
            <select 
              className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 font-medium"
              value={selectedStore} 
              onChange={(e) => setSelectedStore(e.target.value)}
              disabled={!selectedDist}
            >
              <option value="">Select Store...</option>
              {filteredStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Order Items</h3>
          
          {orderItems.map((item, index) => {
            const calc = calculateLineData(item.sku, item.qty, item.extraScheme);
            return (
              <div key={index} className="mb-4 p-3 bg-purple-50 rounded-xl relative border border-purple-100">
                <button onClick={() => removeItem(index)} className="absolute top-2 right-2 text-red-400 font-bold text-xs">✕</button>
                
                <label className="text-[10px] font-bold text-gray-500">SKU</label>
                <select 
                  className="w-full p-2 mb-2 border border-gray-200 rounded-lg text-sm bg-white"
                  value={item.sku} 
                  onChange={(e) => updateItem(index, "sku", e.target.value)}
                >
                  <option value="">Select SKU...</option>
                  {skus.map(s => <option key={s.sku} value={s.sku}>{s.name} (₹{s.mrp})</option>)}
                </select>

                <div className="flex gap-2">
                  <div className="w-1/2">
                    <label className="text-[10px] font-bold text-gray-500">Qty</label>
                    <input 
                      type="number" min="1" 
                      className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                      value={item.qty} 
                      onChange={(e) => updateItem(index, "qty", Number(e.target.value))} 
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="text-[10px] font-bold text-gray-500">Extra Scheme</label>
                    <select 
                      className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
                      value={item.extraScheme} 
                      onChange={(e) => updateItem(index, "extraScheme", Number(e.target.value))}
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={10}>10%</option>
                    </select>
                  </div>
                </div>

                <div className="mt-2 text-right border-t border-purple-200 pt-2">
                  <div className="text-[10px] text-gray-500 font-bold">Base (ex GST): ₹{calc.baseExGst}</div>
                  <div className="text-[10px] text-purple-600 font-bold">Claim (incl GST): ₹{calc.claim}</div>
                  <div className="text-xs font-black text-purple-700 mt-1">Net Total: ₹{calc.net}</div>
                </div>
              </div>
            );
          })}

          <button 
            onClick={addItem}
            className="w-full py-2 border-2 border-dashed border-purple-300 text-purple-600 font-bold rounded-xl text-sm hover:bg-purple-50"
          >
            + Add SKU
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500 font-bold">Grand Total (Incl GST)</p>
            <p className="text-xl font-black text-gray-900">₹{grandTotal.toFixed(2)}</p>
            <p className="text-xs text-purple-600 font-bold mt-1">Total Claim: ₹{totalClaim.toFixed(2)}</p>
          </div>
          <button 
            onClick={submitOrder}
            disabled={isSubmitting}
            className="bg-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Submit"}
          </button>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}