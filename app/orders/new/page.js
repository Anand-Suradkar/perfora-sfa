"use client";

import { useState, useEffect, Suspense } from "react";
import { db, auth } from "../../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "../../components/BottomNav";

function OrderTakingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [distributors, setDistributors] = useState([]);
  const [stores, setStores] = useState([]);
  const [skus, setSkus] = useState([]);
  
  const [selectedDist, setSelectedDist] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);

  // Load cart from local storage & preselect store from URL
  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem("perfora_cart") || "[]");
    setCart(savedCart);
    
    const urlStoreId = searchParams.get("storeId");
    const urlDistId = searchParams.get("distId");
    if (urlStoreId) setSelectedStore(urlStoreId);
    if (urlDistId) setSelectedDist(urlDistId);
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      const isAdmin = auth.currentUser.email === "anand@perforacare.com";

      let distQuery = isAdmin ? query(collection(db, "distributors")) : query(collection(db, "distributors"), where("mapped_SO_emails", "array-contains", auth.currentUser.email));
      const distSnap = await getDocs(distQuery);
      setDistributors(distSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      let storeQuery = isAdmin ? query(collection(db, "stores")) : query(collection(db, "stores"), where("SO_email", "==", auth.currentUser.email));
      const storeSnap = await getDocs(storeQuery);
      setStores(storeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const skuSnap = await getDocs(collection(db, "sku_master"));
      setSkus(skuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, []);

  // If URL had a store, set the dist based on the store's mapping
  useEffect(() => {
    if (selectedStore && stores.length > 0) {
      const storeObj = stores.find(s => s.id === selectedStore);
      if (storeObj && storeObj.distributor_id) setSelectedDist(storeObj.distributor_id);
    }
  }, [selectedStore, stores]);

  const filteredStores = stores.filter(s => s.distributor_id === selectedDist);
  const categories = ["All", ...new Set(skus.map(s => s.category || "General"))];

  const filteredSkus = skus.filter(s => {
    const matchesCat = activeCategory === "All" || (s.category || "General") === activeCategory;
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.sku.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const updateQty = (skuId, delta) => {
    let newCart = [...cart];
    const existing = newCart.find(item => item.sku === skuId);
    if (existing) {
      existing.qty += delta;
      if (existing.qty <= 0) newCart = newCart.filter(item => item.sku !== skuId);
    } else if (delta > 0) {
      newCart.push({ sku: skuId, qty: 1 });
    }
    setCart(newCart);
    localStorage.setItem("perfora_cart", JSON.stringify(newCart));
  };

  const getCartQty = (skuId) => cart.find(item => item.sku === skuId)?.qty || 0;

  const proceedToCart = () => {
    if (!selectedDist || !selectedStore) return alert("Please select Distributor and Store first.");
    if (cart.length === 0) return alert("Add some SKUs first.");
    
    localStorage.setItem("perfora_order_context", JSON.stringify({ distId: selectedDist, storeId: selectedStore }));
    router.push("/cart");
  };

  return (
    <div className="min-h-screen bg-[#f8f5ff] pb-32">
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 p-4 rounded-b-3xl shadow-lg text-white">
        <h1 className="text-2xl font-black">Order taking</h1>
        <p className="text-sm opacity-90 mt-1">Distributor → outlet → SKU</p>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto -mt-4">
        {/* Selectors */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 block">DISTRIBUTOR</label>
            <select className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium mt-1"
              value={selectedDist} onChange={(e) => { setSelectedDist(e.target.value); setSelectedStore(""); }}>
              <option value="">Select Distributor...</option>
              {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 block">STORE</label>
            <select className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium mt-1"
              value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} disabled={!selectedDist}>
              <option value="">Select Store...</option>
              {filteredStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Catalogue */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-gray-800">Product catalogue</h3>
            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{skus.length} SKUs</span>
          </div>
          
          <input type="text" placeholder="Search SKU / PER code" className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm mb-3" value={search} onChange={e => setSearch(e.target.value)} />

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-3">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} 
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${activeCategory === cat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                {cat}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-gray-400 font-bold mb-3 flex justify-between">Swipe left/right to browse 4 SKUs at a time <span>↔</span></p>

          <div className="space-y-3">
            {filteredSkus.map(sku => (
              <div key={sku.sku} className="flex items-center gap-3 border border-gray-100 p-2 rounded-xl">
                <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center text-xl">📦</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-purple-600">{sku.sku}</p>
                  <p className="text-xs font-black text-gray-800 leading-tight truncate">{sku.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">MRP ₹{sku.mrp} <span className="text-gray-400">Rate ex-GST ₹{(sku.mrp / 1.18 * 0.75).toFixed(2)}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(sku.sku, -1)} className="w-7 h-7 bg-gray-100 rounded-full font-bold">−</button>
                  <span className="text-sm font-black w-4 text-center">{getCartQty(sku.sku)}</span>
                  <button onClick={() => updateQty(sku.sku, 1)} className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full font-bold">+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-16 w-full max-w-md left-1/2 -translate-x-1/2 bg-white border-t border-gray-200 p-3 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40">
          <div className="flex justify-between items-center bg-blue-50 p-2 rounded-xl">
            <div>
              <p className="text-[10px] font-bold text-gray-500">Cart • {cart.length} SKU • {cart.reduce((a, b) => a + b.qty, 0)} units</p>
              <p className="text-sm font-black text-gray-900">₹ ---</p>
            </div>
            <button onClick={proceedToCart} className="bg-blue-600 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-md">
              View cart →
            </button>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrderTakingForm />
    </Suspense>
  );
}