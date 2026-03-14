import { type ReactNode, useEffect, useMemo, useState } from 'react';

import {
  ALL_CLAIMS,
  CLAIM_CATEGORIES,
  type Card,
  type Claim,
  type ClaimCategory,
  RANK_LABELS,
  SUIT_SYMBOLS,
  claimToKey,
  claimToLabel,
  compareClaims,
} from '@bluff-game/shared';

import { claimToIllustrationCards } from '../lib/claimVisuals.js';

interface ClaimComposerProps {
  lastClaim?: Claim;
  disabled?: boolean;
  onSubmit: (claimKey: string) => void;
}

type ClaimByCategory<C extends ClaimCategory> = Extract<Claim, { category: C }>;

const CATEGORY_LABELS: Record<ClaimCategory, string> = {
  'high-card': 'High card',
  pair: 'Pair',
  'two-pair': 'Two pair',
  'three-of-a-kind': 'Trips',
  straight: 'Straight',
  flush: 'Flush',
  'full-house': 'Full house',
  'four-of-a-kind': 'Quads',
  'straight-flush': 'Straight flush',
  'royal-flush': 'Royal flush',
};

function categoryClaimsFor<C extends ClaimCategory>(
  claims: Claim[],
  category: C,
): ClaimByCategory<C>[] {
  return claims.filter(
    (claim): claim is ClaimByCategory<C> => claim.category === category,
  );
}

function rankToken(rank: number): string {
  return RANK_LABELS[rank as keyof typeof RANK_LABELS];
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)];
}

interface OptionGridProps {
  label: string;
  children: ReactNode;
}

function OptionGrid({ label, children }: OptionGridProps) {
  return (
    <section className="claim-option-group">
      <p className="claim-option-label">{label}</p>
      <div className="claim-option-grid">{children}</div>
    </section>
  );
}

interface RankOptionButtonProps {
  rank: number;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}

function RankOptionButton({
  rank,
  active,
  disabled,
  onClick,
}: RankOptionButtonProps) {
  return (
    <button
      type="button"
      className={`claim-rank-button ${active ? 'is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      {rankToken(rank)}
    </button>
  );
}

interface ClaimCardStackProps {
  cards: Card[];
  compact?: boolean;
}

function ClaimCardStack({ cards, compact = false }: ClaimCardStackProps) {
  return (
    <div className={`claim-card-stack ${compact ? 'is-compact' : ''}`}>
      {cards.map((card) => (
        <div
          key={`${card.rank}-${card.suit}`}
          className={`claim-visual-card suit-${card.suit}`}
        >
          <span className="claim-visual-rank">{RANK_LABELS[card.rank]}</span>
          <span className="claim-visual-suit">{SUIT_SYMBOLS[card.suit]}</span>
        </div>
      ))}
    </div>
  );
}

interface ClaimVisualPanelProps {
  label: string;
  claim?: Claim | undefined;
  emptyTitle: string;
  emptyText: string;
}

function ClaimVisualPanel({
  label,
  claim,
  emptyTitle,
  emptyText,
}: ClaimVisualPanelProps) {
  return (
    <section className="claim-visual-panel">
      <p className="claim-panel-label">{label}</p>

      {claim ? (
        <>
          <ClaimCardStack cards={claimToIllustrationCards(claim)} />
          <strong className="claim-panel-title">{claimToLabel(claim)}</strong>
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

interface CategoryButtonProps {
  category: ClaimCategory;
  active: boolean;
  disabled: boolean;
  previewClaim?: Claim | undefined;
  onClick: () => void;
}

function CategoryButton({
  category,
  active,
  disabled,
  previewClaim,
  onClick,
}: CategoryButtonProps) {
  return (
    <button
      type="button"
      className={`claim-category-button ${active ? 'is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      {previewClaim ? (
        <ClaimCardStack
          cards={claimToIllustrationCards(previewClaim)}
          compact
        />
      ) : (
        <div className="claim-category-empty">-</div>
      )}
      <span className="claim-category-label">{CATEGORY_LABELS[category]}</span>
    </button>
  );
}

