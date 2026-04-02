import { renderToStaticMarkup } from 'react-dom/server';

import {
  DEFAULT_ROOM_SETTINGS,
  createCard,
  createJoker,
} from '@bluff-game/shared';
import { describe, expect, it, vi } from 'vitest';

import { ClaimComposer } from './ClaimComposer.js';

function renderComposer() {
  return renderToStaticMarkup(
    <ClaimComposer
      claimOrderPreset={DEFAULT_ROOM_SETTINGS.claimOrderPreset}
      flushRule={DEFAULT_ROOM_SETTINGS.flushRule}
      yourHand={[
        createCard(14, 'spades'),
        createJoker('red'),
        createCard(6, 'clubs'),
      ]}
      cardsInRound={11}
      onSubmit={vi.fn()}
    />,
  );
}

describe('ClaimComposer', () => {
  it('opens on the combination-type view and shows match context', () => {
    const markup = renderComposer();

    expect(markup).toContain('Your hand');
    expect(markup).toContain('Cards in round');
    expect(markup).toContain('Total live cards still in play.');
    expect(markup).toContain('Quick search');
    expect(markup).toContain('Search legal claims');
    expect(markup).toContain(
      'Search by rank, suit, category, or compact claim text to jump straight to a legal claim.',
    );
    expect(markup).toContain('11');
    expect(markup).toContain('RJ');
    expect(markup).toContain('High card');
    expect(markup).toContain('Two pair');
    expect(markup).toContain('Straight flush');
    expect(markup).not.toContain('Choose a combination type.');
    expect(markup).not.toContain('Lowest legal raise');
    expect(markup).not.toContain('Current step');
  });
});
