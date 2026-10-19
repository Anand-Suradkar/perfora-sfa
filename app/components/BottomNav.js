"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: "🏠" },
    { name: "Orders", path: "/orders", icon: "📋" },
    { name: "Stores", path: "/stores", icon: "🏪" },
    { name: "New Store", path: "/new-store", icon: "➕" },
    { name: "Claim", path: "/claim", icon: "💰" },
  ];

  return (
    <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive ? "text-purple-600" : "text-gray-400 hover:text-purple-400"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className={`text-[10px] font-bold ${isActive ? "text-purple-600" : "text-gray-500"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}