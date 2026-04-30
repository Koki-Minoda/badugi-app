import { BadugiUIAdapter } from "../badugi/BadugiUIAdapter.js";

export class DrawLowballUIAdapter extends BadugiUIAdapter {
  formatStreetLabel(streetId) {
    if (!streetId) return "";
    const normalized = String(streetId).toUpperCase();
    if (normalized === "BET") return "Betting";
    if (normalized === "DRAW") return "Draw";
    if (normalized === "SHOWDOWN") return "Showdown";
    return String(streetId);
  }

  formatHandLabel(evaluation) {
    if (!evaluation) return "";
    return evaluation.handLabel ?? evaluation.handName ?? evaluation.label ?? "";
  }

  formatHandRanks(evaluation) {
    if (!evaluation) return "";
    return evaluation.ranksLabel ?? evaluation.rankLabel ?? "";
  }
}

export default DrawLowballUIAdapter;
