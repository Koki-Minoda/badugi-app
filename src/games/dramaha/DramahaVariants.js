import { createDramahaGameDefinition } from "./DramahaGameDefinition.js";

export const DRAMAHA_APP_VARIANTS = Object.freeze({
  DRAMAHA_HI: "dramaha_hi",
  DRAMAHA_27: "dramaha_27",
  DRAMAHA_A5: "dramaha_a5",
  DRAMAHA_ZERO: "dramaha_zero",
  DRAMAHA_HIDUGI: "dramaha_hidugi",
  DRAMAHA_BADUGI: "dramaha_badugi",
});

export const DRAMAHA_DEFINITIONS = Object.freeze({
  [DRAMAHA_APP_VARIANTS.DRAMAHA_HI]: createDramahaGameDefinition({
    id: "game-dramaha-hi",
    label: "Dramaha Hi",
    variant: DRAMAHA_APP_VARIANTS.DRAMAHA_HI,
  }),
  [DRAMAHA_APP_VARIANTS.DRAMAHA_27]: createDramahaGameDefinition({
    id: "game-dramaha-27",
    label: "Dramaha 2-7",
    variant: DRAMAHA_APP_VARIANTS.DRAMAHA_27,
  }),
  [DRAMAHA_APP_VARIANTS.DRAMAHA_A5]: createDramahaGameDefinition({
    id: "game-dramaha-a5",
    label: "Dramaha A-5",
    variant: DRAMAHA_APP_VARIANTS.DRAMAHA_A5,
  }),
  [DRAMAHA_APP_VARIANTS.DRAMAHA_ZERO]: createDramahaGameDefinition({
    id: "game-dramaha-zero",
    label: "Dramaha Zero",
    variant: DRAMAHA_APP_VARIANTS.DRAMAHA_ZERO,
  }),
  [DRAMAHA_APP_VARIANTS.DRAMAHA_HIDUGI]: createDramahaGameDefinition({
    id: "game-dramaha-hidugi",
    label: "Dramaha Hidugi",
    variant: DRAMAHA_APP_VARIANTS.DRAMAHA_HIDUGI,
  }),
  [DRAMAHA_APP_VARIANTS.DRAMAHA_BADUGI]: createDramahaGameDefinition({
    id: "game-dramaha-badugi",
    label: "Dramaha Badugi",
    variant: DRAMAHA_APP_VARIANTS.DRAMAHA_BADUGI,
  }),
});
