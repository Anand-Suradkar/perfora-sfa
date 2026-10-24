"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import BottomNav from "../components/BottomNav";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [visits, setVisits] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterDist, setFilterDist] = useState("ALL");
  const [filterSO, setFilterSO] = useState("ALL");
  const [distributors, setDistributors] = useState([]);
  const [soList, setSoList] = useState([]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (!u) { router.push("/"); return; }

      try {
        await setDoc(doc(db, "users", u.email), {
          email: u.email,
          name: u.displayName || u.email.split('@')[0],
          role: u.email === "anand@perforacare.com" ? "Admin" : "SO"
        }, { merge: true });
      } catch (e) {}

      setUser(u);

      try {
        const isAdmin = u.email === "anand@perforacare.com";

        const distSnap = await getDocs(collection(db, "distributors"));
        setDistributors(distSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // FIX #1: Fetch all users for the dropdown to ensure no one is missing
        const usersSnap = await getDocs(collection(db, "users"));
        setSoList(usersSnap.docs.map(u => u.data()));

        const orderQ = isAdmin ? query(collection(db, "orders")) : query(collection(db, "orders"), where("SO_email", "==", u.email));
        const orderSnap = await getDocs(orderQ);
        setOrders(orderSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const visitQ = isAdmin ? query(collection(db, "visits")) : query(collection(db, "visits"), where("SO_email", "==", u.email));
        const visitSnap = await getDocs(visitQ);
        setVisits(visitSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const storeQ = isAdmin ? query(collection(db, "stores")) : query(collection(db, "stores"), where("SO_email", "==", u.email));
        const storeSnap = await getDocs(storeQ);
        setStores(storeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (error) {}
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading || !user) return <div className="p-10 text-center font-bold text-[#2A6080]">Loading Dashboard...</div>;

  const hr = new Date().getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const username = user.email.split('@')[0];

  const currentMonth = filterDate.slice(0, 7);
  let ftdCalls = 0, mtdCalls = 0, ftdSec = 0, mtdSec = 0, productiveCalls = 0;
  let totalQty = 0, totalSkus = 0;
  let ftdNewStores = 0, mtdNewStores = 0;
  let focusFtdQty = 0, focusMtdQty = 0; // For Tracking specific category (e.g. Toothpaste)
  
  const storeTotals = {};
  const categoryTotals = {};

  const filteredOrders = orders.filter(o => {
    if (!o.createdAt) return false;
    const d = new Date(o.createdAt.toMillis()).toISOString().split('T')[0];
    const oMonth = d.slice(0, 7);
    if (oMonth !== currentMonth) return false;
    if (filterDist !== "ALL" && o.distributor_id !== filterDist) return false;
    if (filterSO !== "ALL" && o.SO_email !== filterSO) return false;
    return true;
  });

  filteredOrders.forEach(order => {
    const orderDate = new Date(order.createdAt.toMillis()).toISOString().split('T')[0];
    const orderValue = Number(order.grand_total) || 0;
    if (orderDate === filterDate) ftdSec += orderValue;
    mtdSec += orderValue;
    totalSkus += order.items.length;
    order.items.forEach(item => {
      totalQty += item.qty;
      const cat = item.category || "Other";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(item.net || 0);
      
      // Track specific Category Qty (e.g., Toothpaste)
      if (cat.toLowerCase().includes("toothpaste")) {
        if (orderDate === filterDate) focusFtdQty += item.qty;
        focusMtdQty += item.qty;
      }
    });
    storeTotals[order.storeName || order.store_id] = (storeTotals[order.storeName || order.store_id] || 0) + orderValue;
  });

  const filteredVisits = visits.filter(v => {
    if (!v.checkInTime) return false;
    const d = new Date(v.checkInTime.toMillis()).toISOString().split('T')[0];
    if (filterSO !== "ALL" && v.SO_email !== filterSO) return false;
    return d.slice(0, 7) === currentMonth;
  });

  filteredVisits.forEach(v => {
    const visitDate = new Date(v.checkInTime.toMillis()).toISOString().split('T')[0];
    if (visitDate === filterDate) ftdCalls++;
    mtdCalls++;
    if (v.status === "COMPLETED") productiveCalls++;
  });

  const lpc = mtdCalls > 0 ? (totalSkus / mtdCalls).toFixed(1) : 0;
  const topStores = Object.entries(storeTotals).sort((a, b) => b[1] - a[1]).slice(0, 10);
  
  stores.forEach(s => {
    if (!s.createdAt) return;
    if (filterDist !== "ALL" && s.distributor_id !== filterDist) return;
    if (filterSO !== "ALL" && s.SO_email !== filterSO) return;
    
    const created = s.createdAt.toMillis ? new Date(s.createdAt.toMillis()) : new Date(s.createdAt);
    if (created.toISOString().slice(0, 7) === currentMonth) {
      mtdNewStores++;
      if (created.toISOString().split('T')[0] === filterDate) ftdNewStores++;
    }
  });

  const catTotalValue = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  // Colors for Top 10
  const topColors = ['bg-[#E05C1A]', 'bg-[#F5C840] text-gray-900', 'bg-[#8BC44A]', 'bg-[#2A6080]', 'bg-purple-600', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-400', 'bg-gray-400'];

  return (
    <div className="min-h-screen pb-20">
      <div className="bg-gradient-to-r from-[#2A6080] to-[#1E455C] p-4 rounded-b-3xl shadow-lg text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black">Dashboard</h1>
            <p className="text-sm opacity-90 mt-1">{greeting}, {username}!</p>
            <p className="text-xs opacity-75 mt-0.5">{new Date().toDateString()}</p>
          </div>
          <div className="flex gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">🔔</div>
            <div className="w-8 h-8 bg-white text-[#2A6080] rounded-full flex items-center justify-center font-bold">AS</div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto -mt-4">
        <div className="bg-white p-4 rounded-3xl shadow-md border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Dashboard filters</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">SALES PERSON</label>
              <select className="w-full p-2 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium" value={filterSO} onChange={(e) => setFilterSO(e.target.value)}>
                <option value="ALL">Whole team</option>
                {soList.map(so => <option key={so.email} value={so.email}>{so.name || so.email.split('@')[0]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">DISTRIBUTOR</label>
              <select className="w-full p-2 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium" value={filterDist} onChange={(e) => setFilterDist(e.target.value)}>
                <option value="ALL">All distributors</option>
                {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">DATE (FTD CARDS)</label>
              <input type="date" className="w-full p-2 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">QUARTER (CATEGORY)</label>
              <select className="w-full p-2 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium"><option>OND-2026</option></select>
            </div>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#2A6080] p-4 rounded-3xl shadow-sm text-white">
            <p className="text-xs font-bold flex items-center gap-1">📍 FTD Calls</p>
            <h2 className="text-3xl font-black mt-1">{ftdCalls}</h2>
          </div>
          <div className="bg-[#F5E8C8] p-4 rounded-3xl shadow-sm border border-[#e6d5af] text-gray-800">
            <p className="text-xs font-bold flex items-center gap-1">🗓️ MTD Calls</p>
            <h2 className="text-3xl font-black mt-1">{mtdCalls}</h2>
          </div>
          <div className="bg-[#E05C1A] p-4 rounded-3xl shadow-sm text-white">
            <p className="text-xs font-bold flex items-center gap-1">🎯 FTD Sec</p>
            <h2 className="text-2xl font-black mt-1">₹{ftdSec.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h2>
          </div>
          <div className="bg-[#F5C840] p-4 rounded-3xl shadow-sm text-gray-900">
            <p className="text-xs font-bold flex items-center gap-1">📈 MTD Sec</p>
            <h2 className="text-2xl font-black mt-1">₹{mtdSec.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h2>
          </div>
        </div>

        {/* FIX #2 & #3: Productive/LPC Combined + New Stores Moved Up */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#8BC44A] p-4 rounded-3xl shadow-sm text-white col-span-2 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold flex items-center gap-1">✅ Productive</p>
              <h2 className="text-3xl font-black mt-1">{productiveCalls}</h2>
            </div>
            <div className="border-l border-white/30 pl-4 h-full flex flex-col justify-center">
              <p className="text-xs font-bold flex items-center gap-1">🔢 Avg LPC</p>
              <h2 className="text-3xl font-black mt-1">{lpc}</h2>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
           <div className="bg-[#E05C1A] p-4 rounded-3xl shadow-sm text-white col-span-2 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold flex items-center gap-1">🏬 New Stores (FTD)</p>
              <h2 className="text-2xl font-black mt-1">{ftdNewStores}</h2>
            </div>
            <div className="border-l border-white/30 pl-6 h-full flex flex-col justify-center">
              <p className="text-xs font-bold flex items-center gap-1">🏬 New Stores (MTD)</p>
              <h2 className="text-2xl font-black mt-1">{mtdNewStores}</h2>
            </div>
          </div>
        </div>

        {/* FIX #3: Specific Category Tracking (like Purple Toothpaste) */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">Toothpaste Performance</h3>
          <div className="grid grid-cols-2 gap-3 mt-3">
             <div className="bg-[#F5E8C8] p-3 rounded-xl border border-[#e6d5af]">
                <p className="text-[10px] font-bold text-gray-600">FTD Qty Sold</p>
                <p className="text-lg font-black text-gray-900">{focusFtdQty}</p>
             </div>
             <div className="bg-[#F5E8C8] p-3 rounded-xl border border-[#e6d5af]">
                <p className="text-[10px] font-bold text-gray-600">MTD Qty Sold</p>
                <p className="text-lg font-black text-gray-900">{focusMtdQty}</p>
             </div>
          </div>
        </div>

        {/* Category Table */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mt-4">
          <h3 className="text-sm font-bold text-gray-800 mb-2">Category-wise contribution</h3>
          <div className="w-full text-xs">
            <div className="flex font-bold text-gray-400 mb-2 border-b pb-1">
              <div className="flex-1 text-left">CATEGORY</div>
              <div className="w-12 text-right">QTY</div>
              <div className="w-16 text-right">VALUE</div>
              <div className="w-16 text-right">CONTRIB.</div>
            </div>
            {sortedCats.map(([cat, val], i) => (
              <div key={i} className="flex text-gray-700 font-medium mb-1.5 items-center">
                <div className="flex-1 text-left font-bold text-gray-900">{cat}</div>
                <div className="w-12 text-right">{(val / 100).toFixed(0)}</div>
                <div className="w-16 text-right">₹{(val/1000).toFixed(1)}K</div>
                <div className="w-16 text-right text-gray-500">{((val / catTotalValue) * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* FIX #4: Top 10 Stores All Colored */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Top 10 stores</h3>
          {topStores.length === 0 ? <p className="text-xs text-gray-400">No orders yet.</p> : 
            topStores.map(([storeName, total], index) => (
              <div key={storeName} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${topColors[index]}`}>
                    {index + 1}
                  </div>
                  <p className="text-xs font-bold text-gray-900">{storeName}</p>
                </div>
                <span className="text-xs font-black text-gray-900">₹{total.toLocaleString()}</span>
              </div>
            ))
          }
        </div>
      </div>
      <BottomNav />
    </div>
  );
}