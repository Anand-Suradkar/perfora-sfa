"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, addDoc, doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";
import Papa from "papaparse";

export default function AdminPage() {
  const router = useRouter();
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState("");

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

  // --- BULK UPLOAD: SKUs ---
  const handleSkuUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading("skus");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        for (let row of results.data) {
          if (!row.SKU || !row.Name || !row.MRP) continue;
          await addDoc(collection(db, "sku_master"), {
            sku: String(row.SKU).toUpperCase().trim(),
            name: String(row.Name).trim(),
            mrp: Number(row.MRP),
            gst: Number(row.GST) || 0, // NEW: Accepts GST from CSV
            category: row.Category || "General",
            is_focus: String(row.is_focus).toLowerCase() === "true"
          });
        }
        alert(`Uploaded ${results.data.length} SKUs!`);
        fetchSkus();
        setUploading("");
      }
    });
  };

  // --- BULK UPLOAD: DISTRIBUTORS & USERS ---
  const handleDistUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading("dists");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        for (let row of results.data) {
          if (!row.DistributorID || !row.DistributorName) continue;
          
          let emailArray = [];
          if (row.SO_Emails) {
            emailArray = String(row.SO_Emails).split(",").map(email => email.trim().toLowerCase());
          }

          await setDoc(doc(db, "distributors", String(row.DistributorID).trim()), {
            id: String(row.DistributorID).trim(),
            name: String(row.DistributorName).trim(),
            mapped_SO_emails: emailArray
          });
        }
        alert(`Uploaded ${results.data.length} Distributors!`);
        setUploading("");
      }
    });
  };

  // --- BULK UPLOAD: STORES ---
  const handleStoreUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading("stores");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        for (let row of results.data) {
          if (!row.StoreID || !row.StoreName) continue;
          await setDoc(doc(db, "stores", String(row.StoreID).trim()), {
            id: String(row.StoreID).trim(),
            name: String(row.StoreName).trim(),
            owner: String(row.Owner || "").trim(),
            distributor_id: String(row.DistributorID).trim(),
            SO_email: String(row.SO_Email).trim().toLowerCase(),
            type: "REPEAT"
          });
        }
        alert(`Uploaded ${results.data.length} Stores!`);
        setUploading("");
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">Admin Control Center</h1>
      </div>

      <div className="p-4 space-y-6 max-w-md mx-auto">
        
        {/* Distributor Upload */}
        <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200">
          <h2 className="text-sm font-bold text-purple-900 mb-1">👥 Bulk Upload Distributors & SOs</h2>
          <p className="text-xs text-purple-700 mb-3">CSV Columns: <br/><b>DistributorID, DistributorName, SO_Emails</b></p>
          <input type="file" accept=".csv" onChange={handleDistUpload} disabled={uploading !== ""} className="block w-full text-sm file:bg-purple-600 file:text-white file:rounded-full file:border-0 file:px-4 file:py-2" />
          {uploading === "dists" && <p className="text-xs text-purple-600 font-bold mt-2 animate-pulse">Uploading...</p>}
        </div>

        {/* Store Upload */}
        <div className="bg-green-50 p-4 rounded-2xl border border-green-200">
          <h2 className="text-sm font-bold text-green-900 mb-1">🏪 Bulk Upload Stores</h2>
          <p className="text-xs text-green-700 mb-3">CSV Columns: <br/><b>StoreID, StoreName, Owner, DistributorID, SO_Email</b></p>
          <input type="file" accept=".csv" onChange={handleStoreUpload} disabled={uploading !== ""} className="block w-full text-sm file:bg-green-600 file:text-white file:rounded-full file:border-0 file:px-4 file:py-2" />
          {uploading === "stores" && <p className="text-xs text-green-600 font-bold mt-2 animate-pulse">Uploading...</p>}
        </div>

        {/* SKU Upload */}
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
          <h2 className="text-sm font-bold text-blue-900 mb-1">📦 Bulk Upload SKUs</h2>
          <p className="text-xs text-blue-700 mb-3">CSV Columns: <br/><b>SKU, Name, MRP, GST, Category, is_focus</b></p>
          <input type="file" accept=".csv" onChange={handleSkuUpload} disabled={uploading !== ""} className="block w-full text-sm file:bg-blue-600 file:text-white file:rounded-full file:border-0 file:px-4 file:py-2" />
          {uploading === "skus" && <p className="text-xs text-blue-600 font-bold mt-2 animate-pulse">Uploading...</p>}
        </div>

        {/* SKU List Preview */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <h2 className="text-sm font-bold text-gray-800 p-4 border-b">Master SKU List ({skus.length})</h2>
          <div className="max-h-60 overflow-y-auto">
            {loading ? <p className="p-4 text-center text-sm text-gray-500">Loading...</p> : 
            skus.map((s, i) => (
              <div key={i} className="flex justify-between items-center p-3 border-b border-gray-50 text-sm">
                <div>
                  <p className="font-bold text-gray-800">{s.sku}</p>
                  <p className="text-xs text-gray-500">{s.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-gray-900">₹{s.mrp}</p>
                  <p className="text-[10px] text-gray-500">GST: {s.gst || 0}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}