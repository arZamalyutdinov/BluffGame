import { DEFAULT_JOKER_RULE, type JokerRule } from '../settings/index.js';

export const SUITS = ['diamonds', 'clubs', 'hearts', 'spades'] as const;

export type Suit = (typeof SUITS)[number];

export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

export type Rank = (typeof RANKS)[number];

export const JOKER_COLORS = ['red', 'black'] as const;

export type JokerColor = (typeof JOKER_COLORS)[number];

export interface StandardCard {
  kind: 'standard';
  rank: Rank;
  suit: Suit;
}

export interface JokerCard {
  kind: 'joker';
  color: JokerColor;
}

export type Card = StandardCard | JokerCard;

export const RANK_LABELS: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

export function createCard(rank: Rank, suit: Suit): StandardCard {
  return {
    kind: 'standard',
    rank,
    suit,
  };
}

export function createJoker(color: JokerColor): JokerCard {
  return {
    kind: 'joker',
    color,
  };
}

export function isStandardCard(card: Card): card is StandardCard {
  return card.kind === 'standard';
}

export function isJokerCard(card: Card): card is JokerCard {
  return card.kind === 'joker';
}

export function canJokerRepresentSuit(
  joker: JokerCard | JokerColor,
  suit: Suit,
): boolean {
  const color = typeof joker === 'string' ? joker : joker.color;

  return color === 'red'
    ? suit === 'diamonds' || suit === 'hearts'
    : suit === 'clubs' || suit === 'spades';
}

export function getCardTone(card: Card): JokerColor {
  if (isJokerCard(card)) {
    return card.color;
  }

  return card.suit === 'diamonds' || card.suit === 'hearts' ? 'red' : 'black';
}

export function getCardRankLabel(card: Card): string {
  if (isJokerCard(card)) {
    return card.color === 'red' ? 'RJ' : 'BJ';
  }

  return RANK_LABELS[card.rank];
}

export function getCardSuitSymbol(card: Card): string {
  if (isJokerCard(card)) {
    return '✦';
  }

  return SUIT_SYMBOLS[card.suit];
}

export function getCardCenterLabel(card: Card): string {
  if (isJokerCard(card)) {
    return 'JOKER';
  }

  return RANK_LABELS[card.rank];
}

export function createDeck(jokerRule: JokerRule = DEFAULT_JOKER_RULE): Card[] {
  const deck: Card[] = SUITS.flatMap((suit) =>
    RANKS.map((rank) => createCard(rank, suit)),
  );

  if (jokerRule === 'two-jokers') {
    deck.push(createJoker('red'), createJoker('black'));
  }

  return deck;
}

export function createDeckShoe(
  requiredCardCount: number,
  jokerRule: JokerRule = DEFAULT_JOKER_RULE,
): Card[] {
  const safeRequiredCardCount = Math.max(0, Math.floor(requiredCardCount));

  if (safeRequiredCardCount === 0) {
    return [];
  }

  const deckSize = createDeck(jokerRule).length;
  const deckCopies = Math.ceil(safeRequiredCardCount / deckSize);

  return Array.from({ length: deckCopies }, () => createDeck(jokerRule)).flat();
}

export function shuffleDeck(deck: Card[], random = Math.random): Card[] {
  const next = [...deck];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = next[index];
    const swapValue = next[swapIndex];

    if (!current || !swapValue) {
      throw new Error('Shuffle attempted to swap an out-of-range card.');
    }

    next[index] = swapValue;
    next[swapIndex] = current;
  }

  return next;
}

function getCardSortStrength(card: Card): number {
  if (isJokerCard(card)) {
    return card.color === 'red' ? 1_200 : 1_100;
  }

  return card.rank * 10 + SUITS.indexOf(card.suit);
}

export function sortCardsDescending(cards: Card[]): Card[] {
  return [...cards].sort(
    (left, right) => getCardSortStrength(right) - getCardSortStrength(left),
  );
}

export function cardToKey(card: Card): string {
  if (isJokerCard(card)) {
    return `joker:${card.color}`;
  }

  return `standard:${card.rank}:${card.suit}`;
}

export function cardToShortLabel(card: Card): string {
  if (isJokerCard(card)) {
    return getCardRankLabel(card);
  }

  return `${RANK_LABELS[card.rank]}${SUIT_SYMBOLS[card.suit]}`;
}

export function dealCards(
  deck: Card[],
  requests: Array<{ playerId: string; count: number }>,
): Record<string, Card[]> {
  const hands: Record<string, Card[]> = {};
  let cursor = 0;

  for (const request of requests) {
    const nextHand = deck.slice(cursor, cursor + request.count);

    if (nextHand.length !== request.count) {
      throw new Error('Not enough cards to satisfy deal requests.');
    }

    hands[request.playerId] = nextHand;
    cursor += request.count;
  }

  return hands;
}
