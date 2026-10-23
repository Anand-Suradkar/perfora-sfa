"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("stores"); // Default to stores
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // --- DATA STATES ---
  const [skus, setSkus] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [stores, setStores] = useState([]);

  // --- STORE FORM STATE ---
  const [storeForm, setStoreForm] = useState({ id: "", name: "", owner: "", distributor_id: "", SO_email: "", status: "Active" });
  const [editingStore, setEditingStore] = useState(null);

  // --- DISTRIBUTOR FORM STATE ---
  const [distForm, setDistForm] = useState({ id: "", name: "", city: "", so_emails: "" });
  const [editingDist, setEditingDist] = useState(null);

  // --- SKU FORM STATE ---
  const [skuForm, setSkuForm] = useState({ sku: "", name: "", mrp: "", gst: "18", category: "", is_focus: false });
  const [editingSku, setEditingSku] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const skuSnap = await getDocs(collection(db, "sku_master"));
      setSkus(skuSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.sku.localeCompare(b.sku)));

      const distSnap = await getDocs(collection(db, "distributors"));
      setDistributors(distSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.name.localeCompare(b.name)));

      const storeSnap = await getDocs(collection(db, "stores"));
      setStores(storeSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.name.localeCompare(b.name)));
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

  // ================= STORE ACTIONS =================
  const handleSaveStore = async (e) => {
    e.preventDefault();
    if (!storeForm.name || !storeForm.distributor_id) return alert("Store Name and Distributor are required");
    
    // If editing, use existing ID. If new, generate a timestamp ID.
    const storeId = editingStore || "STR-" + Date.now();
    
    try {
      await setDoc(doc(db, "stores", storeId), { ...storeForm, id: storeId });
      alert("Store Saved!");
      setStoreForm({ id: "", name: "", owner: "", distributor_id: "", SO_email: "", status: "Active" });
      setEditingStore(null);
      fetchData();
    } catch (error) { alert("Error saving store"); }
  };

  const handleEditStore = (s) => {
    setStoreForm({ 
      id: s.id, name: s.name, owner: s.owner || "", distributor_id: s.distributor_id || "", 
      SO_email: s.SO_email || "", status: s.status || "Active" 
    });
    setEditingStore(s.id);
    window.scrollTo(0, 0);
  };

  const handleDeleteStore = async (id) => {
    if (!confirm(`Delete store ${id}? This cannot be undone.`)) return;
    try { await deleteDoc(doc(db, "stores", id)); fetchData(); } catch (e) { alert("Error deleting"); }
  };

  // ================= DISTRIBUTOR ACTIONS =================
  const handleSaveDist = async (e) => {
    e.preventDefault();
    if (!distForm.id || !distForm.name) return alert("Distributor ID and Name are required");
    const emailsArray = distForm.so_emails.split(",").map(email => email.trim().toLowerCase()).filter(email => email !== "");
    const distId = distForm.id.toUpperCase().trim();
    
    try {
      await setDoc(doc(db, "distributors", distId), { id: distId, name: distForm.name, city: distForm.city, mapped_SO_emails: emailsArray });
      alert("Distributor Saved!");
      setDistForm({ id: "", name: "", city: "", so_emails: "" });
      setEditingDist(null);
      fetchData();
    } catch (error) { alert("Error saving Distributor"); }
  };

  const handleEditDist = (d) => {
    setDistForm({ id: d.id, name: d.name, city: d.city || "", so_emails: d.mapped_SO_emails ? d.mapped_SO_emails.join(", ") : "" });
    setEditingDist(d.id);
    window.scrollTo(0, 0);
  };

  const handleDeleteDist = async (id) => {
    if (!confirm(`Delete Distributor ${id}?`)) return;
    try { await deleteDoc(doc(db, "distributors", id)); fetchData(); } catch (e) { alert("Error deleting"); }
  };

  // ================= SKU ACTIONS =================
  const handleSaveSku = async (e) => {
    e.preventDefault();
    if (!skuForm.sku || !skuForm.name || !skuForm.mrp) return alert("Fill required fields");
    const skuId = skuForm.sku.toUpperCase().trim();
    
    try {
      await setDoc(doc(db, "sku_master", skuId), { ...skuForm, sku: skuId, mrp: Number(skuForm.mrp), gst: Number(skuForm.gst) });
      alert("SKU Saved!");
      setSkuForm({ sku: "", name: "", mrp: "", gst: "18", category: "", is_focus: false });
      setEditingSku(null);
      fetchData();
    } catch (error) { alert("Error saving SKU"); }
  };

  const handleEditSku = (s) => {
    setSkuForm({ sku: s.sku, name: s.name, mrp: s.mrp, gst: s.gst || "18", category: s.category || "", is_focus: s.is_focus || false });
    setEditingSku(s.id);
    window.scrollTo(0, 0);
  };

  const handleDeleteSku = async (id) => {
    if (!confirm(`Delete SKU ${id}?`)) return;
    try { await deleteDoc(doc(db, "sku_master", id)); fetchData(); } catch (e) { alert("Error deleting"); }
  };

  // Filtering
  const filteredStores = stores.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.SO_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-100 pb-20 md:pb-0 font-sans">
      
      {/* Header - Desktop optimized */}
      <div className="bg-gray-900 text-white p-4 md:p-6 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black">Admin Control Center</h1>
          <p className="text-sm text-gray-400 mt-1">Full Database Management for Perforacare SFA</p>
        </div>
        <div className="hidden md:flex gap-4 text-sm font-bold">
          <div className="bg-gray-800 px-4 py-2 rounded-lg">SKUs: {skus.length}</div>
          <div className="bg-gray-800 px-4 py-2 rounded-lg">Distributors: {distributors.length}</div>
          <div className="bg-gray-800 px-4 py-2 rounded-lg">Stores: {stores.length}</div>
        </div>
      </div>

      {/* Main Container - Full width on Desktop */}
      <div className="max-w-7xl mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
            <button onClick={() => setActiveTab("stores")} className={"px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors " + (activeTab === "stores" ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-50')}>🏪 Store Management</button>
            <button onClick={() => setActiveTab("distributors")} className={"px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors " + (activeTab === "distributors" ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-50')}>🏢 Distributors & Users</button>
            <button onClick={() => setActiveTab("skus")} className={"px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors " + (activeTab === "skus" ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-50')}>📦 SKU Master</button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          
          {/* ================= STORES TAB ================= */}
          {activeTab === "stores" && (
            <div className="space-y-6">
              {/* Form */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-800 mb-4">{editingStore ? "Edit Store" : "Add New Store"}</h2>
                <form onSubmit={handleSaveStore} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500">Store Name *</label>
                    <input required type="text" value={storeForm.name} onChange={e => setStoreForm({...storeForm, name: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500">Owner Name</label>
                    <input type="text" value={storeForm.owner} onChange={e => setStoreForm({...storeForm, owner: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500">Distributor *</label>
                    <select required value={storeForm.distributor_id} onChange={e => setStoreForm({...storeForm, distributor_id: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-gray-50">
                      <option value="">Select Distributor...</option>
                      {distributors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.id})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500">Assigned SO Email</label>
                    <input type="email" value={storeForm.SO_email} onChange={e => setStoreForm({...storeForm, SO_email: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-gray-50" placeholder="user@perforacare.com" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500">Status</label>
                    <select value={storeForm.status} onChange={e => setStoreForm({...storeForm, status: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-gray-50">
                      <option value="Active">Active</option>
                      <option value="Closed">Closed / Dead</option>
                    </select>
                  </div>
                  
                  <div className="md:col-span-2 flex gap-2 mt-2">
                    <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg shadow-sm">{editingStore ? "Update Store" : "Save Store"}</button>
                    {editingStore && <button type="button" onClick={() => { setEditingStore(null); setStoreForm({ id: "", name: "", owner: "", distributor_id: "", SO_email: "", status: "Active" }); }} className="bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-lg">Cancel</button>}
                  </div>
                </form>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                  <h2 className="text-lg font-bold text-gray-800">Store List ({filteredStores.length})</h2>
                  <input type="text" placeholder="Search by store name, ID, or SO email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded-lg text-sm w-64" />
                </div>
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0">
                      <tr>
                        <th className="p-3">Store Name</th>
                        <th className="p-3">Distributor</th>
                        <th className="p-3">SO Email</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStores.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="p-3">
                            <p className="font-bold text-gray-800">{s.name}</p>
                            <p className="text-[10px] text-gray-400">{s.id}</p>
                          </td>
                          <td className="p-3 text-gray-600">{s.distributor_id}</td>
                          <td className="p-3 text-gray-600 text-xs">{s.SO_email || "-"}</td>
                          <td className="p-3">
                            <span className={"px-2 py-1 rounded text-[10px] font-bold " + (s.status === "Closed" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>
                              {s.status || "Active"}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <button onClick={() => handleEditStore(s)} className="text-blue-600 font-bold text-xs hover:underline">Edit</button>
                            <button onClick={() => handleDeleteStore(s.id)} className="text-red-600 font-bold text-xs hover:underline">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= DISTRIBUTORS TAB ================= */}
          {activeTab === "distributors" && (
             <div className="space-y-6">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
               <h2 className="text-lg font-bold text-gray-800 mb-4">{editingDist ? "Edit Distributor" : "Add Distributor / Map User"}</h2>
               <form onSubmit={handleSaveDist} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-bold text-gray-500">Distributor ID *</label>
                   <input required type="text" value={distForm.id} onChange={e => setDistForm({...distForm, id: e.target.value})} disabled={!!editingDist} className="w-full p-2 border rounded-lg mt-1 bg-gray-50 disabled:opacity-50" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-gray-500">Distributor Name *</label>
                   <input required type="text" value={distForm.name} onChange={e => setDistForm({...distForm, name: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-gray-50" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-gray-500">City</label>
                   <input type="text" value={distForm.city} onChange={e => setDistForm({...distForm, city: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-gray-50" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-gray-500">Mapped SO Emails (Comma separated)</label>
                   <input type="text" value={distForm.so_emails} onChange={e => setDistForm({...distForm, so_emails: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-gray-50" placeholder="user1@perfora.com, user2@..." />
                 </div>
                 <div className="md:col-span-2 flex gap-2 mt-2">
                    <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg shadow-sm">{editingDist ? "Update Distributor" : "Save Distributor"}</button>
                    {editingDist && <button type="button" onClick={() => { setEditingDist(null); setDistForm({ id: "", name: "", city: "", so_emails: "" }); }} className="bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-lg">Cancel</button>}
                  </div>
               </form>
             </div>

             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="p-4 border-b bg-gray-50"><h2 className="text-lg font-bold text-gray-800">Distributor List ({distributors.length})</h2></div>
               <div className="overflow-x-auto max-h-[600px]">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0">
                     <tr>
                       <th className="p-3">Distributor</th>
                       <th className="p-3">City</th>
                       <th className="p-3">Mapped SOs</th>
                       <th className="p-3 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {distributors.map(d => (
                       <tr key={d.id} className="hover:bg-gray-50">
                         <td className="p-3">
                           <p className="font-bold text-gray-800">{d.name}</p>
                           <p className="text-[10px] text-gray-400">{d.id}</p>
                         </td>
                         <td className="p-3 text-gray-600">{d.city || "-"}</td>
                         <td className="p-3 text-blue-600 text-xs font-bold">{d.mapped_SO_emails?.join(", ") || "Unmapped"}</td>
                         <td className="p-3 text-right space-x-2">
                            <button onClick={() => handleEditDist(d)} className="text-blue-600 font-bold text-xs hover:underline">Edit</button>
                            <button onClick={() => handleDeleteDist(d.id)} className="text-red-600 font-bold text-xs hover:underline">Delete</button>
                          </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
           </div>
          )}

          {/* ================= SKUs TAB ================= */}
          {activeTab === "skus" && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-800 mb-4">{editingSku ? "Edit SKU" : "Add New SKU"}</h2>
                <form onSubmit={handleSaveSku} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500">SKU Code *</label>
                    <input required type="text" value={skuForm.sku} onChange={e => setSkuForm({...skuForm, sku: e.target.value})} disabled={!!editingSku} className="w-full p-2 border rounded-lg mt-1 bg-gray-50 disabled:opacity-50" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-gray-500">Product Name *</label>
                    <input required type="text" value={skuForm.name} onChange={e => setSkuForm({...skuForm, name: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500">MRP (₹) *</label>
                    <input required type="number" value={skuForm.mrp} onChange={e => setSkuForm({...skuForm, mrp: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500">GST %</label>
                    <input required type="number" value={skuForm.gst} onChange={e => setSkuForm({...skuForm, gst: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500">Category</label>
                    <input type="text" value={skuForm.category} onChange={e => setSkuForm({...skuForm, category: e.target.value})} className="w-full p-2 border rounded-lg mt-1 bg-gray-50" />
                  </div>
                  <div className="md:col-span-3 flex items-center gap-4 mt-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                      <input type="checkbox" checked={skuForm.is_focus} onChange={e => setSkuForm({...skuForm, is_focus: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                      Mark as Focus Product
                    </label>
                    <div className="flex-1 flex gap-2 justify-end">
                      <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg shadow-sm">{editingSku ? "Update SKU" : "Save SKU"}</button>
                      {editingSku && <button type="button" onClick={() => { setEditingSku(null); setSkuForm({ sku: "", name: "", mrp: "", gst: "18", category: "", is_focus: false }); }} className="bg-gray-200 text-gray-700 font-bold py-2 px-6 rounded-lg">Cancel</button>}
                    </div>
                  </div>
                </form>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-gray-50"><h2 className="text-lg font-bold text-gray-800">SKU List ({skus.length})</h2></div>
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0">
                      <tr>
                        <th className="p-3">SKU</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">MRP</th>
                        <th className="p-3">GST</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {skus.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="p-3 font-bold text-gray-800">{s.sku}</td>
                          <td className="p-3 text-gray-600 truncate max-w-[200px]">{s.name}</td>
                          <td className="p-3 font-bold">₹{s.mrp}</td>
                          <td className="p-3 text-gray-500">{s.gst}%</td>
                          <td className="p-3 text-gray-500">{s.category}</td>
                          <td className="p-3 text-right space-x-2">
                            <button onClick={() => handleEditSku(s)} className="text-blue-600 font-bold text-xs hover:underline">Edit</button>
                            <button onClick={() => handleDeleteSku(s.id)} className="text-red-600 font-bold text-xs hover:underline">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* Keep BottomNav for mobile viewing, but hide it on desktop screens */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}