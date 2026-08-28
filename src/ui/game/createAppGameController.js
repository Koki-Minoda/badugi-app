import ChinesePokerController from "../../games/chinese/ChinesePokerController.js";
import { GAME_VARIANTS } from "../../games/core/variants.js";
import {
  APP_VARIANT_IDS,
  isDrawLowballAppVariant,
  normalizeAppVariantId,
} from "./appVariantRouting.js";

const DEFAULT_CHINESE_SEATS = Object.freeze([
  { id: "hero", name: "You", isHero: true },
  { id: "mina", name: "Mina" },
  { id: "ren", name: "Ren" },
  { id: "sora", name: "Sora" },
]);

export function createAppGameController({
  variantId,
  tableConfig = {},
  drawConfig = {},
  badugiConfig = {},
  chineseSeats = DEFAULT_CHINESE_SEATS,
} = {}) {
  const normalizedVariant = normalizeAppVariantId(variantId, null);
  if (normalizedVariant === APP_VARIANT_IDS.CHINESE_POKER) {
    return new ChinesePokerController({ seats: chineseSeats.map((seat) => ({ ...seat })) });
  }

  const controllerFactory = GAME_VARIANTS[normalizedVariant]?.controllerFactory;
  if (typeof controllerFactory !== "function") return null;
  if (normalizedVariant === APP_VARIANT_IDS.BADUGI) {
    return controllerFactory(badugiConfig);
  }
  if (isDrawLowballAppVariant(normalizedVariant)) {
    return controllerFactory(drawConfig);
  }
  return controllerFactory({ tableConfig });
}

export default createAppGameController;
