import {
  RANKS,
  RANK_LABELS,
  type Rank,
  SUITS,
  SUIT_SYMBOLS,
  type Suit,
} from '../cards/index.js';
import {
  type ClaimOrderPreset,
  DEFAULT_CLAIM_ORDER_PRESET,
  DEFAULT_FLUSH_RULE,
  FLUSH_RULES,
  type FlushRule,
} from '../settings/index.js';

export const CLAIM_CATEGORIES = [
  'high-card',
  'pair',
  'two-pair',
  'three-of-a-kind',
  'straight',
  'flush',
  'full-house',
  'four-of-a-kind',
  'straight-flush',
] as const;

export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number];

const CLAIM_CATEGORY_ORDERS: Record<
  ClaimOrderPreset,
  readonly ClaimCategory[]
> = {
  'flush-below-straight': [
    'high-card',
    'pair',
    'two-pair',
    'three-of-a-kind',
    'flush',
    'straight',
    'full-house',
    'four-of-a-kind',
    'straight-flush',
  ],
  'standard-poker': [
    'high-card',
    'pair',
    'two-pair',
    'three-of-a-kind',
    'straight',
    'flush',
    'full-house',
    'four-of-a-kind',
    'straight-flush',
  ],
  'flush-below-trips-and-straight': [
    'high-card',
    'pair',
    'two-pair',
    'flush',
    'three-of-a-kind',
    'straight',
    'full-house',
    'four-of-a-kind',
    'straight-flush',
  ],
};

export const STRAIGHT_LOW_RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type StraightLowRank = (typeof STRAIGHT_LOW_RANKS)[number];

export const STRAIGHT_LOW_RANK_LABELS: Record<StraightLowRank, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
};

const STRAIGHT_LOW_RANK_WORDS: Record<StraightLowRank, string> = {
  1: 'ace',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
};

export type HighCardClaim = {
  category: 'high-card';
  rank: Rank;
};

export type PairClaim = {
  category: 'pair';
  pairRank: Rank;
};

export type TwoPairClaim = {
  category: 'two-pair';
  highPairRank: Rank;
  lowPairRank: Rank;
};

export type ThreeOfAKindClaim = {
  category: 'three-of-a-kind';
  tripRank: Rank;
};

export type StraightClaim = {
  category: 'straight';
  lowRank: StraightLowRank;
};

export type FlushClaim = {
  category: 'flush';
  suit: Suit;
  rank?: Rank;
};

export type FullHouseClaim = {
  category: 'full-house';
  tripRank: Rank;
  pairRank: Rank;
};

export type FourOfAKindClaim = {
  category: 'four-of-a-kind';
  quadRank: Rank;
};

export type StraightFlushClaim = {
  category: 'straight-flush';
  lowRank: StraightLowRank;
  suit: Suit;
};

export type Claim =
  | HighCardClaim
  | PairClaim
  | TwoPairClaim
  | ThreeOfAKindClaim
  | StraightClaim
  | FlushClaim
  | FullHouseClaim
  | FourOfAKindClaim
  | StraightFlushClaim;

const RANK_WORDS_SINGULAR: Record<Rank, string> = {
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'jack',
  12: 'queen',
  13: 'king',
  14: 'ace',
};

const RANK_WORDS_PLURAL: Record<Rank, string> = {
  2: 'twos',
  3: 'threes',
  4: 'fours',
  5: 'fives',
  6: 'sixes',
  7: 'sevens',
  8: 'eights',
  9: 'nines',
  10: 'tens',
  11: 'jacks',
  12: 'queens',
  13: 'kings',
  14: 'aces',
};

const RANK_SHORT_PLURAL_LABELS: Record<Rank, string> = {
  2: '2s',
  3: '3s',
  4: '4s',
  5: '5s',
  6: '6s',
  7: '7s',
  8: '8s',
  9: '9s',
  10: '10s',
  11: 'Js',
  12: 'Qs',
  13: 'Ks',
  14: 'As',
};

function suitStrength(suit: Suit): number {
  return SUITS.indexOf(suit);
}

