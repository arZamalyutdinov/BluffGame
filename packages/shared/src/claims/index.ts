import type { Rank } from '../cards/index.js';

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
  'royal-flush',
] as const;

export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number];

export type StraightHighRank = 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type FlushHighRank = 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type StraightFlushHighRank = 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

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
  highRank: StraightHighRank;
};

export type FlushClaim = {
  category: 'flush';
  highRank: FlushHighRank;
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
  highRank: StraightFlushHighRank;
};

export type RoyalFlushClaim = {
  category: 'royal-flush';
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
  | StraightFlushClaim
  | RoyalFlushClaim;

const CATEGORY_STRENGTH: Record<ClaimCategory, number> = {
  'high-card': 0,
  pair: 1,
  'two-pair': 2,
  'three-of-a-kind': 3,
  straight: 4,
  flush: 5,
  'full-house': 6,
  'four-of-a-kind': 7,
  'straight-flush': 8,
  'royal-flush': 9,
};

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
      return [claim.highRank];
    case 'flush':
      return [claim.highRank];
    case 'full-house':
      return [claim.tripRank, claim.pairRank];
    case 'four-of-a-kind':
      return [claim.quadRank];
    case 'straight-flush':
      return [claim.highRank];
    case 'royal-flush':
      return [];
  }
}

export function compareClaims(left: Claim, right: Claim): number {
  const categoryDelta =
    CATEGORY_STRENGTH[left.category] - CATEGORY_STRENGTH[right.category];

  if (categoryDelta !== 0) {
    return categoryDelta;
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
): boolean {
  if (!previousClaim) {
    return true;
  }

  return compareClaims(nextClaim, previousClaim) > 0;
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
      return `straight:${claim.highRank}`;
    case 'flush':
      return `flush:${claim.highRank}`;
    case 'full-house':
      return `full-house:${claim.tripRank}:${claim.pairRank}`;
    case 'four-of-a-kind':
      return `four-of-a-kind:${claim.quadRank}`;
    case 'straight-flush':
      return `straight-flush:${claim.highRank}`;
    case 'royal-flush':
      return 'royal-flush';
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
      return `${RANK_WORDS_SINGULAR[claim.highRank]}-high straight`;
    case 'flush':
      return `${RANK_WORDS_SINGULAR[claim.highRank]}-high flush`;
    case 'full-house':
      return `${RANK_WORDS_PLURAL[claim.tripRank]} full of ${RANK_WORDS_PLURAL[claim.pairRank]}`;
    case 'four-of-a-kind':
      return `four ${RANK_WORDS_PLURAL[claim.quadRank]}`;
    case 'straight-flush':
      return `${RANK_WORDS_SINGULAR[claim.highRank]}-high straight flush`;
    case 'royal-flush':
      return 'royal flush';
  }
}

function parseRank(value: string): Rank {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 14) {
    throw new Error(`Invalid rank: ${value}`);
  }

  return parsed as Rank;
}

function parseStraightHighRank(value: string): StraightHighRank {
  const parsed = parseRank(value);

  if (parsed < 5) {
    throw new Error(`Invalid straight high rank: ${value}`);
  }

  return parsed as StraightHighRank;
}

function parseFlushHighRank(value: string): FlushHighRank {
  const parsed = parseRank(value);

  if (parsed < 6) {
    throw new Error(`Invalid flush high rank: ${value}`);
  }

  return parsed as FlushHighRank;
}

function parseStraightFlushHighRank(value: string): StraightFlushHighRank {
  const parsed = parseRank(value);

  if (parsed < 5 || parsed > 13) {
    throw new Error(`Invalid straight flush high rank: ${value}`);
  }

  return parsed as StraightFlushHighRank;
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
        highRank: parseStraightHighRank(firstValue ?? ''),
      };
    case 'flush':
      return {
        category,
        highRank: parseFlushHighRank(firstValue ?? ''),
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
        highRank: parseStraightFlushHighRank(firstValue ?? ''),
      };
    case 'royal-flush':
      return {
        category,
      };
    default:
      throw new Error(`Unknown claim category: ${category}`);
  }
}

function createAscendingClaims(): Claim[] {
  const claims: Claim[] = [];

  for (let rank = 2; rank <= 14; rank += 1) {
    claims.push({ category: 'high-card', rank: rank as Rank });
  }

  for (let rank = 2; rank <= 14; rank += 1) {
    claims.push({ category: 'pair', pairRank: rank as Rank });
  }

  for (let highPairRank = 3; highPairRank <= 14; highPairRank += 1) {
    for (let lowPairRank = 2; lowPairRank < highPairRank; lowPairRank += 1) {
      claims.push({
        category: 'two-pair',
        highPairRank: highPairRank as Rank,
        lowPairRank: lowPairRank as Rank,
      });
    }
  }

  for (let rank = 2; rank <= 14; rank += 1) {
    claims.push({ category: 'three-of-a-kind', tripRank: rank as Rank });
  }

  for (let highRank = 5; highRank <= 14; highRank += 1) {
    claims.push({
      category: 'straight',
      highRank: highRank as StraightHighRank,
    });
  }

  for (let highRank = 6; highRank <= 14; highRank += 1) {
    claims.push({ category: 'flush', highRank: highRank as FlushHighRank });
  }

  for (let tripRank = 2; tripRank <= 14; tripRank += 1) {
    for (let pairRank = 2; pairRank <= 14; pairRank += 1) {
      if (tripRank === pairRank) {
        continue;
      }

      claims.push({
        category: 'full-house',
        tripRank: tripRank as Rank,
        pairRank: pairRank as Rank,
      });
    }
  }

  for (let rank = 2; rank <= 14; rank += 1) {
    claims.push({ category: 'four-of-a-kind', quadRank: rank as Rank });
  }

  for (let highRank = 5; highRank <= 13; highRank += 1) {
    claims.push({
      category: 'straight-flush',
      highRank: highRank as StraightFlushHighRank,
    });
  }

  claims.push({ category: 'royal-flush' });

  return claims;
}

export const ALL_CLAIMS = createAscendingClaims();

export const CLAIMS_BY_KEY = new Map(
  ALL_CLAIMS.map((claim) => [claimToKey(claim), claim] as const),
);