export function ClaimComposer({
  lastClaim,
  disabled = false,
  onSubmit,
}: ClaimComposerProps) {
  const availableClaims = useMemo(
    () =>
      ALL_CLAIMS.filter(
        (claim) => !lastClaim || compareClaims(claim, lastClaim) > 0,
      ),
    [lastClaim],
  );
  const availableClaimsByCategory = useMemo(() => {
    const groups = new Map<ClaimCategory, Claim[]>();

    for (const category of CLAIM_CATEGORIES) {
      groups.set(category, []);
    }

    for (const claim of availableClaims) {
      groups.get(claim.category)?.push(claim);
    }

    return groups;
  }, [availableClaims]);
  const [selectedCategory, setSelectedCategory] =
    useState<ClaimCategory>('high-card');
  const [selectedClaimKey, setSelectedClaimKey] = useState('');

  useEffect(() => {
    const firstAvailableCategory = CLAIM_CATEGORIES.find(
      (category) => (availableClaimsByCategory.get(category)?.length ?? 0) > 0,
    );

    if (!firstAvailableCategory) {
      setSelectedClaimKey('');
      return;
    }

    const nextCategory =
      (availableClaimsByCategory.get(selectedCategory)?.length ?? 0) > 0
        ? selectedCategory
        : firstAvailableCategory;
    const categoryClaims = availableClaimsByCategory.get(nextCategory) ?? [];
    const hasSelectedClaim = categoryClaims.some(
      (claim) => claimToKey(claim) === selectedClaimKey,
    );

    if (nextCategory !== selectedCategory) {
      setSelectedCategory(nextCategory);
    }

    if (!hasSelectedClaim) {
      const defaultClaim = categoryClaims[0];
      setSelectedClaimKey(defaultClaim ? claimToKey(defaultClaim) : '');
    }
  }, [availableClaimsByCategory, selectedCategory, selectedClaimKey]);

  const selectedCategoryClaims =
    availableClaimsByCategory.get(selectedCategory) ?? [];
  const selectedClaim =
    selectedCategoryClaims.find(
      (claim) => claimToKey(claim) === selectedClaimKey,
    ) ?? selectedCategoryClaims[0];
  const minimumClaim = availableClaims[0];

  if (availableClaims.length === 0) {
    return (
      <div className="composer-card muted-panel">
        No stronger claims remain. The next player must check.
      </div>
    );
  }

  return (
    <form
      className="composer-card claim-builder"
      onSubmit={(event) => {
        event.preventDefault();

        if (selectedClaimKey) {
          onSubmit(selectedClaimKey);
        }
      }}
    >
      <div className="claim-visual-row">
        <ClaimVisualPanel
          label="Claim to beat"
          claim={lastClaim}
          emptyTitle="Opening move"
          emptyText="No claim is on the table yet. You can open with any legal claim."
        />

        <ClaimVisualPanel
          label="Your claim"
          claim={selectedClaim}
          emptyTitle="Pick a claim"
          emptyText="Choose a category and shape the exact claim before submitting."
        />
      </div>

      <div className="claim-builder-header">
        <div>
          <p className="eyebrow composer-eyebrow">Category</p>
          <p className="claim-helper-text">
            Start with the hand type, then fine-tune the exact rank details.
          </p>
        </div>
      </div>

      <div className="claim-category-toolbar">
        {CLAIM_CATEGORIES.map((category) => {
          const categoryClaims = availableClaimsByCategory.get(category) ?? [];
          const previewClaim = categoryClaims[0];
          const isAvailable = categoryClaims.length > 0;
          const isActive = category === selectedCategory;

          return (
            <CategoryButton
              key={category}
              category={category}
              active={isActive}
              disabled={disabled || !isAvailable}
              previewClaim={previewClaim}
              onClick={() => setSelectedCategory(category)}
            />
          );
        })}
      </div>

      {selectedClaim ? (
        <div className="claim-builder-body">
          {renderClaimControls({
            category: selectedCategory,
            claims: selectedCategoryClaims,
            selectedClaim,
            disabled,
            onChange: (nextClaim) => setSelectedClaimKey(claimToKey(nextClaim)),
          })}
        </div>
      ) : null}

      <div className="claim-builder-footer">
        {minimumClaim ? (
          <div className="claim-minimum-note">
            Lowest legal raise: <strong>{claimToLabel(minimumClaim)}</strong>
          </div>
        ) : (
          <div className="claim-minimum-note">No raise options remain.</div>
        )}

        <button
          type="submit"
          className="primary-button"
          disabled={disabled || !selectedClaimKey}
        >
          Submit claim
        </button>
      </div>
    </form>
  );
}

