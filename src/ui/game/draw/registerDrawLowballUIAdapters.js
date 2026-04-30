import {
  getGameUIAdapter,
  registerGameUIAdapter,
} from "../GameUIAdapterRegistry.js";
import { DrawLowballUIAdapter } from "./DrawLowballUIAdapter.js";

export const DRAW_LOWBALL_UI_VARIANT_IDS = [
  "deuce_to_seven_triple_draw",
  "ace_to_five_triple_draw",
  "deuce_to_seven_single_draw",
  "ace_to_five_single_draw",
  "D01",
  "D02",
  "S01",
  "S02",
];

export function ensureDrawLowballUIAdaptersRegistered(options = {}) {
  const registered = [];
  for (const variantId of DRAW_LOWBALL_UI_VARIANT_IDS) {
    const existing = getGameUIAdapter(variantId);
    if (existing) {
      registered.push(existing);
      continue;
    }
    const adapter = new DrawLowballUIAdapter(options);
    registerGameUIAdapter(variantId, adapter);
    registered.push(adapter);
  }
  return registered;
}

export default ensureDrawLowballUIAdaptersRegistered;
