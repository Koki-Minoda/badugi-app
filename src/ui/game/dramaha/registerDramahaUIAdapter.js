import { registerGameUIAdapter, getGameUIAdapter } from "../GameUIAdapterRegistry.js";
import { NLHUIAdapter } from "../nlh/NLHUIAdapter.js";
import { DRAMAHA_APP_VARIANTS } from "../../../games/dramaha/DramahaVariants.js";

export class DramahaUIAdapter extends NLHUIAdapter {
  buildViewProps({ controllerSnapshot = {}, tableConfig = {} } = {}) {
    const props = super.buildViewProps({ controllerSnapshot, tableConfig });
    const street = String(controllerSnapshot?.street ?? "").toUpperCase();
    if (street !== "DRAW") {
      return props;
    }
    const players = controllerSnapshot?.players ?? [];
    const hero = players[0] ?? null;
    const isHeroTurn =
      hero &&
      hero.seatOut !== true &&
      hero.folded !== true &&
      hero.allIn !== true &&
      hero.hasDrawn !== true &&
      (controllerSnapshot.currentActor ?? controllerSnapshot.turn ?? null) === 0;
    return {
      ...props,
      tablePhase: "DRAW",
      controlsConfig: {
        ...(props.controlsConfig ?? {}),
        phase: "DRAW",
        street: "DRAW",
        isHeroTurn: Boolean(isHeroTurn),
      },
    };
  }

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
