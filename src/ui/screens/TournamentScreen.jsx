import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TournamentHubScreen from "./TournamentHubScreen.jsx";
import {
  discardQueuedTournamentSnapshots,
  resumeTournamentSnapshot,
  retireTournamentSnapshot,
} from "../utils/syncManager.js";
import {
  loadActiveMTTSnapshot,
  saveActiveMTTSnapshot,
} from "../tournament/tournamentManager.js";

function readStoredAuth() {
  try {
    return JSON.parse(window.localStorage.getItem("mgx_auth") ?? "null");
  } catch {
    return null;
  }
}

export default function TournamentScreen() {
  const navigate = useNavigate();
  const [activeSnapshot, setActiveSnapshot] = useState(() =>
    loadActiveMTTSnapshot(),
  );

  useEffect(() => {
    const auth = readStoredAuth();
    if (!auth?.accessToken) return undefined;
    let cancelled = false;
    const localSnapshot = loadActiveMTTSnapshot();
    resumeTournamentSnapshot({
      accessToken: auth.accessToken,
      tokenType: auth.tokenType,
    })
      .then((response) => {
        if (cancelled || !response?.hasSnapshot || response.snapshot?.version !== 1) {
          return;
        }
        const remoteSavedAt = Date.parse(response.snapshot.savedAt ?? "") || 0;
        const localSavedAt = Date.parse(localSnapshot?.savedAt ?? "") || 0;
        const selected =
          remoteSavedAt >= localSavedAt ? response.snapshot : localSnapshot;
        if (!selected) return;
        saveActiveMTTSnapshot(selected);
        setActiveSnapshot(selected);
      })
      .catch((error) => {
        if (!cancelled) console.warn("[MTT] Hub resume lookup failed", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TournamentHubScreen
      activeSnapshot={activeSnapshot}
      onBack={() => navigate("/menu")}
      onStartTournament={(config, stage) => {
        navigate(`/game?mode=store_tournament&stage=${stage.id}`, {
          state: {
            startTournamentMTT: true,
            stageId: stage.id,
            tournamentConfigId: config.id,
          },
        });
      }}
      onResumeTournament={() => {
        navigate("/game?mode=store_tournament&resume=1", {
          state: { resumeTournamentMTT: true },
        });
      }}
      onRetireTournament={() => {
        setActiveSnapshot(null);
        discardQueuedTournamentSnapshots();
        const auth = readStoredAuth();
        if (!auth?.accessToken) return;
        retireTournamentSnapshot({
          accessToken: auth.accessToken,
          tokenType: auth.tokenType,
        }).catch((error) => {
          console.warn("[MTT] Hub retire failed", error);
        });
      }}
    />
  );
}
