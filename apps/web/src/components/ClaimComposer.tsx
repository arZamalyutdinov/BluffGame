import { type ReactNode, useEffect, useMemo, useState } from 'react';

import {
  type Claim,
  type ClaimCategory,
  type ClaimOrderPreset,
  RANK_LABELS,
  STRAIGHT_LOW_RANK_LABELS,
  SUIT_SYMBOLS,
  claimToCompactLabel,
  claimToKey,
  compareClaims,
  getAllClaims,
  getClaimCategoryOrder,
} from '@bluff-game/shared';

import { claimToIllustrationCards } from '../lib/claimVisuals.js';
import { ClaimCardStack } from './ClaimPreview.js';

interface ClaimComposerProps {
  claimOrderPreset: ClaimOrderPreset;
  lastClaim?: Claim;
  disabled?: boolean;
  onSelectedClaimChange?: (claim?: Claim) => void;
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

function suitLabel(suit: string): string {
  return `${suit[0]?.toUpperCase() ?? ''}${suit.slice(1)}`;
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
  label?: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}

function RankOptionButton({
  rank,
  label,
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
      {label ?? rankToken(rank)}
    </button>
  );
}

interface SuitOptionButtonProps {
  suit: 'diamonds' | 'clubs' | 'hearts' | 'spades';
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}

function SuitOptionButton({
  suit,
  active,
  disabled,
  onClick,
}: SuitOptionButtonProps) {
  return (
    <button
      type="button"
      className={`claim-suit-button suit-${suit} ${active ? 'is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      <span className="claim-suit-symbol">{SUIT_SYMBOLS[suit]}</span>
      <span className="claim-suit-label">{suitLabel(suit)}</span>
    </button>
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
  claimOrderPreset,
  lastClaim,
  disabled = false,
  onSelectedClaimChange,
  onSubmit,
}: ClaimComposerProps) {
  const categoryOrder = useMemo(
    () => getClaimCategoryOrder(claimOrderPreset),
    [claimOrderPreset],
  );
  const availableClaims = useMemo(
    () =>
      getAllClaims(claimOrderPreset).filter(
        (claim) =>
          !lastClaim || compareClaims(claim, lastClaim, claimOrderPreset) > 0,
      ),
    [claimOrderPreset, lastClaim],
  );
  const availableClaimsByCategory = useMemo(() => {
    const groups = new Map<ClaimCategory, Claim[]>();

    for (const category of categoryOrder) {
      groups.set(category, []);
    }

    for (const claim of availableClaims) {
      groups.get(claim.category)?.push(claim);
    }

    return groups;
  }, [availableClaims, categoryOrder]);
  const [selectedCategory, setSelectedCategory] = useState<ClaimCategory>(
    categoryOrder[0] ?? 'high-card',
  );
  const [selectedClaimKey, setSelectedClaimKey] = useState('');

  useEffect(() => {
    const firstAvailableCategory = categoryOrder.find(
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
  }, [
    availableClaimsByCategory,
    categoryOrder,
    selectedCategory,
    selectedClaimKey,
  ]);

  const selectedCategoryClaims =
    availableClaimsByCategory.get(selectedCategory) ?? [];
  const selectedClaim =
    selectedCategoryClaims.find(
      (claim) => claimToKey(claim) === selectedClaimKey,
    ) ?? selectedCategoryClaims[0];
  const minimumClaim = availableClaims[0];

  useEffect(() => {
    onSelectedClaimChange?.(selectedClaim);
  }, [onSelectedClaimChange, selectedClaim]);

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
      <div className="claim-builder-intro">
        <p className="eyebrow composer-eyebrow">Build your claim</p>
        <p className="claim-helper-text">
          Choose the hand category first, then set the exact rank or suit.
        </p>
      </div>

      <div className="claim-category-toolbar">
        {categoryOrder.map((category) => {
          const categoryClaims = availableClaimsByCategory.get(category) ?? [];
          const previewClaim = categoryClaims[0];
          const isAvailable = categoryClaims.length > 0;
          const isActive = category === selectedCategory;

          return (
            <div
              key={category}
              className={`claim-category-item ${isActive ? 'is-active' : ''}`}
            >
              <CategoryButton
                category={category}
                active={isActive}
                disabled={disabled || !isAvailable}
                previewClaim={previewClaim}
                onClick={() => setSelectedCategory(category)}
              />

              {isActive && selectedClaim ? (
                <div className="claim-category-inline-controls">
                  {renderClaimControls({
                    category: selectedCategory,
                    claims: selectedCategoryClaims,
                    selectedClaim,
                    disabled,
                    onChange: (nextClaim) =>
                      setSelectedClaimKey(claimToKey(nextClaim)),
                  })}

                  <button
                    type="submit"
                    className="primary-button claim-inline-submit"
                    disabled={disabled || !selectedClaimKey}
                  >
                    Submit claim
                  </button>
                </div>
              ) : null}
            </div>
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
            Lowest legal raise:{' '}
            <strong>{claimToCompactLabel(minimumClaim)}</strong>
          </div>
        ) : (
          <div className="claim-minimum-note">No raise options remain.</div>
        )}

        <button
          type="submit"
          className="primary-button claim-footer-submit"
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
                  const nextClaim =
                    twoPairClaims.find(
                      (claim) =>
                        claim.highPairRank === rank &&
                        claim.lowPairRank === selectedLowPair,
                    ) ??
                    twoPairClaims.find((claim) => claim.highPairRank === rank);

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
        <OptionGrid label="Low card">
          {straightClaims.map((claim) => (
            <RankOptionButton
              key={claimToKey(claim)}
              rank={claim.lowRank}
              label={STRAIGHT_LOW_RANK_LABELS[claim.lowRank]}
              active={
                selectedClaim.category === 'straight' &&
                selectedClaim.lowRank === claim.lowRank
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
        <OptionGrid label="Suit">
          {flushClaims.map((claim) => (
            <SuitOptionButton
              key={claimToKey(claim)}
              suit={claim.suit}
              active={
                selectedClaim.category === 'flush' &&
                selectedClaim.suit === claim.suit
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
                  const nextClaim =
                    fullHouseClaims.find(
                      (claim) =>
                        claim.tripRank === rank &&
                        claim.pairRank === selectedPair,
                    ) ??
                    fullHouseClaims.find((claim) => claim.tripRank === rank);

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
      const selectedLowRank =
        selectedClaim.category === 'straight-flush'
          ? selectedClaim.lowRank
          : straightFlushClaims[0]?.lowRank;
      const lowRankOptions = uniqueNumbers(
        straightFlushClaims.map((claim) => claim.lowRank),
      );
      const suitClaims = straightFlushClaims.filter(
        (claim) => claim.lowRank === selectedLowRank,
      );
      const selectedSuit =
        selectedClaim.category === 'straight-flush' &&
        selectedClaim.lowRank === selectedLowRank
          ? selectedClaim.suit
          : suitClaims[0]?.suit;

      return (
        <>
          <OptionGrid label="Low card">
            {lowRankOptions.map((rank) => (
              <RankOptionButton
                key={`straight-flush-low-${rank}`}
                rank={rank}
                label={
                  STRAIGHT_LOW_RANK_LABELS[
                    rank as keyof typeof STRAIGHT_LOW_RANK_LABELS
                  ]
                }
                active={rank === selectedLowRank}
                disabled={disabled}
                onClick={() => {
                  const nextClaim =
                    straightFlushClaims.find(
                      (claim) =>
                        claim.lowRank === rank && claim.suit === selectedSuit,
                    ) ??
                    straightFlushClaims.find((claim) => claim.lowRank === rank);

                  if (nextClaim) {
                    onChange(nextClaim);
                  }
                }}
              />
            ))}
          </OptionGrid>

          <OptionGrid label="Suit">
            {suitClaims.map((claim) => (
              <SuitOptionButton
                key={claimToKey(claim)}
                suit={claim.suit}
                active={claim.suit === selectedSuit}
                disabled={disabled}
                onClick={() => onChange(claim)}
              />
            ))}
          </OptionGrid>
        </>
      );
    }
  }
}
