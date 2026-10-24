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

  const [skus, setSkus] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [claims, setClaims] = useState([]);

  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showDistModal, setShowDistModal] = useState(false);
  const [showSkuModal, setShowSkuModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  const [storeForm, setStoreForm] = useState({ id: "", name: "", owner: "", distributor_id: "", SO_email: "", status: "Active" });
  const [distForm, setDistForm] = useState({ id: "", name: "", city: "", so_emails: "" });
  const [skuForm, setSkuForm] = useState({ sku: "", name: "", mrp: "", gst: "18", category: "", is_focus: false, img: "" });
  const [userForm, setUserForm] = useState({ email: "", name: "", role: "SO" });

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
              invoiceNo: invNo, orderId: d.id, date: new Date(order.createdAt.toMillis()).toLocaleDateString(),
              store: order.storeName || order.store_id, distId: order.distributor_id, distName: dName, soEmail: soEmail,
              sku: i.sku, skuName: i.skuName, category: i.category || "General", gst: i.gst || 0,
              mrp: i.mrp, qty: i.qty, scheme: i.extraScheme, claimAmount: Number(i.claim)
            });
          }
        });
      });
      setClaims(allClaims.sort((a,b) => new Date(b.date) - new Date(a.date)));
    } catch (error) {}
    setLoading(false);
  };

  useEffect(() => {
    const currentEmail = auth.currentUser?.email;
    if (currentEmail !== "anand@perforacare.com" && currentEmail !== "anandsuradkar9@gmail.com") {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [router]);

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

  const exportClaims = () => {
    const headers = ["Date", "Invoice No", "Distributor", "SO Email", "Store", "SKU", "SKU Name", "Category", "GST %", "MRP", "Qty", "Scheme %", "Claim Amount"];
    const data = filteredClaims.map(c => [c.date, c.invoiceNo, c.distName, c.soEmail, c.store, c.sku, c.skuName, c.category, c.gst, c.mrp, c.qty, c.scheme, c.claimAmount]);
    const csv = Papa.unparse({ fields: headers, data });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Claims_Export_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

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
    <div className="min-h-screen bg-[#F5E8C8] font-sans pb-20 md:pb-0">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black text-[#2A6080] tracking-tight">Perfora Admin</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-gray-800">{greeting}, {adminName.split(' ')[0]}!</p>
            <p className="text-xs text-gray-500">{new Date().toDateString()}</p>
          </div>
          <div className="w-10 h-10 bg-[#2A6080] text-white rounded-full flex items-center justify-center font-bold">AD</div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row min-h-[calc(100vh-73px)]">
        <div className="w-full md:w-64 bg-white border-r border-gray-200 p-4 space-y-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Menu</p>
          <button onClick={() => setActiveTab("overview")} className={"w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all " + (activeTab === "overview" ? 'bg-[#2A6080] text-white' : 'text-gray-600 hover:bg-gray-50')}>📊 Overview</button>
          <button onClick={() => setActiveTab("stores")} className={"w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all " + (activeTab === "stores" ? 'bg-[#2A6080] text-white' : 'text-gray-600 hover:bg-gray-50')}>🏪 Stores</button>
          <button onClick={() => setActiveTab("distributors")} className={"w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all " + (activeTab === "distributors" ? 'bg-[#2A6080] text-white' : 'text-gray-600 hover:bg-gray-50')}>🏢 Distributors</button>
          <button onClick={() => setActiveTab("users")} className={"w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all " + (activeTab === "users" ? 'bg-[#2A6080] text-white' : 'text-gray-600 hover:bg-gray-50')}>👥 Users (SOs)</button>
          <button onClick={() => setActiveTab("skus")} className={"w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all " + (activeTab === "skus" ? 'bg-[#2A6080] text-white' : 'text-gray-600 hover:bg-gray-50')}>📦 SKU Master</button>
          <button onClick={() => setActiveTab("claims")} className={"w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all " + (activeTab === "claims" ? 'bg-[#E05C1A] text-white' : 'text-gray-600 hover:bg-gray-50')}>💰 Claims</button>
        </div>

        <div className="flex-1 p-6 overflow-hidden">
          
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#2A6080] p-5 rounded-2xl shadow-sm text-white"><p className="text-sm font-bold opacity-80">Total Stores</p><h2 className="text-3xl font-black mt-2">{stores.length}</h2></div>
                <div className="bg-[#8BC44A] p-5 rounded-2xl shadow-sm text-white"><p className="text-sm font-bold opacity-80">Total SKUs</p><h2 className="text-3xl font-black mt-2">{skus.length}</h2></div>
                <div className="bg-[#F5C840] p-5 rounded-2xl shadow-sm text-gray-900"><p className="text-sm font-bold opacity-80">Distributors</p><h2 className="text-3xl font-black mt-2">{distributors.length}</h2></div>
                <div className="bg-[#E05C1A] p-5 rounded-2xl shadow-sm text-white"><p className="text-sm font-bold opacity-80">Total Claims</p><h2 className="text-3xl font-black mt-2">₹{claims.reduce((a,c) => a + c.claimAmount, 0).toFixed(0)}</h2></div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
                <div className="flex gap-4">
                  <button onClick={() => { setActiveTab("claims"); setTimeout(exportClaims, 500); }} className="bg-[#F5E8C8] text-[#E05C1A] font-bold px-6 py-3 rounded-xl border border-[#e6d5af] hover:bg-[#f0dab2]">⬇ Export All Claims Data</button>
                </div>
              </div>
            </div>
          )}

          {/* ... Other tabs follow the same color pattern in their headers/tables ... */}
          {activeTab === "stores" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50">
                <h2 className="text-lg font-bold text-[#2A6080]">Store Management ({filteredStores.length})</h2>
                <div className="flex gap-2 w-full md:w-auto">
                  <select value={distFilter} onChange={e => setDistFilter(e.target.value)} className="p-2 border rounded-lg text-sm bg-white">
                    <option value="ALL">All Distributors</option>
                    {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <input type="text" placeholder="Search store..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded-lg text-sm flex-1" />
                  <button onClick={() => { setStoreForm({ id: "", name: "", owner: "", distributor_id: "", SO_email: "", status: "Active" }); setShowStoreModal(true); }} className="bg-[#2A6080] text-white font-bold px-4 py-2 rounded-lg text-sm shadow-sm whitespace-nowrap">+ Add Store</button>
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
                        <td className="p-3"><span className={"px-2 py-1 rounded text-[10px] font-bold " + (s.status === "Closed" ? "bg-red-100 text-red-700" : "bg-[#8BC44A] text-white")}>{s.status || "Active"}</span></td>
                        <td className="p-3 text-right space-x-2">
                          <button onClick={() => { setStoreForm(s); setShowStoreModal(true); }} className="text-[#2A6080] font-bold text-xs">Edit</button>
                          <button onClick={() => deleteItem("stores", s.id)} className="text-[#E05C1A] font-bold text-xs">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ... (Other tabs like Users, Distributors, SKUs, Claims follow the same UI structure as before, just with updated colors) ... */}
          {/* (Please copy the rest of the tabs from the previous Admin code block, just changing 'bg-blue-600' to 'bg-[#2A6080]' and 'bg-red-600' to 'bg-[#E05C1A]' if you want to match exactly) */}
          
        </div>
      </div>

      {showStoreModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Edit Store</h2>
            <form onSubmit={saveStore} className="space-y-3">
              <input required type="text" placeholder="Store Name" value={storeForm.name} onChange={e => setStoreForm({...storeForm, name: e.target.value})} className="w-full p-2 border rounded-lg" />
              <input type="text" placeholder="Owner Name" value={storeForm.owner} onChange={e => setStoreForm({...storeForm, owner: e.target.value})} className="w-full p-2 border rounded-lg" />
              <select required value={storeForm.distributor_id} onChange={e => setStoreForm({...storeForm, distributor_id: e.target.value})} className="w-full p-2 border rounded-lg">
                <option value="">Select Distributor...</option>
                {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              
              {/* FIX #7: Dropdown to change SO */}
              <div>
                  <label className="text-[10px] font-bold text-gray-500">Assign to Sales Officer</label>
                  <select value={storeForm.SO_email} onChange={e => setStoreForm({...storeForm, SO_email: e.target.value})} className="w-full p-2 border rounded-lg mt-1">
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.email}>{u.name || u.email} ({u.role})</option>)}
                  </select>
              </div>
              
              <select value={storeForm.status} onChange={e => setStoreForm({...storeForm, status: e.target.value})} className="w-full p-2 border rounded-lg">
                <option value="Active">Active</option>
                <option value="Closed">Closed / Dead</option>
              </select>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setShowStoreModal(false)} className="px-4 py-2 text-gray-600 font-bold">Cancel</button>
                <button type="submit" className="bg-[#2A6080] text-white px-4 py-2 rounded-lg font-bold">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ... (Other Modals follow the same pattern) ... */}

      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}