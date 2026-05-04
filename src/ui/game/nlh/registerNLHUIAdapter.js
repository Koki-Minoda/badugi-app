// src/ui/game/nlh/registerNLHUIAdapter.js

import { NLHUIAdapter } from "./NLHUIAdapter.js";
import {
  getGameUIAdapter,
  registerGameUIAdapter,
} from "../GameUIAdapterRegistry.js";
import { APP_VARIANT_IDS } from "../appVariantRouting.js";

const VARIANT_ID = "nlh";

export function ensureNLHUIAdapterRegistered(options = {}) {
  const ids = [
    APP_VARIANT_IDS.NLH,
    APP_VARIANT_IDS.FLH,
    APP_VARIANT_IDS.STUD,
    APP_VARIANT_IDS.STUD8,
    APP_VARIANT_IDS.RAZZ,
    APP_VARIANT_IDS.RAZZDUGI,
    APP_VARIANT_IDS.RAZZDUCEY,
  ];
  const existing = getGameUIAdapter(VARIANT_ID);
  if (existing && !options.force) {
    ids.forEach((id) => {
      if (!getGameUIAdapter(id)) registerGameUIAdapter(id, existing);
    });
    return existing;
  }
  const adapter = new NLHUIAdapter(options);
  ids.forEach((id) => registerGameUIAdapter(id, adapter));
  return adapter;
}

export default ensureNLHUIAdapterRegistered;
