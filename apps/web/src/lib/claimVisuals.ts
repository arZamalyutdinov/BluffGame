import {
  type Card,
  type Claim,
  type Rank,
  type Suit,
  createCard,
} from '@bluff-game/shared';

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

function straightRanks(lowRank: number): Rank[] {
  if (lowRank === 1) {
    return [14, 2, 3, 4, 5];
  }

  return [
    asRank(lowRank),
    asRank(lowRank + 1),
    asRank(lowRank + 2),
    asRank(lowRank + 3),
    asRank(lowRank + 4),
  ];
}

const FLUSH_PREVIEW_FILLER_RANKS = [14, 13, 12, 11, 9].map(asRank);

export function claimToIllustrationCards(claim: Claim): Card[] {
  switch (claim.category) {
    case 'high-card':
      return [createCard(claim.rank, 'spades')];
    case 'pair':
      return [
        createCard(claim.pairRank, 'spades'),
        createCard(claim.pairRank, 'hearts'),
      ];
    case 'two-pair':
      return [
        createCard(claim.highPairRank, 'spades'),
        createCard(claim.highPairRank, 'hearts'),
        createCard(claim.lowPairRank, 'clubs'),
        createCard(claim.lowPairRank, 'diamonds'),
      ];
    case 'three-of-a-kind':
      return [
        createCard(claim.tripRank, 'spades'),
        createCard(claim.tripRank, 'hearts'),
        createCard(claim.tripRank, 'clubs'),
      ];
    case 'straight':
      return straightRanks(claim.lowRank).map((rank, index) =>
        createCard(rank, STRAIGHT_PREVIEW_SUITS[index] ?? 'spades'),
      );
    case 'flush':
      return claim.rank === undefined
        ? FLUSH_PREVIEW_FILLER_RANKS.map((rank) => createCard(rank, claim.suit))
        : [
            ...FLUSH_PREVIEW_FILLER_RANKS.filter((rank) => rank !== claim.rank)
              .slice(0, 4)
              .map((rank) => createCard(rank, claim.suit)),
            createCard(claim.rank, claim.suit),
          ];
    case 'full-house':
      return [
        createCard(claim.tripRank, 'spades'),
        createCard(claim.tripRank, 'hearts'),
        createCard(claim.tripRank, 'clubs'),
        createCard(claim.pairRank, 'diamonds'),
        createCard(claim.pairRank, 'spades'),
      ];
    case 'four-of-a-kind':
      return SUIT_ORDER.map((suit) => createCard(claim.quadRank, suit));
    case 'straight-flush':
      return straightRanks(claim.lowRank).map((rank) =>
        createCard(rank, claim.suit),
      );
  }
}

export function claimToBuilderIllustrationCards(
  claim: Claim,
  stepId?: string,
): Card[] {
  if (claim.category === 'two-pair' && stepId === 'highPairRank') {
    return [
      createCard(claim.highPairRank, 'spades'),
      createCard(claim.highPairRank, 'hearts'),
    ];
  }

  if (claim.category === 'full-house' && stepId === 'tripRank') {
    return [
      createCard(claim.tripRank, 'spades'),
      createCard(claim.tripRank, 'hearts'),
      createCard(claim.tripRank, 'clubs'),
    ];
  }

  return claimToIllustrationCards(claim);
}