function createCategoryStrengthMap(
  preset: ClaimOrderPreset,
): Record<ClaimCategory, number> {
  const strengths = {} as Record<ClaimCategory, number>;

  for (const [index, category] of CLAIM_CATEGORY_ORDERS[preset].entries()) {
    strengths[category] = index;
  }

  return strengths;
}

function categoryClaimsFor(
  category: ClaimCategory,
  flushRule: FlushRule = DEFAULT_FLUSH_RULE,
): Claim[] {
  switch (category) {
    case 'high-card':
      return RANKS.map((rank) => ({ category, rank }));
    case 'pair':
      return RANKS.map((pairRank) => ({ category, pairRank }));
    case 'two-pair': {
      const claims: Claim[] = [];

      for (let highPairRank = 3; highPairRank <= 14; highPairRank += 1) {
        for (
          let lowPairRank = 2;
          lowPairRank < highPairRank;
          lowPairRank += 1
        ) {
          claims.push({
            category,
            highPairRank: highPairRank as Rank,
            lowPairRank: lowPairRank as Rank,
          });
        }
      }

      return claims;
    }
    case 'three-of-a-kind':
      return RANKS.map((tripRank) => ({ category, tripRank }));
    case 'straight':
      return STRAIGHT_LOW_RANKS.map((lowRank) => ({ category, lowRank }));
    case 'flush':
      return flushRule === 'suit-plus-rank'
        ? SUITS.flatMap((suit) =>
            RANKS.map((rank) => ({
              category,
              suit,
              rank,
            })),
          )
        : SUITS.map((suit) => ({ category, suit }));
    case 'full-house': {
      const claims: Claim[] = [];

      for (const tripRank of RANKS) {
        for (const pairRank of RANKS) {
          if (tripRank === pairRank) {
            continue;
          }

          claims.push({
            category,
            tripRank,
            pairRank,
          });
        }
      }

      return claims;
    }
    case 'four-of-a-kind':
      return RANKS.map((quadRank) => ({ category, quadRank }));
    case 'straight-flush': {
      const claims: Claim[] = [];

      for (const lowRank of STRAIGHT_LOW_RANKS) {
        for (const suit of SUITS) {
          claims.push({
            category,
            lowRank,
            suit,
          });
        }
      }

      return claims;
    }
  }
}

const allClaimsCache = new Map<string, Claim[]>();
const categoryStrengthCache = new Map<
  ClaimOrderPreset,
  Record<ClaimCategory, number>
>();

export function getClaimCategoryOrder(
  preset: ClaimOrderPreset = DEFAULT_CLAIM_ORDER_PRESET,
): ClaimCategory[] {
  return [...CLAIM_CATEGORY_ORDERS[preset]];
}

export function claimToComparisonTuple(claim: Claim): number[] {
  switch (claim.category) {
    case 'high-card':
      return [claim.rank];
    case 'pair':
      return [claim.pairRank];
    case 'two-pair':
      return [claim.highPairRank, claim.lowPairRank];
    case 'three-of-a-kind':
      return [claim.tripRank];
    case 'straight':
      return [claim.lowRank];
    case 'flush':
      return claim.rank === undefined
        ? [suitStrength(claim.suit)]
        : [suitStrength(claim.suit), claim.rank];
    case 'full-house':
      return [claim.tripRank, claim.pairRank];
    case 'four-of-a-kind':
      return [claim.quadRank];
    case 'straight-flush':
      return [claim.lowRank, suitStrength(claim.suit)];
  }
}

