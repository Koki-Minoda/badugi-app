import GameRegistry from "../_core/GameRegistry.js";
import { GAME_VARIANTS as CONTROLLER_VARIANTS } from "../core/variants.js";
import { GAME_VARIANTS as UI_VARIANTS } from "../../ui/game/variants.js";
import { GAME_VARIANTS as CATALOG_VARIANTS } from "./variantCatalog.js";
import {
  VARIANT_AVAILABILITY,
  getVariantAvailability,
} from "./variantAvailability.js";

const DRAW_DEFINITION_DEBT = [
  "D01", "D02", "D04", "D05", "D06", "D07",
  "S01", "S02", "S03", "S04", "S05", "S06", "S07",
];

export const KNOWN_VARIANT_MANIFEST_EXCEPTIONS = Object.freeze({
  ...Object.fromEntries(
    DRAW_DEFINITION_DEBT.map((variantId) => [
      `${variantId}:game-definition-missing`,
      "Draw-family runtime predates GameDefinition; controller and engine are registered separately.",
    ]),
  ),
  "B09:definition-contract-incomplete":
    "FLO8 currently uses a minimal derived definition and inherits runtime behavior from PLO8.",
  "ST4:definition-contract-incomplete":
    "Razzdugi currently uses a minimal definition consumed by the shared Stud controller.",
  "ST5:definition-contract-incomplete":
    "Razzducey currently uses a minimal definition consumed by the shared Stud controller.",
  "CP1:definition-contract-incomplete":
    "Classic Chinese Poker uses its dedicated set/showdown controller rather than the street GameDefinition contract.",
  "CP1:controller-registry-missing":
    "Classic Chinese Poker is routed through its dedicated controller outside the shared controller registry.",
});

const REQUIRED_DEFINITION_FIELDS = Object.freeze([
  "id",
  "label",
  "variant",
  "streets",
  "handStructure",
  "evaluateHand",
]);

function uiEntryFor(variant) {
  const ids = new Set([variant.id, variant.engineKey].filter(Boolean));
  return UI_VARIANTS.find((entry) => ids.has(entry.id)) ?? null;
}

function controllerEntryFor(variant) {
  return CONTROLLER_VARIANTS[variant.engineKey] ?? null;
}

function definitionFor(variant) {
  return GameRegistry.get(variant.engineKey) ?? null;
}

function missingDefinitionFields(definition) {
  return REQUIRED_DEFINITION_FIELDS.filter((field) => {
    const value = definition?.[field];
    if (field === "streets") return !Array.isArray(value) || value.length === 0;
    if (field === "handStructure") return !value || typeof value !== "object";
    if (field === "evaluateHand") return typeof value !== "function";
    return value == null || value === "";
  });
}

export function buildCanonicalVariantManifest() {
  return CATALOG_VARIANTS.map((variant) => {
    const availability = getVariantAvailability(variant.engineKey ?? variant.id);
    const controller = controllerEntryFor(variant);
    const definition = definitionFor(variant);
    const ui = uiEntryFor(variant);
    return Object.freeze({
      id: variant.id,
      engineKey: variant.engineKey,
      name: variant.name,
      category: variant.category,
      holeCards: variant.holeCards,
      catalogStatus: variant.status,
      availability: availability.availability,
      availabilityKey: availability.key,
      controllerVariantId: controller?.variantId ?? null,
      definitionVariant: definition?.variant ?? null,
      definitionHoleCards: definition?.handStructure?.hole ?? null,
      uiId: ui?.id ?? null,
      uiEnabled: ui?.enabled ?? false,
    });
  });
}

export function auditVariantManifest({
  knownExceptions = KNOWN_VARIANT_MANIFEST_EXCEPTIONS,
} = {}) {
  const issues = [];
  const ids = new Set();
  const engineKeys = new Set();

  for (const variant of CATALOG_VARIANTS) {
    if (ids.has(variant.id)) {
      issues.push({ key: `${variant.id}:duplicate-catalog-id`, variantId: variant.id });
    }
    ids.add(variant.id);

    if (!variant.engineKey) {
      issues.push({ key: `${variant.id}:engine-key-missing`, variantId: variant.id });
    } else if (engineKeys.has(variant.engineKey)) {
      issues.push({ key: `${variant.id}:duplicate-engine-key`, variantId: variant.id });
    }
    engineKeys.add(variant.engineKey);

    const controller = controllerEntryFor(variant);
    if (!controller) {
      issues.push({ key: `${variant.id}:controller-registry-missing`, variantId: variant.id });
    } else if (controller.variantId !== variant.id) {
      issues.push({
        key: `${variant.id}:controller-variant-id-mismatch`,
        variantId: variant.id,
        expected: variant.id,
        actual: controller.variantId,
      });
    }

    const ui = uiEntryFor(variant);
    if (!ui) {
      issues.push({ key: `${variant.id}:ui-registry-missing`, variantId: variant.id });
    }

    const availability = getVariantAvailability(variant.engineKey ?? variant.id);
    if (!availability.key || !VARIANT_AVAILABILITY[availability.key]) {
      issues.push({ key: `${variant.id}:availability-missing`, variantId: variant.id });
    }

    const definition = definitionFor(variant);
    if (!definition) {
      issues.push({ key: `${variant.id}:game-definition-missing`, variantId: variant.id });
    } else {
      const missingFields = missingDefinitionFields(definition);
      if (missingFields.length) {
        issues.push({
          key: `${variant.id}:definition-contract-incomplete`,
          variantId: variant.id,
          missingFields,
        });
      }
      if (
        Number.isFinite(variant.holeCards) &&
        Number.isFinite(definition.handStructure?.hole) &&
        variant.holeCards !== definition.handStructure.hole
      ) {
        issues.push({
          key: `${variant.id}:hole-card-count-mismatch`,
          variantId: variant.id,
          expected: definition.handStructure.hole,
          actual: variant.holeCards,
        });
      }
    }
  }

  const classified = issues.map((issue) => ({
    ...issue,
    allowlisted: Object.prototype.hasOwnProperty.call(knownExceptions, issue.key),
    reason: knownExceptions[issue.key] ?? null,
  }));
  return {
    manifest: buildCanonicalVariantManifest(),
    issues: classified,
    unexpectedIssues: classified.filter((issue) => !issue.allowlisted),
    allowlistedIssues: classified.filter((issue) => issue.allowlisted),
  };
}

