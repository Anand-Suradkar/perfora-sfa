"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";

export default function OrdersListPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!auth.currentUser) return;
      
      try {
        // Fetch only orders for the logged-in user
        const q = query(
          collection(db, "orders"), 
          where("SO_email", "==", auth.currentUser.email)
        );
        const querySnapshot = await getDocs(q);
        
        const fetchedOrders = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort by newest first
        fetchedOrders.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        
        setOrders(fetchedOrders);
      } catch (error) {
        console.error("Error fetching orders:", error);
      }
      setLoading(false);
    };

    fetchOrders();
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-20">
      <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
        <button 
          onClick={() => router.push("/orders/new")}
          className="bg-purple-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-md"
        >
          + New Order
        </button>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {loading ? (
          <p className="text-center text-gray-500 font-medium mt-10">Loading orders...</p>
        ) : orders.length === 0 ? (
          <div className="text-center mt-10">
            <p className="text-gray-500 font-medium">No orders yet.</p>
            <p className="text-sm text-gray-400 mt-1">Click "+ New Order" to start taking orders.</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">Store: {order.store_id}</h3>
                  <p className="text-xs text-purple-600 font-bold">Dist: {order.distributor_id}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                  order.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' : 
                  order.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' : 
                  'bg-red-100 text-red-700'
                }`}>
                  {order.status}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 mb-3">
                {order.items.length} SKU(s) | Date: {order.createdAt ? new Date(order.createdAt.toMillis()).toLocaleDateString() : 'Just now'}
              </div>

              <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                <span className="text-sm font-bold text-gray-500">Total Amount</span>
                <span className="text-lg font-black text-gray-900">₹{order.grand_total}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}