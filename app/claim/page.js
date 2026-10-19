"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import BottomNav from "../components/BottomNav";

export default function ClaimPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClaims = async () => {
      if (!auth.currentUser) return;
      try {
        // 1. Get all SKUs to find MRP
        const skuSnap = await getDocs(collection(db, "sku_master"));
        const skuMap = {};
        skuSnap.docs.forEach(doc => { skuMap[doc.data().sku] = doc.data().mrp; });

        // 2. Get all Orders for this user
        const q = query(collection(db, "orders"), where("SO_email", "==", auth.currentUser.email));
        const orderSnap = await getDocs(q);
        
        let allClaims = [];
        
        // 3. Calculate Claim (MRP * Qty * Extra%)
        orderSnap.docs.forEach(doc => {
          const order = doc.data();
          order.items.forEach(item => {
            if (item.extraScheme > 0 && skuMap[item.sku]) {
              const claimValue = skuMap[item.sku] * item.qty * (item.extraScheme / 100);
              allClaims.push({
                date: new Date(order.createdAt.toMillis()).toLocaleDateString(),
                store: order.store_id,
                sku: item.sku,
                qty: item.qty,
                scheme: item.extraScheme,
                claimValue: claimValue.toFixed(2)
              });
            }
          });
        });
        setClaims(allClaims);
      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    };
    fetchClaims();
  }, []);

  const totalClaim = claims.reduce((acc, curr) => acc + Number(curr.claimValue), 0);

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-20">
      <div className="bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">Claim Dashboard</h1>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="bg-gradient-to-r from-orange-400 to-red-500 p-5 rounded-2xl shadow-lg text-white">
          <p className="text-sm font-bold opacity-90">Total Claim Value</p>
          <h2 className="text-3xl font-black mt-1">₹ {totalClaim.toFixed(2)}</h2>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 p-3 border-b border-gray-100 grid grid-cols-4 text-[10px] font-bold text-gray-500 uppercase">
            <div>SKU</div>
            <div className="text-center">Qty</div>
            <div className="text-center">Scheme</div>
            <div className="text-right">Claim</div>
          </div>
          
          {loading ? <p className="p-4 text-center text-sm text-gray-500">Calculating...</p> : 
           claims.length === 0 ? <p className="p-4 text-center text-sm text-gray-500">No extra schemes given yet.</p> :
           claims.map((c, i) => (
            <div key={i} className="grid grid-cols-4 p-3 border-b border-gray-50 text-sm items-center">
              <div className="font-bold text-gray-800">{c.sku}</div>
              <div className="text-center text-gray-600">{c.qty}</div>
              <div className="text-center font-bold text-orange-500">{c.scheme}%</div>
              <div className="text-right font-bold text-gray-900">₹{c.claimValue}</div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}