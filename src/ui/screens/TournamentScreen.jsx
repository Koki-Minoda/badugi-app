import React from "react";
import { useNavigate } from "react-router-dom";
import TournamentHubScreen from "./TournamentHubScreen.jsx";

export default function TournamentScreen() {
  const navigate = useNavigate();

  return (
    <TournamentHubScreen
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
    />
  );
}
