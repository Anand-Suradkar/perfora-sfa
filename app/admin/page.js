"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";
import Papa from "papaparse";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [distFilter, setDistFilter] = useState("ALL");
  const [soFilter, setSoFilter] = useState("ALL");

  // --- DATA STATES ---
  const [skus, setSkus] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [claims, setClaims] = useState([]);

  // --- MODAL STATES ---
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showDistModal, setShowDistModal] = useState(false);
  const [showSkuModal, setShowSkuModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  // --- FORM STATES ---
  const [storeForm, setStoreForm] = useState({ id: "", name: "", owner: "", distributor_id: "", SO_email: "", status: "Active" });
  const [distForm, setDistForm] = useState({ id: "", name: "", city: "", so_emails: "" });
  const [skuForm, setSkuForm] = useState({ sku: "", name: "", mrp: "", gst: "18", category: "", is_focus: false, img: "" });
  const [userForm, setUserForm] = useState({ email: "", name: "", role: "SO" });

  // Dynamic Greeting
  const hr = new Date().getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const adminName = auth.currentUser?.displayName || "Admin";

  const fetchData = async () => {
    setLoading(true);
    try {
      const skuSnap = await getDocs(collection(db, "sku_master"));
      setSkus(skuSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.sku.localeCompare(b.sku)));

      const distSnap = await getDocs(collection(db, "distributors"));
      const dList = distSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDistributors(dList);

      const storeSnap = await getDocs(collection(db, "stores"));
      setStores(storeSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const userSnap = await getDocs(collection(db, "users"));
      setUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch Claims from Orders
      const orderSnap = await getDocs(collection(db, "orders"));
      let allClaims = [];
      orderSnap.docs.forEach(d => {
        const order = d.data();
        const invNo = d.id.slice(-6).toUpperCase();
        const soEmail = order.SO_email || "";
        const dName = dList.find(x => x.id === order.distributor_id)?.name || order.distributor_id;

        order.items.forEach(i => {
          if (i.extraScheme > 0) {
            allClaims.push({ 
              invoiceNo: invNo,
              orderId: d.id,
              date: new Date(order.createdAt.toMillis()).toLocaleDateString(),
              store: order.storeName || order.store_id,
              distId: order.distributor_id,
              distName: dName,
              soEmail: soEmail,
              sku: i.sku,
              skuName: i.skuName,
              mrp: i.mrp,
              qty: i.qty,
              scheme: i.extraScheme,
              claimAmount: Number(i.claim)
            });
          }
        });
      });
      setClaims(allClaims.sort((a,b) => new Date(b.date) - new Date(a.date)));
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

  // ================= SAVE HANDLERS =================
  const saveStore = async (e) => {
    e.preventDefault();
    const storeId = storeForm.id || "STR-" + Date.now();
    await setDoc(doc(db, "stores", storeId), { ...storeForm, id: storeId });
    setShowStoreModal(false); fetchData();
  };

  const saveDist = async (e) => {
    e.preventDefault();
    const distId = distForm.id.toUpperCase().trim();
    const emailsArray = distForm.so_emails.split(",").map(email => email.trim().toLowerCase()).filter(email => email !== "");
    await setDoc(doc(db, "distributors", distId), { id: distId, name: distForm.name, city: distForm.city, mapped_SO_emails: emailsArray });
    setShowDistModal(false); fetchData();
  };

  const saveSku = async (e) => {
    e.preventDefault();
    const skuId = skuForm.sku.toUpperCase().trim();
    await setDoc(doc(db, "sku_master", skuId), { ...skuForm, sku: skuId, mrp: Number(skuForm.mrp), gst: Number(skuForm.gst) });
    setShowSkuModal(false); fetchData();
  };

  const saveUser = async (e) => {
    e.preventDefault();
    if(!userForm.email) return;
    await setDoc(doc(db, "users", userForm.email.toLowerCase()), { ...userForm, email: userForm.email.toLowerCase() });
    setShowUserModal(false); fetchData();
  };

  const deleteItem = async (col, id) => {
    if (!confirm(`Delete ${id}?`)) return;
    await deleteDoc(doc(db, col, id));
    fetchData();
  };

  // ================= EXPORT CLAIMS =================
  const exportClaims = () => {
    const headers = ["Date", "Invoice No", "Distributor", "SO Email", "Store", "SKU", "SKU Name", "MRP", "Qty", "Scheme %", "Claim Amount"];
    const data = filteredClaims.map(c => [c.date, c.invoiceNo, c.distName, c.soEmail, c.store, c.sku, c.skuName, c.mrp, c.qty, c.scheme, c.claimAmount]);
    const csv = Papa.unparse({ fields: headers, data });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Claims_Export_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  // Filtering logic
  const filteredStores = stores.filter(s => {
    const matchSearch = s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || s.id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDist = distFilter === "ALL" || s.distributor_id === distFilter;
    return matchSearch && matchDist;
  });

  const filteredClaims = claims.filter(c => {
    const matchDist = distFilter === "ALL" || c.distId === distFilter;
    const matchSO = soFilter === "ALL" || c.soEmail === soFilter;
    return matchDist && matchSO;
  });

  return (
    <div className="min-h-screen bg-[#F3F4F6] font-sans pb-20 md:pb-0">
      
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black text-gray-800 tracking-tight">Perfora Admin</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-gray-800">{greeting}, {adminName.split(' ')[0]}!</p>
            <p className="text-xs text-gray-500">Wed, 22 Oct 2026</p>
          </div>
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-700">
            AD
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row min-h-[calc(100vh-73px)]">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-white border-r border-gray-200 p-4 space-y-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Menu</p>
          <button onClick={() => setActiveTab("overview")} className={"w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all " + (activeTab === "overview" ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50')}>📊 Overview</button>
          <button onClick={() => setActiveTab("stores")} className={"w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all " + (activeTab === "stores" ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50')}>🏪 Stores</button>
          <button onClick={() => setActiveTab("distributors")} className={"w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all " + (activeTab === "distributors" ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50')}>🏢 Distributors</button>
          <button onClick={() => setActiveTab("users")} className={"w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all " + (activeTab === "users" ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50')}>👥 Users (SOs)</button>
          <button onClick={() => setActiveTab("skus")} className={"w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all " + (activeTab === "skus" ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50')}>📦 SKU Master</button>
          <button onClick={() => setActiveTab("claims")} className={"w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all " + (activeTab === "claims" ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50')}>💰 Claims</button>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-hidden">
          
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-2xl shadow-sm text-white">
                  <p className="text-sm font-bold opacity-80">Total Stores</p>
                  <h2 className="text-3xl font-black mt-2">{stores.length}</h2>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-5 rounded-2xl shadow-sm text-white">
                  <p className="text-sm font-bold opacity-80">Total SKUs</p>
                  <h2 className="text-3xl font-black mt-2">{skus.length}</h2>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-2xl shadow-sm text-white">
                  <p className="text-sm font-bold opacity-80">Distributors</p>
                  <h2 className="text-3xl font-black mt-2">{distributors.length}</h2>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-5 rounded-2xl shadow-sm text-white">
                  <p className="text-sm font-bold opacity-80">Total Claims</p>
                  <h2 className="text-3xl font-black mt-2">₹{claims.reduce((a,c) => a + c.claimAmount, 0).toFixed(0)}</h2>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
                <div className="flex gap-4">
                  <button onClick={() => { setActiveTab("claims"); exportClaims(); }} className="bg-orange-100 text-orange-700 font-bold px-6 py-3 rounded-xl hover:bg-orange-200">⬇ Export Claims Data</button>
                </div>
              </div>
            </div>
          )}

          {/* STORES TAB */}
          {activeTab === "stores" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50">
                <h2 className="text-lg font-bold text-gray-800">Store Management ({filteredStores.length})</h2>
                <div className="flex gap-2 w-full md:w-auto">
                  <select value={distFilter} onChange={e => setDistFilter(e.target.value)} className="p-2 border rounded-lg text-sm bg-white">
                    <option value="ALL">All Distributors</option>
                    {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <input type="text" placeholder="Search store..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded-lg text-sm flex-1" />
                  <button onClick={() => { setStoreForm({ id: "", name: "", owner: "", distributor_id: "", SO_email: "", status: "Active" }); setShowStoreModal(true); }} className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-sm whitespace-nowrap">+ Add Store</button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[650px]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0">
                    <tr><th className="p-3">Store Name</th><th className="p-3">Distributor</th><th className="p-3">SO Email</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStores.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="p-3 font-bold text-gray-800">{s.name} <br/><span className="text-[10px] text-gray-400 font-normal">{s.id}</span></td>
                        <td className="p-3 text-gray-600">{s.distributor_id}</td>
                        <td className="p-3 text-gray-600 text-xs">{s.SO_email || "-"}</td>
                        <td className="p-3"><span className={"px-2 py-1 rounded text-[10px] font-bold " + (s.status === "Closed" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>{s.status || "Active"}</span></td>
                        <td className="p-3 text-right space-x-2">
                          <button onClick={() => { setStoreForm(s); setShowStoreModal(true); }} className="text-blue-600 font-bold text-xs">Edit</button>
                          <button onClick={() => deleteItem("stores", s.id)} className="text-red-600 font-bold text-xs">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CLAIMS TAB */}
          {activeTab === "claims" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50">
                <h2 className="text-lg font-bold text-orange-800">Claims Dashboard</h2>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <select value={distFilter} onChange={e => setDistFilter(e.target.value)} className="p-2 border rounded-lg text-sm bg-white">
                    <option value="ALL">All Distributors</option>
                    {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select value={soFilter} onChange={e => setSoFilter(e.target.value)} className="p-2 border rounded-lg text-sm bg-white">
                    <option value="ALL">All SOs</option>
                    {users.filter(u => u.role === "SO").map(u => <option key={u.id} value={u.email}>{u.email}</option>)}
                  </select>
                  <button onClick={exportClaims} className="bg-green-600 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-sm flex items-center gap-2">⬇ Export CSV</button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[650px]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0">
                    <tr><th className="p-3">Invoice / Date</th><th className="p-3">Distributor / SO</th><th className="p-3">Store</th><th className="p-3">SKU Details</th><th className="p-3">Scheme</th><th className="p-3 text-right">Claim Amount</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredClaims.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-3">
                          <p className="font-bold text-blue-700">{c.invoiceNo}</p>
                          <p className="text-[10px] text-gray-500">{c.date}</p>
                        </td>
                        <td className="p-3">
                          <p className="font-bold text-gray-800">{c.distName}</p>
                          <p className="text-[10px] text-gray-500">{c.soEmail}</p>
                        </td>
                        <td className="p-3 font-semibold text-gray-700">{c.store}</td>
                        <td className="p-3">
                          <p className="font-bold text-gray-800">{c.sku}</p>
                          <p className="text-[10px] text-gray-500">{c.skuName} (MRP: ₹{c.mrp})</p>
                        </td>
                        <td className="p-3 font-bold text-orange-600">{c.scheme}% <br/><span className="text-[10px] text-gray-500 font-normal">Qty: {c.qty}</span></td>
                        <td className="p-3 text-right font-black text-gray-900">₹{c.claimAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= USERS TAB ================= */}
          {activeTab === "users" && (
             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                 <h2 className="text-lg font-bold text-gray-800">Sales Officers ({users.length})</h2>
                 <button onClick={() => { setUserForm({ email: "", name: "", role: "SO" }); setShowUserModal(true); }} className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-sm">+ Add User</button>
               </div>
               <div className="overflow-x-auto max-h-[650px]">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0">
                     <tr><th className="p-3">Email</th><th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3 text-right">Actions</th></tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {users.map(u => (
                       <tr key={u.id} className="hover:bg-gray-50">
                         <td className="p-3 font-bold text-gray-800">{u.email}</td>
                         <td className="p-3 text-gray-600">{u.name || "-"}</td>
                         <td className="p-3"><span className="bg-gray-200 px-2 py-1 rounded text-xs font-bold">{u.role || "SO"}</span></td>
                         <td className="p-3 text-right space-x-2">
                            <button onClick={() => { setUserForm(u); setShowUserModal(true); }} className="text-blue-600 font-bold text-xs">Edit</button>
                            <button onClick={() => deleteItem("users", u.id)} className="text-red-600 font-bold text-xs">Delete</button>
                          </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
          )}

          {/* ================= DISTRIBUTORS TAB ================= */}
          {activeTab === "distributors" && (
             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                 <h2 className="text-lg font-bold text-gray-800">Distributors ({distributors.length})</h2>
                 <button onClick={() => { setDistForm({ id: "", name: "", city: "", so_emails: "" }); setShowDistModal(true); }} className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-sm">+ Add Distributor</button>
               </div>
               <div className="overflow-x-auto max-h-[650px]">
                 <table className="w-full text-left text-sm">
                   <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0">
                     <tr><th className="p-3">Distributor</th><th className="p-3">City</th><th className="p-3">Mapped SOs</th><th className="p-3 text-right">Actions</th></tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {distributors.map(d => (
                       <tr key={d.id} className="hover:bg-gray-50">
                         <td className="p-3 font-bold text-gray-800">{d.name} <br/><span className="text-[10px] text-gray-400">{d.id}</span></td>
                         <td className="p-3 text-gray-600">{d.city || "-"}</td>
                         <td className="p-3 text-blue-600 text-xs font-bold">{d.mapped_SO_emails?.join(", ") || "Unmapped"}</td>
                         <td className="p-3 text-right space-x-2">
                            <button onClick={() => { setDistForm({ id: d.id, name: d.name, city: d.city || "", so_emails: d.mapped_SO_emails ? d.mapped_SO_emails.join(", ") : "" }); setShowDistModal(true); }} className="text-blue-600 font-bold text-xs">Edit</button>
                            <button onClick={() => deleteItem("distributors", d.id)} className="text-red-600 font-bold text-xs">Delete</button>
                          </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
          )}

          {/* ================= SKU TAB ================= */}
          {activeTab === "skus" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h2 className="text-lg font-bold text-gray-800">SKU Master ({skus.length})</h2>
                <button onClick={() => { setSkuForm({ sku: "", name: "", mrp: "", gst: "18", category: "", is_focus: false, img: "" }); setShowSkuModal(true); }} className="bg-blue-600 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-sm">+ Add SKU</button>
              </div>
              <div className="overflow-x-auto max-h-[650px]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0">
                    <tr><th className="p-3">SKU</th><th className="p-3">Name</th><th className="p-3">MRP</th><th className="p-3">GST</th><th className="p-3">Category</th><th className="p-3 text-right">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {skus.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="p-3 font-bold text-gray-800">{s.sku}</td>
                        <td className="p-3 text-gray-600 max-w-[200px] truncate">{s.name}</td>
                        <td className="p-3 font-bold">₹{s.mrp}</td>
                        <td className="p-3 text-gray-500">{s.gst}%</td>
                        <td className="p-3 text-gray-500">{s.category}</td>
                        <td className="p-3 text-right space-x-2">
                          <button onClick={() => { setSkuForm(s); setShowSkuModal(true); }} className="text-blue-600 font-bold text-xs">Edit</button>
                          <button onClick={() => deleteItem("sku_master", s.id)} className="text-red-600 font-bold text-xs">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ================= MODALS ================= */}
      
      {/* Store Modal */}
      {showStoreModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{storeForm.id ? "Edit Store" : "Add New Store"}</h2>
            <form onSubmit={saveStore} className="space-y-3">
              <input required type="text" placeholder="Store Name" value={storeForm.name} onChange={e => setStoreForm({...storeForm, name: e.target.value})} className="w-full p-2 border rounded-lg" />
              <input type="text" placeholder="Owner Name" value={storeForm.owner} onChange={e => setStoreForm({...storeForm, owner: e.target.value})} className="w-full p-2 border rounded-lg" />
              <select required value={storeForm.distributor_id} onChange={e => setStoreForm({...storeForm, distributor_id: e.target.value})} className="w-full p-2 border rounded-lg">
                <option value="">Select Distributor...</option>
                {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input type="email" placeholder="SO Email" value={storeForm.SO_email} onChange={e => setStoreForm({...storeForm, SO_email: e.target.value})} className="w-full p-2 border rounded-lg" />
              <select value={storeForm.status} onChange={e => setStoreForm({...storeForm, status: e.target.value})} className="w-full p-2 border rounded-lg">
                <option value="Active">Active</option>
                <option value="Closed">Closed / Dead</option>
              </select>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setShowStoreModal(false)} className="px-4 py-2 text-gray-600 font-bold">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Distributor Modal */}
      {showDistModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{distForm.id ? "Edit Distributor" : "Add Distributor"}</h2>
            <form onSubmit={saveDist} className="space-y-3">
              <input required type="text" placeholder="Distributor ID (e.g. D01)" value={distForm.id} onChange={e => setDistForm({...distForm, id: e.target.value})} disabled={!!distForm.id} className="w-full p-2 border rounded-lg disabled:bg-gray-100" />
              <input required type="text" placeholder="Distributor Name" value={distForm.name} onChange={e => setDistForm({...distForm, name: e.target.value})} className="w-full p-2 border rounded-lg" />
              <input type="text" placeholder="City" value={distForm.city} onChange={e => setDistForm({...distForm, city: e.target.value})} className="w-full p-2 border rounded-lg" />
              <textarea placeholder="SO Emails (comma separated)" value={distForm.so_emails} onChange={e => setDistForm({...distForm, so_emails: e.target.value})} className="w-full p-2 border rounded-lg" rows="2"></textarea>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setShowDistModal(false)} className="px-4 py-2 text-gray-600 font-bold">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SKU Modal */}
      {showSkuModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{skuForm.id ? "Edit SKU" : "Add SKU"}</h2>
            <form onSubmit={saveSku} className="space-y-3">
              <input required type="text" placeholder="SKU Code" value={skuForm.sku} onChange={e => setSkuForm({...skuForm, sku: e.target.value})} disabled={!!skuForm.id} className="w-full p-2 border rounded-lg disabled:bg-gray-100" />
              <input required type="text" placeholder="Product Name" value={skuForm.name} onChange={e => setSkuForm({...skuForm, name: e.target.value})} className="w-full p-2 border rounded-lg" />
              <div className="flex gap-2">
                <input required type="number" placeholder="MRP" value={skuForm.mrp} onChange={e => setSkuForm({...skuForm, mrp: e.target.value})} className="w-1/2 p-2 border rounded-lg" />
                <input required type="number" placeholder="GST%" value={skuForm.gst} onChange={e => setSkuForm({...skuForm, gst: e.target.value})} className="w-1/2 p-2 border rounded-lg" />
              </div>
              <input type="text" placeholder="Category" value={skuForm.category} onChange={e => setSkuForm({...skuForm, category: e.target.value})} className="w-full p-2 border rounded-lg" />
              <input type="text" placeholder="Image Link (https://...)" value={skuForm.img || ""} onChange={e => setSkuForm({...skuForm, img: e.target.value})} className="w-full p-2 border rounded-lg" />
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={skuForm.is_focus} onChange={e => setSkuForm({...skuForm, is_focus: e.target.checked})} /> Focus Product
              </label>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setShowSkuModal(false)} className="px-4 py-2 text-gray-600 font-bold">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">{userForm.id ? "Edit User" : "Add User"}</h2>
            <form onSubmit={saveUser} className="space-y-3">
              <input required type="email" placeholder="Google Email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} disabled={!!userForm.id} className="w-full p-2 border rounded-lg disabled:bg-gray-100" />
              <input type="text" placeholder="Full Name" value={userForm.name || ""} onChange={e => setUserForm({...userForm, name: e.target.value})} className="w-full p-2 border rounded-lg" />
              <select value={userForm.role || "SO"} onChange={e => setUserForm({...userForm, role: e.target.value})} className="w-full p-2 border rounded-lg">
                <option value="SO">Sales Officer</option>
                <option value="Admin">Admin</option>
              </select>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 text-gray-600 font-bold">Cancel</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}