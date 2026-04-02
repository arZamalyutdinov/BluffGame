import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import {
  type Card,
  type Claim,
  type ClaimCategory,
  type ClaimOrderPreset,
  type FlushRule,
  claimToKey,
  getAllClaims,
  getClaimCategoryOrder,
  isClaimStrictlyHigher,
  sortCardsDescending,
} from '@bluff-game/shared';

import {
  type BuilderOption,
  buildOptions,
  buildSelectionsForClaim,
  filterClaimsBySelections,
  getBuilderSteps,
  getSelectionLabel,
  normalizeSelections,
} from '../lib/claimBuilder.js';
import {
  type ClaimSearchDocument,
  searchClaimDocuments,
} from '../lib/claimSearch.js';
import {
  claimToBuilderIllustrationCards,
  claimToIllustrationCards,
} from '../lib/claimVisuals.js';
import { useLocale } from '../lib/i18n/index.js';
import { ClaimCardStack } from './ClaimPreview.js';
import { ArrowLeftIcon } from './Icons.js';

interface ClaimComposerProps {
  claimOrderPreset: ClaimOrderPreset;
  flushRule: FlushRule;
  yourHand: Card[];
  cardsInRound: number;
  lastClaim?: Claim;
  disabled?: boolean;
  onSelectedClaimChange?: (claim?: Claim) => void;
  onSubmit: (claimKey: string) => void;
}

interface CategoryButtonProps {
  disabled: boolean;
  previewClaim?: Claim | undefined;
  label: string;
  meta: string;
  onClick: () => void;
}

interface BuilderOptionButtonProps {
  option: BuilderOption;
  previewCards: Card[];
  active: boolean;
  disabled: boolean;
  isFinalStep: boolean;
  finalStepLabel: string;
  legalPathsLabel: (count: number) => string;
  onClick: () => void;
}

function CategoryButton({
  disabled,
  previewClaim,
  onClick,
  label,
  meta,
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
        <span className="claim-category-label">{label}</span>
        <span className="claim-category-meta">{meta}</span>
      </span>
    </button>
  );
}

