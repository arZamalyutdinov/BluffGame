import { createCard, createJoker } from '@bluff-game/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LocaleProvider,
  detectBrowserLocale,
  getStoredLocale,
  saveStoredLocale,
  useLocale,
} from './i18n/index.js';

function LocaleProbe() {
  const {
    formatClaimLabel,
    formatClaimCompactLabel,
    formatChatTime,
    getCardLabels,
    t,
  } = useLocale();

  const queenLabels = getCardLabels(createCard(12, 'spades'));
  const jokerLabels = getCardLabels(createJoker('red'));

  return (
    <section>
      <div data-kind="claim">
        {formatClaimLabel({
          category: 'flush',
          suit: 'hearts',
          rank: 14,
        })}
      </div>
      <div data-kind="compact">
        {formatClaimCompactLabel({
          category: 'pair',
          pairRank: 12,
        })}
      </div>
      <div data-kind="rank">{queenLabels.cornerRank}</div>
      <div data-kind="joker">
        {jokerLabels.cornerRank}/{jokerLabels.centerLabel}
      </div>
      <div data-kind="label">{t('bluffCaught')}</div>
      <div data-kind="time">
        {formatChatTime(new Date('2026-03-20T12:05:00.000Z').getTime())}
      </div>
    </section>
  );
}

describe('i18n helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects supported browser locales and falls back to English', () => {
    expect(detectBrowserLocale('ru-RU')).toBe('ru');
    expect(detectBrowserLocale('ru-x-fenya')).toBe('ru-x-fenya');
    expect(detectBrowserLocale('en-US')).toBe('en');
    expect(detectBrowserLocale('fr-FR')).toBe('en');
    expect(detectBrowserLocale(['fr-FR', 'ru-RU'])).toBe('ru');
  });

  it('persists manual locale selection in localStorage', () => {
    const storage = {
      value: '' as string | null,
      getItem(key: string) {
        return key === 'bluffgame/locale' ? this.value : null;
      },
      setItem(key: string, value: string) {
        if (key === 'bluffgame/locale') {
          this.value = value;
        }
      },
    };

    vi.stubGlobal('window', {
      localStorage: storage,
      navigator: {
        language: 'en-US',
        languages: ['en-US'],
      },
    });

    expect(getStoredLocale()).toBeNull();
    saveStoredLocale('ru');
    expect(getStoredLocale()).toBe('ru');
    saveStoredLocale('ru-x-fenya');
    expect(getStoredLocale()).toBe('ru-x-fenya');
  });

  it('renders Russian claim, suit, rank, joker, and chat-time formatting', () => {
    const russianMarkup = renderToStaticMarkup(
      <LocaleProvider initialLocale="ru">
        <LocaleProbe />
      </LocaleProvider>,
    );
    const englishMarkup = renderToStaticMarkup(
      <LocaleProvider initialLocale="en">
        <LocaleProbe />
      </LocaleProvider>,
    );
    const prisonMarkup = renderToStaticMarkup(
      <LocaleProvider initialLocale="ru-x-fenya">
        <LocaleProbe />
      </LocaleProvider>,
    );

    expect(russianMarkup).toContain('флеш червы с А');
    expect(russianMarkup).toContain('пара Д');
    expect(russianMarkup).toContain('Блеф пойман');
    expect(russianMarkup).toContain('>Д<');
    expect(russianMarkup).toContain('RJ/JOKER');
    expect(englishMarkup).toContain('hearts flush with ace');
    expect(englishMarkup).toContain('pair of Qs');
    expect(englishMarkup).toContain('Bluff caught');
    expect(englishMarkup).toContain('>Q<');
    expect(englishMarkup).toContain('RJ/JOKER');
    expect(prisonMarkup).toContain('флеш червы с А');
    expect(prisonMarkup).toContain('пара Д');
    expect(prisonMarkup).toContain('Вафлер вскрылся');
    expect(russianMarkup).not.toContain('PM');
    expect(englishMarkup).toContain('PM');
    expect(prisonMarkup).not.toContain('PM');
  });
});
