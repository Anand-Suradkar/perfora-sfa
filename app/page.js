"use client";

import { useState } from "react";
import { auth, googleProvider } from "./lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // This line opens the Google popup!
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Logged in as:", result.user.email);
      
      // Once logged in, send them to the dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error(error);
      alert("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f5ff] flex flex-col items-center justify-center p-6 font-sans">
      <div className="mb-12 text-center">
        <div className="w-20 h-20 bg-purple-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <span className="text-4xl font-black text-purple-700">P</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Perfora SFA</h1>
        <p className="text-gray-500 mt-2 font-medium">Sales Force Automation</p>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm border border-purple-100">
        <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Welcome Back</h2>
        
        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-100 hover:border-purple-300 text-gray-700 font-semibold py-3.5 px-4 rounded-xl transition-all shadow-sm disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {loading ? "Signing in..." : "Sign in with Google"}
        </button>

        <p className="text-xs text-center text-gray-400 mt-6 font-medium">
          Admin & Sales Officers Only
        </p>
      </div>
    </div>
  );
}