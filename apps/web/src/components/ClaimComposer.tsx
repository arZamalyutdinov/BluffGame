import { useEffect, useMemo, useState } from 'react';

import {
  type Claim,
  type ClaimCategory,
  type ClaimOrderPreset,
  claimToCompactLabel,
  claimToKey,
  compareClaims,
  getAllClaims,
  getClaimCategoryOrder,
} from '@bluff-game/shared';

import { claimToIllustrationCards } from '../lib/claimVisuals.js';
import { ClaimCardStack } from './ClaimPreview.js';
import { ArrowLeftIcon } from './Icons.js';

interface ClaimComposerProps {
  claimOrderPreset: ClaimOrderPreset;
  lastClaim?: Claim;
  disabled?: boolean;
  onSelectedClaimChange?: (claim?: Claim) => void;
  onSubmit: (claimKey: string) => void;
}

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

type ComposerStep = 'category' | 'claim';

interface CategoryButtonProps {
  category: ClaimCategory;
  disabled: boolean;
  previewClaim?: Claim | undefined;
  onClick: () => void;
}

function CategoryButton({
  category,
  disabled,
  previewClaim,
  onClick,
}: CategoryButtonProps) {
  return (
    <button
      type="button"
      className="claim-category-button"
      onClick={onClick}
      disabled={disabled}
    >
      {previewClaim ? (
        <ClaimCardStack
          cards={claimToIllustrationCards(previewClaim)}
          compact
        />
      ) : (
        <div className="claim-category-empty">-</div>
      )}
      <span className="claim-category-copy">
        <span className="claim-category-label">
          {CATEGORY_LABELS[category]}
        </span>
        <span className="claim-category-meta">Choose</span>
      </span>
    </button>
  );
}

interface ClaimChoiceButtonProps {
  claim: Claim;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}

function ClaimChoiceButton({
  claim,
  active,
  disabled,
  onClick,
}: ClaimChoiceButtonProps) {
  return (
    <button
      type="button"
      className={`claim-choice-button ${active ? 'is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      <ClaimCardStack cards={claimToIllustrationCards(claim)} compact />
      <span className="claim-choice-copy">
        <span className="claim-choice-label">{claimToCompactLabel(claim)}</span>
        <span className="claim-choice-meta">Select</span>
      </span>
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
  const firstAvailableCategory = useMemo(
    () =>
      categoryOrder.find(
        (category) =>
          (availableClaimsByCategory.get(category)?.length ?? 0) > 0,
      ) ?? null,
    [availableClaimsByCategory, categoryOrder],
  );
  const [composerStep, setComposerStep] = useState<ComposerStep>('category');
  const [selectedCategory, setSelectedCategory] =
    useState<ClaimCategory | null>(firstAvailableCategory);
  const [selectedClaimKey, setSelectedClaimKey] = useState('');

  useEffect(() => {
    if (!firstAvailableCategory) {
      setComposerStep('category');
      setSelectedCategory(null);
      setSelectedClaimKey('');
      return;
    }

    setSelectedCategory((current) => {
      if (
        current &&
        (availableClaimsByCategory.get(current)?.length ?? 0) > 0
      ) {
        return current;
      }

      return firstAvailableCategory;
    });
  }, [availableClaimsByCategory, firstAvailableCategory]);

  const selectedCategoryClaims = selectedCategory
    ? (availableClaimsByCategory.get(selectedCategory) ?? [])
    : [];

  useEffect(() => {
    if (composerStep !== 'claim' || selectedCategoryClaims.length === 0) {
      setSelectedClaimKey('');
      return;
    }

    setSelectedClaimKey((current) => {
      if (
        current &&
        selectedCategoryClaims.some((claim) => claimToKey(claim) === current)
      ) {
        return current;
      }

      const firstClaim = selectedCategoryClaims[0];

      return firstClaim ? claimToKey(firstClaim) : '';
    });
  }, [composerStep, selectedCategoryClaims]);

  const selectedClaim =
    composerStep === 'claim'
      ? (selectedCategoryClaims.find(
          (claim) => claimToKey(claim) === selectedClaimKey,
        ) ?? selectedCategoryClaims[0])
      : undefined;
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

  function handleSelectCategory(category: ClaimCategory) {
    const categoryClaims = availableClaimsByCategory.get(category) ?? [];
    const firstClaim = categoryClaims[0];

    if (!firstClaim) {
      return;
    }

    setSelectedCategory(category);
    setSelectedClaimKey(claimToKey(firstClaim));
    setComposerStep('claim');
  }

  function handleBackToCategories() {
    setComposerStep('category');
    setSelectedClaimKey('');
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
          {composerStep === 'category'
            ? 'Choose a combination type.'
            : `Choose the exact ${selectedCategory ? CATEGORY_LABELS[selectedCategory].toLowerCase() : 'claim'}.`}
        </p>
      </div>

      {composerStep === 'category' ? (
        <div className="claim-category-toolbar">
          {categoryOrder.map((category) => {
            const categoryClaims =
              availableClaimsByCategory.get(category) ?? [];
            const previewClaim = categoryClaims[0];

            return (
              <CategoryButton
                key={category}
                category={category}
                disabled={disabled || categoryClaims.length === 0}
                previewClaim={previewClaim}
                onClick={() => handleSelectCategory(category)}
              />
            );
          })}
        </div>
      ) : (
        <>
          <div className="claim-step-header">
            <div className="claim-step-main">
              <button
                type="button"
                className="ghost-button claim-step-back"
                onClick={handleBackToCategories}
                aria-label="Back to combination types"
              >
                <ArrowLeftIcon className="button-icon" />
              </button>

              <div className="claim-step-copy">
                <p className="claim-panel-label">Combination type</p>
                <h3 className="claim-step-title">
                  {selectedCategory
                    ? CATEGORY_LABELS[selectedCategory]
                    : 'Claim'}
                </h3>
              </div>
            </div>

            <button
              type="submit"
              className="primary-button claim-step-submit"
              disabled={disabled || !selectedClaimKey}
            >
              Submit claim
            </button>
          </div>

          <div className="claim-builder-body">
            <div className="claim-choice-grid">
              {selectedCategoryClaims.map((claim) => {
                const claimKey = claimToKey(claim);

                return (
                  <ClaimChoiceButton
                    key={claimKey}
                    claim={claim}
                    active={claimKey === selectedClaimKey}
                    disabled={disabled}
                    onClick={() => setSelectedClaimKey(claimKey)}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}

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
