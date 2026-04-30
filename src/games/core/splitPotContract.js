export const ODD_CHIP_POLICIES = Object.freeze({
  COMPONENT_ORDER: "componentOrder",
  SEAT_ORDER: "seatOrder",
});

const COMPONENTS = Object.freeze({
  BADUGI_LOW: Object.freeze({
    id: "badugiLow",
    label: "Badugi Low",
    evaluator: "badugi-low",
    shareUnits: 1,
    comparator: "low",
  }),
  BADUGI_HIGH: Object.freeze({
    id: "badugiHigh",
    label: "High Badugi",
    evaluator: "badugi-high",
    shareUnits: 1,
    comparator: "high-badugi",
  }),
  LOW_27: Object.freeze({
    id: "deuceToSevenLow",
    label: "2-7 Low",
    evaluator: "low-27",
    shareUnits: 1,
    comparator: "low",
  }),
  LOW_A5: Object.freeze({
    id: "aceToFiveLow",
    label: "A-5 Low",
    evaluator: "low-a5",
    shareUnits: 1,
    comparator: "low",
  }),
  ARCHIE_HIGH: Object.freeze({
    id: "archieHigh",
    label: "Archie High",
    evaluator: "high",
    shareUnits: 1,
    comparator: "high",
    qualifier: "pairOrBetter",
  }),
  ARCHIE_LOW: Object.freeze({
    id: "archieLow",
    label: "Archie Low",
    evaluator: "low-a5",
    shareUnits: 1,
    comparator: "low",
    qualifier: "eightOrBetter",
  }),
});

const SPECIAL_DRAW_CONTRACTS = Object.freeze({
  "split-badugi-27": Object.freeze({
    id: "badeucey",
    splitMode: "component",
    summaryMode: "componentShowdown",
    oddChipPolicy: ODD_CHIP_POLICIES.COMPONENT_ORDER,
    components: Object.freeze([COMPONENTS.BADUGI_LOW, COMPONENTS.LOW_27]),
  }),
  "split-badugi-a5": Object.freeze({
    id: "badacey",
    splitMode: "component",
    summaryMode: "componentShowdown",
    oddChipPolicy: ODD_CHIP_POLICIES.COMPONENT_ORDER,
    components: Object.freeze([COMPONENTS.BADUGI_LOW, COMPONENTS.LOW_A5]),
  }),
  "badugi-high": Object.freeze({
    id: "hidugi",
    splitMode: "single",
    summaryMode: "singleShowdown",
    oddChipPolicy: ODD_CHIP_POLICIES.SEAT_ORDER,
    display: Object.freeze({
      handLabel: "High Badugi",
      description: "Reverse Badugi: valid Badugi card count is primary, then higher ranks win.",
    }),
    components: Object.freeze([COMPONENTS.BADUGI_HIGH]),
  }),
  archie: Object.freeze({
    id: "archie",
    splitMode: "component",
    summaryMode: "componentShowdown",
    oddChipPolicy: ODD_CHIP_POLICIES.COMPONENT_ORDER,
    display: Object.freeze({
      handLabel: "Archie",
      description: "Split draw evaluator: pair-or-better high half and 8-or-better A-5 low half.",
    }),
    components: Object.freeze([COMPONENTS.ARCHIE_HIGH, COMPONENTS.ARCHIE_LOW]),
  }),
});

const GENERIC_SPLIT_MODES = new Set(["single", "byBoard", "hiLo"]);

function getEvaluatorTags(variant = {}) {
  if (Array.isArray(variant.evaluators)) return variant.evaluators.filter(Boolean);
  const evaluator = variant.showdown?.evaluator;
  return evaluator ? [evaluator] : [];
}

function cloneComponent(component) {
  return { ...component };
}

function cloneContract(contract) {
  return {
    ...contract,
    display: contract.display ? { ...contract.display } : undefined,
    components: contract.components.map(cloneComponent),
  };
}

export function getSpecialDrawContract(variant = {}) {
  const evaluatorTag = getEvaluatorTags(variant).find((tag) => SPECIAL_DRAW_CONTRACTS[tag]);
  if (!evaluatorTag) return null;
  return {
    evaluatorTag,
    ...cloneContract(SPECIAL_DRAW_CONTRACTS[evaluatorTag]),
  };
}

export function getPotAwardContract(variant = {}) {
  const specialContract = getSpecialDrawContract(variant);
  if (specialContract) return specialContract;

  const splitMode = variant.showdown?.splitMode;
  if (!GENERIC_SPLIT_MODES.has(splitMode)) {
    throw new Error(`Unsupported splitMode: ${splitMode}`);
  }

  return {
    id: splitMode,
    splitMode,
    summaryMode: `${splitMode}Showdown`,
    oddChipPolicy: ODD_CHIP_POLICIES.SEAT_ORDER,
    components: [],
  };
}

export function splitAmountByUnits(amount, entries = []) {
  const normalizedAmount = Math.max(0, Number(amount) || 0);
  const normalizedEntries = entries
    .map((entry) => ({ ...entry, shareUnits: Math.max(0, Number(entry.shareUnits) || 0) }))
    .filter((entry) => entry.shareUnits > 0);
  const totalUnits = normalizedEntries.reduce((sum, entry) => sum + entry.shareUnits, 0);

  if (!normalizedAmount || !totalUnits) {
    return normalizedEntries.map((entry) => ({ ...entry, amount: 0 }));
  }

  let assigned = 0;
  const splits = normalizedEntries.map((entry) => {
    const splitAmount = Math.floor((normalizedAmount * entry.shareUnits) / totalUnits);
    assigned += splitAmount;
    return { ...entry, amount: splitAmount };
  });

  let remainder = normalizedAmount - assigned;
  for (let index = 0; remainder > 0 && splits.length > 0; index = (index + 1) % splits.length) {
    splits[index].amount += 1;
    remainder -= 1;
  }

  return splits;
}

export function splitPotByComponents(amount, components = []) {
  return splitAmountByUnits(amount, components).map((component) => ({
    componentId: component.id,
    label: component.label,
    evaluator: component.evaluator,
    amount: component.amount,
  }));
}

export function buildSplitShowdownSummary({ variant, evaluations = [], pot = 0 } = {}) {
  const contract = getPotAwardContract(variant);
  const componentPots =
    contract.components.length > 1 ? splitPotByComponents(pot, contract.components) : [];

  return {
    variantId: variant?.id ?? null,
    contractId: contract.id,
    splitMode: contract.splitMode,
    summaryMode: contract.summaryMode,
    oddChipPolicy: contract.oddChipPolicy,
    display: contract.display ?? null,
    components: contract.components.map((component) => ({
      ...component,
      amount:
        componentPots.find((componentPot) => componentPot.componentId === component.id)?.amount ??
        Math.max(0, Number(pot) || 0),
      evaluations: evaluations.filter(
        (evaluation) =>
          evaluation?.componentId === component.id ||
          evaluation?.component === component.id ||
          evaluation?.evaluator === component.evaluator,
      ),
      winners: [],
    })),
  };
}
