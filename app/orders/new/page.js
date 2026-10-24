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
  const [storeSearch, setStoreSearch] = useState("");
  const [showStoreList, setShowStoreList] = useState(false);
  
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem("perfora_cart") || "[]");
    setCart(savedCart);
    
    const urlStoreId = searchParams.get("storeId");
    const urlDistId = searchParams.get("distId");
    if (urlStoreId) {
      setSelectedStore(urlStoreId);
      setShowStoreList(false);
    }
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

  useEffect(() => {
    if (selectedStore && stores.length > 0) {
      const storeObj = stores.find(s => s.id === selectedStore);
      if (storeObj) {
        setSelectedDist(storeObj.distributor_id);
        setStoreSearch(storeObj.name);
      }
    }
  }, [selectedStore, stores]);

  const handleDistChange = (e) => {
    setSelectedDist(e.target.value);
    setSelectedStore("");
    setStoreSearch("");
  };

  const filteredStores = stores.filter(s => 
    s.distributor_id === selectedDist && 
    s.name.toLowerCase().includes(storeSearch.toLowerCase())
  );

  const handleSelectStore = (store) => {
    setSelectedStore(store.id);
    setStoreSearch(store.name);
    setShowStoreList(false);
  };

  const categories = ["All", ...new Set(skus.map(s => s.category || "General"))];

  const filteredSkus = skus.filter(s => {
    const matchesCat = activeCategory === "All" || (s.category || "General") === activeCategory;
    const searchLower = search.toLowerCase();
    const nameMatch = s.name ? s.name.toLowerCase().includes(searchLower) : false;
    const skuMatch = s.sku ? s.sku.toLowerCase().includes(searchLower) : false;
    return matchesCat && (nameMatch || skuMatch);
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
    <div className="min-h-screen bg-[#F5E8C8] pb-32">
      <div className="bg-gradient-to-r from-[#2A6080] to-[#1E455C] p-4 rounded-b-3xl shadow-lg text-white">
        <h1 className="text-2xl font-black">Order taking</h1>
        <p className="text-sm opacity-90 mt-1">Distributor → outlet → SKU</p>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto -mt-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 block">DISTRIBUTOR</label>
            <select className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium mt-1"
              value={selectedDist} onChange={handleDistChange}>
              <option value="">Select Distributor...</option>
              {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          
          <div className="relative">
            <label className="text-[10px] font-bold text-gray-500 block">STORE (SEARCH)</label>
            <input 
              type="text" 
              className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium mt-1"
              placeholder={selectedDist ? "Type to search store..." : "Select Distributor First"}
              value={storeSearch}
              onChange={(e) => { setStoreSearch(e.target.value); setSelectedStore(""); setShowStoreList(true); }}
              onFocus={() => setShowStoreList(true)}
              disabled={!selectedDist}
            />
            
            {showStoreList && storeSearch && selectedDist && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredStores.length === 0 ? (
                  <div className="p-3 text-xs text-gray-500">No stores found.</div>
                ) : (
                  filteredStores.map(s => (
                    <div key={s.id} onClick={() => handleSelectStore(s)} className="p-3 text-sm font-bold text-gray-800 border-b border-gray-50 hover:bg-[#F5E8C8] cursor-pointer">
                      {s.name} <span className="text-[10px] text-gray-400 font-normal">({s.city})</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-gray-800">Product catalogue</h3>
            <span className="text-[10px] font-bold bg-[#F5E8C8] text-[#2A6080] px-2 py-1 rounded-full">{filteredSkus.length} SKUs</span>
          </div>
          
          <input type="text" placeholder="Search SKU / Product Name" className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm mb-3" value={search} onChange={e => setSearch(e.target.value)} />

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-3">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} 
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${activeCategory === cat ? 'bg-[#2A6080] text-white border-[#2A6080]' : 'bg-white text-gray-600 border-gray-200'}`}>
                {cat}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-gray-400 font-bold mb-2 flex justify-between">Swipe left/right to browse <span>↔</span></p>

          {/* HORIZONTAL SWIPEABLE CATALOGUE */}
          <div className="flex overflow-x-auto gap-3 pb-4 snap-x scrollbar-hide">
            {filteredSkus.map(sku => {
              const gstRate = Number(sku.gst) || 0;
              const exGstRate = (Number(sku.mrp) * (100 - 25) / 100) / (1 + gstRate / 100);

              return (
              <div key={sku.sku} className="min-w-[85%] snap-center flex flex-col gap-2 border border-gray-100 p-3 rounded-xl bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center text-xl overflow-hidden shrink-0 border border-gray-200">
                    {sku.img ? (
                      <img src={sku.img} alt={sku.name} className="w-full h-full object-contain p-1" loading="lazy" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                    ) : null}
                    <span className={sku.img ? "hidden" : "block"}>📦</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-gray-200">
                    <button onClick={() => updateQty(sku.sku, -1)} className="w-6 h-6 rounded font-bold text-gray-600">−</button>
                    <span className="text-sm font-black w-4 text-center">{getCartQty(sku.sku)}</span>
                    <button onClick={() => updateQty(sku.sku, 1)} className="w-6 h-6 rounded font-bold text-[#2A6080]">+</button>
                  </div>
                </div>
                
                <div className="min-w-0 mt-1">
                  <p className="text-[10px] font-bold text-[#E05C1A]">{sku.sku}</p>
                  <p className="text-xs font-black text-gray-800 leading-tight truncate">{sku.name}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    MRP ₹{sku.mrp} <span className="text-gray-400">Rate ex-GST ₹{exGstRate.toFixed(2)}</span>
                  </p>
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-16 w-full max-w-md left-1/2 -translate-x-1/2 bg-white border-t border-gray-200 p-3 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40">
          <div className="flex justify-between items-center bg-[#F5E8C8] p-2 rounded-xl border border-[#e6d5af]">
            <div>
              <p className="text-[10px] font-bold text-gray-500">Cart • {cart.length} SKU • {cart.reduce((a, b) => a + b.qty, 0)} units</p>
              <p className="text-sm font-black text-[#2A6080]">Ready to Review</p>
            </div>
            <button onClick={proceedToCart} className="bg-[#2A6080] text-white font-bold text-xs px-4 py-2 rounded-lg shadow-md">
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