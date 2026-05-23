import { APP_VARIANT_IDS, normalizeAppVariantId } from "./appVariantRouting.js";

export const LAYOUT_GROUPS = {
  BADUGI: "badugi",
  DRAW_LOWBALL_5CARD: "draw-lowball-5card",
  DEFAULT: "default",
};

const DRAW_LOWBALL_5CARD_VARIANTS = new Set([
  APP_VARIANT_IDS.D01,
  APP_VARIANT_IDS.D02,
  APP_VARIANT_IDS.S01,
  APP_VARIANT_IDS.S02,
  APP_VARIANT_IDS.S03,
]);

const BADUGI_LAYOUT_VARIANTS = new Set([
  APP_VARIANT_IDS.BADUGI,
  APP_VARIANT_IDS.S04,
]);

const BADUGI_PROFILE = Object.freeze({
  layoutGroup: LAYOUT_GROUPS.BADUGI,
  handCardCount: 4,
  mobilePortrait: Object.freeze({
    tableAspectRatio: "9 / 14",
    tableRows: "minmax(0, 0.78fr) minmax(0, 0.88fr) minmax(0, 0.72fr)",
    playerWidth: "clamp(86px, 27dvw, 112px)",
    foldedPlayerWidth: "clamp(76px, 24dvw, 96px)",
    cpuCardWidth: "clamp(17px, 5.2dvh, 24px)",
    cpuCardHeight: "clamp(24px, 7.3dvh, 34px)",
    cpuCardStripMaxWidth: "clamp(82px, 25dvw, 108px)",
    heroCardWidth: "clamp(27px, 7.8dvh, 38px)",
    heroCardHeight: "clamp(38px, 10.9dvh, 54px)",
    heroCardStripMaxWidth: "clamp(128px, 39dvw, 168px)",
    foldedSeatMode: "footer-badge",
    phasePanelDensity: "rail",
  }),
});

const DRAW_LOWBALL_5CARD_PROFILE = Object.freeze({
  layoutGroup: LAYOUT_GROUPS.DRAW_LOWBALL_5CARD,
  handCardCount: 5,
  mobilePortrait: Object.freeze({
    tableAspectRatio: "9 / 14",
    tableRows: "minmax(0, 0.78fr) minmax(0, 0.88fr) minmax(0, 0.72fr)",
    playerWidth: "clamp(96px, 30dvw, 122px)",
    foldedPlayerWidth: "clamp(78px, 23dvw, 102px)",
    cpuCardWidth: "clamp(14px, 4.8dvh, 20px)",
    cpuCardHeight: "clamp(20px, 6.8dvh, 29px)",
    cpuCardStripMaxWidth: "clamp(86px, 28dvw, 112px)",
    heroCardWidth: "clamp(21px, 6.8dvh, 31px)",
    heroCardHeight: "clamp(30px, 9.5dvh, 43px)",
    heroCardStripMaxWidth: "clamp(116px, 39dvw, 154px)",
    foldedSeatMode: "footer-badge",
    phasePanelDensity: "rail",
  }),
});

const DEFAULT_PROFILE = Object.freeze({
  layoutGroup: LAYOUT_GROUPS.DEFAULT,
  handCardCount: 4,
  mobilePortrait: Object.freeze({
    tableAspectRatio: "3 / 5",
    tableRows: "minmax(0, 0.86fr) minmax(0, 0.9fr) minmax(0, 1.14fr)",
    foldedSeatMode: "mucked-band",
    phasePanelDensity: "panel",
  }),
});

export function getVariantLayoutProfile(variantId) {
  const normalized = normalizeAppVariantId(variantId, null);
  if (BADUGI_LAYOUT_VARIANTS.has(normalized)) return BADUGI_PROFILE;
  if (DRAW_LOWBALL_5CARD_VARIANTS.has(normalized))
    return DRAW_LOWBALL_5CARD_PROFILE;
  return DEFAULT_PROFILE;
}

export function isDrawLowballFiveCardLayout(variantId) {
  return (
    getVariantLayoutProfile(variantId).layoutGroup ===
    LAYOUT_GROUPS.DRAW_LOWBALL_5CARD
  );
}
