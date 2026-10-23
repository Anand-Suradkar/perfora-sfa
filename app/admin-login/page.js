"use client";

import { useState } from "react";
import { auth, db } from "../lib/firebase"; 
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Save user to Firestore so they appear in the Users list
      await setDoc(doc(db, "users", userCredential.user.email), {
        email: userCredential.user.email,
        name: userCredential.user.email.split('@')[0],
        role: "Admin" // Since they are logging in via Admin portal
      }, { merge: true });

      router.push("/admin");
    } catch (error) {
      alert("Login failed: " + error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h1 className="text-2xl font-black text-center mb-6">Admin Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            className="w-full p-3 border rounded-xl" 
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            className="w-full p-3 border rounded-xl" 
            required 
          />
          <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}