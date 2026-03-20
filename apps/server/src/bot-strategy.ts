import {
  type Card,
  type Claim,
  type ClaimOrderPreset,
  type FlushRule,
  type JokerRule,
  cardToKey,
  claimExists,
  claimToKey,
  createDeck,
  getAllClaims,
  isClaimStrictlyHigher,
} from '@bluff-game/shared';

export interface BotOpponentRead {
  caughtBluffs: number;
  provenClaims: number;
  timeouts: number;
}

export type BotDecision =
  | { type: 'challenge' }
  | { type: 'claim'; claim: Claim };

export interface BotDecisionContext {
  hand: Card[];
  totalCardsInRound: number;
  activePlayerCount: number;
  selfHandSize: number;
  eliminationHandSize: number;
  claimOrderPreset: ClaimOrderPreset;
  flushRule: FlushRule;
  jokerRule: JokerRule;
  lastClaim?: Claim;
  claimantRead?: BotOpponentRead;
}

const BOT_GIVEN_NAMES = [
  'Alden',
  'Mira',
  'Silas',
  'Nora',
  'Felix',
  'Vera',
  'Iris',
  'Lucian',
  'Elara',
  'Theo',
  'Cora',
  'Soren',
  'Lina',
  'Rowan',
  'Talia',
  'Julian',
] as const;

