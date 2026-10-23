"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("distributors");
  const [loading, setLoading] = useState(true);

  // --- DATA STATES ---
  const [skus, setSkus] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [stores, setStores] = useState([]);

  // --- SKU FORM STATE ---
  const [skuForm, setSkuForm] = useState({ sku: "", name: "", mrp: "", gst: "18", category: "", is_focus: false });
  const [editingSku, setEditingSku] = useState(null);

  // --- DISTRIBUTOR FORM STATE ---
  const [distForm, setDistForm] = useState({ id: "", name: "", city: "", so_emails: "" });
  const [editingDist, setEditingDist] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const skuSnap = await getDocs(collection(db, "sku_master"));
      setSkus(skuSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.sku.localeCompare(b.sku)));

      const distSnap = await getDocs(collection(db, "distributors"));
      setDistributors(distSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.name.localeCompare(b.name)));

      const storeSnap = await getDocs(collection(db, "stores"));
      setStores(storeSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (auth.currentUser?.email !== "anand@perforacare.com") {
      router.push("/dashboard");
    }
    fetchData();
  }, [router]);

  // --- SKU ACTIONS ---
  const handleSaveSku = async (e) => {
    e.preventDefault();
    if (!skuForm.sku || !skuForm.name || !skuForm.mrp) return alert("Fill required fields");
    const skuId = skuForm.sku.toUpperCase().trim();
    const dataToSave = { ...skuForm, sku: skuId, mrp: Number(skuForm.mrp), gst: Number(skuForm.gst) };

    try {
      if (editingSku) {
        await updateDoc(doc(db, "sku_master", editingSku), dataToSave);
      } else {
        await setDoc(doc(db, "sku_master", skuId), dataToSave);
      }
      alert("SKU Saved!");
      setSkuForm({ sku: "", name: "", mrp: "", gst: "18", category: "", is_focus: false });
      setEditingSku(null);
      fetchData();
    } catch (error) { alert("Error saving SKU"); }
  };

  const handleDeleteSku = async (id) => {
    if (!confirm(`Delete SKU ${id}?`)) return;
    try { await deleteDoc(doc(db, "sku_master", id)); fetchData(); } catch (e) { alert("Error deleting"); }
  };

  const handleEditSku = (s) => {
    setSkuForm({ sku: s.sku, name: s.name, mrp: s.mrp, gst: s.gst || "18", category: s.category || "", is_focus: s.is_focus || false });
    setEditingSku(s.id);
    window.scrollTo(0, 0);
  };

  // --- DISTRIBUTOR ACTIONS ---
  const handleSaveDist = async (e) => {
    e.preventDefault();
    if (!distForm.id || !distForm.name) return alert("Distributor ID and Name are required");
    
    // Convert comma separated emails to an array
    const emailsArray = distForm.so_emails.split(",").map(email => email.trim().toLowerCase()).filter(email => email !== "");
    
    const distId = distForm.id.toUpperCase().trim();
    const dataToSave = {
      id: distId,
      name: distForm.name,
      city: distForm.city || "",
      mapped_SO_emails: emailsArray
    };

    try {
      if (editingDist) {
        await updateDoc(doc(db, "distributors", editingDist), dataToSave);
      } else {
        await setDoc(doc(db, "distributors", distId), dataToSave);
      }
      alert("Distributor Saved!");
      setDistForm({ id: "", name: "", city: "", so_emails: "" });
      setEditingDist(null);
      fetchData();
    } catch (error) { alert("Error saving Distributor"); }
  };

  const handleDeleteDist = async (id) => {
    if (!confirm(`Delete Distributor ${id}? This will NOT delete their stores, but they won't be visible in the order screen.`)) return;
    try { await deleteDoc(doc(db, "distributors", id)); fetchData(); } catch (e) { alert("Error deleting"); }
  };

  const handleEditDist = (d) => {
    setDistForm({ 
      id: d.id, 
      name: d.name, 
      city: d.city || "", 
      so_emails: d.mapped_SO_emails ? d.mapped_SO_emails.join(", ") : "" 
    });
    setEditingDist(d.id);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-r from-gray-800 to-gray-600 p-4 rounded-b-3xl shadow-lg text-white">
        <h1 className="text-2xl font-black">Admin Control</h1>
        <p className="text-sm opacity-90 mt-1">Live Database Management</p>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto -mt-4">
        
        {/* Mini Dashboard */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 text-center">
            <p className="text-[10px] font-bold text-gray-500">SKUs</p>
            <p className="text-lg font-black text-gray-800">{skus.length}</p>
          </div>
          <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 text-center">
            <p className="text-[10px] font-bold text-gray-500">Distributors</p>
            <p className="text-lg font-black text-gray-800">{distributors.length}</p>
          </div>
          <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 text-center">
            <p className="text-[10px] font-bold text-gray-500">Stores</p>
            <p className="text-lg font-black text-gray-800">{stores.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setActiveTab("distributors")} className={"px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm border transition-colors " + (activeTab === "distributors" ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200')}>🏢 Distributors & Users</button>
          <button onClick={() => setActiveTab("skus")} className={"px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm border transition-colors " + (activeTab === "skus" ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200')}>📦 SKUs</button>
        </div>

        {/* DISTRIBUTORS TAB */}
        {activeTab === "distributors" && (
          <>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-bold text-gray-800 mb-1">{editingDist ? "Edit Distributor" : "Add New Distributor / Map User"}</h2>
              <p className="text-[10px] text-gray-500 mb-3">To transfer a distributor to another SO, just remove the old email and add the new one below.</p>
              
              <form onSubmit={handleSaveDist} className="space-y-3">
                <div className="flex gap-2">
                  <input required type="text" placeholder="Dist ID (e.g. D01)" value={distForm.id} onChange={e => setDistForm({...distForm, id: e.target.value})} disabled={!!editingDist} className="w-1/3 p-2 border rounded-lg bg-gray-50 text-sm disabled:opacity-50" />
                  <input required type="text" placeholder="Distributor Name" value={distForm.name} onChange={e => setDistForm({...distForm, name: e.target.value})} className="w-2/3 p-2 border rounded-lg bg-gray-50 text-sm" />
                </div>
                <input type="text" placeholder="City (Optional)" value={distForm.city} onChange={e => setDistForm({...distForm, city: e.target.value})} className="w-full p-2 border rounded-lg bg-gray-50 text-sm" />
                
                <div>
                  <label className="text-[10px] font-bold text-gray-500">Mapped SO Emails (comma separated)</label>
                  <input type="text" placeholder="user1@perforacare.com, user2@..." value={distForm.so_emails} onChange={e => setDistForm({...distForm, so_emails: e.target.value})} className="w-full p-2 border rounded-lg bg-gray-50 text-sm mt-1" />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 bg-gray-800 text-white font-bold py-2 rounded-lg text-sm">{editingDist ? "Update Distributor" : "Save Distributor"}</button>
                  {editingDist && <button type="button" onClick={() => { setEditingDist(null); setDistForm({ id: "", name: "", city: "", so_emails: "" }); }} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg text-sm">Cancel</button>}
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <h2 className="text-sm font-bold text-gray-800 p-4 border-b">Distributor Master List</h2>
              <div className="max-h-[400px] overflow-y-auto">
                {loading ? <p className="p-4 text-center text-sm text-gray-500">Loading...</p> : 
                distributors.map(d => (
                  <div key={d.id} className="flex justify-between items-center p-3 border-b border-gray-50 text-sm">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-gray-800">{d.name} <span className="text-[10px] text-gray-400">({d.id})</span></p>
                      <p className="text-[10px] text-gray-500 truncate">{d.city || "No City"}</p>
                      <p className="text-[10px] text-purple-600 font-bold break-all mt-1">SO: {d.mapped_SO_emails?.join(", ") || "No SO Mapped"}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleEditDist(d)} className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-bold">Edit</button>
                      <button onClick={() => handleDeleteDist(d.id)} className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* SKUs TAB */}
        {activeTab === "skus" && (
          <>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-bold text-gray-800 mb-3">{editingSku ? "Edit SKU" : "Add New SKU"}</h2>
              <form onSubmit={handleSaveSku} className="space-y-3">
                <input required type="text" placeholder="SKU Code" value={skuForm.sku} onChange={e => setSkuForm({...skuForm, sku: e.target.value})} disabled={!!editingSku} className="w-full p-2 border rounded-lg bg-gray-50 text-sm disabled:opacity-50" />
                <input required type="text" placeholder="Product Name" value={skuForm.name} onChange={e => setSkuForm({...skuForm, name: e.target.value})} className="w-full p-2 border rounded-lg bg-gray-50 text-sm" />
                <div className="flex gap-2">
                  <input required type="number" placeholder="MRP (₹)" value={skuForm.mrp} onChange={e => setSkuForm({...skuForm, mrp: e.target.value})} className="w-1/2 p-2 border rounded-lg bg-gray-50 text-sm" />
                  <input required type="number" placeholder="GST %" value={skuForm.gst} onChange={e => setSkuForm({...skuForm, gst: e.target.value})} className="w-1/2 p-2 border rounded-lg bg-gray-50 text-sm" />
                </div>
                <input type="text" placeholder="Category" value={skuForm.category} onChange={e => setSkuForm({...skuForm, category: e.target.value})} className="w-full p-2 border rounded-lg bg-gray-50 text-sm" />
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={skuForm.is_focus} onChange={e => setSkuForm({...skuForm, is_focus: e.target.checked})} className="w-4 h-4 text-purple-600 rounded" />
                  <span>Mark as Focus Product?</span>
                </label>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-gray-800 text-white font-bold py-2 rounded-lg text-sm">{editingSku ? "Update SKU" : "Save SKU"}</button>
                  {editingSku && <button type="button" onClick={() => { setEditingSku(null); setSkuForm({ sku: "", name: "", mrp: "", gst: "18", category: "", is_focus: false }); }} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg text-sm">Cancel</button>}
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <h2 className="text-sm font-bold text-gray-800 p-4 border-b">Master SKU List ({skus.length})</h2>
              <div className="max-h-[400px] overflow-y-auto">
                {loading ? <p className="p-4 text-center text-sm text-gray-500">Loading...</p> : 
                skus.map(s => (
                  <div key={s.id} className="flex justify-between items-center p-3 border-b border-gray-50 text-sm">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-gray-800">{s.sku}</p>
                      <p className="text-xs text-gray-500 truncate w-48">{s.name}</p>
                      <p className="text-[10px] text-gray-400">MRP: ₹{s.mrp} | GST: {s.gst}%</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleEditSku(s)} className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-bold">Edit</button>
                      <button onClick={() => handleDeleteSku(s.id)} className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold">Del</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      </div>
      <BottomNav />
    </div>
  );
}