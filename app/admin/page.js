"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";

export default function AdminPage() {
  const router = useRouter();
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [mrp, setMrp] = useState("");
  const [category, setCategory] = useState("");
  const [isFocus, setIsFocus] = useState(false);

  const fetchSkus = async () => {
    const snap = await getDocs(collection(db, "sku_master"));
    setSkus(snap.docs.map(doc => doc.data()));
    setLoading(false);
  };

  useEffect(() => {
    if (auth.currentUser?.email !== "anand@perforacare.com") {
      router.push("/dashboard");
    }
    fetchSkus();
  }, [router]);

  const handleAddSku = async (e) => {
    e.preventDefault();
    if (!sku || !name || !mrp || !category) return alert("Please fill all fields");

    try {
      await addDoc(collection(db, "sku_master"), {
        sku: sku.toUpperCase(),
        name,
        mrp: Number(mrp),
        category,
        is_focus: isFocus
      });
      alert("SKU Added!");
      // Reset form
      setSku(""); setName(""); setMrp(""); setCategory(""); setIsFocus(false);
      fetchSkus(); // Refresh list
    } catch (error) {
      alert("Error adding SKU");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">Admin Control Center</h1>
      </div>

      <div className="p-4 space-y-6 max-w-md mx-auto">
        
        {/* Add SKU Form */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 mb-3 border-b pb-2">Add New SKU</h2>
          <form onSubmit={handleAddSku} className="space-y-3">
            <input required type="text" placeholder="SKU Code (e.g. PC-011)" value={sku} onChange={e => setSku(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50 text-sm" />
            <input required type="text" placeholder="Product Name" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50 text-sm" />
            <div className="flex gap-2">
              <input required type="number" placeholder="MRP (₹)" value={mrp} onChange={e => setMrp(e.target.value)} className="w-1/2 p-2 border rounded-lg bg-gray-50 text-sm" />
              <input required type="text" placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} className="w-1/2 p-2 border rounded-lg bg-gray-50 text-sm" />
            </div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={isFocus} onChange={e => setIsFocus(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
              <span>Mark as Focus Product?</span>
            </label>
            <button type="submit" className="w-full bg-purple-600 text-white font-bold py-2 rounded-lg text-sm mt-2">Save SKU</button>
          </form>
        </div>

        {/* SKU List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <h2 className="text-sm font-bold text-gray-800 p-4 border-b">Master SKU List ({skus.length})</h2>
          {loading ? <p className="p-4 text-center text-sm text-gray-500">Loading...</p> : 
           skus.map((s, i) => (
            <div key={i} className="flex justify-between items-center p-3 border-b border-gray-50 text-sm">
              <div>
                <p className="font-bold text-gray-800">{s.sku}</p>
                <p className="text-xs text-gray-500">{s.name}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-gray-900">₹{s.mrp}</p>
                <p className="text-[10px] text-purple-600">{s.category}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
      <BottomNav />
    </div>
  );
}