import type { Card, Rank, Suit } from '../cards/index.js';
import type {
  Claim,
  StraightClaim,
  StraightFlushClaim,
} from '../claims/index.js';

export interface PenaltyPlayerState {
  playerId: string;
  seatIndex: number;
  handSize: number;
  isEliminated: boolean;
}

export interface ShowdownInput {
  claim: Claim;
  claimantPlayerId: string;
  challengerPlayerId: string;
  handsByPlayerId: Record<string, Card[]>;
  players: PenaltyPlayerState[];
}

export interface ShowdownResolution {
  claimWasValid: boolean;
  loserPlayerId: string;
  loserHandSize: number;
  loserEliminated: boolean;
  updatedPlayers: PenaltyPlayerState[];
}

const ROYAL_RANKS: Rank[] = [10, 11, 12, 13, 14];

function buildRankCounts(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();

  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }

  return counts;
}

function buildSuitGroups(cards: Card[]): Map<Suit, Card[]> {
  const groups = new Map<Suit, Card[]>();

  for (const card of cards) {
    const next = groups.get(card.suit) ?? [];
    next.push(card);
    groups.set(card.suit, next);
  }

  return groups;
}

function getStraightRanks(highRank: StraightClaim['highRank']): Rank[] {
  if (highRank === 5) {
    return [14, 2, 3, 4, 5];
  }

  return [
    (highRank - 4) as Rank,
    (highRank - 3) as Rank,
    (highRank - 2) as Rank,
    (highRank - 1) as Rank,
    highRank,
  ];
}

function hasRanks(cards: Card[], requiredRanks: Rank[]): boolean {
  const rankSet = new Set(cards.map((card) => card.rank));
  return requiredRanks.every((rank) => rankSet.has(rank));
}

function hasStraight(
  cards: Card[],
  claim: StraightClaim | StraightFlushClaim,
): boolean {
  return hasRanks(cards, getStraightRanks(claim.highRank));
}

export function claimExists(cards: Card[], claim: Claim): boolean {
  const rankCounts = buildRankCounts(cards);
  const suitGroups = buildSuitGroups(cards);

  switch (claim.category) {
    case 'high-card':
      return cards.some((card) => card.rank === claim.rank);
    case 'pair':
      return (rankCounts.get(claim.pairRank) ?? 0) >= 2;
    case 'two-pair':
      return (
        (rankCounts.get(claim.highPairRank) ?? 0) >= 2 &&
        (rankCounts.get(claim.lowPairRank) ?? 0) >= 2
      );
    case 'three-of-a-kind':
      return (rankCounts.get(claim.tripRank) ?? 0) >= 3;
    case 'straight':
      return hasStraight(cards, claim);
    case 'flush':
      return [...suitGroups.values()].some((group) => {
        const eligibleCount = group.filter(
          (card) => card.rank <= claim.highRank,
        ).length;
        return (
          eligibleCount >= 5 &&
          group.some((card) => card.rank === claim.highRank)
        );
      });
    case 'full-house':
      return (
        claim.tripRank !== claim.pairRank &&
        (rankCounts.get(claim.tripRank) ?? 0) >= 3 &&
        (rankCounts.get(claim.pairRank) ?? 0) >= 2
      );
    case 'four-of-a-kind':
      return (rankCounts.get(claim.quadRank) ?? 0) >= 4;
    case 'straight-flush':
      return [...suitGroups.values()].some((group) =>
        hasStraight(group, claim),
      );
    case 'royal-flush':
      return [...suitGroups.values()].some((group) =>
        hasRanks(group, ROYAL_RANKS),
      );
  }
}

export function resolveShowdown(input: ShowdownInput): ShowdownResolution {
  const allCards = Object.values(input.handsByPlayerId).flat();
  const claimWasValid = claimExists(allCards, input.claim);
  const loserPlayerId = claimWasValid
    ? input.challengerPlayerId
    : input.claimantPlayerId;

  const updatedPlayers = input.players.map((player) => {
    if (player.playerId !== loserPlayerId) {
      return player;
    }

    if (player.handSize >= 5) {
      return {
        ...player,
        isEliminated: true,
      };
    }

    return {
      ...player,
      handSize: player.handSize + 1,
    };
  });

  const loser = updatedPlayers.find(
    (player) => player.playerId === loserPlayerId,
  );

  if (!loser) {
    throw new Error(`Loser ${loserPlayerId} was not found in player state.`);
  }

  return {
    claimWasValid,
    loserPlayerId,
    loserHandSize: loser.handSize,
    loserEliminated: loser.isEliminated,
    updatedPlayers,
  };
}

export function getNextActiveSeatIndex(
  players: PenaltyPlayerState[],
  currentSeatIndex: number,
): number {
  const activePlayers = players
    .filter((player) => !player.isEliminated)
    .sort((left, right) => left.seatIndex - right.seatIndex);

  if (activePlayers.length === 0) {
    throw new Error('No active players remain.');
  }

  const seatOrder = activePlayers.map((player) => player.seatIndex);
  const currentPosition = seatOrder.findIndex(
    (seatIndex) => seatIndex === currentSeatIndex,
  );

  if (currentPosition === -1) {
    const fallback = seatOrder.find(
      (seatIndex) => seatIndex > currentSeatIndex,
    );
    const firstSeat = seatOrder[0];

    if (firstSeat === undefined) {
      throw new Error('No active seat order exists.');
    }

    return fallback ?? firstSeat;
  }

  const nextSeat = seatOrder[(currentPosition + 1) % seatOrder.length];

  if (nextSeat === undefined) {
    throw new Error('No next active seat exists.');
  }

  return nextSeat;
}

export function getActivePlayerIds(players: PenaltyPlayerState[]): string[] {
  return players
    .filter((player) => !player.isEliminated)
    .sort((left, right) => left.seatIndex - right.seatIndex)
    .map((player) => player.playerId);
}