function BuilderOptionButton({
  option,
  previewCards,
  active,
  disabled,
  isFinalStep,
  onClick,
  finalStepLabel,
  legalPathsLabel,
}: BuilderOptionButtonProps) {
  return (
    <button
      type="button"
      className={`claim-choice-button ${active ? 'is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      <ClaimCardStack cards={previewCards} compact />
      <span className="claim-choice-copy">
        <span className="claim-choice-label">{option.label}</span>
        <span className="claim-choice-meta">
          {isFinalStep ? finalStepLabel : legalPathsLabel(option.count)}
        </span>
      </span>
    </button>
  );
}

interface ClaimSearchResultButtonProps {
  result: ClaimSearchDocument;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}

function ClaimSearchResultButton({
  result,
  active,
  disabled,
  onClick,
}: ClaimSearchResultButtonProps) {
  return (
    <button
      type="button"
      className={`claim-choice-button claim-search-result-button ${
        active ? 'is-active' : ''
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      <ClaimCardStack cards={claimToIllustrationCards(result.claim)} compact />
      <span className="claim-choice-copy">
        <span className="claim-choice-label">{result.compactLabel}</span>
        <span className="claim-choice-meta">{result.categoryLabel}</span>
      </span>
    </button>
  );
}

export function ClaimComposer({
  claimOrderPreset,
  flushRule,
  yourHand,
  cardsInRound,
  lastClaim,
  disabled = false,
  onSelectedClaimChange,
  onSubmit,
}: ClaimComposerProps) {
  const {
    catalog,
    formatClaimCompactLabel,
    formatClaimLabel,
    formatRankLabel,
    formatSuitChoiceLabel,
    locale,
  } = useLocale();
  const categoryOrder = useMemo(
    () => getClaimCategoryOrder(claimOrderPreset),
    [claimOrderPreset],
  );
  const availableClaims = useMemo(
    () =>
      getAllClaims(claimOrderPreset, flushRule).filter(
        (claim) =>
          !lastClaim ||
          isClaimStrictlyHigher(claim, lastClaim, claimOrderPreset, flushRule),
      ),
    [claimOrderPreset, flushRule, lastClaim],
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
  const [selectedCategory, setSelectedCategory] =
    useState<ClaimCategory | null>(null);
  const [selectedStepValues, setSelectedStepValues] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    if (!firstAvailableCategory) {
      setSelectedCategory(null);
      setSelectedStepValues([]);
      return;
    }

    setSelectedCategory((current) => {
      if (
        current &&
        (availableClaimsByCategory.get(current)?.length ?? 0) > 0
      ) {
        return current;
      }

      return null;
    });
  }, [availableClaimsByCategory, firstAvailableCategory]);

  const selectedCategoryClaims = selectedCategory
    ? (availableClaimsByCategory.get(selectedCategory) ?? [])
    : [];
  const builderStepInput = useMemo(
    () => ({
      helpers: {
        formatClaimCompactLabel,
        formatRankLabel,
        formatSuitChoiceLabel,
      },
      labels: {
        highCard: catalog.claims.stepTitles.rank,
        pairRank: catalog.claims.stepTitles.pairRank,
        firstPair: catalog.claims.stepTitles.highPairRank,
        secondPair: catalog.claims.stepTitles.lowPairRank,
        triplet: catalog.claims.stepTitles.tripRank,
        straight: catalog.claims.stepTitles.lowRank,
        flushSuit: catalog.claims.stepTitles.suit,
        namedCard: catalog.claims.stepTitles.flushRank,
        pair: catalog.claims.stepTitles.fullHousePairRank,
        quadRank: catalog.claims.stepTitles.quadRank,
        straightFlushSuit: catalog.claims.stepTitles.straightFlushSuit,
      },
      copy: catalog.claims.helpers,
    }),
    [
      catalog.claims.helpers,
      catalog.claims.stepTitles,
      formatClaimCompactLabel,
      formatRankLabel,
      formatSuitChoiceLabel,
    ],
  );
  const builderSteps = useMemo(
    () =>
      selectedCategory
        ? getBuilderSteps(selectedCategory, flushRule, builderStepInput)
        : [],
    [builderStepInput, flushRule, selectedCategory],
  );

  useEffect(() => {
    setSelectedStepValues((current) =>
      normalizeSelections(selectedCategoryClaims, builderSteps, current),
    );
  }, [builderSteps, selectedCategoryClaims]);

  const activeStepIndex =
    builderSteps.length === 0
      ? 0
      : Math.min(selectedStepValues.length, builderSteps.length - 1);
  const activePrefixSelections = selectedStepValues.slice(0, activeStepIndex);
  const activeStep = builderSteps[activeStepIndex];
  const claimsForActiveStep = activeStep
    ? filterClaimsBySelections(
        selectedCategoryClaims,
        builderSteps,
        activePrefixSelections,
      )
    : [];
  const activeOptions = activeStep
    ? buildOptions(claimsForActiveStep, activeStep)
    : [];
  const activeOptionValue = selectedStepValues[activeStepIndex] ?? '';
  const selectedClaim =
    builderSteps.length > 0 && selectedStepValues.length === builderSteps.length
      ? filterClaimsBySelections(
          selectedCategoryClaims,
          builderSteps,
          selectedStepValues,
        )[0]
      : undefined;
  const isBuilderOpen = Boolean(selectedCategory && builderSteps.length > 0);
  const sortedHand = useMemo(() => sortCardsDescending(yourHand), [yourHand]);
  const searchResults = useMemo(
    () =>
      searchClaimDocuments({
        query: deferredSearchQuery,
        claimOrderPreset,
        flushRule,
        locale,
        catalog,
        legalClaimKeys: availableClaims.map((claim) => claimToKey(claim)),
      }),
    [
      availableClaims,
      catalog,
      claimOrderPreset,
      deferredSearchQuery,
      flushRule,
      locale,
    ],
  );
  const isSearchActive = searchQuery.trim().length > 0;
  const selectedClaimKey = selectedClaim ? claimToKey(selectedClaim) : null;

  useEffect(() => {
    onSelectedClaimChange?.(selectedClaim);
  }, [onSelectedClaimChange, selectedClaim]);

  if (availableClaims.length === 0) {
    return (
      <div className="composer-card muted-panel">
        {catalog.table.noStrongerClaimsRemain}
      </div>
    );
  }

  function handleSelectCategory(category: ClaimCategory) {
    const categoryClaims = availableClaimsByCategory.get(category) ?? [];

    if (categoryClaims.length === 0) {
      return;
    }

    setSelectedCategory(category);
    setSelectedStepValues([]);
  }

  function handleBack() {
    if (selectedStepValues.length > 0) {
      setSelectedStepValues((current) => current.slice(0, -1));
      return;
    }

    setSelectedCategory(null);
  }

  function handleSelectStepValue(value: string) {
    setSelectedStepValues((current) => {
      const nextValues = current.slice(0, activeStepIndex);
      nextValues[activeStepIndex] = value;
      return nextValues;
    });
  }

  function handleSelectSearchResult(result: ClaimSearchDocument) {
    const nextBuilderSteps = getBuilderSteps(
      result.claim.category,
      flushRule,
      builderStepInput,
    );

    setSelectedCategory(result.claim.category);
    setSelectedStepValues(
      buildSelectionsForClaim(result.claim, nextBuilderSteps),
    );
    setSearchQuery('');
  }

  return (
    <form
      className="composer-card claim-builder"
      onSubmit={(event) => {
        event.preventDefault();

        if (selectedClaim) {
          onSubmit(claimToKey(selectedClaim));
        }
      }}
    >
      <div className="claim-builder-context" aria-label="Claim builder context">
        <section className="claim-builder-context-panel">
          <p className="claim-panel-label">
            {catalog.table.yourHand(sortedHand.length).split(' · ')[0]}
          </p>
          <div className="claim-builder-context-hand">
            <ClaimCardStack cards={sortedHand} compact />
          </div>
          <p className="claim-builder-context-meta">
            {catalog.table.cardsReady(sortedHand.length)}
          </p>
        </section>

        <section className="claim-builder-context-panel claim-builder-context-total">
          <p className="claim-panel-label">{catalog.table.cardsInRound}</p>
          <strong className="claim-builder-context-value">
            {cardsInRound}
          </strong>
          <p className="claim-builder-context-meta">
            {catalog.table.totalLiveCards}
          </p>
        </section>
      </div>

      <div className="claim-search-panel">
        <div className="claim-search-header">
          <label className="claim-panel-label" htmlFor="claim-builder-search">
            {catalog.table.claimSearchLabel}
          </label>

          {searchQuery.trim() ? (
            <button
              type="button"
              className="ghost-button claim-search-clear"
              onClick={() => setSearchQuery('')}
            >
              {catalog.table.clearClaimSearch}
            </button>
          ) : null}
        </div>

        <input
          id="claim-builder-search"
          className="claim-search-input"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={catalog.table.claimSearchPlaceholder}
          autoComplete="off"
          spellCheck={false}
        />

        <p className="claim-helper-text claim-search-helper">
          {isSearchActive
            ? searchResults.length > 0
              ? catalog.table.claimSearchResults(searchResults.length)
              : catalog.table.claimSearchEmpty(searchQuery.trim())
            : catalog.table.claimSearchHint}
        </p>
      </div>

      {isSearchActive ? (
        <div className="claim-builder-body">
          {searchResults.length > 0 ? (
            <div className="claim-choice-grid claim-search-results">
              {searchResults.map((result) => (
                <ClaimSearchResultButton
                  key={result.claimKey}
                  result={result}
                  active={result.claimKey === selectedClaimKey}
                  disabled={disabled}
                  onClick={() => handleSelectSearchResult(result)}
                />
              ))}
            </div>
          ) : (
            <div className="claim-search-empty muted-panel">
              <p className="claim-panel-label">
                {catalog.table.claimSearchLabel}
              </p>
              <strong>{catalog.table.claimSearchNoMatches}</strong>
              <p className="claim-helper-text">
                {catalog.table.claimSearchEmpty(searchQuery.trim())}
              </p>
            </div>
          )}
        </div>
      ) : !isBuilderOpen ? (
        <div className="claim-category-toolbar">
          {categoryOrder.map((category) => {
            const categoryClaims =
              availableClaimsByCategory.get(category) ?? [];
            const previewClaim = categoryClaims[0];

            return (
              <CategoryButton
                key={category}
                disabled={disabled || categoryClaims.length === 0}
                previewClaim={previewClaim}
                label={catalog.claims.categoryLabels[category]}
                meta={catalog.claims.categoryButtonMeta}
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
                onClick={handleBack}
                aria-label={
                  selectedStepValues.length > 0
                    ? catalog.table.backToPreviousClaimPart
                    : catalog.table.backToCombinationTypes
                }
              >
                <ArrowLeftIcon className="button-icon" />
              </button>

              <div className="claim-step-copy">
                <p className="claim-panel-label">
                  {catalog.table.combinationType}
                </p>
                <h3 className="claim-step-title">
                  {selectedCategory
                    ? catalog.claims.categoryLabels[selectedCategory]
                    : catalog.table.claimFallback}
                </h3>
                {selectedClaim ? (
                  <p className="claim-helper-text">
                    {catalog.table.selectedClaim(
                      formatClaimLabel(selectedClaim),
                    )}
                  </p>
                ) : null}
                {builderSteps.length > 1 ? (
                  <div
                    className="claim-builder-trail"
                    aria-label={catalog.table.chosenParts}
                  >
                    {builderSteps.map((step, index) => (
                      <span
                        key={step.id}
                        className={`claim-builder-trail-chip ${
                          index === activeStepIndex ? 'is-active' : ''
                        } ${selectedStepValues[index] ? 'is-complete' : ''}`}
                      >
                        {selectedStepValues[index]
                          ? getSelectionLabel(
                              selectedCategoryClaims,
                              builderSteps,
                              selectedStepValues,
                              index,
                            )
                          : `${index + 1}. ${step.title}`}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="submit"
              className="primary-button claim-step-submit"
              disabled={disabled || !selectedClaim}
            >
              {catalog.text.submitClaim}
            </button>
          </div>

          <div className="claim-builder-body">
            {activeStep ? (
              <>
                <div className="claim-choice-grid">
                  {activeOptions.map((option) => (
                    <BuilderOptionButton
                      key={option.value}
                      option={option}
                      previewCards={claimToBuilderIllustrationCards(
                        option.previewClaim,
                        activeStepIndex === builderSteps.length - 1
                          ? undefined
                          : activeStep?.id,
                      )}
                      active={option.value === activeOptionValue}
                      disabled={disabled}
                      isFinalStep={activeStepIndex === builderSteps.length - 1}
                      finalStepLabel={catalog.claims.optionSelect}
                      legalPathsLabel={catalog.claims.legalPaths}
                      onClick={() => handleSelectStepValue(option.value)}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </>
      )}
    </form>
  );
}