export function compareClaims(
  left: Claim,
  right: Claim,
  preset: ClaimOrderPreset = DEFAULT_CLAIM_ORDER_PRESET,
  flushRule: FlushRule = DEFAULT_FLUSH_RULE,
): number {
  const categoryStrength =
    categoryStrengthCache.get(preset) ?? createCategoryStrengthMap(preset);
  categoryStrengthCache.set(preset, categoryStrength);

  const categoryDelta =
    categoryStrength[left.category] - categoryStrength[right.category];

  if (categoryDelta !== 0) {
    return categoryDelta;
  }

  if (
    flushRule === 'suit-plus-rank' &&
    left.category === 'flush' &&
    right.category === 'flush' &&
    left.rank !== undefined &&
    right.rank !== undefined
  ) {
    const suitDelta = suitStrength(left.suit) - suitStrength(right.suit);
    const rankDelta = left.rank - right.rank;

    if (suitDelta === 0 && rankDelta === 0) {
      return 0;
    }

    if (suitDelta >= 0 && rankDelta >= 0) {
      return 1;
    }

    if (suitDelta <= 0 && rankDelta <= 0) {
      return -1;
    }

    return 0;
  }

  const leftTuple = claimToComparisonTuple(left);
  const rightTuple = claimToComparisonTuple(right);
  const length = Math.max(leftTuple.length, rightTuple.length);

  for (let index = 0; index < length; index += 1) {
    const delta = (leftTuple[index] ?? 0) - (rightTuple[index] ?? 0);

    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

export function isClaimStrictlyHigher(
  nextClaim: Claim,
  previousClaim?: Claim,
  preset: ClaimOrderPreset = DEFAULT_CLAIM_ORDER_PRESET,
  flushRule: FlushRule = DEFAULT_FLUSH_RULE,
): boolean {
  if (!previousClaim) {
    return true;
  }

  return compareClaims(nextClaim, previousClaim, preset, flushRule) > 0;
}

export function claimToKey(claim: Claim): string {
  switch (claim.category) {
    case 'high-card':
      return `high-card:${claim.rank}`;
    case 'pair':
      return `pair:${claim.pairRank}`;
    case 'two-pair':
      return `two-pair:${claim.highPairRank}:${claim.lowPairRank}`;
    case 'three-of-a-kind':
      return `three-of-a-kind:${claim.tripRank}`;
    case 'straight':
      return `straight:${claim.lowRank}`;
    case 'flush':
      return claim.rank === undefined
        ? `flush:${claim.suit}`
        : `flush:${claim.suit}:${claim.rank}`;
    case 'full-house':
      return `full-house:${claim.tripRank}:${claim.pairRank}`;
    case 'four-of-a-kind':
      return `four-of-a-kind:${claim.quadRank}`;
    case 'straight-flush':
      return `straight-flush:${claim.lowRank}:${claim.suit}`;
  }
}

export function claimToLabel(claim: Claim): string {
  switch (claim.category) {
    case 'high-card':
      return `high card ${RANK_WORDS_SINGULAR[claim.rank]}`;
    case 'pair':
      return `pair of ${RANK_WORDS_PLURAL[claim.pairRank]}`;
    case 'two-pair':
      return `${RANK_WORDS_PLURAL[claim.highPairRank]} and ${RANK_WORDS_PLURAL[claim.lowPairRank]}`;
    case 'three-of-a-kind':
      return `three ${RANK_WORDS_PLURAL[claim.tripRank]}`;
    case 'straight':
      return `${STRAIGHT_LOW_RANK_WORDS[claim.lowRank]}-low straight`;
    case 'flush':
      return claim.rank === undefined
        ? `${claim.suit} flush`
        : `${claim.suit} flush with ${RANK_WORDS_SINGULAR[claim.rank]}`;
    case 'full-house':
      return `${RANK_WORDS_PLURAL[claim.tripRank]} full of ${RANK_WORDS_PLURAL[claim.pairRank]}`;
    case 'four-of-a-kind':
      return `four ${RANK_WORDS_PLURAL[claim.quadRank]}`;
    case 'straight-flush':
      return `${STRAIGHT_LOW_RANK_WORDS[claim.lowRank]}-low ${claim.suit} straight flush`;
  }
}

export function claimToCompactLabel(claim: Claim): string {
  switch (claim.category) {
    case 'high-card':
      return `${RANK_LABELS[claim.rank]}-high`;
    case 'pair':
      return `pair of ${RANK_SHORT_PLURAL_LABELS[claim.pairRank]}`;
    case 'two-pair':
      return `${RANK_SHORT_PLURAL_LABELS[claim.highPairRank]} & ${RANK_SHORT_PLURAL_LABELS[claim.lowPairRank]}`;
    case 'three-of-a-kind':
      return `trips ${RANK_SHORT_PLURAL_LABELS[claim.tripRank]}`;
    case 'straight':
      return `${STRAIGHT_LOW_RANK_LABELS[claim.lowRank]}-low straight`;
    case 'flush':
      return claim.rank === undefined
        ? `${SUIT_SYMBOLS[claim.suit]} flush`
        : `${SUIT_SYMBOLS[claim.suit]} flush + ${RANK_LABELS[claim.rank]}`;
    case 'full-house':
      return `${RANK_SHORT_PLURAL_LABELS[claim.tripRank]} full of ${RANK_SHORT_PLURAL_LABELS[claim.pairRank]}`;
    case 'four-of-a-kind':
      return `quads ${RANK_SHORT_PLURAL_LABELS[claim.quadRank]}`;
    case 'straight-flush':
      return `${STRAIGHT_LOW_RANK_LABELS[claim.lowRank]}-low ${SUIT_SYMBOLS[claim.suit]} straight flush`;
  }
}

function parseRank(value: string): Rank {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 14) {
    throw new Error(`Invalid rank: ${value}`);
  }

  return parsed as Rank;
}

function parseSuit(value: string): Suit {
  if (!SUITS.includes(value as Suit)) {
    throw new Error(`Invalid suit: ${value}`);
  }

  return value as Suit;
}

function parseStraightLowRank(value: string): StraightLowRank {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    !STRAIGHT_LOW_RANKS.includes(parsed as StraightLowRank)
  ) {
    throw new Error(`Invalid straight low rank: ${value}`);
  }

  return parsed as StraightLowRank;
}

