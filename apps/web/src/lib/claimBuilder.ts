import {
  type Claim,
  type ClaimCategory,
  type FlushRule,
  type Rank,
  type Suit,
  claimToKey,
} from '@bluff-game/shared';

export interface BuilderStepConfig {
  id: string;
  title: string;
  helper: string;
  getValue: (claim: Claim) => string;
  getLabel: (claim: Claim) => string;
}

export interface BuilderOption {
  value: string;
  label: string;
  previewClaim: Claim;
  count: number;
}

export interface BuilderStepInput {
  helpers: {
    formatClaimCompactLabel: (claim: Claim) => string;
    formatRankLabel: (rank: Rank) => string;
    formatSuitChoiceLabel: (suit: Suit) => string;
  };
  labels: {
    highCard: string;
    pairRank: string;
    firstPair: string;
    secondPair: string;
    triplet: string;
    straight: string;
    flushSuit: string;
    namedCard: string;
    pair: string;
    quadRank: string;
    straightFlushSuit: string;
  };
  copy: {
    highCard: string;
    pair: string;
    firstPair: string;
    secondPair: string;
    trips: string;
    straight: string;
    flushSuitFirst: string;
    flushNamedCard: string;
    flushSuitOnly: string;
    fullHouseTrips: string;
    fullHousePair: string;
    quads: string;
    straightFlushSuit: string;
    straightFlushStraight: string;
  };
}

export function getBuilderSteps(
  category: ClaimCategory,
  flushRule: FlushRule,
  input: BuilderStepInput,
): BuilderStepConfig[] {
  const { formatClaimCompactLabel, formatRankLabel, formatSuitChoiceLabel } =
    input.helpers;
  const { labels, copy } = input;

  switch (category) {
    case 'high-card':
      return [
        {
          id: 'rank',
          title: labels.highCard,
          helper: copy.highCard,
          getValue: (claim) => claimToKey(claim),
          getLabel: (claim) => formatClaimCompactLabel(claim),
        },
      ];
    case 'pair':
      return [
        {
          id: 'pairRank',
          title: labels.pairRank,
          helper: copy.pair,
          getValue: (claim) => claimToKey(claim),
          getLabel: (claim) => formatClaimCompactLabel(claim),
        },
      ];
    case 'two-pair':
      return [
        {
          id: 'highPairRank',
          title: labels.firstPair,
          helper: copy.firstPair,
          getValue: (claim) =>
            claim.category === 'two-pair' ? String(claim.highPairRank) : '',
          getLabel: (claim) =>
            claim.category === 'two-pair'
              ? formatRankLabel(claim.highPairRank)
              : formatClaimCompactLabel(claim),
        },
        {
          id: 'lowPairRank',
          title: labels.secondPair,
          helper: copy.secondPair,
          getValue: (claim) =>
            claim.category === 'two-pair' ? String(claim.lowPairRank) : '',
          getLabel: (claim) =>
            claim.category === 'two-pair'
              ? formatRankLabel(claim.lowPairRank)
              : formatClaimCompactLabel(claim),
        },
      ];
    case 'three-of-a-kind':
      return [
        {
          id: 'tripRank',
          title: labels.triplet,
          helper: copy.trips,
          getValue: (claim) => claimToKey(claim),
          getLabel: (claim) => formatClaimCompactLabel(claim),
        },
      ];
    case 'straight':
      return [
        {
          id: 'lowRank',
          title: labels.straight,
          helper: copy.straight,
          getValue: (claim) => claimToKey(claim),
          getLabel: (claim) => formatClaimCompactLabel(claim),
        },
      ];
    case 'flush':
      return flushRule === 'suit-plus-rank'
        ? [
            {
              id: 'suit',
              title: labels.flushSuit,
              helper: copy.flushSuitFirst,
              getValue: (claim) =>
                claim.category === 'flush' ? claim.suit : '',
              getLabel: (claim) =>
                claim.category === 'flush'
                  ? formatSuitChoiceLabel(claim.suit)
                  : formatClaimCompactLabel(claim),
            },
            {
              id: 'rank',
              title: labels.namedCard,
              helper: copy.flushNamedCard,
              getValue: (claim) =>
                claim.category === 'flush' && claim.rank !== undefined
                  ? String(claim.rank)
                  : '',
              getLabel: (claim) =>
                claim.category === 'flush' && claim.rank !== undefined
                  ? formatRankLabel(claim.rank)
                  : formatClaimCompactLabel(claim),
            },
          ]
        : [
            {
              id: 'suit',
              title: labels.flushSuit,
              helper: copy.flushSuitOnly,
              getValue: (claim) => claimToKey(claim),
              getLabel: (claim) => formatClaimCompactLabel(claim),
            },
          ];
    case 'full-house':
      return [
        {
          id: 'tripRank',
          title: labels.triplet,
          helper: copy.fullHouseTrips,
          getValue: (claim) =>
            claim.category === 'full-house' ? String(claim.tripRank) : '',
          getLabel: (claim) =>
            claim.category === 'full-house'
              ? formatRankLabel(claim.tripRank)
              : formatClaimCompactLabel(claim),
        },
        {
          id: 'pairRank',
          title: labels.pair,
          helper: copy.fullHousePair,
          getValue: (claim) =>
            claim.category === 'full-house' ? String(claim.pairRank) : '',
          getLabel: (claim) =>
            claim.category === 'full-house'
              ? formatRankLabel(claim.pairRank)
              : formatClaimCompactLabel(claim),
        },
      ];
    case 'four-of-a-kind':
      return [
        {
          id: 'quadRank',
          title: labels.quadRank,
          helper: copy.quads,
          getValue: (claim) => claimToKey(claim),
          getLabel: (claim) => formatClaimCompactLabel(claim),
        },
      ];
    case 'straight-flush':
      return [
        {
          id: 'suit',
          title: labels.straightFlushSuit,
          helper: copy.straightFlushSuit,
          getValue: (claim) =>
            claim.category === 'straight-flush' ? claim.suit : '',
          getLabel: (claim) =>
            claim.category === 'straight-flush'
              ? formatSuitChoiceLabel(claim.suit)
              : formatClaimCompactLabel(claim),
        },
        {
          id: 'lowRank',
          title: labels.straight,
          helper: copy.straightFlushStraight,
          getValue: (claim) =>
            claim.category === 'straight-flush' ? String(claim.lowRank) : '',
          getLabel: (claim) => formatClaimCompactLabel(claim),
        },
      ];
  }
}

