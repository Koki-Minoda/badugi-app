import { registerGameUIAdapter, getGameUIAdapter } from "../GameUIAdapterRegistry.js";
import { NLHUIAdapter } from "../nlh/NLHUIAdapter.js";
import { DRAMAHA_APP_VARIANTS } from "../../../games/dramaha/DramahaVariants.js";

export class DramahaUIAdapter extends NLHUIAdapter {
  formatStreetLabel(streetId) {
    switch (String(streetId ?? "").toUpperCase()) {
      case "PREFLOP":
        return "Preflop";
      case "FLOP":
        return "Flop";
      case "DRAW":
        return "Draw";
      case "FINAL":
        return "Final Bet";
      case "SHOWDOWN":
        return "Showdown";
      default:
        return super.formatStreetLabel(streetId);
    }
  }
}

export function ensureDramahaUIAdaptersRegistered(options = {}) {
  const ids = Object.values(DRAMAHA_APP_VARIANTS);
  const registered = {};
  ids.forEach((id) => {
    const existing = getGameUIAdapter(id);
    if (existing && !options.force) {
      registered[id] = existing;
      return;
    }
    const adapter = new DramahaUIAdapter(options);
    registerGameUIAdapter(id, adapter);
    registered[id] = adapter;
  });
  return registered;
}

export default ensureDramahaUIAdaptersRegistered;