const BOT_SURNAMES = [
  'Vale',
  'Marlowe',
  'Hollow',
  'Quill',
  'Sterling',
  'Frost',
  'Dane',
  'Rook',
  'Hart',
  'Reed',
  'Flint',
  'Crow',
  'Morrow',
  'Pike',
  'Ashby',
  'Wren',
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeNameKey(value: string): string {
  return value.trim().toLowerCase();
}

function buildRemainingDeck(hand: Card[], jokerRule: JokerRule): Card[] {
  const remainingCounts = new Map<string, number>();

  for (const card of createDeck(jokerRule)) {
    const key = cardToKey(card);
    remainingCounts.set(key, (remainingCounts.get(key) ?? 0) + 1);
  }

  for (const card of hand) {
    const key = cardToKey(card);
    const count = remainingCounts.get(key) ?? 0;

    if (count <= 0) {
      continue;
    }

    remainingCounts.set(key, count - 1);
  }

  return createDeck(jokerRule).filter((card) => {
    const key = cardToKey(card);
    const count = remainingCounts.get(key) ?? 0;

    if (count <= 0) {
      return false;
    }

    remainingCounts.set(key, count - 1);
    return true;
  });
}

function sampleUnknownCards(deck: Card[], count: number): Card[] {
  if (count <= 0) {
    return [];
  }

  const shuffled = [...deck];

  for (let index = 0; index < count; index += 1) {
    const swapIndex =
      index + Math.floor(Math.random() * (shuffled.length - index));
    const next = shuffled[index];

    shuffled[index] = shuffled[swapIndex] as Card;
    shuffled[swapIndex] = next as Card;
  }

  return shuffled.slice(0, count);
}

function estimateClaimProbabilities(
  context: Pick<
    BotDecisionContext,
    'hand' | 'totalCardsInRound' | 'activePlayerCount' | 'jokerRule'
  >,
  claims: Claim[],
): Map<string, number> {
  const uniqueClaims = Array.from(
    new Map(
      claims.map((claim) => [claimToKey(claim), claim] as const),
    ).values(),
  );
  const probabilities = new Map<string, number>();
  const unknownCount = Math.max(
    0,
    context.totalCardsInRound - context.hand.length,
  );

  if (unknownCount === 0) {
    for (const claim of uniqueClaims) {
      probabilities.set(
        claimToKey(claim),
        claimExists(context.hand, claim) ? 1 : 0,
      );
    }

    return probabilities;
  }

  const remainingDeck = buildRemainingDeck(context.hand, context.jokerRule);
  const sampleCount = clamp(
    150 + uniqueClaims.length / 4 + context.activePlayerCount * 15,
    180,
    360,
  );
  const counts = new Map<string, number>();

  for (const claim of uniqueClaims) {
    counts.set(claimToKey(claim), 0);
  }

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const combinedCards = [
      ...context.hand,
      ...sampleUnknownCards(remainingDeck, unknownCount),
    ];

    for (const claim of uniqueClaims) {
      if (claimExists(combinedCards, claim)) {
        const key = claimToKey(claim);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  for (const claim of uniqueClaims) {
    const key = claimToKey(claim);
    probabilities.set(key, (counts.get(key) ?? 0) / sampleCount);
  }

  return probabilities;
}

function getSelfRisk(
  selfHandSize: number,
  eliminationHandSize: number,
): number {
  return clamp((selfHandSize - 1) / Math.max(1, eliminationHandSize - 1), 0, 1);
}

function getClaimPressure(
  claim: Claim,
  allClaims: Claim[],
  claimIndexes: Map<string, number>,
): number {
  if (allClaims.length <= 1) {
    return 1;
  }

  return (
    (claimIndexes.get(claimToKey(claim)) ?? 0) /
    Math.max(1, allClaims.length - 1)
  );
}

export function chooseBotAction(context: BotDecisionContext): BotDecision {
  const allClaims = getAllClaims(context.claimOrderPreset, context.flushRule);
  const legalClaims = allClaims.filter(
    (claim) =>
      !context.lastClaim ||
      isClaimStrictlyHigher(
        claim,
        context.lastClaim,
        context.claimOrderPreset,
        context.flushRule,
      ),
  );

  if (!context.lastClaim) {
    const claimIndexes = new Map(
      allClaims.map((claim, index) => [claimToKey(claim), index] as const),
    );
    const probabilities = estimateClaimProbabilities(context, legalClaims);
    const selfRisk = getSelfRisk(
      context.selfHandSize,
      context.eliminationHandSize,
    );
    const truthFloor = 0.42 + selfRisk * 0.2;
    const scoredClaims = legalClaims.map((claim) => {
      const probability = probabilities.get(claimToKey(claim)) ?? 0;
      const pressure = getClaimPressure(claim, allClaims, claimIndexes);
      const directSupport = claimExists(context.hand, claim) ? 0.12 : 0;
      const score =
        probability * (1.5 + selfRisk * 0.5) +
        pressure * 0.95 +
        directSupport -
        Math.max(0, truthFloor - probability) * (0.7 + selfRisk);

      return {
        claim,
        probability,
        score,
      };
    });
    const safeClaims = scoredClaims.filter(
      (entry) => entry.probability >= truthFloor,
    );
    const bestClaim = [
      ...(safeClaims.length > 0 ? safeClaims : scoredClaims),
    ].sort((left, right) => right.score - left.score)[0];
    const fallbackClaim = legalClaims[0] ?? allClaims[0];

    if (!fallbackClaim) {
      throw new Error('At least one claim must exist for a bot turn.');
    }

    return {
      type: 'claim',
      claim: bestClaim?.claim ?? fallbackClaim,
    };
  }

  const claimsToEstimate = [context.lastClaim, ...legalClaims];
  const claimIndexes = new Map(
    allClaims.map((claim, index) => [claimToKey(claim), index] as const),
  );
  const probabilities = estimateClaimProbabilities(context, claimsToEstimate);
  const selfRisk = getSelfRisk(
    context.selfHandSize,
    context.eliminationHandSize,
  );
  const currentClaimProbability =
    probabilities.get(claimToKey(context.lastClaim)) ?? 0;
  const currentClaimPressure = getClaimPressure(
    context.lastClaim,
    allClaims,
    claimIndexes,
  );
  const claimantBias = clamp(
    (context.claimantRead?.caughtBluffs ?? 0) * 0.08 -
      (context.claimantRead?.provenClaims ?? 0) * 0.04 +
      (context.claimantRead?.timeouts ?? 0) * 0.03,
    -0.08,
    0.22,
  );
  const challengeThreshold = clamp(
    0.22 + selfRisk * 0.2 + currentClaimPressure * 0.14 + claimantBias,
    0.1,
    0.74,
  );
  const challengeScore =
    (1 - currentClaimProbability) * (1.3 + selfRisk * 0.8) -
    currentClaimProbability * (0.95 + selfRisk * 1.25);
  const raiseTruthFloor = 0.28 + selfRisk * 0.25;
  const scoredRaises = legalClaims.map((claim) => {
    const probability = probabilities.get(claimToKey(claim)) ?? 0;
    const pressure = getClaimPressure(claim, allClaims, claimIndexes);
    const directSupport = claimExists(context.hand, claim) ? 0.14 : 0;
    const score =
      probability * (1.35 + selfRisk * 0.95) +
      pressure * 0.72 +
      directSupport -
      (1 - probability) * (0.8 + selfRisk * 1.35);

    return {
      claim,
      probability,
      score,
    };
  });
  const viableRaises = scoredRaises.filter(
    (entry) => entry.probability >= raiseTruthFloor,
  );
  const bestRaise = [
    ...(viableRaises.length > 0 ? viableRaises : scoredRaises),
  ].sort((left, right) => right.score - left.score)[0];

  if (!bestRaise) {
    return { type: 'challenge' };
  }

  if (
    currentClaimProbability <= challengeThreshold &&
    challengeScore >= bestRaise.score - 0.08
  ) {
    return { type: 'challenge' };
  }

  if (viableRaises.length > 0 && bestRaise.score > -0.12) {
    return {
      type: 'claim',
      claim: bestRaise.claim,
    };
  }

  if (challengeScore >= -0.04) {
    return { type: 'challenge' };
  }

  return {
    type: 'claim',
    claim: bestRaise.claim,
  };
}

export function generateBotName(existingNames: string[]): string {
  const takenNames = new Set(existingNames.map(normalizeNameKey));
  const givenOffset = Math.floor(Math.random() * BOT_GIVEN_NAMES.length);
  const surnameOffset = Math.floor(Math.random() * BOT_SURNAMES.length);

  for (
    let givenIndex = 0;
    givenIndex < BOT_GIVEN_NAMES.length;
    givenIndex += 1
  ) {
    for (
      let surnameIndex = 0;
      surnameIndex < BOT_SURNAMES.length;
      surnameIndex += 1
    ) {
      const candidate = `${BOT_GIVEN_NAMES[(givenOffset + givenIndex) % BOT_GIVEN_NAMES.length]} ${
        BOT_SURNAMES[(surnameOffset + surnameIndex) % BOT_SURNAMES.length]
      }`;

      if (!takenNames.has(normalizeNameKey(candidate))) {
        return candidate;
      }
    }
  }

  let suffix = 1;

  while (takenNames.has(normalizeNameKey(`Table Bot ${suffix}`))) {
    suffix += 1;
  }

  return `Table Bot ${suffix}`;
}
