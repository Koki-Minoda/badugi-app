// src/ui/game/badugi/registerBadugiUIAdapter.js

import { BadugiUIAdapter } from "./BadugiUIAdapter.js";
import {
  getGameUIAdapter,
  registerGameUIAdapter,
} from "../GameUIAdapterRegistry.js";

const BADUGI_VARIANT_ID = "badugi";

export function ensureBadugiUIAdapterRegistered(options = {}) {
  const existing = getGameUIAdapter(BADUGI_VARIANT_ID);
  if (existing) {
    return existing;
  }
  const adapterInstance = new BadugiUIAdapter(options);
  registerGameUIAdapter(BADUGI_VARIANT_ID, adapterInstance);
  return adapterInstance;
}

export default ensureBadugiUIAdapterRegistered;
