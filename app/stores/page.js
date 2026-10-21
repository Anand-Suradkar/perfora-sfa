"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";

export default function StoresPage() {
  const router = useRouter();
  const [stores, setStores] = useState([]);
  const [visits, setVisits] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      
      try {
        const isAdmin = user.email === "anand@perforacare.com";
        
        // Fetch Stores
        const storeQ = isAdmin 
          ? query(collection(db, "stores")) 
          : query(collection(db, "stores"), where("SO_email", "==", user.email));
        const storeSnap = await getDocs(storeQ);
        setStores(storeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch Today's Visits
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const visitQ = isAdmin
          ? query(collection(db, "visits"))
          : query(collection(db, "visits"), where("SO_email", "==", user.email));
        const visitSnap = await getDocs(visitQ);
        
        const visitMap = {};
        visitSnap.docs.forEach(doc => {
          const v = doc.data();
          if (v.checkInTime?.toDate() >= startOfDay) {
            visitMap[v.store_id] = { id: doc.id, status: v.status };
          }
        });
        setVisits(visitMap);

      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCheckIn = async (storeId) => {
    if (!navigator.geolocation) return alert("GPS not supported");
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await addDoc(collection(db, "visits"), {
          store_id: storeId,
          SO_email: auth.currentUser.email,
          checkInTime: serverTimestamp(),
          checkInLat: pos.coords.latitude,
          checkInLng: pos.coords.longitude,
          status: "IN_PROGRESS"
        });
        setVisits(prev => ({ ...prev, [storeId]: { status: "IN_PROGRESS" } }));
      } catch (e) { alert(e.message); }
    }, (err) => alert("GPS error: " + err.message), { enableHighAccuracy: true });
  };

  const totalStores = stores.length;
  const visitedStores = Object.keys(visits).length;
  const pendingStores = totalStores - visitedStores;
  const productiveStores = Object.values(visits).filter(v => v.status === "COMPLETED").length;

  const filteredStores = stores.filter(s => 
    s.name?.toLowerCase().includes(search.toLowerCase()) || 
    s.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-20">
      <div className="bg-gradient-to-r from-teal-800 to-teal-600 p-4 rounded-b-3xl shadow-lg text-white">
        <h1 className="text-2xl font-black">Store visit beat</h1>
        <p className="text-sm opacity-90 mt-1">{new Date().toDateString()}</p>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto -mt-4">
        <div className="bg-white p-2 rounded-2xl shadow-md border border-gray-100 flex items-center gap-2">
          <span className="text-gray-400 pl-2">🔍</span>
          <input 
            type="text" 
            placeholder="Search stores, locality, outlet ID" 
            className="w-full p-2 bg-transparent outline-none text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="bg-green-50 rounded-xl p-2 text-center border border-green-100">
            <p className="text-[10px] font-bold text-green-800">✓ Productive</p>
            <p className="text-lg font-black text-green-600">{productiveStores}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-2 text-center border border-blue-100">
            <p className="text-[10px] font-bold text-blue-800">📍 Visited</p>
            <p className="text-lg font-black text-blue-600">{visitedStores}</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-2 text-center border border-orange-100">
            <p className="text-[10px] font-bold text-orange-800">⏱ Pending</p>
            <p className="text-lg font-black text-orange-600">{pendingStores}</p>
          </div>
          <div className="bg-teal-50 rounded-xl p-2 text-center border border-teal-100">
            <p className="text-[10px] font-bold text-teal-800">🏪 Total</p>
            <p className="text-lg font-black text-teal-600">{totalStores}</p>
          </div>
        </div>

        <h3 className="font-bold text-gray-800 mt-4">Stores to visit today</h3>

        {loading ? <p className="text-center font-bold text-gray-500 mt-10">Loading...</p> : 
         filteredStores.length === 0 ? <p className="text-center font-bold text-gray-500 mt-10">No stores found.</p> :
         filteredStores.slice(0, 50).map(store => {
          const visit = visits[store.id];
          const isCompleted = visit?.status === "COMPLETED";
          const isInProgress = visit?.status === "IN_PROGRESS";

          return (
            <div key={store.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-black text-gray-900 text-lg leading-tight">{store.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{store.locality} {store.city}</p>
                  <p className="text-xs text-gray-400 mt-1">Last order: none yet • {store.distributor_id}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                  isCompleted ? 'bg-green-100 text-green-700' : 
                  isInProgress ? 'bg-blue-100 text-blue-700' : 
                  'bg-orange-100 text-orange-700'
                }`}>
                  {isCompleted ? 'COMPLETED' : isInProgress ? 'IN PROGRESS' : 'PENDING'}
                </span>
              </div>

              <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-50">
                <span className="text-[10px] font-bold text-gray-400">ID: {store.id}</span>
                {!visit ? (
                  <button onClick={() => handleCheckIn(store.id)} className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md">
                    Start visit →
                  </button>
                ) : isInProgress ? (
                  <button onClick={() => router.push("/orders/new")} className="bg-purple-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md">
                    Take Order
                  </button>
                ) : (
                  <button onClick={() => router.push("/orders/new")} className="bg-gray-100 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl border border-gray-200">
                    View Summary
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <BottomNav />
    </div>
  );
}