export function parseClaimKey(key: string): Claim {
  const parts = key.split(':');
  const [category, firstValue, secondValue] = parts;

  switch (category) {
    case 'high-card':
      return {
        category,
        rank: parseRank(firstValue ?? ''),
      };
    case 'pair':
      return {
        category,
        pairRank: parseRank(firstValue ?? ''),
      };
    case 'two-pair': {
      const highPairRank = parseRank(firstValue ?? '');
      const lowPairRank = parseRank(secondValue ?? '');

      if (highPairRank <= lowPairRank) {
        throw new Error('Two-pair claims must keep the higher pair first.');
      }

      return {
        category,
        highPairRank,
        lowPairRank,
      };
    }
    case 'three-of-a-kind':
      return {
        category,
        tripRank: parseRank(firstValue ?? ''),
      };
    case 'straight':
      return {
        category,
        lowRank: parseStraightLowRank(firstValue ?? ''),
      };
    case 'flush':
      return secondValue
        ? {
            category,
            suit: parseSuit(firstValue ?? ''),
            rank: parseRank(secondValue),
          }
        : {
            category,
            suit: parseSuit(firstValue ?? ''),
          };
    case 'full-house': {
      const tripRank = parseRank(firstValue ?? '');
      const pairRank = parseRank(secondValue ?? '');

      if (tripRank === pairRank) {
        throw new Error(
          'Full-house claims require different trip and pair ranks.',
        );
      }

      return {
        category,
        tripRank,
        pairRank,
      };
    }
    case 'four-of-a-kind':
      return {
        category,
        quadRank: parseRank(firstValue ?? ''),
      };
    case 'straight-flush':
      return {
        category,
        lowRank: parseStraightLowRank(firstValue ?? ''),
        suit: parseSuit(secondValue ?? ''),
      };
    default:
      throw new Error(`Unknown claim category: ${category}`);
  }
}

export function getAllClaims(
  preset: ClaimOrderPreset = DEFAULT_CLAIM_ORDER_PRESET,
  flushRule: FlushRule = DEFAULT_FLUSH_RULE,
): Claim[] {
  const cacheKey = `${preset}:${flushRule}`;
  const cached = allClaimsCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const claims = getClaimCategoryOrder(preset).flatMap((category) =>
    categoryClaimsFor(category, flushRule),
  );
  allClaimsCache.set(cacheKey, claims);
  return claims;
}

export const ALL_CLAIMS = getAllClaims();

const allClaimUniverse = FLUSH_RULES.flatMap((flushRule) =>
  CLAIM_CATEGORIES.flatMap((category) =>
    categoryClaimsFor(category, flushRule),
  ),
);

export const CLAIMS_BY_KEY = new Map(
  allClaimUniverse.map((claim) => [claimToKey(claim), claim] as const),
);
