import { type Claim, DEFAULT_ROOM_SETTINGS } from '@bluff-game/shared';
import { describe, expect, it } from 'vitest';

import {
  buildSelectionsForClaim,
  filterClaimsBySelections,
  getBuilderSteps,
} from './claimBuilder.js';
import { enCatalog } from './i18n/en.js';
import { formatClaimCompactLabelWithCatalog } from './i18n/index.js';

function buildStepInput() {
  return {
    helpers: {
      formatClaimCompactLabel: (claim: Claim) =>
        formatClaimCompactLabelWithCatalog(claim, enCatalog),
      formatRankLabel: (rank: keyof typeof enCatalog.cards.rankLabels) =>
        enCatalog.cards.rankLabels[rank],
      formatSuitChoiceLabel: (
        suit: keyof typeof enCatalog.cards.suitChoiceLabels,
      ) => enCatalog.cards.suitChoiceLabels[suit],
    },
    labels: {
      highCard: enCatalog.claims.stepTitles.rank,
      pairRank: enCatalog.claims.stepTitles.pairRank,
      firstPair: enCatalog.claims.stepTitles.highPairRank,
      secondPair: enCatalog.claims.stepTitles.lowPairRank,
      triplet: enCatalog.claims.stepTitles.tripRank,
      straight: enCatalog.claims.stepTitles.lowRank,
      flushSuit: enCatalog.claims.stepTitles.suit,
      namedCard: enCatalog.claims.stepTitles.flushRank,
      pair: enCatalog.claims.stepTitles.fullHousePairRank,
      quadRank: enCatalog.claims.stepTitles.quadRank,
      straightFlushSuit: enCatalog.claims.stepTitles.straightFlushSuit,
    },
    copy: enCatalog.claims.helpers,
  };
}

describe('claim builder helpers', () => {
  it('maps a search-selected claim back into the exact builder selections', () => {
    const claim: Claim = {
      category: 'flush',
      suit: 'hearts',
      rank: 12,
    };
    const steps = getBuilderSteps('flush', 'suit-plus-rank', buildStepInput());
    const selections = buildSelectionsForClaim(claim, steps);
    const matchingClaims = filterClaimsBySelections([claim], steps, selections);

    expect(selections).toEqual(['hearts', '12']);
    expect(matchingClaims).toEqual([claim]);
  });

  it('uses the shared single-step key for pair claims', () => {
    const claim: Claim = {
      category: 'pair',
      pairRank: 12,
    };
    const steps = getBuilderSteps(
      'pair',
      DEFAULT_ROOM_SETTINGS.flushRule,
      buildStepInput(),
    );

    expect(buildSelectionsForClaim(claim, steps)).toEqual(['pair:12']);
  });
});
