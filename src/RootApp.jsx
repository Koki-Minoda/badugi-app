// src/RootApp.jsx
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import App from "@ui/App";
import ProfileStats from "./components/ProfileStats";
import HistoryScreen from "./ui/screens/HistoryScreen.jsx";
import TitleScreen from "./ui/screens/TitleScreen";
import GameSelectorScreen from "./ui/screens/GameSelectorScreen.jsx";
import TitleSettingsScreen from "./ui/screens/TitleSettingsScreen";
import TournamentScreen from "./ui/screens/TournamentScreen";
import MixedGameScreen from "./ui/screens/MixedGameScreen";
import MultiGameScreen from "./ui/screens/MultiGameScreen.jsx";
import DealersChoiceScreen from "./ui/screens/DealersChoiceScreen.jsx";
import MainMenuScreen from "./ui/screens/MainMenuScreen.jsx";
import LeaderboardScreen from "./ui/screens/LeaderboardScreen.jsx";
import { GameEngineProvider } from "./ui/engine/GameEngineContext";
import { MixedGameProvider } from "./ui/mixed/MixedGameContext.jsx";

export default function RootApp() {
  return (
    <MixedGameProvider>
      <Routes>
        <Route path="/" element={<TitleScreen />} />
        <Route path="/menu" element={<MainMenuScreen />} />
        <Route path="/mixed" element={<MixedGameScreen />} />
        <Route path="/games" element={<GameSelectorScreen />} />
        <Route path="/multigame" element={<MultiGameScreen />} />
        <Route path="/dealers-choice" element={<DealersChoiceScreen />} />
        <Route
          path="/game"
          element={
            <GameEngineProvider gameId="badugi">
              <App />
            </GameEngineProvider>
          }
        />
        <Route path="/settings" element={<TitleSettingsScreen />} />
        <Route path="/tournament" element={<TournamentScreen />} />
        <Route path="/leaderboard" element={<LeaderboardScreen />} />
        <Route path="/profile" element={<ProfileStats />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MixedGameProvider>
  );
}
