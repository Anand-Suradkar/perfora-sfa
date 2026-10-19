"use client";
import { useState } from "react";
import { db } from "../lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export default function SeedPage() {
  const [status, setStatus] = useState("");

  const seedData = async () => {
    setStatus("Seeding distributors...");
    try {
      // 1. Distributors
      const dists = [
        { id: "D01", name: "Sanvi / A H Ent", mapped_SO_email: "anand@perforacare.com" },
        { id: "D02", name: "TOYOTOYZ", mapped_SO_email: "anand@perforacare.com" },
        { id: "D03", name: "M K / Meharwan", mapped_SO_email: "anand@perforacare.com" },
        { id: "D04", name: "A B Marketing", mapped_SO_email: "anand@perforacare.com" },
        { id: "D05", name: "RMS Sales", mapped_SO_email: "anand@perforacare.com" },
        { id: "D06", name: "Shree Sai Sales", mapped_SO_email: "anand@perforacare.com" },
        { id: "D07", name: "Bombay OTC House", mapped_SO_email: "anand@perforacare.com" },
      ];
      for (let d of dists) {
        await setDoc(doc(db, "distributors", d.id), d);
      }

      setStatus("Seeding SKUs...");
      // 2. SKU Master
      const skus = [
        { sku: "PC-001", name: "Perforacare Pain Relief 100ml", mrp: 180, category: "Pain Relief", is_focus: true },
        { sku: "PC-002", name: "Perforacare Cough Syrup 100ml", mrp: 145, category: "Cough & Cold", is_focus: true },
        { sku: "PC-003", name: "Perforacare Antacid 200ml", mrp: 120, category: "Digestive", is_focus: false },
        { sku: "PC-004", name: "Perforacare Multivitamin 30tab", mrp: 350, category: "Nutraceutical", is_focus: true },
        { sku: "PC-005", name: "Perforacare Calcium+D3 30tab", mrp: 280, category: "Nutraceutical", is_focus: false },
      ];
      for (let s of skus) {
        await setDoc(doc(db, "sku_master", s.sku), s);
      }

      setStatus("Seeding stores...");
      // 3. Stores (Adding 3 stores to the first distributor)
      const stores = [
        { id: "S01", name: "Shree Medicals", owner: "Rajesh", distributor_id: "D01", SO_email: "anand@perforacare.com", type: "REPEAT" },
        { id: "S02", name: "Krishna Pharma", owner: "Amit", distributor_id: "D01", SO_email: "anand@perforacare.com", type: "REPEAT" },
        { id: "S03", name: "New Life Chemist", owner: "Suresh", distributor_id: "D01", SO_email: "anand@perforacare.com", type: "NEW" },
      ];
      for (let st of stores) {
        await setDoc(doc(db, "stores", st.id), st);
      }

      setStatus("✅ Done! Data successfully added to database.");
    } catch (error) {
      console.error(error);
      setStatus("❌ Error: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Database Seeder</h1>
        <p className="text-gray-500 text-sm mb-6">Click the button below to add 7 Distributors, 5 SKUs, and 3 Stores to your database.</p>
        
        <button 
          onClick={seedData}
          className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition-colors"
        >
          Seed Database Now
        </button>

        {status && (
          <div className="mt-6 p-4 bg-purple-50 text-purple-800 rounded-lg font-medium text-sm">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}