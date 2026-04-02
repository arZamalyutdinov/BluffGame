import Fuse from 'fuse.js';

import {
  type Claim,
  type ClaimCategory,
  type ClaimOrderPreset,
  type FlushRule,
  claimToKey,
  getAllClaims,
} from '@bluff-game/shared';

import type { LocaleCatalog } from './i18n/en.js';
import {
  formatClaimCompactLabelWithCatalog,
  formatClaimLabelWithCatalog,
} from './i18n/index.js';

export interface ClaimSearchDocument {
  claim: Claim;
  claimKey: string;
  category: ClaimCategory;
  compactLabel: string;
  fullLabel: string;
  categoryLabel: string;
  aliases: string;
  searchText: string;
}

interface ClaimSearchIndex {
  documents: ClaimSearchDocument[];
  fuse: Fuse<ClaimSearchDocument>;
}

const claimSearchCache = new Map<string, ClaimSearchIndex>();

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04ff]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildClaimAliases(claim: Claim, catalog: LocaleCatalog): string {
  const parts = [
    claimToKey(claim),
    catalog.claims.categoryLabels[claim.category],
    formatClaimCompactLabelWithCatalog(claim, catalog),
    formatClaimLabelWithCatalog(claim, catalog),
  ];

  return normalizeSearchText(parts.join(' '));
}

function buildClaimSearchDocuments(
  claimOrderPreset: ClaimOrderPreset,
  flushRule: FlushRule,
  catalog: LocaleCatalog,
): ClaimSearchDocument[] {
  return getAllClaims(claimOrderPreset, flushRule).map((claim) => ({
    claim,
    claimKey: claimToKey(claim),
    category: claim.category,
    compactLabel: formatClaimCompactLabelWithCatalog(claim, catalog),
    fullLabel: formatClaimLabelWithCatalog(claim, catalog),
    categoryLabel: catalog.claims.categoryLabels[claim.category],
    aliases: buildClaimAliases(claim, catalog),
    searchText: normalizeSearchText(
      [
        formatClaimCompactLabelWithCatalog(claim, catalog),
        formatClaimLabelWithCatalog(claim, catalog),
        catalog.claims.categoryLabels[claim.category],
        buildClaimAliases(claim, catalog),
      ].join(' '),
    ),
  }));
}

export function getClaimSearchDocuments(input: {
  claimOrderPreset: ClaimOrderPreset;
  flushRule: FlushRule;
  locale: string;
  catalog: LocaleCatalog;
}): ClaimSearchDocument[] {
  const cacheKey = [input.claimOrderPreset, input.flushRule, input.locale].join(
    ':',
  );
  const cached = claimSearchCache.get(cacheKey);

  if (cached) {
    return cached.documents;
  }

  const documents = buildClaimSearchDocuments(
    input.claimOrderPreset,
    input.flushRule,
    input.catalog,
  );
  const fuse = new Fuse(documents, {
    ignoreLocation: true,
    includeScore: true,
    threshold: 0.34,
    keys: [
      { name: 'compactLabel', weight: 0.45 },
      { name: 'fullLabel', weight: 0.3 },
      { name: 'aliases', weight: 0.18 },
      { name: 'categoryLabel', weight: 0.07 },
    ],
  });

  claimSearchCache.set(cacheKey, { documents, fuse });
  return documents;
}

function getClaimSearchIndex(input: {
  claimOrderPreset: ClaimOrderPreset;
  flushRule: FlushRule;
  locale: string;
  catalog: LocaleCatalog;
}): ClaimSearchIndex {
  const cacheKey = [input.claimOrderPreset, input.flushRule, input.locale].join(
    ':',
  );
  const cached = claimSearchCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  getClaimSearchDocuments(input);
  return claimSearchCache.get(cacheKey) as ClaimSearchIndex;
}

export function searchClaimDocuments(input: {
  query: string;
  claimOrderPreset: ClaimOrderPreset;
  flushRule: FlushRule;
  locale: string;
  catalog: LocaleCatalog;
  legalClaimKeys: Iterable<string>;
  limit?: number;
}): ClaimSearchDocument[] {
  const trimmedQuery = input.query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const index = getClaimSearchIndex(input);
  const legalClaimKeys = new Set(input.legalClaimKeys);
  const searchTokens = Array.from(
    new Set([trimmedQuery, normalizeSearchText(trimmedQuery)].filter(Boolean)),
  );
  const searchLimit = Math.max((input.limit ?? 12) * 4, 24);
  const queryTokens = normalizeSearchText(trimmedQuery)
    .split(' ')
    .filter(Boolean);
  const documentsByKey = new Map<
    string,
    { document: ClaimSearchDocument; score: number; coverage: number }
  >();

  for (const token of searchTokens) {
    for (const result of index.fuse.search(token, { limit: searchLimit })) {
      if (!legalClaimKeys.has(result.item.claimKey)) {
        continue;
      }

      const existing = documentsByKey.get(result.item.claimKey);
      const score = result.score ?? Number.POSITIVE_INFINITY;
      const coverage = queryTokens.reduce(
        (count, token) =>
          result.item.searchText.includes(token) ? count + 1 : count,
        0,
      );

      if (
        !existing ||
        coverage > existing.coverage ||
        (coverage === existing.coverage && score < existing.score)
      ) {
        documentsByKey.set(result.item.claimKey, {
          document: result.item,
          score,
          coverage,
        });
      }
    }
  }

  return [...documentsByKey.values()]
    .sort((left, right) => {
      if (left.coverage !== right.coverage) {
        return right.coverage - left.coverage;
      }

      if (left.score !== right.score) {
        return left.score - right.score;
      }

      return left.document.compactLabel.localeCompare(
        right.document.compactLabel,
      );
    })
    .slice(0, input.limit ?? 12)
    .map((entry) => entry.document);
}
