// src/RootApp.jsx
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import App from "@ui/App";
import ProfileStats from "./components/ProfileStats";
import TournamentHistory from "./components/TournamentHistory";
import TitleScreen from "./ui/screens/TitleScreen";
import TitleSettingsScreen from "./ui/screens/TitleSettingsScreen";
import TournamentScreen from "./ui/screens/TournamentScreen";

export default function RootApp() {
  return (
    <Routes>
      <Route path="/" element={<TitleScreen />} />
      <Route path="/game" element={<App />} />
      <Route path="/settings" element={<TitleSettingsScreen />} />
      <Route path="/tournament" element={<TournamentScreen />} />
      <Route path="/profile" element={<ProfileStats />} />
      <Route path="/history" element={<TournamentHistory />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
