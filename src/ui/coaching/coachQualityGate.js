// New Strategy Score consumers must use this contract. Existing CPU routing and
// preview lessons are separate and are not certified by this gate.
export const COACH_QUALITY_THRESHOLDS = Object.freeze({
  minimumHeldoutDecisions: 200,
  minimumAcceptableActionAgreementLower95: 0.95,
  maximumExpectedCalibrationError: 0.10,
});

function inList(value, allowed) {
  return Array.isArray(allowed) && allowed.includes(value);
}
function finiteBetween(value, lower, upper) {
  return typeof value === 'number' && Number.isFinite(value) && value >= lower && value <= upper;
}
function groundedEvidence(value) {
  return Boolean(value && typeof value.path === 'string' && value.path.length &&
    /^[a-f0-9]{64}$/.test(value.sha256 ?? ''));
}

export function evaluateCoachQuality(candidate = {}, request = {}) {
  const reasons = [];
  const scope = candidate.scope ?? {};
  const checks = candidate.checks ?? {};
  const quality = candidate.quality ?? {};
  const thresholds = COACH_QUALITY_THRESHOLDS;
  const requiredChecks = ['runtimeSemantics', 'legalActions', 'noPrivateInformation',
    'heldoutSeparation', 'baselineCompatibility', 'replayLinkage', 'abstention', 'rollback'];
  if (candidate.schemaVersion !== 1) reasons.push('invalid-schema');
  if (typeof candidate.implementer !== 'string' || !candidate.implementer.trim()) reasons.push('missing-implementer');
  if (!candidate.modelVersion || !candidate.evaluatorVersion) reasons.push('missing-version');
  if (!groundedEvidence(candidate.evidence)) reasons.push('missing-evidence');
  if (candidate.evidenceVerified !== true) reasons.push('unverified-evidence');
  if (!scope.variantId || scope.variantId !== request.variantId) reasons.push('variant-out-of-scope');
  for (const [field, values] of [['playerCount', scope.playerCounts], ['betting', scope.betting],
    ['mode', scope.modes], ['street', scope.streets], ['action', scope.actions]]) {
    if (!inList(request[field], values)) reasons.push(`${field}-out-of-scope`);
  }
  for (const check of requiredChecks) if (checks[check] !== true) reasons.push(`missing-${check}`);
  if (!Number.isInteger(quality.heldoutDecisions) || quality.heldoutDecisions < thresholds.minimumHeldoutDecisions) reasons.push('insufficient-heldout-decisions');
  if (!finiteBetween(quality.acceptableActionAgreementLower95, thresholds.minimumAcceptableActionAgreementLower95, 1)) reasons.push('action-quality-unproven');
  if (!finiteBetween(quality.expectedCalibrationError, 0, thresholds.maximumExpectedCalibrationError)) reasons.push('confidence-uncalibrated');
  if (quality.majorIncorrectAdvice !== 0) reasons.push('major-advice-errors-or-unknown');
  if (quality.explanationGroundingRate !== 1) reasons.push('explanation-not-grounded');
  const review = candidate.independentReview;
  if (!review || review.status !== 'approved' || review.reviewerType !== 'human' ||
      typeof review.reviewer !== 'string' || !review.reviewer.trim() ||
      review.reviewer === candidate.implementer || !groundedEvidence(review.evidence)) reasons.push('independent-review-required');
  const confidence = candidate.confidence;
  if (!['High Confidence', 'Medium Confidence'].includes(confidence)) reasons.push('experimental-or-unrated');
  if (confidence === 'High Confidence' && !['solver', 'reviewed-exact-rules'].includes(candidate.baselineType)) reasons.push('high-confidence-baseline-unproven');
  if (!['solver', 'reviewed-exact-rules', 'validated-empirical'].includes(candidate.baselineType)) reasons.push('missing-strategy-baseline');
  const eligible = reasons.length === 0;
  return { eligible, scoreName: 'MGX Strategy Score', confidence: eligible ? confidence : '保留',
    score: null, reasons, evaluatorVersion: candidate.evaluatorVersion ?? null };
}
