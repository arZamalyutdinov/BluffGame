import {
  type Card,
  type Rank,
  type Suit,
  sortCardsDescending,
} from '../cards/index.js';
import type { Claim, StraightClaim } from '../claims/index.js';

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
  eliminationHandSize: number;
}

export interface ShowdownResolution {
  claimWasValid: boolean;
  loserPlayerId: string;
  loserHandSize: number;
  loserEliminated: boolean;
  updatedPlayers: PenaltyPlayerState[];
}

export interface RoundLossInput {
  loserPlayerId: string;
  players: PenaltyPlayerState[];
  eliminationHandSize: number;
}

export interface RoundLossResolution {
  loserPlayerId: string;
  loserHandSize: number;
  loserEliminated: boolean;
  updatedPlayers: PenaltyPlayerState[];
}

export interface ClaimConstruction {
  cards: Card[];
  slotCards: Array<Card | undefined>;
  requiredCount: number;
  isComplete: boolean;
}

function getStraightRanks(lowRank: StraightClaim['lowRank']): Rank[] {
  if (lowRank === 1) {
    return [14, 2, 3, 4, 5];
  }

  return [
    lowRank as Rank,
    (lowRank + 1) as Rank,
    (lowRank + 2) as Rank,
    (lowRank + 3) as Rank,
    (lowRank + 4) as Rank,
  ];
}

function takeCardsOfRank(cards: Card[], rank: Rank, count: number): Card[] {
  return sortCardsDescending(cards.filter((card) => card.rank === rank)).slice(
    0,
    count,
  );
}

function toSlotCards(
  cards: Card[],
  requiredCount: number,
): Array<Card | undefined> {
  return Array.from({ length: requiredCount }, (_, index) => cards[index]);
}

function takeCardsOfSuit(cards: Card[], suit: Suit, count: number): Card[] {
  return sortCardsDescending(cards.filter((card) => card.suit === suit)).slice(
    0,
    count,
  );
}

function takeStraightSlotCards(
  cards: Card[],
  lowRank: StraightClaim['lowRank'],
): Array<Card | undefined> {
  const sortedCards = sortCardsDescending(cards);

  return getStraightRanks(lowRank).map((rank) =>
    sortedCards.find((card) => card.rank === rank),
  );
}

export function buildClaimConstruction(
  cards: Card[],
  claim: Claim,
): ClaimConstruction {
  switch (claim.category) {
    case 'high-card': {
      const selectedCards = takeCardsOfRank(cards, claim.rank, 1);
      const slotCards = toSlotCards(selectedCards, 1);

      return {
        cards: selectedCards,
        slotCards,
        requiredCount: 1,
        isComplete: selectedCards.length === 1,
      };
    }
    case 'pair': {
      const selectedCards = takeCardsOfRank(cards, claim.pairRank, 2);
      const slotCards = toSlotCards(selectedCards, 2);

      return {
        cards: selectedCards,
        slotCards,
        requiredCount: 2,
        isComplete: selectedCards.length === 2,
      };
    }
    case 'two-pair': {
      const highPairCards = takeCardsOfRank(cards, claim.highPairRank, 2);
      const lowPairCards = takeCardsOfRank(cards, claim.lowPairRank, 2);
      const slotCards = [
        ...toSlotCards(highPairCards, 2),
        ...toSlotCards(lowPairCards, 2),
      ];
      const selectedCards = [...highPairCards, ...lowPairCards];

      return {
        cards: selectedCards,
        slotCards,
        requiredCount: 4,
        isComplete: highPairCards.length === 2 && lowPairCards.length === 2,
      };
    }
    case 'three-of-a-kind': {
      const selectedCards = takeCardsOfRank(cards, claim.tripRank, 3);
      const slotCards = toSlotCards(selectedCards, 3);

      return {
        cards: selectedCards,
        slotCards,
        requiredCount: 3,
        isComplete: selectedCards.length === 3,
      };
    }
    case 'straight': {
      const slotCards = takeStraightSlotCards(cards, claim.lowRank);
      const selectedCards = slotCards.filter((card): card is Card =>
        Boolean(card),
      );

      return {
        cards: selectedCards,
        slotCards,
        requiredCount: 5,
        isComplete: selectedCards.length === 5,
      };
    }
    case 'flush': {
      const selectedCards = takeCardsOfSuit(cards, claim.suit, 5);
      const slotCards = toSlotCards(selectedCards, 5);

      return {
        cards: selectedCards,
        slotCards,
        requiredCount: 5,
        isComplete: selectedCards.length === 5,
      };
    }
    case 'full-house': {
      const tripCards = takeCardsOfRank(cards, claim.tripRank, 3);
      const pairCards = takeCardsOfRank(cards, claim.pairRank, 2);
      const slotCards = [
        ...toSlotCards(tripCards, 3),
        ...toSlotCards(pairCards, 2),
      ];
      const selectedCards = [...tripCards, ...pairCards];

      return {
        cards: selectedCards,
        slotCards,
        requiredCount: 5,
        isComplete: tripCards.length === 3 && pairCards.length === 2,
      };
    }
    case 'four-of-a-kind': {
      const selectedCards = takeCardsOfRank(cards, claim.quadRank, 4);
      const slotCards = toSlotCards(selectedCards, 4);

      return {
        cards: selectedCards,
        slotCards,
        requiredCount: 4,
        isComplete: selectedCards.length === 4,
      };
    }
    case 'straight-flush': {
      const suitedCards = cards.filter((card) => card.suit === claim.suit);
      const slotCards = takeStraightSlotCards(suitedCards, claim.lowRank);
      const selectedCards = slotCards.filter((card): card is Card =>
        Boolean(card),
      );

      return {
        cards: selectedCards,
        slotCards,
        requiredCount: 5,
        isComplete: selectedCards.length === 5,
      };
    }
  }
}

export function claimExists(cards: Card[], claim: Claim): boolean {
  return buildClaimConstruction(cards, claim).isComplete;
}

export function resolveShowdown(input: ShowdownInput): ShowdownResolution {
  const allCards = Object.values(input.handsByPlayerId).flat();
  const claimWasValid = claimExists(allCards, input.claim);
  const loserPlayerId = claimWasValid
    ? input.challengerPlayerId
    : input.claimantPlayerId;

  const penalty = applyRoundLoss({
    loserPlayerId,
    players: input.players,
    eliminationHandSize: input.eliminationHandSize,
  });

  return {
    claimWasValid,
    loserPlayerId,
    loserHandSize: penalty.loserHandSize,
    loserEliminated: penalty.loserEliminated,
    updatedPlayers: penalty.updatedPlayers,
  };
}

export function applyRoundLoss(input: RoundLossInput): RoundLossResolution {
  const updatedPlayers = input.players.map((player) => {
    if (player.playerId !== input.loserPlayerId) {
      return player;
    }

    if (player.handSize >= input.eliminationHandSize) {
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
    (player) => player.playerId === input.loserPlayerId,
  );

  if (!loser) {
    throw new Error(
      `Loser ${input.loserPlayerId} was not found in player state.`,
    );
  }

  return {
    loserPlayerId: input.loserPlayerId,
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
