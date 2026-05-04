import { registerGameUIAdapter, getGameUIAdapter } from "../GameUIAdapterRegistry.js";
import { NLHUIAdapter } from "../nlh/NLHUIAdapter.js";
import { APP_VARIANT_IDS } from "../appVariantRouting.js";

export class PLOUIAdapter extends NLHUIAdapter {
  formatStreetLabel(streetId) {
    return super.formatStreetLabel(streetId);
  }
}

export function ensurePLOUIAdapterRegistered(options = {}) {
  const existing = getGameUIAdapter(APP_VARIANT_IDS.PLO);
  if (existing && !options.force) return existing;
  const adapter = new PLOUIAdapter(options);
  registerGameUIAdapter(APP_VARIANT_IDS.PLO, adapter);
  return adapter;
}

export default ensurePLOUIAdapterRegistered;
