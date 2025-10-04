// src/RootApp.jsx
import React from "react";
import App from "./App"; // 👈 ゲーム画面（本体）
import ProfileStats from "./components/ProfileStats";
import TournamentHistory from "./components/TournamentHistory";

export default function RootApp() {
  const hash = typeof window !== "undefined" ? window.location.hash : "#home";

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Badugi App</h1>
        <nav className="flex gap-2">
          <a className="px-3 py-1.5 rounded-xl border hover:bg-gray-50" href="#home">Home</a>
          <a className="px-3 py-1.5 rounded-xl border hover:bg-gray-50" href="#profile">Profile</a>
          <a className="px-3 py-1.5 rounded-xl border hover:bg-gray-50" href="#history">History</a>
        </nav>
      </header>

      <main>
        {hash === "#profile" && <ProfileStats />}
        {hash === "#history" && <TournamentHistory />}
        {(!hash || hash === "#home") && <App />} {/* 👈 ゲーム画面 */}
      </main>
    </div>
  );
}
