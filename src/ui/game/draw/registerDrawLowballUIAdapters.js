import {
  getGameUIAdapter,
  registerGameUIAdapter,
} from "../GameUIAdapterRegistry.js";
import { DrawLowballUIAdapter } from "./DrawLowballUIAdapter.js";

export const DRAW_LOWBALL_UI_VARIANT_IDS = [
  "deuce_to_seven_triple_draw",
  "ace_to_five_triple_draw",
  "badeucey_triple_draw",
  "badacey_triple_draw",
  "hidugi_triple_draw",
  "archie_triple_draw",
  "deuce_to_seven_single_draw",
  "ace_to_five_single_draw",
  "five_card_single_draw",
  "badugi_single_draw",
  "badeucey_single_draw",
  "badacey_single_draw",
  "hidugi_single_draw",
  "D01",
  "D02",
  "D04",
  "D05",
  "D06",
  "D07",
  "S01",
  "S02",
  "S03",
  "S04",
  "S05",
  "S06",
  "S07",
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