interface RenderClaimControlsArgs {
  category: ClaimCategory;
  claims: Claim[];
  selectedClaim: Claim;
  disabled: boolean;
  onChange: (claim: Claim) => void;
}

function renderClaimControls({
  category,
  claims,
  selectedClaim,
  disabled,
  onChange,
}: RenderClaimControlsArgs) {
  switch (category) {
    case 'high-card': {
      const highCardClaims = categoryClaimsFor(claims, 'high-card');

      return (
        <OptionGrid label="Rank">
          {highCardClaims.map((claim) => (
            <RankOptionButton
              key={claimToKey(claim)}
              rank={claim.rank}
              active={
                selectedClaim.category === 'high-card' &&
                selectedClaim.rank === claim.rank
              }
              disabled={disabled}
              onClick={() => onChange(claim)}
            />
          ))}
        </OptionGrid>
      );
    }
    case 'pair': {
      const pairClaims = categoryClaimsFor(claims, 'pair');

      return (
        <OptionGrid label="Pair rank">
          {pairClaims.map((claim) => (
            <RankOptionButton
              key={claimToKey(claim)}
              rank={claim.pairRank}
              active={
                selectedClaim.category === 'pair' &&
                selectedClaim.pairRank === claim.pairRank
              }
              disabled={disabled}
              onClick={() => onChange(claim)}
            />
          ))}
        </OptionGrid>
      );
    }
    case 'two-pair': {
      const twoPairClaims = categoryClaimsFor(claims, 'two-pair');
      const selectedHighPair =
        selectedClaim.category === 'two-pair'
          ? selectedClaim.highPairRank
          : twoPairClaims[0]?.highPairRank;
      const highPairOptions = uniqueNumbers(
        twoPairClaims.map((claim) => claim.highPairRank),
      );
      const lowPairClaims = twoPairClaims.filter(
        (claim) => claim.highPairRank === selectedHighPair,
      );
      const selectedLowPair =
        selectedClaim.category === 'two-pair' &&
        selectedClaim.highPairRank === selectedHighPair
          ? selectedClaim.lowPairRank
          : lowPairClaims[0]?.lowPairRank;

      return (
        <>
          <OptionGrid label="High pair">
            {highPairOptions.map((rank) => (
              <RankOptionButton
                key={`two-pair-high-${rank}`}
                rank={rank}
                active={rank === selectedHighPair}
                disabled={disabled}
                onClick={() => {
                  const nextClaim = twoPairClaims.find(
                    (claim) => claim.highPairRank === rank,
                  );

                  if (nextClaim) {
                    onChange(nextClaim);
                  }
                }}
              />
            ))}
          </OptionGrid>

          <OptionGrid label="Low pair">
            {lowPairClaims.map((claim) => (
              <RankOptionButton
                key={claimToKey(claim)}
                rank={claim.lowPairRank}
                active={claim.lowPairRank === selectedLowPair}
                disabled={disabled}
                onClick={() => onChange(claim)}
              />
            ))}
          </OptionGrid>
        </>
      );
    }
    case 'three-of-a-kind': {
      const tripClaims = categoryClaimsFor(claims, 'three-of-a-kind');

      return (
        <OptionGrid label="Trip rank">
          {tripClaims.map((claim) => (
            <RankOptionButton
              key={claimToKey(claim)}
              rank={claim.tripRank}
              active={
                selectedClaim.category === 'three-of-a-kind' &&
                selectedClaim.tripRank === claim.tripRank
              }
              disabled={disabled}
              onClick={() => onChange(claim)}
            />
          ))}
        </OptionGrid>
      );
    }
    case 'straight': {
      const straightClaims = categoryClaimsFor(claims, 'straight');

      return (
        <OptionGrid label="High card">
          {straightClaims.map((claim) => (
            <RankOptionButton
              key={claimToKey(claim)}
              rank={claim.highRank}
              active={
                selectedClaim.category === 'straight' &&
                selectedClaim.highRank === claim.highRank
              }
              disabled={disabled}
              onClick={() => onChange(claim)}
            />
          ))}
        </OptionGrid>
      );
    }
    case 'flush': {
      const flushClaims = categoryClaimsFor(claims, 'flush');

      return (
        <OptionGrid label="High card">
          {flushClaims.map((claim) => (
            <RankOptionButton
              key={claimToKey(claim)}
              rank={claim.highRank}
              active={
                selectedClaim.category === 'flush' &&
                selectedClaim.highRank === claim.highRank
              }
              disabled={disabled}
              onClick={() => onChange(claim)}
            />
          ))}
        </OptionGrid>
      );
    }
    case 'full-house': {
      const fullHouseClaims = categoryClaimsFor(claims, 'full-house');
      const selectedTrip =
        selectedClaim.category === 'full-house'
          ? selectedClaim.tripRank
          : fullHouseClaims[0]?.tripRank;
      const tripOptions = uniqueNumbers(
        fullHouseClaims.map((claim) => claim.tripRank),
      );
      const pairClaims = fullHouseClaims.filter(
        (claim) => claim.tripRank === selectedTrip,
      );
      const selectedPair =
        selectedClaim.category === 'full-house' &&
        selectedClaim.tripRank === selectedTrip
          ? selectedClaim.pairRank
          : pairClaims[0]?.pairRank;

      return (
        <>
          <OptionGrid label="Trips">
            {tripOptions.map((rank) => (
              <RankOptionButton
                key={`full-house-trip-${rank}`}
                rank={rank}
                active={rank === selectedTrip}
                disabled={disabled}
                onClick={() => {
                  const nextClaim = fullHouseClaims.find(
                    (claim) => claim.tripRank === rank,
                  );

                  if (nextClaim) {
                    onChange(nextClaim);
                  }
                }}
              />
            ))}
          </OptionGrid>

          <OptionGrid label="Pair">
            {pairClaims.map((claim) => (
              <RankOptionButton
                key={claimToKey(claim)}
                rank={claim.pairRank}
                active={claim.pairRank === selectedPair}
                disabled={disabled}
                onClick={() => onChange(claim)}
              />
            ))}
          </OptionGrid>
        </>
      );
    }
    case 'four-of-a-kind': {
      const quadClaims = categoryClaimsFor(claims, 'four-of-a-kind');

      return (
        <OptionGrid label="Quad rank">
          {quadClaims.map((claim) => (
            <RankOptionButton
              key={claimToKey(claim)}
              rank={claim.quadRank}
              active={
                selectedClaim.category === 'four-of-a-kind' &&
                selectedClaim.quadRank === claim.quadRank
              }
              disabled={disabled}
              onClick={() => onChange(claim)}
            />
          ))}
        </OptionGrid>
      );
    }
    case 'straight-flush': {
      const straightFlushClaims = categoryClaimsFor(claims, 'straight-flush');

      return (
        <OptionGrid label="High card">
          {straightFlushClaims.map((claim) => (
            <RankOptionButton
              key={claimToKey(claim)}
              rank={claim.highRank}
              active={
                selectedClaim.category === 'straight-flush' &&
                selectedClaim.highRank === claim.highRank
              }
              disabled={disabled}
              onClick={() => onChange(claim)}
            />
          ))}
        </OptionGrid>
      );
    }
    case 'royal-flush':
      return (
        <div className="claim-locked-state">
          <ClaimCardStack cards={claimToIllustrationCards(selectedClaim)} />
          <div>
            <strong>Royal flush</strong>
            <p className="claim-helper-text">
              No extra selection needed. This is the strongest possible claim.
            </p>
          </div>
        </div>
      );
  }
}
