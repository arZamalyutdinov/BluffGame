import type { ReactNode } from 'react';

import { type Card, type Claim, cardToKey } from '@bluff-game/shared';

import { claimToIllustrationCards } from '../lib/claimVisuals.js';
import { useLocale } from '../lib/i18n/index.js';
import { PokerCardFace } from './PokerCardFace.js';

interface ClaimCardStackProps {
  cards: Card[];
  compact?: boolean;
}

export function ClaimCardStack({
  cards,
  compact = false,
}: ClaimCardStackProps) {
  return (
    <div className={`claim-card-stack ${compact ? 'is-compact' : ''}`}>
      {cards.map((card, index) => (
        <div
          key={`${cardToKey(card)}-${index}`}
          className="claim-visual-card-slot"
          style={{ zIndex: index + 1 }}
        >
          <PokerCardFace card={card} />
        </div>
      ))}
    </div>
  );
}

interface ClaimPreviewPanelProps {
  label: string;
  claim?: Claim | undefined;
  emptyTitle: string;
  emptyText: string;
  helperText?: string | undefined;
  className?: string | undefined;
  headerAction?: ReactNode;
  compactCards?: boolean | undefined;
}

export function ClaimPreviewPanel({
  label,
  claim,
  emptyTitle,
  emptyText,
  helperText,
  className,
  headerAction,
  compactCards = false,
}: ClaimPreviewPanelProps) {
  const { formatClaimCompactLabel } = useLocale();

  return (
    <section className={`claim-visual-panel ${className ?? ''}`.trim()}>
      <div className="claim-panel-header">
        <p className="claim-panel-label">{label}</p>
        {headerAction ? (
          <div className="claim-panel-header-action">{headerAction}</div>
        ) : null}
      </div>

      {claim ? (
        <>
          <div className="claim-panel-stack-area">
            <ClaimCardStack
              cards={claimToIllustrationCards(claim)}
              compact={compactCards}
            />
          </div>
          <strong className="claim-panel-title">
            {formatClaimCompactLabel(claim)}
          </strong>
          {helperText ? (
            <p className="claim-helper-text">{helperText}</p>
          ) : null}
        </>
      ) : (
        <div className="claim-panel-empty">
          <strong className="claim-panel-title">{emptyTitle}</strong>
          <p className="claim-helper-text">{emptyText}</p>
        </div>
      )}
    </section>
  );
}
