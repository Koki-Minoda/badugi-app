// src/ui/game/nlh/registerNLHUIAdapter.js

import { NLHUIAdapter } from "./NLHUIAdapter.js";
import {
  getGameUIAdapter,
  registerGameUIAdapter,
} from "../GameUIAdapterRegistry.js";

const VARIANT_ID = "nlh";

export function ensureNLHUIAdapterRegistered(options = {}) {
  const existing = getGameUIAdapter(VARIANT_ID);
  if (existing) {
    return existing;
  }
  const adapter = new NLHUIAdapter(options);
  registerGameUIAdapter(VARIANT_ID, adapter);
  return adapter;
}

export default ensureNLHUIAdapterRegistered;
