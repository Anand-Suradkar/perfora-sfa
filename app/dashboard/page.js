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
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Filters State
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterDist, setFilterDist] = useState("ALL");
  const [distributors, setDistributors] = useState([]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (!u) { router.push("/"); return; }
      setUser(u);

      try {
        const isAdmin = u.email === "anand@perforacare.com";

        // Fetch Distributors for filter dropdown
        const distSnap = await getDocs(collection(db, "distributors"));
        setDistributors(distSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Orders
        const orderQ = isAdmin ? query(collection(db, "orders")) : query(collection(db, "orders"), where("SO_email", "==", u.email));
        const orderSnap = await getDocs(orderQ);
        setOrders(orderSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch Visits
        const visitQ = isAdmin ? query(collection(db, "visits")) : query(collection(db, "visits"), where("SO_email", "==", u.email));
        const visitSnap = await getDocs(visitQ);
        setVisits(visitSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch Stores (for New Stores count)
        const storeQ = isAdmin ? query(collection(db, "stores")) : query(collection(db, "stores"), where("SO_email", "==", u.email));
        const storeSnap = await getDocs(storeQ);
        setStores(storeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading || !user) return <div className="p-10 text-center font-bold text-blue-600">Loading Dashboard...</div>;

  // --- CALCULATIONS ---
  const today = new Date().toDateString();
  const currentMonth = filterMonth; // e.g., "2026-10"

  let ftdCalls = 0, mtdCalls = 0, ftdSec = 0, mtdSec = 0, productiveCalls = 0;
  let totalQty = 0, totalSkus = 0;
  const storeTotals = {};
  const categoryTotals = {};

  // Filter orders based on dropdown
  const filteredOrders = orders.filter(o => {
    const d = o.createdAt ? new Date(o.createdAt.toMillis()) : new Date();
    const oMonth = d.toISOString().slice(0, 7);
    const distMatch = filterDist === "ALL" || o.distributor_id === filterDist;
    return oMonth === currentMonth && distMatch;
  });

  filteredOrders.forEach(order => {
    const orderDate = order.createdAt ? new Date(order.createdAt.toMillis()) : new Date();
    const orderValue = Number(order.grand_total) || 0;
    
    if (orderDate.toDateString() === today) ftdSec += orderValue;
    mtdSec += orderValue;

    totalSkus += order.items.length;
    order.items.forEach(item => {
      totalQty += item.qty;
      const cat = item.category || "Other";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(item.net || 0);
    });

    storeTotals[order.store_id] = (storeTotals[order.store_id] || 0) + orderValue;
  });

  // Filter visits
  const filteredVisits = visits.filter(v => {
    const d = v.checkInTime ? new Date(v.checkInTime.toMillis()) : new Date();
    const vMonth = d.toISOString().slice(0, 7);
    return vMonth === currentMonth;
  });

  filteredVisits.forEach(v => {
    const visitDate = new Date(v.checkInTime.toMillis());
    if (visitDate.toDateString() === today) ftdCalls++;
    mtdCalls++;
    if (v.status === "COMPLETED") productiveCalls++;
  });

  const lpc = mtdCalls > 0 ? (totalSkus / mtdCalls).toFixed(1) : 0;
  const topStores = Object.entries(storeTotals).sort((a, b) => b[1] - a[1]).slice(0, 10);
  
  // New Stores this month
  const newStoresCount = stores.filter(s => {
    if (filterDist !== "ALL" && s.distributor_id !== filterDist) return false;
    const created = s.createdAt ? new Date(s.createdAt.toMillis()) : new Date();
    return created.toISOString().slice(0, 7) === currentMonth;
  }).length;

  const targetMTD = 500000; // Hardcoded for now, will add to Admin settings later
  const achPct = ((mtdSec / targetMTD) * 100).toFixed(1);

  // Category sorting
  const catTotalValue = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-20">
      
      {/* Blue Header */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 p-4 rounded-b-3xl shadow-lg text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black">Dashboard</h1>
            <p className="text-sm opacity-90 mt-1">Good afternoon, {user.email.split('@')[0]}!</p>
            <p className="text-xs opacity-75 mt-0.5">{new Date().toDateString()}</p>
          </div>
          <div className="flex gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">🔔</div>
            <div className="w-8 h-8 bg-white text-blue-800 rounded-full flex items-center justify-center font-bold">AS</div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto -mt-4">
        
        {/* Filters Card */}
        <div className="bg-white p-4 rounded-3xl shadow-md border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Dashboard filters</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">SALES PERSON</label>
              <select className="w-full p-2 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium">
                <option>Whole team</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">DISTRIBUTOR</label>
              <select 
                className="w-full p-2 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium"
                value={filterDist} onChange={(e) => setFilterDist(e.target.value)}
              >
                <option value="ALL">All distributors</option>
                {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">MONTH (MTD CARDS)</label>
              <input 
                type="month" 
                className="w-full p-2 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium"
                value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">QUARTER (CATEGORY)</label>
              <select className="w-full p-2 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium">
                <option>OND-2026</option>
              </select>
            </div>
          </div>
        </div>

        {/* Colorful KPI Cards Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-100 p-4 rounded-3xl shadow-sm border border-blue-200 text-blue-900">
            <p className="text-xs font-bold flex items-center gap-1">📍 FTD Calls Made</p>
            <h2 className="text-3xl font-black mt-1">{ftdCalls}</h2>
            <p className="text-[10px] mt-1 font-medium opacity-80">Visits recorded today</p>
          </div>
          <div className="bg-purple-100 p-4 rounded-3xl shadow-sm border border-purple-200 text-purple-900">
            <p className="text-xs font-bold flex items-center gap-1">🗓️ MTD Calls Made</p>
            <h2 className="text-3xl font-black mt-1">{mtdCalls}</h2>
            <p className="text-[10px] mt-1 font-medium opacity-80">Calls in {filterMonth}</p>
          </div>
          <div className="bg-orange-100 p-4 rounded-3xl shadow-sm border border-orange-200 text-orange-900">
            <p className="text-xs font-bold flex items-center gap-1">🎯 FTD Secondary</p>
            <h2 className="text-2xl font-black mt-1">₹{ftdSec.toLocaleString()}</h2>
            <p className="text-[10px] mt-1 font-medium opacity-80">{filteredOrders.length} orders today</p>
          </div>
          <div className="bg-teal-100 p-4 rounded-3xl shadow-sm border border-teal-200 text-teal-900">
            <p className="text-xs font-bold flex items-center gap-1">📈 MTD Secondary</p>
            <h2 className="text-2xl font-black mt-1">₹{mtdSec.toLocaleString()}</h2>
            <p className="text-[10px] mt-1 font-medium opacity-80">{filteredOrders.length} orders in month</p>
          </div>
          <div className="bg-green-100 p-4 rounded-3xl shadow-sm border border-green-200 text-green-900 flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold flex items-center gap-1">✅ Productive</p>
              <h2 className="text-3xl font-black mt-1">{productiveCalls}</h2>
            </div>
            <p className="text-[10px] mt-1 font-medium opacity-80">FTD calls</p>
          </div>
          <div className="bg-green-50 p-4 rounded-3xl shadow-sm border border-green-100 text-green-900 flex flex-col justify-between">
            <div>
              <p className="text-xs font-bold flex items-center gap-1">🔢 Average LPC</p>
              <h2 className="text-3xl font-black mt-1">{lpc}</h2>
            </div>
            <p className="text-[10px] mt-1 font-medium opacity-80">SKU lines / call</p>
          </div>
          <div className="bg-pink-100 p-4 rounded-3xl shadow-sm border border-pink-200 text-pink-900 col-span-2">
            <p className="text-xs font-bold flex items-center gap-1">🏬 New stores</p>
            <h2 className="text-3xl font-black mt-1">{newStoresCount}</h2>
            <p className="text-[10px] mt-1 font-medium opacity-80">Added this month</p>
          </div>
        </div>

        {/* Category Contribution Table */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mt-4">
          <h3 className="text-sm font-bold text-gray-800 mb-2">Category-wise contribution</h3>
          <p className="text-[10px] text-gray-500 mb-3">OND-2026 • All assigned distributors</p>
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
            <div className="flex font-black text-gray-900 mt-2 pt-2 border-t">
              <div className="flex-1 text-left">Total</div>
              <div className="w-12 text-right">{totalQty}</div>
              <div className="w-16 text-right">₹{(catTotalValue/1000).toFixed(1)}K</div>
              <div className="w-16 text-right">100.0%</div>
            </div>
          </div>
        </div>

        {/* Target vs Ach */}
        <div className="bg-green-50 p-4 rounded-3xl shadow-sm border border-green-100">
          <h3 className="text-sm font-bold text-gray-800 mb-2">Target vs Ach</h3>
          <div className="flex justify-between text-xs font-bold text-gray-600 mb-2">
            <span>MTD Tgt ₹{targetMTD.toLocaleString()}</span>
            <span>MTD Ach ₹{mtdSec.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, Number(achPct))}%` }}></div>
          </div>
          <p className="text-xs font-bold text-green-700">{achPct}% MTD Ach • ₹{(targetMTD - mtdSec).toLocaleString()} to target</p>
        </div>

        {/* Top 10 Stores */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-gray-800">Top 10 stores</h3>
            <span className="text-xs font-bold text-blue-600">MTD</span>
          </div>
          {topStores.length === 0 ? <p className="text-xs text-gray-400">No orders yet.</p> : 
            topStores.map(([storeId, total], index) => (
              <div key={storeId} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white
                    ${index === 0 ? 'bg-blue-600' : index === 1 ? 'bg-green-500' : index === 2 ? 'bg-orange-500' : index === 3 ? 'bg-red-500' : index === 4 ? 'bg-purple-600' : 'bg-gray-400'}`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">{storeId}</p>
                    <p className="text-[10px] text-gray-500">1 orders • qty 10</p>
                  </div>
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