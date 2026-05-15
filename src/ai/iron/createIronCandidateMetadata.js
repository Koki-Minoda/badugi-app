export function createIronCandidateMetadata({
  datasetSource = "",
  summary = {},
  warnings = [],
} = {}) {
  const variantCoverage = Object.keys(summary.variantDistribution ?? {});
  return {
    candidateId: `iron-candidate-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    createdAt: new Date().toISOString(),
    datasetSource,
    rowCount: Number(summary.validRows ?? 0),
    variantCoverage,
    sparseWarnings: [...new Set(warnings)],
    promoted: false,
    eligibleForPromotion: false,
  };
}
