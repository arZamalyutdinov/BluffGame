import {
  type Card,
  type StandardCard,
  type Suit,
  canJokerRepresentSuit,
  isJokerCard,
  isStandardCard,
  sortCardsDescending,
} from '../cards/index.js';
import type { Claim, StraightClaim } from '../claims/index.js';
import {
  DEFAULT_SHOWDOWN_DRAW_RULE,
  type ShowdownDrawRule,
} from '../settings/index.js';

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
  remainingDeck?: Card[];
  showdownDrawRule?: ShowdownDrawRule;
}

export interface ShowdownResolution {
  claimWasValid: boolean;
  loserPlayerId: string;
  loserHandSize: number;
  loserEliminated: boolean;
  updatedPlayers: PenaltyPlayerState[];
  deckDraws: Card[];
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

function getStraightRanks(lowRank: StraightClaim['lowRank']): number[] {
  if (lowRank === 1) {
    return [14, 2, 3, 4, 5];
  }

  return [lowRank, lowRank + 1, lowRank + 2, lowRank + 3, lowRank + 4];
}

function takeAvailableJokers(cards: Card[]) {
  return sortCardsDescending(cards.filter(isJokerCard));
}

function takeEligibleSuitJokers(cards: Card[], suit: Suit) {
  return sortCardsDescending(
    cards.filter(
      (card) => isJokerCard(card) && canJokerRepresentSuit(card, suit),
    ),
  );
}

function takeCardsOfRank(cards: Card[], rank: number, count: number): Card[] {
  return sortCardsDescending(
    cards.filter((card) => isStandardCard(card) && card.rank === rank),
  ).slice(0, count);
}

function sortStandardCardsDescending(cards: StandardCard[]): StandardCard[] {
  return sortCardsDescending(cards) as StandardCard[];
}

function toSlotCards(
  cards: Card[],
  requiredCount: number,
): Array<Card | undefined> {
  return Array.from({ length: requiredCount }, (_, index) => cards[index]);
}

function fillRankSlots(
  cards: Card[],
  rank: number,
  requiredCount: number,
): ClaimConstruction {
  const naturalCards = takeCardsOfRank(cards, rank, requiredCount);
  const jokerCount = Math.max(0, requiredCount - naturalCards.length);
  const jokers = takeAvailableJokers(cards).slice(0, jokerCount);
  const selectedCards = [...naturalCards, ...jokers];

  return {
    cards: selectedCards,
    slotCards: toSlotCards(selectedCards, requiredCount),
    requiredCount,
    isComplete: selectedCards.length === requiredCount,
  };
}

function fillGroupedSlots(
  cards: Card[],
  groups: Array<{ rank: number; requiredCount: number }>,
): ClaimConstruction {
  let availableJokers = takeAvailableJokers(cards);
  const slotCards: Array<Card | undefined> = [];

  for (const group of groups) {
    const naturalCards = takeCardsOfRank(
      cards,
      group.rank,
      group.requiredCount,
    );
    const jokerCount = Math.max(0, group.requiredCount - naturalCards.length);
    const jokers = availableJokers.slice(0, jokerCount);
    availableJokers = availableJokers.slice(jokers.length);
    const groupCards = [...naturalCards, ...jokers];

    slotCards.push(...toSlotCards(groupCards, group.requiredCount));
  }

  const selectedCards = slotCards.filter((card): card is Card => Boolean(card));

  return {
    cards: selectedCards,
    slotCards,
    requiredCount: groups.reduce(
      (total, group) => total + group.requiredCount,
      0,
    ),
    isComplete: slotCards.every(Boolean),
  };
}

function fillStraightSlots(cards: Card[], lowRank: StraightClaim['lowRank']) {
  const sortedCards = sortStandardCardsDescending(cards.filter(isStandardCard));
  let availableJokers = takeAvailableJokers(cards);
  const slotCards = getStraightRanks(lowRank).map((rank) => {
    const matchingCard = sortedCards.find((card) => card.rank === rank);

    if (matchingCard) {
      return matchingCard;
    }

    const joker = availableJokers[0];

    if (!joker) {
      return undefined;
    }

    availableJokers = availableJokers.slice(1);
    return joker;
  });
  const selectedCards = slotCards.filter((card): card is Card => Boolean(card));

  return {
    cards: selectedCards,
    slotCards,
    requiredCount: 5,
    isComplete: selectedCards.length === 5,
  };
}

function fillFlushSlots(cards: Card[], suit: Suit) {
  const suitedCards = sortStandardCardsDescending(
    cards.filter(
      (card): card is StandardCard =>
        isStandardCard(card) && card.suit === suit,
    ),
  ).slice(0, 5);
  const eligibleJokers = takeEligibleSuitJokers(cards, suit).slice(
    0,
    Math.max(0, 5 - suitedCards.length),
  );
  const selectedCards = [...suitedCards, ...eligibleJokers].slice(0, 5);

  return {
    cards: selectedCards,
    slotCards: toSlotCards(selectedCards, 5),
    requiredCount: 5,
    isComplete: selectedCards.length === 5,
  };
}

function fillSuitPlusRankFlushSlots(cards: Card[], suit: Suit, rank: number) {
  const suitedCards = sortStandardCardsDescending(
    cards.filter(
      (card): card is StandardCard =>
        isStandardCard(card) && card.suit === suit,
    ),
  );
  const namedCard = suitedCards.find((card) => card.rank === rank);
  const fillerNaturals = suitedCards
    .filter((card) => card !== namedCard)
    .slice(0, 4);
  const eligibleJokers = takeEligibleSuitJokers(cards, suit);

  let namedSlotCard: Card | undefined = namedCard;
  let fillerJokers: Card[] = [];

  if (!namedSlotCard) {
    namedSlotCard = eligibleJokers[0];
  } else if (fillerNaturals.length < 4 && eligibleJokers[0]) {
    fillerJokers = [eligibleJokers[0]];
  }

  const fillerCards = [...fillerNaturals, ...fillerJokers].slice(0, 4);
  const slotCards = [...toSlotCards(fillerCards, 4), namedSlotCard];
  const selectedCards = slotCards.filter((card): card is Card => Boolean(card));

  return {
    cards: selectedCards,
    slotCards,
    requiredCount: 5,
    isComplete: slotCards.slice(0, 4).every(Boolean) && Boolean(slotCards[4]),
  };
}

function fillStraightFlushSlots(
  cards: Card[],
  lowRank: StraightClaim['lowRank'],
  suit: Suit,
) {
  const suitedCards = sortStandardCardsDescending(
    cards.filter(
      (card): card is StandardCard =>
        isStandardCard(card) && card.suit === suit,
    ),
  );
  let availableJokers = takeEligibleSuitJokers(cards, suit);
  const slotCards = getStraightRanks(lowRank).map((rank) => {
    const matchingCard = suitedCards.find((card) => card.rank === rank);

    if (matchingCard) {
      return matchingCard;
    }

    const joker = availableJokers[0];

    if (!joker) {
      return undefined;
    }

    availableJokers = availableJokers.slice(1);
    return joker;
  });
  const selectedCards = slotCards.filter((card): card is Card => Boolean(card));

  return {
    cards: selectedCards,
    slotCards,
    requiredCount: 5,
    isComplete: selectedCards.length === 5,
  };
}

export function buildClaimConstruction(
  cards: Card[],
  claim: Claim,
): ClaimConstruction {
  switch (claim.category) {
    case 'high-card':
      return fillRankSlots(cards, claim.rank, 1);
    case 'pair':
      return fillRankSlots(cards, claim.pairRank, 2);
    case 'two-pair':
      return fillGroupedSlots(cards, [
        { rank: claim.highPairRank, requiredCount: 2 },
        { rank: claim.lowPairRank, requiredCount: 2 },
      ]);
    case 'three-of-a-kind':
      return fillRankSlots(cards, claim.tripRank, 3);
    case 'straight':
      return fillStraightSlots(cards, claim.lowRank);
    case 'flush':
      return claim.rank === undefined
        ? fillFlushSlots(cards, claim.suit)
        : fillSuitPlusRankFlushSlots(cards, claim.suit, claim.rank);
    case 'full-house':
      return fillGroupedSlots(cards, [
        { rank: claim.tripRank, requiredCount: 3 },
        { rank: claim.pairRank, requiredCount: 2 },
      ]);
    case 'four-of-a-kind':
      return fillRankSlots(cards, claim.quadRank, 4);
    case 'straight-flush':
      return fillStraightFlushSlots(cards, claim.lowRank, claim.suit);
  }
}

export function getClaimProgressScore(cards: Card[], claim: Claim): number {
  return buildClaimConstruction(cards, claim).cards.length;
}

export function claimExists(cards: Card[], claim: Claim): boolean {
  return buildClaimConstruction(cards, claim).isComplete;
}

export function getShowdownDeckDraws(input: {
  claim: Claim;
  revealedCards: Card[];
  remainingDeck: Card[];
  showdownDrawRule?: ShowdownDrawRule;
}): Card[] {
  const showdownDrawRule = input.showdownDrawRule ?? DEFAULT_SHOWDOWN_DRAW_RULE;

  if (showdownDrawRule !== 'draw-until-miss') {
    return [];
  }

  const startingConstruction = buildClaimConstruction(
    input.revealedCards,
    input.claim,
  );

  if (startingConstruction.isComplete) {
    return [];
  }

  const deckDraws: Card[] = [];
  let effectiveCards = [...input.revealedCards];
  let currentScore = startingConstruction.cards.length;

  for (const card of input.remainingDeck) {
    const nextCards = [...effectiveCards, card];
    const nextScore = getClaimProgressScore(nextCards, input.claim);

    deckDraws.push(card);

    if (nextScore <= currentScore) {
      break;
    }

    effectiveCards = nextCards;
    currentScore = nextScore;

    if (claimExists(effectiveCards, input.claim)) {
      break;
    }
  }

  return deckDraws;
}

export function resolveShowdown(input: ShowdownInput): ShowdownResolution {
  const allCards = Object.values(input.handsByPlayerId).flat();
  const deckDraws = getShowdownDeckDraws({
    claim: input.claim,
    revealedCards: allCards,
    remainingDeck: input.remainingDeck ?? [],
    ...(input.showdownDrawRule === undefined
      ? {}
      : { showdownDrawRule: input.showdownDrawRule }),
  });
  const claimWasValid = claimExists([...allCards, ...deckDraws], input.claim);
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
    deckDraws,
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
    throw new Error('Unable to find the round loser in the player list.');
  }

  return {
    loserPlayerId: input.loserPlayerId,
    loserHandSize: loser.handSize,
    loserEliminated: loser.isEliminated,
    updatedPlayers,
  };
}
