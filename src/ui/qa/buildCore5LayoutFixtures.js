import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CORE5_LAYOUT_VARIANTS = [
  {
    game: "Badugi",
    variantId: "badugi",
    displayName: "Badugi",
    cardCount: 4,
    availability: "preview_only",
  },
  {
    game: "2-7 Triple Draw",
    variantId: "D01",
    displayName: "2-7 Triple Draw",
    cardCount: 5,
    availability: "preview_only",
  },
  {
    game: "A-5 Triple Draw",
    variantId: "D02",
    displayName: "A-5 Triple Draw",
    cardCount: 5,
    availability: "alpha_candidate",
  },
  {
    game: "2-7 Single Draw",
    variantId: "S01",
    displayName: "2-7 Single Draw",
    cardCount: 5,
    availability: "alpha_candidate",
  },
  {
    game: "A-5 Single Draw",
    variantId: "S02",
    displayName: "A-5 Single Draw",
    cardCount: 5,
    availability: "alpha_candidate",
  },
];

export const CORE5_LAYOUT_VIEWPORTS = [
  { id: "desktop-1440x900", width: 1440, height: 900, category: "desktop" },
  { id: "desktop-1280x720", width: 1280, height: 720, category: "desktop" },
  { id: "mobile-portrait-390x844", width: 390, height: 844, category: "mobile-portrait" },
  { id: "mobile-portrait-430x932", width: 430, height: 932, category: "mobile-portrait" },
  { id: "mobile-landscape-844x390", width: 844, height: 390, category: "mobile-landscape" },
];

const STAGES = [
  {
    id: "hand-start",
    expectedVisibleElements: ["table", "heroCards", "pot", "phase", "actionControls"],
  },
  {
    id: "mid-hand-betting",
    expectedVisibleElements: ["table", "heroCards", "cpuSeats", "pot", "phase", "actionControls"],
  },
  {
    id: "draw-decision",
    expectedVisibleElements: ["heroCards", "drawControls", "pot", "phase"],
  },
  {
    id: "showdown-result",
    expectedVisibleElements: ["resultOverlay", "resultPot", "nextHandButton"],
  },
  {
    id: "coaching-overlay",
    expectedVisibleElements: ["coachingCard", "replayOrDashboardLink"],
  },
];

export function buildCore5LayoutFixtures() {
  const fixtures = [];
  for (const variant of CORE5_LAYOUT_VARIANTS) {
    for (const viewport of CORE5_LAYOUT_VIEWPORTS) {
      for (const stage of STAGES) {
        fixtures.push({
          variantId: variant.variantId,
          game: variant.game,
          displayName: variant.displayName,
          availability: variant.availability,
          stage: stage.id,
          viewport,
          expectedVisibleElements: stage.expectedVisibleElements,
        });
      }
    }
  }
  return fixtures;
}

export function writeCore5LayoutFixtures(outputPath = "reports/alpha/core5-layout-fixtures.json") {
  const fixtures = buildCore5LayoutFixtures();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: fixtures.length,
        fixtures,
      },
      null,
      2,
    )}\n`,
  );
  return { outputPath, count: fixtures.length };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const outputPath = process.argv[2] ?? "reports/alpha/core5-layout-fixtures.json";
  const result = writeCore5LayoutFixtures(outputPath);
  console.log(JSON.stringify(result, null, 2));
}

