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
  const [skus, setSkus] = useState({});
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        
        // Fetch SKU Master for Category mapping
        const skuSnap = await getDocs(collection(db, "sku_master"));
        const skuMap = {};
        skuSnap.docs.forEach(doc => { skuMap[doc.data().sku] = doc.data(); });
        setSkus(skuMap);

        // Fetch Orders for this user
        const q = query(collection(db, "orders"), where("SO_email", "==", u.email));
        const snap = await getDocs(q);
        const fetchedOrders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(fetchedOrders);
      } else {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (!user) return <div className="p-10 text-center font-bold text-purple-600">Loading...</div>;

  // --- CALCULATIONS ---
  const today = new Date().toDateString();
  let ftdValue = 0;
  let mtdValue = 0;
  const storeTotals = {};
  const categoryTotals = {};

  orders.forEach(order => {
    const orderDate = order.createdAt ? new Date(order.createdAt.toMillis()) : new Date();
    const orderValue = Number(order.grand_total) || 0;

    // MTD / FTD
    if (orderDate.getMonth() === new Date().getMonth()) mtdValue += orderValue;
    if (orderDate.toDateString() === today) ftdValue += orderValue;

    // Store Totals
    storeTotals[order.store_id] = (storeTotals[order.store_id] || 0) + orderValue;

    // Category Totals
    order.items.forEach(item => {
      const skuData = skus[item.sku];
      if (skuData) {
        const cat = skuData.category;
        categoryTotals[cat] = (categoryTotals[cat] || 0) + orderValue;
      }
    });
  });

  // Top Stores
  const topStores = Object.entries(storeTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-20">
      <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs text-purple-600 font-semibold">{user.email}</p>
        </div>
        <button onClick={handleLogout} className="text-sm font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">Logout</button>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-purple-500 to-purple-700 p-4 rounded-2xl shadow-lg text-white">
            <p className="text-sm opacity-90">FTD Value</p>
            <h2 className="text-2xl font-bold mt-1">₹ {ftdValue.toFixed(2)}</h2>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-4 rounded-2xl shadow-lg text-white">
            <p className="text-sm opacity-90">MTD Value</p>
            <h2 className="text-2xl font-bold mt-1">₹ {mtdValue.toFixed(2)}</h2>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-2">Secondary Target vs Ach</h3>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div className="bg-green-500 h-2.5 rounded-full" style={{ width: mtdValue > 0 ? '15%' : '0%' }}></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 font-medium">
            <span>Target: ₹ 50,000</span>
            <span>Ach: {mtdValue > 0 ? '15%' : '0%'}</span>
          </div>
        </div>

        {/* Category Breakdown (Pie Chart Replacement for now) */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Category Contribution</h3>
          {Object.keys(categoryTotals).length === 0 ? <p className="text-xs text-gray-400">No data yet.</p> : 
            Object.entries(categoryTotals).map(([cat, val]) => (
              <div key={cat} className="mb-2">
                <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                  <span>{cat}</span>
                  <span>₹{val.toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${(val / mtdValue) * 100}%` }}></div>
                </div>
              </div>
            ))
          }
        </div>

        {/* Top Stores */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Top Stores</h3>
          {topStores.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">No orders yet.</p> : 
            topStores.map(([storeId, total], index) => (
              <div key={storeId} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm font-bold text-gray-800">{index + 1}. Store {storeId}</span>
                <span className="text-sm font-black text-purple-600">₹{total}</span>
              </div>
            ))
          }
        </div>

      </div>
      <BottomNav />
    </div>
  );
}