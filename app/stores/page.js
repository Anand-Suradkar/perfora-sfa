"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import BottomNav from "../components/BottomNav";

export default function StoresPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      if (!auth.currentUser) return;
      try {
        // Fetch stores belonging to this user
        const q = query(collection(db, "stores"), where("SO_email", "==", auth.currentUser.email));
        const snap = await getDocs(q);
        setStores(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    };
    fetchStores();
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-20">
      <div className="bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">My Stores</h1>
      </div>
      <div className="p-4 space-y-3 max-w-md mx-auto">
        {loading ? <p className="text-center mt-10 text-gray-500">Loading...</p> : 
         stores.length === 0 ? <p className="text-center mt-10 text-gray-500">No stores added yet.</p> :
         stores.map(store => (
          <div key={store.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-800">{store.name}</h3>
              <p className="text-xs text-gray-500">Owner: {store.owner} | Dist: {store.distributor_id}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${store.type === 'NEW' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
              {store.type}
            </span>
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}