export function filterClaimsBySelections(
  claims: Claim[],
  steps: BuilderStepConfig[],
  selections: string[],
): Claim[] {
  return claims.filter((claim) =>
    selections.every(
      (selectedValue, index) => steps[index]?.getValue(claim) === selectedValue,
    ),
  );
}

export function normalizeSelections(
  claims: Claim[],
  steps: BuilderStepConfig[],
  selections: string[],
): string[] {
  const nextSelections: string[] = [];

  for (const [index, selectedValue] of selections.entries()) {
    const claimsForStep = filterClaimsBySelections(
      claims,
      steps,
      nextSelections,
    );
    const step = steps[index];

    if (!step) {
      break;
    }

    const validValues = new Set(
      claimsForStep.map((claim) => step.getValue(claim)).filter(Boolean),
    );

    if (!validValues.has(selectedValue)) {
      break;
    }

    nextSelections.push(selectedValue);
  }

  return nextSelections;
}

export function buildOptions(
  claims: Claim[],
  step: BuilderStepConfig,
): BuilderOption[] {
  const optionMap = new Map<string, BuilderOption>();

  for (const claim of claims) {
    const value = step.getValue(claim);

    if (!value) {
      continue;
    }

    const existing = optionMap.get(value);

    if (existing) {
      existing.count += 1;
      continue;
    }

    optionMap.set(value, {
      value,
      label: step.getLabel(claim),
      previewClaim: claim,
      count: 1,
    });
  }

  return [...optionMap.values()];
}

export function getSelectionLabel(
  claims: Claim[],
  steps: BuilderStepConfig[],
  selections: string[],
  stepIndex: number,
): string {
  const step = steps[stepIndex];

  if (!step) {
    return selections[stepIndex] ?? '';
  }

  const claimsForStep = filterClaimsBySelections(
    claims,
    steps,
    selections.slice(0, stepIndex),
  );
  const matchingClaim = claimsForStep.find(
    (claim) => step.getValue(claim) === selections[stepIndex],
  );

  return matchingClaim
    ? step.getLabel(matchingClaim)
    : (selections[stepIndex] ?? '');
}

export function buildSelectionsForClaim(
  claim: Claim,
  steps: BuilderStepConfig[],
): string[] {
  return steps
    .map((step) => step.getValue(claim))
    .filter((value): value is string => value.length > 0);
}
