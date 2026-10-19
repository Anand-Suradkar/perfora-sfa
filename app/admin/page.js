"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";
import Papa from "papaparse";

export default function AdminPage() {
  const router = useRouter();
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Manual Form State
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
      setSku(""); setName(""); setMrp(""); setCategory(""); setIsFocus(false);
      fetchSkus();
    } catch (error) {
      alert("Error adding SKU");
    }
  };

  // --- BULK UPLOAD LOGIC ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const uploadPromises = results.data.map(async (row) => {
            // Make sure the CSV headers match these names exactly
            if (!row.SKU || !row.Name || !row.MRP) return; 

            await addDoc(collection(db, "sku_master"), {
              sku: String(row.SKU).toUpperCase().trim(),
              name: String(row.Name).trim(),
              mrp: Number(row.MRP),
              category: row.Category ? String(row.Category).trim() : "General",
              is_focus: String(row.is_focus).toLowerCase() === "true" || String(row.is_focus) === "1"
            });
          });

          await Promise.all(uploadPromises);
          alert(`Successfully uploaded ${results.data.length} SKUs!`);
          fetchSkus(); // Refresh list
        } catch (error) {
          console.error(error);
          alert("Error uploading file. Check your column names.");
        }
        setUploading(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">Admin Control Center</h1>
      </div>

      <div className="p-4 space-y-6 max-w-md mx-auto">
        
        {/* Bulk Upload Section */}
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
          <h2 className="text-sm font-bold text-blue-900 mb-1">📁 Bulk Upload SKUs</h2>
          <p className="text-xs text-blue-700 mb-3">Upload a CSV file with these exact columns: <br/><b>SKU, Name, MRP, Category, is_focus (true/false)</b></p>
          
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload} 
            disabled={uploading}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
          />
          {uploading && <p className="text-xs text-blue-600 font-bold mt-2 animate-pulse">Uploading... Please wait.</p>}
        </div>

        {/* Manual Form */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 mb-3 border-b pb-2">Add Single SKU</h2>
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