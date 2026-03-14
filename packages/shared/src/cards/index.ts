export const SUITS = ['diamonds', 'clubs', 'hearts', 'spades'] as const;

export type Suit = (typeof SUITS)[number];

export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

export type Rank = (typeof RANKS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

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

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
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

export function sortCardsDescending(cards: Card[]): Card[] {
  return [...cards].sort((left, right) => {
    if (left.rank !== right.rank) {
      return right.rank - left.rank;
    }

    return SUITS.indexOf(right.suit) - SUITS.indexOf(left.suit);
  });
}

export function cardToShortLabel(card: Card): string {
  return `${RANK_LABELS[card.rank]}${SUIT_SYMBOLS[card.suit]}`;
}

export function dealCards(
  deck: Card[],
  requests: Array<{ playerId: string; count: number }>,
): Record<string, Card[]> {
  const hands: Record<string, Card[]> = {};
  let cursor = 0;

  for (const request of requests) {
    hands[request.playerId] = deck.slice(cursor, cursor + request.count);
    cursor += request.count;
  }

  return hands;
}
