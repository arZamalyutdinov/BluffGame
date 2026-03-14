import type { Card, Claim, Rank, Suit } from '@bluff-game/shared';

const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const STRAIGHT_PREVIEW_SUITS: Suit[] = [
  'spades',
  'hearts',
  'clubs',
  'diamonds',
  'spades',
];

function asRank(value: number): Rank {
  return value as Rank;
}

function straightRanks(highRank: number): Rank[] {
  if (highRank === 5) {
    return [14, 2, 3, 4, 5];
  }

  return [
    asRank(highRank - 4),
    asRank(highRank - 3),
    asRank(highRank - 2),
    asRank(highRank - 1),
    asRank(highRank),
  ];
}

function descendingRanks(highRank: number, count: number): Rank[] {
  return Array.from({ length: count }, (_, index) => asRank(highRank - index));
}

export function claimToIllustrationCards(claim: Claim): Card[] {
  switch (claim.category) {
    case 'high-card':
      return [{ rank: claim.rank, suit: 'spades' }];
    case 'pair':
      return [
        { rank: claim.pairRank, suit: 'spades' },
        { rank: claim.pairRank, suit: 'hearts' },
      ];
    case 'two-pair':
      return [
        { rank: claim.highPairRank, suit: 'spades' },
        { rank: claim.highPairRank, suit: 'hearts' },
        { rank: claim.lowPairRank, suit: 'clubs' },
        { rank: claim.lowPairRank, suit: 'diamonds' },
      ];
    case 'three-of-a-kind':
      return [
        { rank: claim.tripRank, suit: 'spades' },
        { rank: claim.tripRank, suit: 'hearts' },
        { rank: claim.tripRank, suit: 'clubs' },
      ];
    case 'straight':
      return straightRanks(claim.highRank).map((rank, index) => ({
        rank,
        suit: STRAIGHT_PREVIEW_SUITS[index] ?? 'spades',
      }));
    case 'flush':
      return descendingRanks(claim.highRank, 5).map((rank) => ({
        rank,
        suit: 'hearts',
      }));
    case 'full-house':
      return [
        { rank: claim.tripRank, suit: 'spades' },
        { rank: claim.tripRank, suit: 'hearts' },
        { rank: claim.tripRank, suit: 'clubs' },
        { rank: claim.pairRank, suit: 'diamonds' },
        { rank: claim.pairRank, suit: 'spades' },
      ];
    case 'four-of-a-kind':
      return SUIT_ORDER.map((suit) => ({
        rank: claim.quadRank,
        suit,
      }));
    case 'straight-flush':
      return straightRanks(claim.highRank).map((rank) => ({
        rank,
        suit: 'spades',
      }));
    case 'royal-flush':
      return [10, 11, 12, 13, 14].map((rank) => ({
        rank: asRank(rank),
        suit: 'spades',
      }));
  }
}
