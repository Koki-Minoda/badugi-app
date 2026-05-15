// src/RootApp.jsx
import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import App from "@ui/App";
import ProfileStats from "./components/ProfileStats";
import HistoryScreen from "./ui/screens/HistoryScreen.jsx";
import GameSelectorScreen from "./ui/screens/GameSelectorScreen.jsx";
import TitleSettingsScreen from "./ui/screens/TitleSettingsScreen";
import TournamentScreen from "./ui/screens/TournamentScreen";
import MixedGameScreen from "./ui/screens/MixedGameScreen";
import MultiGameScreen from "./ui/screens/MultiGameScreen.jsx";
import DealersChoiceScreen from "./ui/screens/DealersChoiceScreen.jsx";
import MainMenuScreen from "./ui/screens/MainMenuScreen.jsx";
import FriendMatchSetupScreen from "./ui/screens/FriendMatchSetupScreen.jsx";
import LeaderboardScreen from "./ui/screens/LeaderboardScreen.jsx";
import LearningDashboardPreviewScreen from "./ui/screens/LearningDashboardPreviewScreen.jsx";
import { isCoachingPreviewEnabled } from "./ui/coaching/previewFeatureFlags.js";
import { GameEngineProvider } from "./ui/engine/GameEngineContext";
import { MixedGameProvider } from "./ui/mixed/MixedGameContext.jsx";

export default function RootApp() {
  const location = useLocation();
  const coachingPreviewEnabled = isCoachingPreviewEnabled({ search: location.search });
  return (
    <MixedGameProvider>
      <Routes>
        <Route path="/dev/menu" element={<MainMenuScreen coachingPreviewEnabled={coachingPreviewEnabled} />} />
        <Route
          path="/dev/learning-dashboard-preview"
          element={coachingPreviewEnabled ? <LearningDashboardPreviewScreen /> : <Navigate to="/dev/menu" replace />}
        />
        <Route
          path="/"
          element={
            <GameEngineProvider gameId="badugi">
              <App />
            </GameEngineProvider>
          }
        />
        <Route
          path="/dev/*"
          element={
            <GameEngineProvider gameId="badugi">
              <App />
            </GameEngineProvider>
          }
        />
        <Route path="/menu" element={<MainMenuScreen coachingPreviewEnabled={coachingPreviewEnabled} />} />
        <Route
          path="/learning-dashboard-preview"
          element={coachingPreviewEnabled ? <LearningDashboardPreviewScreen /> : <Navigate to="/menu" replace />}
        />
        <Route path="/friend-match" element={<FriendMatchSetupScreen />} />
        <Route path="/dev/friend-match" element={<FriendMatchSetupScreen />} />
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
        <Route path="/dev/history" element={<HistoryScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MixedGameProvider>
  );
}
