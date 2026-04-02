import {
  DEFAULT_ROOM_SETTINGS,
  isClaimStrictlyHigher,
} from '@bluff-game/shared';
import { describe, expect, it } from 'vitest';

import { searchClaimDocuments } from './claimSearch.js';
import { enCatalog } from './i18n/en.js';
import { ruCatalog } from './i18n/ru.js';

describe('claim search', () => {
  it('ranks compact English claim text highly for fuzzy search', () => {
    const results = searchClaimDocuments({
      query: 'pair qs',
      claimOrderPreset: DEFAULT_ROOM_SETTINGS.claimOrderPreset,
      flushRule: DEFAULT_ROOM_SETTINGS.flushRule,
      locale: 'en',
      catalog: enCatalog,
      legalClaimKeys: ['pair:12', 'pair:13', 'pair:14'],
    });

    expect(results[0]?.claimKey).toBe('pair:12');
    expect(results[0]?.compactLabel).toBe('pair of Qs');
  });

  it('matches Russian localized labels', () => {
    const results = searchClaimDocuments({
      query: 'флеш червы',
      claimOrderPreset: DEFAULT_ROOM_SETTINGS.claimOrderPreset,
      flushRule: DEFAULT_ROOM_SETTINGS.flushRule,
      locale: 'ru',
      catalog: ruCatalog,
      legalClaimKeys: ['flush:hearts', 'flush:spades'],
    });

    expect(results[0]?.claimKey).toBe('flush:hearts');
    expect(results[0]?.compactLabel).toContain('♥');
  });

  it('filters out claims that are no longer legal to raise into', () => {
    const lastClaim = {
      category: 'pair' as const,
      pairRank: 12 as const,
    };
    const legalClaimKeys = ['pair:13', 'pair:14', 'two-pair:13:12'];
    const results = searchClaimDocuments({
      query: 'pair',
      claimOrderPreset: DEFAULT_ROOM_SETTINGS.claimOrderPreset,
      flushRule: DEFAULT_ROOM_SETTINGS.flushRule,
      locale: 'en',
      catalog: enCatalog,
      legalClaimKeys,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((result) => legalClaimKeys.includes(result.claimKey)),
    ).toBe(true);
    expect(
      results.every((result) =>
        isClaimStrictlyHigher(
          result.claim,
          lastClaim,
          DEFAULT_ROOM_SETTINGS.claimOrderPreset,
          DEFAULT_ROOM_SETTINGS.flushRule,
        ),
      ),
    ).toBe(true);
  });
});
