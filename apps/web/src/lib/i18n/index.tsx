import {
  type Card,
  type Claim,
  type Rank,
  SUIT_SYMBOLS,
  type Suit,
  appErrorCodeSchema,
  getDefaultAppErrorMessage,
  isJokerCard,
} from '@bluff-game/shared';
import {
  type ReactNode,
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react';

import { type LocaleCatalog, enCatalog } from './en.js';
import { enOrkishCatalog } from './enOrkish.js';
import { ruCatalog } from './ru.js';
import { ruCampCatalog } from './ruCamp.js';
import { ruFenyaCatalog } from './ruFenya.js';

export const SUPPORTED_LOCALES = [
  'en',
  'en-x-orkish',
  'ru',
  'ru-x-camp',
  'ru-x-fenya',
] as const;
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_STORAGE_KEY = 'bluffgame/locale';
const SUPPORTED_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);
const LOCALE_CATALOGS: Record<LocaleCode, LocaleCatalog> = {
  en: enCatalog,
  'en-x-orkish': enOrkishCatalog,
  ru: ruCatalog,
  'ru-x-camp': ruCampCatalog,
  'ru-x-fenya': ruFenyaCatalog,
};

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export function normalizeLocaleCode(
  value: string | null | undefined,
): LocaleCode {
  return findSupportedLocale(value) ?? 'en';
}

function findSupportedLocale(
  value: string | null | undefined,
): LocaleCode | null {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (SUPPORTED_LOCALE_SET.has(normalized)) {
    return normalized as LocaleCode;
  }

  const primaryLanguage = normalized.split('-')[0];

  if (primaryLanguage === 'ru') {
    return 'ru';
  }

  if (primaryLanguage === 'en') {
    return 'en';
  }

  return null;
}

export function detectBrowserLocale(
  input?: readonly string[] | string | null,
): LocaleCode {
  if (Array.isArray(input)) {
    for (const value of input) {
      const normalized = findSupportedLocale(value);

      if (normalized) {
        return normalized;
      }
    }

    return 'en';
  }

  return normalizeLocaleCode(typeof input === 'string' ? input : 'en');
}

export function getStoredLocale(): LocaleCode | null {
  const stored = getStorage()?.getItem(LOCALE_STORAGE_KEY);
  return stored ? normalizeLocaleCode(stored) : null;
}

export function saveStoredLocale(locale: LocaleCode) {
  getStorage()?.setItem(LOCALE_STORAGE_KEY, locale);
}

function getInitialLocale(initialLocale?: LocaleCode): LocaleCode {
  if (initialLocale) {
    return initialLocale;
  }

  const stored = getStoredLocale();

  if (stored) {
    return stored;
  }

  if (typeof window === 'undefined') {
    return 'en';
  }

  return detectBrowserLocale(
    window.navigator.languages ?? window.navigator.language,
  );
}

type TextKey = keyof LocaleCatalog['text'];

interface AppErrorInfo {
  code?: string | undefined;
  message?: string | undefined;
}

interface LocaleContextValue {
  locale: LocaleCode;
  catalog: LocaleCatalog;
  t: <Key extends TextKey>(key: Key) => LocaleCatalog['text'][Key];
  setLocale: (locale: LocaleCode) => void;
  formatRankLabel: (rank: Rank) => string;
  formatSuitChoiceLabel: (suit: Suit) => string;
  formatClaimLabel: (claim: Claim) => string;
  formatClaimCompactLabel: (claim: Claim) => string;
  formatError: (error: AppErrorInfo | null | undefined) => string | null;
  formatChatTime: (sentAtMs: number) => string;
  getCardLabels: (card: Card) => {
    cornerRank: string;
    centerLabel: string;
    suitSymbol: string;
  };
}

