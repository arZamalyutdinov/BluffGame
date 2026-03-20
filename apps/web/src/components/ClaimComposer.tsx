import { useEffect, useMemo, useState } from 'react';

import {
  type Card,
  type Claim,
  type ClaimCategory,
  type ClaimOrderPreset,
  type FlushRule,
  type Suit,
  claimToKey,
  getAllClaims,
  getClaimCategoryOrder,
  isClaimStrictlyHigher,
  sortCardsDescending,
} from '@bluff-game/shared';

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

interface BuilderStepConfig {
  id: string;
  title: string;
  helper: string;
  getValue: (claim: Claim) => string;
  getLabel: (claim: Claim) => string;
}

interface BuilderOption {
  value: string;
  label: string;
  previewClaim: Claim;
  count: number;
}

interface CategoryButtonProps {
  category: ClaimCategory;
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

interface BuilderStepInput {
  helpers: Pick<
    ReturnType<typeof useLocale>,
    'formatClaimCompactLabel' | 'formatRankLabel' | 'formatSuitChoiceLabel'
  >;
  labels: {
    highCard: string;
    pairRank: string;
    firstPair: string;
    secondPair: string;
    triplet: string;
    straight: string;
    flushSuit: string;
    namedCard: string;
    pair: string;
    quadRank: string;
    straightFlushSuit: string;
  };
  copy: {
    highCard: string;
    pair: string;
    firstPair: string;
    secondPair: string;
    trips: string;
    straight: string;
    flushSuitFirst: string;
    flushNamedCard: string;
    flushSuitOnly: string;
    fullHouseTrips: string;
    fullHousePair: string;
    quads: string;
    straightFlushSuit: string;
    straightFlushStraight: string;
  };
}

function getBuilderSteps(
  category: ClaimCategory,
  flushRule: FlushRule,
  input: BuilderStepInput,
): BuilderStepConfig[] {
  const { formatClaimCompactLabel, formatRankLabel, formatSuitChoiceLabel } =
    input.helpers;
  const { labels, copy } = input;

  switch (category) {
    case 'high-card':
      return [
        {
          id: 'rank',
          title: labels.highCard,
          helper: copy.highCard,
          getValue: (claim) => claimToKey(claim),
          getLabel: (claim) => formatClaimCompactLabel(claim),
        },
      ];
    case 'pair':
      return [
        {
          id: 'pairRank',
          title: labels.pairRank,
          helper: copy.pair,
          getValue: (claim) => claimToKey(claim),
          getLabel: (claim) => formatClaimCompactLabel(claim),
        },
      ];
    case 'two-pair':
      return [
        {
          id: 'highPairRank',
          title: labels.firstPair,
          helper: copy.firstPair,
          getValue: (claim) =>
            claim.category === 'two-pair' ? String(claim.highPairRank) : '',
          getLabel: (claim) =>
            claim.category === 'two-pair'
              ? formatRankLabel(claim.highPairRank)
              : formatClaimCompactLabel(claim),
        },
        {
          id: 'lowPairRank',
          title: labels.secondPair,
          helper: copy.secondPair,
          getValue: (claim) =>
            claim.category === 'two-pair' ? String(claim.lowPairRank) : '',
          getLabel: (claim) =>
            claim.category === 'two-pair'
              ? formatRankLabel(claim.lowPairRank)
              : formatClaimCompactLabel(claim),
        },
      ];
    case 'three-of-a-kind':
      return [
        {
          id: 'tripRank',
          title: labels.triplet,
          helper: copy.trips,
          getValue: (claim) => claimToKey(claim),
          getLabel: (claim) => formatClaimCompactLabel(claim),
        },
      ];
    case 'straight':
      return [
        {
          id: 'lowRank',
          title: labels.straight,
          helper: copy.straight,
          getValue: (claim) => claimToKey(claim),
          getLabel: (claim) => formatClaimCompactLabel(claim),
        },
      ];
    case 'flush':
      return flushRule === 'suit-plus-rank'
        ? [
            {
              id: 'suit',
              title: labels.flushSuit,
              helper: copy.flushSuitFirst,
              getValue: (claim) =>
                claim.category === 'flush' ? claim.suit : '',
              getLabel: (claim) =>
                claim.category === 'flush'
                  ? formatSuitChoiceLabel(claim.suit)
                  : formatClaimCompactLabel(claim),
            },
            {
              id: 'rank',
              title: labels.namedCard,
              helper: copy.flushNamedCard,
              getValue: (claim) =>
                claim.category === 'flush' && claim.rank !== undefined
                  ? String(claim.rank)
                  : '',
              getLabel: (claim) =>
                claim.category === 'flush' && claim.rank !== undefined
                  ? formatRankLabel(claim.rank)
                  : formatClaimCompactLabel(claim),
            },
          ]
        : [
            {
              id: 'suit',
              title: labels.flushSuit,
              helper: copy.flushSuitOnly,
              getValue: (claim) => claimToKey(claim),
              getLabel: (claim) => formatClaimCompactLabel(claim),
            },
          ];
    case 'full-house':
      return [
        {
          id: 'tripRank',
          title: labels.triplet,
          helper: copy.fullHouseTrips,
          getValue: (claim) =>
            claim.category === 'full-house' ? String(claim.tripRank) : '',
          getLabel: (claim) =>
            claim.category === 'full-house'
              ? formatRankLabel(claim.tripRank)
              : formatClaimCompactLabel(claim),
        },
        {
          id: 'pairRank',
          title: labels.pair,
          helper: copy.fullHousePair,
          getValue: (claim) =>
            claim.category === 'full-house' ? String(claim.pairRank) : '',
          getLabel: (claim) =>
            claim.category === 'full-house'
              ? formatRankLabel(claim.pairRank)
              : formatClaimCompactLabel(claim),
        },
      ];
    case 'four-of-a-kind':
      return [
        {
          id: 'quadRank',
          title: labels.quadRank,
          helper: copy.quads,
          getValue: (claim) => claimToKey(claim),
          getLabel: (claim) => formatClaimCompactLabel(claim),
        },
      ];
    case 'straight-flush':
      return [
        {
          id: 'suit',
          title: labels.straightFlushSuit,
          helper: copy.straightFlushSuit,
          getValue: (claim) =>
            claim.category === 'straight-flush' ? claim.suit : '',
          getLabel: (claim) =>
            claim.category === 'straight-flush'
              ? formatSuitChoiceLabel(claim.suit)
              : formatClaimCompactLabel(claim),
        },
        {
          id: 'lowRank',
          title: labels.straight,
          helper: copy.straightFlushStraight,
          getValue: (claim) =>
            claim.category === 'straight-flush' ? String(claim.lowRank) : '',
          getLabel: (claim) =>
            claim.category === 'straight-flush'
              ? formatClaimCompactLabel(claim)
              : formatClaimCompactLabel(claim),
        },
      ];
  }
}

function filterClaimsBySelections(
  claims: Claim[],
  steps: BuilderStepConfig[],
  selections: string[],
): Claim[] {
  return claims.filter((claim) =>
    selections.every(
      (selectedValue, index) => steps[index]?.getValue(claim) === selectedValue,
    ),
  );
}

function normalizeSelections(
  claims: Claim[],
  steps: BuilderStepConfig[],
  selections: string[],
): string[] {
  const nextSelections: string[] = [];

  for (const [index, selectedValue] of selections.entries()) {
    const claimsForStep = filterClaimsBySelections(
      claims,
      steps,
      nextSelections,
    );
    const step = steps[index];

    if (!step) {
      break;
    }

    const validValues = new Set(
      claimsForStep.map((claim) => step.getValue(claim)).filter(Boolean),
    );

    if (!validValues.has(selectedValue)) {
      break;
    }

    nextSelections.push(selectedValue);
  }

  return nextSelections;
}

function buildOptions(
  claims: Claim[],
  step: BuilderStepConfig,
): BuilderOption[] {
  const optionMap = new Map<string, BuilderOption>();

  for (const claim of claims) {
    const value = step.getValue(claim);

    if (!value) {
      continue;
    }

    const existing = optionMap.get(value);

    if (existing) {
      existing.count += 1;
      continue;
    }

    optionMap.set(value, {
      value,
      label: step.getLabel(claim),
      previewClaim: claim,
      count: 1,
    });
  }

  return [...optionMap.values()];
}

function getSelectionLabel(
  claims: Claim[],
  steps: BuilderStepConfig[],
  selections: string[],
  stepIndex: number,
): string {
  const step = steps[stepIndex];

  if (!step) {
    return selections[stepIndex] ?? '';
  }

  const claimsForStep = filterClaimsBySelections(
    claims,
    steps,
    selections.slice(0, stepIndex),
  );
  const matchingClaim = claimsForStep.find(
    (claim) => step.getValue(claim) === selections[stepIndex],
  );

  return matchingClaim
    ? step.getLabel(matchingClaim)
    : (selections[stepIndex] ?? '');
}

function CategoryButton({
  category,
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
    formatRankLabel,
    formatSuitChoiceLabel,
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
  const builderSteps = useMemo(
    () =>
      selectedCategory
        ? getBuilderSteps(selectedCategory, flushRule, {
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
          })
        : [],
    [
      catalog.claims.helpers,
      catalog.claims.stepTitles,
      flushRule,
      formatClaimCompactLabel,
      formatRankLabel,
      formatSuitChoiceLabel,
      selectedCategory,
    ],
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

      {!isBuilderOpen ? (
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
