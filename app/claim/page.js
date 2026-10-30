"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { loadAppUser } from "../lib/access";
import { isClaimEligibleOrder } from "../lib/claim-eligibility.mjs";
import BottomNav from "../components/BottomNav";

export default function ClaimPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        if (!cancelled) {
          setClaims([]);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) setLoading(true);
      try {
        const profile = await loadAppUser(user, db);
        const email = profile.email;
        const isAdmin = profile.role === "Admin";
        const q = isAdmin
          ? query(collection(db, "orders"))
          : query(collection(db, "orders"), where("SO_email", "==", email));

        const snap = await getDocs(q);
        const allClaims = [];

        snap.docs.forEach((orderDoc) => {
          const order = orderDoc.data();

          // Match Apps Script claim visibility: only Accepted, Invoiced or Dispatched
          // orders contribute claims. Draft, Created, Shared and Cancelled orders do not.
          if (!isClaimEligibleOrder(order)) return;

          order.items.forEach((item) => {
            if (Number(item?.extraScheme) <= 0 || !Number.isFinite(Number(item?.claim))) return;

            const createdAtMs = typeof order.createdAt?.toMillis === "function"
              ? order.createdAt.toMillis()
              : 0;

            allClaims.push({
              orderId: orderDoc.id,
              store: order.storeName || order.store_id || "Unknown store",
              sku: item.sku || "",
              skuName: item.skuName || item.sku || "",
              qty: Number(item.qty) || 0,
              scheme: Number(item.extraScheme) || 0,
              claimValue: Number(item.claim) || 0,
              date: createdAtMs ? new Date(createdAtMs).toLocaleDateString() : "",
              sortTime: createdAtMs,
            });
          });
        });

        allClaims.sort((a, b) => b.sortTime - a.sortTime);
        if (!cancelled) setClaims(allClaims);
      } catch (error) {
        console.error("Could not load claims:", error);
        if (!cancelled) setClaims([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const totalClaim = claims.reduce((acc, curr) => acc + Number(curr.claimValue), 0);

  const exportToCSV = () => {
    const headers = ["Date", "Order ID", "Store", "SKU Code", "SKU Name", "Qty", "Extra Scheme", "Claim Value"];
    const rows = claims.map(c => [
      c.date, c.orderId, c.store, c.sku, c.skuName, c.qty, `${c.scheme}%`, c.claimValue
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Claims_Export_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-20">
      <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Claim Dashboard</h1>
          <p className="text-xs text-purple-600 font-semibold">Extra Scheme Calculations</p>
        </div>
        <button onClick={exportToCSV} className="bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm">
          ⬇ Export CSV
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        
        {/* Total Claim Card */}
        <div className="bg-gradient-to-r from-orange-400 to-red-500 p-6 rounded-3xl shadow-lg text-white">
          <p className="text-sm font-bold opacity-90">Total Claim Value</p>
          <h2 className="text-4xl font-black mt-2">₹ {totalClaim.toFixed(2)}</h2>
          <p className="text-xs mt-2 opacity-80">Calculated from all extra schemes (5% / 10%)</p>
        </div>

        {/* Claims List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 p-3 border-b border-gray-100 grid grid-cols-5 text-[10px] font-bold text-gray-500 uppercase">
            <div className="col-span-2">SKU</div>
            <div className="text-center">Qty</div>
            <div className="text-center">Scheme</div>
            <div className="text-right">Claim</div>
          </div>
          
          {loading ? <p className="p-4 text-center text-sm text-gray-500">Calculating...</p> : 
           claims.length === 0 ? <p className="p-6 text-center text-sm text-gray-500">No extra schemes given yet.</p> :
           claims.map((c, i) => (
            <div key={i} className="grid grid-cols-5 p-3 border-b border-gray-50 text-sm items-center">
              <div className="col-span-2 min-w-0 pr-2">
                <p className="font-bold text-gray-800 truncate">{c.sku}</p>
                <p className="text-[10px] text-gray-500 truncate">{c.store}</p>
              </div>
              <div className="text-center text-gray-600">{c.qty}</div>
              <div className="text-center font-bold text-orange-500">{c.scheme}%</div>
              <div className="text-right font-black text-gray-900">₹{c.claimValue}</div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}