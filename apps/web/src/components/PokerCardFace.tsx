import { type Card, isJokerCard } from '@bluff-game/shared';

import { useLocale } from '../lib/i18n/index.js';

interface PokerCardFaceProps {
  card: Card;
  className?: string;
}

export function PokerCardFace({ card, className }: PokerCardFaceProps) {
  const { getCardLabels } = useLocale();
  const toneClass = isJokerCard(card)
    ? `is-joker ${card.color === 'red' ? 'is-red-joker' : 'is-black-joker'}`
    : `suit-${card.suit}`;
  const { cornerRank, centerLabel, suitSymbol } = getCardLabels(card);

  return (
    <div className={`claim-visual-card ${toneClass} ${className ?? ''}`.trim()}>
      <div className="claim-visual-corners">
        <span className="claim-visual-rank">{cornerRank}</span>
        <span className="claim-visual-suit">{suitSymbol}</span>
      </div>
      <div className="claim-visual-center">
        <span className="claim-visual-center-suit">
          {isJokerCard(card) ? 'JOKER' : suitSymbol}
        </span>
        <span className="claim-visual-center-rank">{centerLabel}</span>
      </div>
      <div className="claim-visual-corners claim-visual-corners-bottom">
        <span className="claim-visual-rank">{cornerRank}</span>
        <span className="claim-visual-suit">{suitSymbol}</span>
      </div>
    </div>
  );
}
