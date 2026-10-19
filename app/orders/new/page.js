"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../../lib/firebase"; // Correct path for the new folder
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../../components/BottomNav"; // Correct path

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

      // 1. Fetch Distributors (Filtered by user unless Admin)
      let distQuery;
      if (isAdmin) {
        distQuery = query(collection(db, "distributors"));
      } else {
        distQuery = query(collection(db, "distributors"), where("mapped_SO_email", "==", auth.currentUser.email));
      }
      const distSnap = await getDocs(distQuery);
      setDistributors(distSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // 2. Fetch Stores (Filtered by user unless Admin)
      let storeQuery;
      if (isAdmin) {
        storeQuery = query(collection(db, "stores"));
      } else {
        storeQuery = query(collection(db, "stores"), where("SO_email", "==", auth.currentUser.email));
      }
      const storeSnap = await getDocs(storeQuery);
      setStores(storeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // 3. Fetch SKUs (Everyone sees all SKUs)
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
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
  };

  const calculateLineTotal = (skuId, qty, extra) => {
    const skuData = skus.find(s => s.sku === skuId);
    if (!skuData) return 0;
    const totalMrp = skuData.mrp * qty;
    const totalDiscount = 0.25 + (extra / 100);
    return (totalMrp * (1 - totalDiscount)).toFixed(2);
  };

  const grandTotal = orderItems.reduce((acc, item) => acc + Number(calculateLineTotal(item.sku, item.qty, item.extraScheme)), 0);

  const submitOrder = async () => {
    if (!selectedDist || !selectedStore || orderItems.length === 0) {
      alert("Please select Distributor, Store, and add at least one item.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "orders"), {
        SO_email: auth.currentUser.email,
        distributor_id: selectedDist,
        store_id: selectedStore,
        items: orderItems,
        grand_total: grandTotal,
        status: "SUBMITTED",
        createdAt: serverTimestamp()
      });
      
      // THIS IS THE MAGIC LINE: Sends you back to the Orders List
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
          
          {orderItems.map((item, index) => (
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

              <div className="mt-2 text-right">
                <span className="text-xs font-bold text-purple-700">Line Total: ₹{calculateLineTotal(item.sku, item.qty, item.extraScheme)}</span>
              </div>
            </div>
          ))}

          <button 
            onClick={addItem}
            className="w-full py-2 border-2 border-dashed border-purple-300 text-purple-600 font-bold rounded-xl text-sm hover:bg-purple-50"
          >
            + Add SKU
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500 font-bold">Grand Total</p>
            <p className="text-xl font-black text-gray-900">₹{grandTotal.toFixed(2)}</p>
          </div>
          <button 
            onClick={submitOrder}
            disabled={isSubmitting}
            className="bg-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Submit Order"}
          </button>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}