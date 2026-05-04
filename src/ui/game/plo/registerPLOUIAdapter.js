import { registerGameUIAdapter, getGameUIAdapter } from "../GameUIAdapterRegistry.js";
import { NLHUIAdapter } from "../nlh/NLHUIAdapter.js";
import { APP_VARIANT_IDS } from "../appVariantRouting.js";

export class PLOUIAdapter extends NLHUIAdapter {
  formatStreetLabel(streetId) {
    return super.formatStreetLabel(streetId);
  }
}

export function ensurePLOUIAdapterRegistered(options = {}) {
  const ids = [
    APP_VARIANT_IDS.PLO,
    APP_VARIANT_IDS.PLO8,
    APP_VARIANT_IDS.BIG_O,
    APP_VARIANT_IDS.FIVE_CARD_PLO,
  ];
  const existing = getGameUIAdapter(APP_VARIANT_IDS.PLO);
  if (existing && !options.force) {
    ids.forEach((id) => {
      if (!getGameUIAdapter(id)) registerGameUIAdapter(id, existing);
    });
    return existing;
  }
  const adapter = new PLOUIAdapter(options);
  ids.forEach((id) => registerGameUIAdapter(id, adapter));
  return adapter;
}

export default ensurePLOUIAdapterRegistered;
