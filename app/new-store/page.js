"use client";

import { useState } from "react";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";

export default function NewStorePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ name: "", owner: "", mobile: "", distributor_id: "D01" });
  const [gps, setGps] = useState("Fetching...");
  const [saving, setSaving] = useState(false);

  // Auto-fetch GPS on load
  useState(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps(`${pos.coords.latitude}, ${pos.coords.longitude}`),
        () => setGps("Location Denied")
      );
    } else {
      setGps("Not Supported");
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.owner) return alert("Fill Name and Owner");
    
    setSaving(true);
    try {
      await addDoc(collection(db, "stores"), {
        ...formData,
        SO_email: auth.currentUser.email,
        type: "NEW",
        gps: gps,
        createdAt: serverTimestamp()
      });
      alert("Store Added Successfully!");
      router.push("/stores");
    } catch (error) {
      alert("Error adding store");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-20">
      <div className="bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">Add New Store</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-md mx-auto">
        <div className="bg-white p-4 rounded-2xl shadow-sm space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500">Store Name *</label>
            <input required type="text" className="w-full p-3 border rounded-xl mt-1 bg-gray-50" 
              onChange={(e) => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500">Owner Name *</label>
            <input required type="text" className="w-full p-3 border rounded-xl mt-1 bg-gray-50" 
              onChange={(e) => setFormData({...formData, owner: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500">Mobile</label>
            <input type="number" className="w-full p-3 border rounded-xl mt-1 bg-gray-50" 
              onChange={(e) => setFormData({...formData, mobile: e.target.value})} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500">Distributor</label>
            <select className="w-full p-3 border rounded-xl mt-1 bg-gray-50"
              onChange={(e) => setFormData({...formData, distributor_id: e.target.value})}>
              <option value="D01">Sanvi / A H Ent</option>
              <option value="D02">TOYOTOYZ</option>
              <option value="D03">M K / Meharwan</option>
            </select>
          </div>
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-blue-800 text-xs font-bold mt-2">
            📍 GPS Location: {gps}
          </div>
        </div>

        <button type="submit" disabled={saving} className="w-full bg-purple-600 text-white font-bold py-4 rounded-xl shadow-lg">
          {saving ? "Saving..." : "Save Store"}
        </button>
      </form>
      <BottomNav />
    </div>
  );
}