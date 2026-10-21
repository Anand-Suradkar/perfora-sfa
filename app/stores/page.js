"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";

export default function StoresPage() {
  const router = useRouter();
  const [stores, setStores] = useState([]);
  const [visits, setVisits] = useState({}); // Map of storeId -> visit status
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      const isAdmin = auth.currentUser.email === "anand@perforacare.com";

      try {
        // 1. Fetch Stores
        let storeQuery = isAdmin 
          ? query(collection(db, "stores")) 
          : query(collection(db, "stores"), where("SO_email", "==", auth.currentUser.email));
        const storeSnap = await getDocs(storeQuery);
        const storeList = storeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setStores(storeList);

        // 2. Fetch Today's Visits
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const visitQuery = query(
          collection(db, "visits"), 
          where("SO_email", "==", auth.currentUser.email)
        );
        const visitSnap = await getDocs(visitQuery);
        
        const visitMap = {};
        visitSnap.docs.forEach(doc => {
          const v = doc.data();
          // Simple check if visit is from today
          if (v.checkInTime?.toDate() >= startOfDay) {
            visitMap[v.store_id] = {
              id: doc.id,
              status: v.status, // "IN_PROGRESS" or "COMPLETED"
              checkInTime: v.checkInTime
            };
          }
        });
        setVisits(visitMap);

      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleCheckIn = async (storeId) => {
    if (!navigator.geolocation) {
      alert("GPS is not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          await addDoc(collection(db, "visits"), {
            store_id: storeId,
            SO_email: auth.currentUser.email,
            checkInTime: serverTimestamp(),
            checkInLat: latitude,
            checkInLng: longitude,
            status: "IN_PROGRESS"
          });
          
          // Update UI instantly
          setVisits(prev => ({
            ...prev,
            [storeId]: { status: "IN_PROGRESS", checkInTime: new Date() }
          }));
          
        } catch (error) {
          alert("Error checking in: " + error.message);
        }
      },
      (error) => {
        alert("Please allow GPS access to check in. Error: " + error.message);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleCheckOut = async (storeId) => {
    // In a real app, we would update the specific visit document.
    // For now, we will just mark it as completed in the UI for this session.
    setVisits(prev => ({
      ...prev,
      [storeId]: { ...prev[storeId], status: "COMPLETED" }
    }));
    alert("Visit completed! You can now take the order.");
    router.push("/orders/new");
  };

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-20">
      <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Store Visit Beat</h1>
          <p className="text-xs text-blue-600 font-semibold">Today • {stores.length} Stores</p>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {loading ? (
          <p className="text-center font-bold text-gray-500 mt-10">Loading your beat...</p>
        ) : stores.length === 0 ? (
          <p className="text-center font-bold text-gray-500 mt-10">No stores assigned to you.</p>
        ) : (
          stores.map(store => {
            const visit = visits[store.id];
            const isInProgress = visit?.status === "IN_PROGRESS";
            const isCompleted = visit?.status === "COMPLETED";

            return (
              <div key={store.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{store.name}</h3>
                    <p className="text-xs text-gray-500">{store.owner} • {store.distributor_id}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                    isCompleted ? 'bg-green-100 text-green-700' : 
                    isInProgress ? 'bg-blue-100 text-blue-700' : 
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {isCompleted ? 'COMPLETED' : isInProgress ? 'IN PROGRESS' : 'PENDING'}
                  </span>
                </div>

                <div className="flex gap-2 mt-4">
                  {!visit && (
                    <button 
                      onClick={() => handleCheckIn(store.id)}
                      className="w-full bg-blue-600 text-white font-bold py-2 rounded-xl text-sm shadow-md"
                    >
                      Start Visit (GPS Check-in)
                    </button>
                  )}

                  {isInProgress && (
                    <div className="w-full flex gap-2">
                      <button 
                        onClick={() => router.push("/orders/new")}
                        className="flex-1 bg-purple-600 text-white font-bold py-2 rounded-xl text-sm shadow-md"
                      >
                        Take Order
                      </button>
                      <button 
                        onClick={() => handleCheckOut(store.id)}
                        className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded-xl text-sm border border-gray-200"
                      >
                        Check Out
                      </button>
                    </div>
                  )}

                  {isCompleted && (
                    <button 
                      onClick={() => router.push("/orders/new")}
                      className="w-full bg-green-50 text-green-700 font-bold py-2 rounded-xl text-sm border border-green-200"
                    >
                      View / Add More Orders
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <BottomNav />
    </div>
  );
}