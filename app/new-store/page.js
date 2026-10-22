"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";

export default function NewStorePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ name: "", owner: "", mobile: "", distributor_id: "" });
  const [distributors, setDistributors] = useState([]);
  const [gps, setGps] = useState("Fetching...");
  const [saving, setSaving] = useState(false);

  // Fetch Distributors for the dropdown
  useEffect(() => {
    const fetchDists = async () => {
      const snap = await getDocs(collection(db, "distributors"));
      const dists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDistributors(dists);
      if (dists.length > 0) setFormData(prev => ({ ...prev, distributor_id: dists[0].id }));
    };
    fetchDists();

    // Fetch GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGps(`${pos.coords.latitude}, ${pos.coords.longitude}`),
        () => setGps("Location Denied")
      );
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.owner || !formData.distributor_id) return alert("Fill all required fields");
    
    setSaving(true);
    try {
      await addDoc(collection(db, "stores"), {
        ...formData,
        SO_email: auth.currentUser.email,
        type: "NEW",
        gps: gps,
        createdAt: new Date().toISOString() // Needed for dashboard calculations
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
      <div className="bg-gradient-to-r from-purple-800 to-purple-600 p-4 rounded-b-3xl shadow-lg text-white">
        <h1 className="text-2xl font-black">New Store</h1>
        <p className="text-sm opacity-90 mt-1">Add an outlet & start ordering</p>
      </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-md mx-auto -mt-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500">OUTLET NAME *</label>
            <input required type="text" className="w-full p-3 border rounded-xl mt-1 bg-gray-50" onChange={(e) => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div>
               <label className="text-[10px] font-bold text-gray-500">CITY *</label>
               <input required type="text" className="w-full p-3 border rounded-xl mt-1 bg-gray-50" onChange={(e) => setFormData({...formData, city: e.target.value})} />
             </div>
             <div>
               <label className="text-[10px] font-bold text-gray-500">LOCALITY</label>
               <input type="text" className="w-full p-3 border rounded-xl mt-1 bg-gray-50" onChange={(e) => setFormData({...formData, locality: e.target.value})} />
             </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500">ADDRESS</label>
            <input type="text" className="w-full p-3 border rounded-xl mt-1 bg-gray-50" onChange={(e) => setFormData({...formData, address: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div>
               <label className="text-[10px] font-bold text-gray-500">CONTACT PERSON</label>
               <input type="text" className="w-full p-3 border rounded-xl mt-1 bg-gray-50" onChange={(e) => setFormData({...formData, owner: e.target.value})} />
             </div>
             <div>
               <label className="text-[10px] font-bold text-gray-500">MOBILE</label>
               <input type="number" className="w-full p-3 border rounded-xl mt-1 bg-gray-50" onChange={(e) => setFormData({...formData, mobile: e.target.value})} />
             </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500">DISTRIBUTOR *</label>
            <select required className="w-full p-3 border rounded-xl mt-1 bg-gray-50" value={formData.distributor_id} onChange={(e) => setFormData({...formData, distributor_id: e.target.value})}>
              <option value="">Select Distributor...</option>
              {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500">STORE TYPE</label>
              <select className="w-full p-3 border rounded-xl mt-1 bg-gray-50" onChange={(e) => setFormData({...formData, type: e.target.value})}>
                <option value="GT">GT</option>
                <option value="MT">MT</option>
                <option value="Chemist">Chemist</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500">FOCUS OUTLET</label>
              <select className="w-full p-3 border rounded-xl mt-1 bg-gray-50" onChange={(e) => setFormData({...formData, focus: e.target.value === "Yes"})}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>
          
          <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg mt-2 border border-gray-200">
            <button type="button" onClick={() => {
                if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => setGps(`${p.coords.latitude}, ${p.coords.longitude}`));
            }} className="text-xs font-bold text-blue-700 flex items-center gap-1">
              📍 Capture GPS
            </button>
            <span className="text-[10px] text-gray-500">{gps}</span>
          </div>
        </div>

        <button type="submit" disabled={saving} className="w-full bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg">
          {saving ? "Saving..." : "Save outlet & start order"}
        </button>
      </form>
      <BottomNav />
    </div>
  );
}