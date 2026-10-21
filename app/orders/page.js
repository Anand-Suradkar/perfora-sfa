"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";

export default function OrdersListPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  const fetchOrders = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, "orders"), where("SO_email", "==", auth.currentUser.email));
      const snap = await getDocs(q);
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetched.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setOrders(fetched);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, "orders", id), { status: newStatus });
      fetchOrders(); // Refresh list
    } catch (error) {
      alert("Error updating status");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this order?")) return;
    try {
      await deleteDoc(doc(db, "orders", id));
      fetchOrders();
    } catch (error) {
      alert("Error deleting order");
    }
  };

  const statuses = ["All", "CREATED", "SHARED", "ACCEPTED", "INVOICED"];
  
  const filteredOrders = orders.filter(o => filter === "All" || o.status === filter);

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-20">
      {/* Blue Header */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 p-4 rounded-b-3xl shadow-lg text-white">
        <h1 className="text-2xl font-black">Orders</h1>
        <p className="text-sm opacity-90 mt-1">{orders.length} total orders</p>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto -mt-4">
        
        {/* Status Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {statuses.map(s => {
            const count = s === "All" ? orders.length : orders.filter(o => o.status === s).length;
            return (
              <button 
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm border transition-colors
                  ${filter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                {s === "All" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()} ({count})
              </button>
            )
          })}
        </div>

        {/* Orders List */}
        {loading ? <p className="text-center font-bold text-gray-500 mt-10">Loading...</p> : 
         filteredOrders.length === 0 ? <p className="text-center font-bold text-gray-500 mt-10">No orders found.</p> :
         filteredOrders.map((order) => (
          <div key={order.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-black text-gray-900 text-lg leading-tight">{order.store_id}</h3>
                <p className="text-[10px] text-blue-600 font-bold mt-0.5">{order.distributor_id} • {new Date(order.createdAt?.toMillis()).toLocaleDateString()}</p>
                <p className="text-xs text-gray-500 mt-1">{order.items.length} SKUs • {order.items.reduce((a, b) => a + b.qty, 0)} units</p>
              </div>
              <div className="text-right">
                <p className="font-black text-gray-900 text-lg">₹{Number(order.grand_total).toFixed(2)}</p>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md inline-block mt-1 ${
                  order.status === 'CREATED' ? 'bg-blue-100 text-blue-700' :
                  order.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                  order.status === 'INVOICED' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {order.status}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-50">
              <button className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 rounded-lg border border-blue-100">View</button>
              <button className="px-3 py-1.5 text-xs font-bold text-orange-700 bg-orange-50 rounded-lg border border-orange-100">Edit</button>
              <a href={`https://wa.me/?text=Order ${order.id} Total: ${order.grand_total}`} target="_blank" className="px-3 py-1.5 text-xs font-bold text-white bg-green-500 rounded-lg shadow-sm">WhatsApp</a>
              
              {order.status === 'CREATED' && (
                <button onClick={() => handleUpdateStatus(order.id, 'ACCEPTED')} className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg shadow-sm">Accept</button>
              )}
              
              <button onClick={() => handleDelete(order.id)} className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 rounded-lg border border-red-100 ml-auto">Delete</button>
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}