function formatClaimWithCatalog(
  claim: Claim,
  catalog: LocaleCatalog,
  variant: 'compact' | 'full',
): string {
  const rankLabels = catalog.cards.rankLabels;
  const rankWordsSingular = catalog.cards.rankWordSingular;
  const rankWordsPlural = catalog.cards.rankWordPlural;
  const rankShortPlural = catalog.cards.rankShortPlural;
  const straightLowRankLabels = catalog.cards.straightLowRankLabels;
  const straightLowRankWords = catalog.cards.straightLowRankWords;
  const suitNames = catalog.cards.suitNames;
  const templates = catalog.claims;

  switch (claim.category) {
    case 'high-card':
      return variant === 'compact'
        ? templates.highCardCompact(rankLabels[claim.rank])
        : templates.highCardFull(rankWordsSingular[claim.rank]);
    case 'pair':
      return variant === 'compact'
        ? templates.pairCompact(rankShortPlural[claim.pairRank])
        : templates.pairFull(rankWordsPlural[claim.pairRank]);
    case 'two-pair':
      return variant === 'compact'
        ? templates.twoPairCompact(
            rankShortPlural[claim.highPairRank],
            rankShortPlural[claim.lowPairRank],
          )
        : templates.twoPairFull(
            rankWordsPlural[claim.highPairRank],
            rankWordsPlural[claim.lowPairRank],
          );
    case 'three-of-a-kind':
      return variant === 'compact'
        ? templates.tripsCompact(rankShortPlural[claim.tripRank])
        : templates.tripsFull(rankWordsPlural[claim.tripRank]);
    case 'straight':
      return variant === 'compact'
        ? templates.straightCompact(straightLowRankLabels[claim.lowRank])
        : templates.straightFull(straightLowRankWords[claim.lowRank]);
    case 'flush':
      return variant === 'compact'
        ? templates.flushCompact(
            SUIT_SYMBOLS[claim.suit],
            claim.rank === undefined ? undefined : rankLabels[claim.rank],
          )
        : templates.flushFull(
            suitNames[claim.suit],
            claim.rank === undefined
              ? undefined
              : rankWordsSingular[claim.rank],
          );
    case 'full-house':
      return variant === 'compact'
        ? templates.fullHouseCompact(
            rankShortPlural[claim.tripRank],
            rankShortPlural[claim.pairRank],
          )
        : templates.fullHouseFull(
            rankWordsPlural[claim.tripRank],
            rankWordsPlural[claim.pairRank],
          );
    case 'four-of-a-kind':
      return variant === 'compact'
        ? templates.quadsCompact(rankShortPlural[claim.quadRank])
        : templates.quadsFull(rankWordsPlural[claim.quadRank]);
    case 'straight-flush':
      return variant === 'compact'
        ? templates.straightFlushCompact(
            straightLowRankLabels[claim.lowRank],
            SUIT_SYMBOLS[claim.suit],
          )
        : templates.straightFlushFull(
            straightLowRankWords[claim.lowRank],
            suitNames[claim.suit],
          );
  }
}

export function formatClaimLabelWithCatalog(
  claim: Claim,
  catalog: LocaleCatalog,
): string {
  return formatClaimWithCatalog(claim, catalog, 'full');
}

export function formatClaimCompactLabelWithCatalog(
  claim: Claim,
  catalog: LocaleCatalog,
): string {
  return formatClaimWithCatalog(claim, catalog, 'compact');
}

function createLocaleContextValue(
  locale: LocaleCode,
  setLocaleState: (locale: LocaleCode) => void,
): LocaleContextValue {
  const catalog = LOCALE_CATALOGS[locale];

  return {
    locale,
    catalog,
    t: (key) => catalog.text[key],
    setLocale: (nextLocale) => {
      saveStoredLocale(nextLocale);
      setLocaleState(nextLocale);
    },
    formatRankLabel: (rank) => catalog.cards.rankLabels[rank],
    formatSuitChoiceLabel: (suit) => catalog.cards.suitChoiceLabels[suit],
    formatClaimLabel: (claim) => formatClaimLabelWithCatalog(claim, catalog),
    formatClaimCompactLabel: (claim) =>
      formatClaimCompactLabelWithCatalog(claim, catalog),
    formatError: (error) => {
      if (!error) {
        return null;
      }

      const parsedCode = appErrorCodeSchema.safeParse(error.code);

      if (parsedCode.success) {
        return catalog.errors[parsedCode.data];
      }

      return error.message ?? null;
    },
    formatChatTime: (sentAtMs) =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(sentAtMs)),
    getCardLabels: (card) => {
      if (isJokerCard(card)) {
        return {
          cornerRank: catalog.cards.jokerCornerLabels[card.color],
          centerLabel: catalog.cards.jokerCenterLabel,
          suitSymbol: '✦',
        };
      }

      return {
        cornerRank: catalog.cards.rankLabels[card.rank],
        centerLabel: catalog.cards.rankLabels[card.rank],
        suitSymbol: SUIT_SYMBOLS[card.suit],
      };
    },
  };
}

const LocaleContext = createContext<LocaleContextValue>(
  createLocaleContextValue('en', () => undefined),
);

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: LocaleCode;
}) {
  const [locale, setLocaleState] = useState<LocaleCode>(() =>
    getInitialLocale(initialLocale),
  );
  const value = useMemo(
    () => createLocaleContextValue(locale, setLocaleState),
    [locale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function getLocaleNativeName(locale: LocaleCode): string {
  return LOCALE_CATALOGS[locale].meta.nativeName;
}

export function getFallbackErrorMessage(
  code: string | undefined,
): string | null {
  const parsedCode = appErrorCodeSchema.safeParse(code);

  if (!parsedCode.success) {
    return null;
  }

  return getDefaultAppErrorMessage(parsedCode.data);
}
