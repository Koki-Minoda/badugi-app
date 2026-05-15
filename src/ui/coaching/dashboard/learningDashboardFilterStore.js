export const DEFAULT_STEP56_DASHBOARD_FILTER_OUTPUT_PATH =
  "reports/ai-iron/step56-dashboard-filter-preview.json";

function readStorage(storage, key) {
  if (!storage || typeof storage.getItem !== "function") return null;
  try {
    return JSON.parse(storage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  if (!storage || typeof storage.setItem !== "function") return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Preview-only persistence must never block the dashboard.
  }
}

function normalizeVariant(value, availableVariants = []) {
  if (value === "all") return "all";
  return availableVariants.includes(value) ? value : "all";
}

export function createLearningDashboardFilterStore({
  storage = null,
  storageKey = "mgx.preview.learningDashboardFilter",
  availableVariants = [],
  initialVariant = "all",
} = {}) {
  let selectedVariant = normalizeVariant(readStorage(storage, storageKey)?.selectedVariant ?? initialVariant, availableVariants);
  const persist = () => writeStorage(storage, storageKey, { selectedVariant, previewOnly: true });
  return {
    getSelectedVariant() {
      return selectedVariant;
    },
    setSelectedVariant(value) {
      selectedVariant = normalizeVariant(value, availableVariants);
      persist();
      return selectedVariant;
    },
    reset() {
      selectedVariant = "all";
      persist();
    },
    exportPreview() {
      return {
        previewOnly: true,
        localOnly: true,
        backendUpload: false,
        networkTelemetry: false,
        selectedVariant,
        availableVariants: [...availableVariants].sort(),
      };
    },
  };
}

export function buildLearningDashboardFilterPreviewSummary({ availableVariants = ["D02", "S02"] } = {}) {
  const store = createLearningDashboardFilterStore({ availableVariants, initialVariant: "S02" });
  const selectedBeforeReset = store.getSelectedVariant();
  store.reset();
  return {
    generatedAt: new Date().toISOString(),
    ...store.exportPreview(),
    selectedBeforeReset,
    fallbackSafe: true,
    promoted: false,
    routingChanged: false,
    priorityFrozen: true,
    d01Excluded: true,
  };
}

export async function buildLearningDashboardFilterPreview({
  outputPath = DEFAULT_STEP56_DASHBOARD_FILTER_OUTPUT_PATH,
  availableVariants = ["D02", "S02"],
} = {}) {
  return {
    ...buildLearningDashboardFilterPreviewSummary({ availableVariants }),
    outputPath,
  };
}

if (typeof process !== "undefined" && process.argv?.[1] && import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildLearningDashboardFilterPreview();
  console.log(JSON.stringify(report, null, 2));
}
