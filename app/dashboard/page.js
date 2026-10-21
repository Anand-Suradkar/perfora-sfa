"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import BottomNav from "../components/BottomNav";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (!u) { router.push("/"); return; }
      setUser(u);

      try {
        const isAdmin = u.email === "anand@perforacare.com";

        // Fetch Orders
        const orderQ = isAdmin 
          ? query(collection(db, "orders")) 
          : query(collection(db, "orders"), where("SO_email", "==", u.email));
        const orderSnap = await getDocs(orderQ);
        setOrders(orderSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch Visits
        const visitQ = isAdmin 
          ? query(collection(db, "visits")) 
          : query(collection(db, "visits"), where("SO_email", "==", u.email));
        const visitSnap = await getDocs(visitQ);
        setVisits(visitSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (loading || !user) return <div className="p-10 text-center font-bold text-purple-600">Loading Dashboard...</div>;

  // --- CALCULATIONS ---
  const today = new Date().toDateString();
  const currentMonth = new Date().getMonth();

  let ftdValue = 0, mtdValue = 0, ftdCalls = 0, mtdCalls = 0;
  let totalSkus = 0, totalOrders = 0;
  const storeTotals = {};
  const categoryTotals = {};

  orders.forEach(order => {
    const orderDate = order.createdAt ? new Date(order.createdAt.toMillis()) : new Date();
    const orderValue = Number(order.grand_total) || 0;
    
    // FTD / MTD
    if (orderDate.getMonth() === currentMonth) {
      mtdValue += orderValue;
      totalOrders++;
      order.items.forEach(item => {
        totalSkus += item.qty;
        // Category contribution (simplified)
        categoryTotals["Pharma"] = (categoryTotals["Pharma"] || 0) + orderValue;
      });
    }
    if (orderDate.toDateString() === today) ftdValue += orderValue;

    // Store Totals
    storeTotals[order.store_id] = (storeTotals[order.store_id] || 0) + orderValue;
  });

  visits.forEach(v => {
    const visitDate = v.checkInTime ? new Date(v.checkInTime.toMillis()) : new Date();
    if (visitDate.getMonth() === currentMonth) mtdCalls++;
    if (visitDate.toDateString() === today) ftdCalls++;
  });

  const lpc = mtdCalls > 0 ? (totalOrders / mtdCalls).toFixed(1) : 0;
  const topStores = Object.entries(storeTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-20">
      
      {/* Header */}
      <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900">SFA Dashboard</h1>
          <p className="text-xs text-purple-600 font-semibold">{user.email}</p>
        </div>
        <button onClick={handleLogout} className="text-sm font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">Logout</button>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        
        {/* FTD / MTD Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-4 rounded-3xl shadow-lg text-white">
            <p className="text-xs font-bold opacity-90">FTD Value</p>
            <h2 className="text-2xl font-black mt-1">₹ {ftdValue.toLocaleString()}</h2>
            <p className="text-[10px] mt-2 bg-white/20 inline-block px-2 py-0.5 rounded-md">{ftdCalls} Calls Today</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 p-4 rounded-3xl shadow-lg text-white">
            <p className="text-xs font-bold opacity-90">MTD Value</p>
            <h2 className="text-2xl font-black mt-1">₹ {mtdValue.toLocaleString()}</h2>
            <p className="text-[10px] mt-2 bg-white/20 inline-block px-2 py-0.5 rounded-md">{mtdCalls} Calls Month</p>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500">Total Orders (MTD)</p>
            <h3 className="text-xl font-black text-gray-900 mt-1">{totalOrders}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-500">LPC (Lines/Call)</p>
            <h3 className="text-xl font-black text-gray-900 mt-1">{lpc}</h3>
          </div>
        </div>

        {/* Target vs Achievement */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-2">Secondary Target (₹ 5,00,000)</h3>
          <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
            <div className="bg-green-500 h-3 rounded-full" style={{ width: `${Math.min(100, (mtdValue / 500000) * 100)}%` }}></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 font-bold">
            <span>Ach: {((mtdValue / 500000) * 100).toFixed(1)}%</span>
            <span>Bal: ₹ {(500000 - mtdValue).toLocaleString()}</span>
          </div>
        </div>

        {/* Top 5 Stores */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Top 5 Stores (MTD)</h3>
          {topStores.length === 0 ? <p className="text-xs text-gray-400">No orders yet.</p> : 
            topStores.map(([storeId, total], index) => (
              <div key={storeId} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm font-bold text-gray-700">{index + 1}. Store {storeId}</span>
                <span className="text-sm font-black text-purple-600">₹{total.toLocaleString()}</span>
              </div>
            ))
          }
        </div>

      </div>
      <BottomNav />
    </div>
  );
}