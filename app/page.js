
"use client";

const OLD_APP_URL = "https://anand-suradkar.github.io/perfora-sales-pwa/";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f8f5ff] flex items-center justify-center p-5">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-purple-100 p-8 text-center">
        <div className="w-20 h-20 bg-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl font-black text-purple-700">P</span>
        </div>

        <h1 className="text-2xl font-extrabold text-gray-900">
          Perfora SFA
        </h1>

        <p className="text-gray-500 mt-2">
          Important Application Update
        </p>

        <div className="mt-8 bg-purple-50 rounded-2xl p-5">
          <h2 className="text-xl font-bold text-purple-800">
            Please Use Old App
          </h2>

          <p className="text-gray-600 text-sm mt-3 leading-6">
            The Firebase SFA application is no longer being used
            for daily sales operations.
          </p>

          <p className="text-gray-700 font-semibold mt-3">
            Please continue your work through the existing
            Perfora Sales Management App.
          </p>
        </div>

        <a
          href={OLD_APP_URL}
          className="block w-full mt-7 bg-purple-700 hover:bg-purple-800 text-white font-bold py-4 px-5 rounded-xl transition-colors"
        >
          GO TO PERFORA SALES MANAGEMENT APP
        </a>

        <p className="text-xs text-gray-400 mt-6">
          Please use the existing app for all sales activities.
        </p>
      </div>
    </main>
  );
}
