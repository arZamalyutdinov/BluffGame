import { renderToStaticMarkup } from 'react-dom/server';

import {
  type Card,
  type Claim,
  DEFAULT_ROOM_SETTINGS,
  type MatchSnapshot,
  type RoomSnapshot,
  calculateDealingDurationMs,
  createCard,
  createJoker,
  roomSnapshotSchema,
} from '@bluff-game/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TableView, shouldPlaySelfTurnRing } from './TableView.js';

function buildPairClaim(
  rank: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 = 10,
): Claim {
  return {
    category: 'pair',
    pairRank: rank,
  };
}

function buildCard(
  rank: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14,
  suit: 'diamonds' | 'clubs' | 'hearts' | 'spades',
): Card {
  return createCard(rank, suit);
}

type MatchOverrides = Omit<
  Partial<MatchSnapshot>,
  'dealing' | 'lastClaim' | 'showdown' | 'timeout' | 'turnTimer' | 'spectator'
> & {
  dealing?: MatchSnapshot['dealing'] | null;
  lastClaim?: MatchSnapshot['lastClaim'] | null;
  turnTimer?: MatchSnapshot['turnTimer'] | null;
  showdown?: MatchSnapshot['showdown'] | null;
  timeout?: MatchSnapshot['timeout'] | null;
  spectator?: MatchSnapshot['spectator'] | null;
};

interface SnapshotOverrides {
  phase?: RoomSnapshot['phase'];
  serverNowMs?: RoomSnapshot['serverNowMs'];
  settings?: RoomSnapshot['settings'];
  players?: RoomSnapshot['players'];
  chatMessages?: RoomSnapshot['chatMessages'];
  match?: MatchOverrides | null;
}

function mergeMatch(baseMatch: MatchSnapshot, overrides: MatchOverrides) {
  const {
    dealing,
    lastClaim,
    turnTimer,
    showdown,
    timeout,
    spectator,
    ...rest
  } = overrides;
  let nextMatch: MatchSnapshot = {
    ...baseMatch,
    ...rest,
  };

  if (dealing === null) {
    const { dealing: _removedDealing, ...restMatch } = nextMatch;
    nextMatch = restMatch as MatchSnapshot;
  } else if (dealing !== undefined) {
    nextMatch.dealing = dealing;
  }

  if (lastClaim === null) {
    const { lastClaim: _removedLastClaim, ...restMatch } = nextMatch;
    nextMatch = restMatch as MatchSnapshot;
  } else if (lastClaim !== undefined) {
    nextMatch.lastClaim = lastClaim;
  }

  if (turnTimer === null) {
    const { turnTimer: _removedTurnTimer, ...restMatch } = nextMatch;
    nextMatch = restMatch as MatchSnapshot;
  } else if (turnTimer !== undefined) {
    nextMatch.turnTimer = turnTimer;
  }

  if (showdown === null) {
    const { showdown: _removedShowdown, ...restMatch } = nextMatch;
    nextMatch = restMatch as MatchSnapshot;
  } else if (showdown !== undefined) {
    nextMatch.showdown = showdown;
  }

  if (timeout === null) {
    const { timeout: _removedTimeout, ...restMatch } = nextMatch;
    nextMatch = restMatch as MatchSnapshot;
  } else if (timeout !== undefined) {
    nextMatch.timeout = timeout;
  }

  if (spectator === null) {
    const { spectator: _removedSpectator, ...restMatch } = nextMatch;
    nextMatch = restMatch as MatchSnapshot;
  } else if (spectator !== undefined) {
    nextMatch.spectator = spectator;
  }

  return nextMatch;
}

function buildSnapshot(
  playerCount: number,
  overrides: SnapshotOverrides = {},
): RoomSnapshot {
  const players = Array.from({ length: playerCount }, (_, index) => {
    const seatNumber = index + 1;
    const playerId = `p${seatNumber}`;

    return {
      playerId,
      name:
        seatNumber === 1
          ? 'Captain Violet'
          : seatNumber === 4
            ? 'Nova Bot'
            : `Player ${seatNumber}`,
      seatIndex: index,
      isHost: seatNumber === 1,
      isBot: seatNumber === 4,
      isReady: true,
      connectionStatus: 'connected' as const,
      handSize: 3,
      isEliminated: false,
      cardCount: Math.max(1, 4 - (index % 3)),
    };
  });

  const snapshot: RoomSnapshot = {
    roomCode: 'ABCD',
    phase: 'in-match',
    selfPlayerId: 'p1',
    hostPlayerId: 'p1',
    serverNowMs: Date.now(),
    settings: DEFAULT_ROOM_SETTINGS,
    players,
    chatMessages: [
      {
        messageId: 'm1',
        playerId: 'p2',
        playerName: players[1]?.name ?? 'Player 2',
        text: 'Feeling bold already.',
        sentAtMs: 1_701_000_000_000,
      },
      {
        messageId: 'm2',
        playerId: 'p1',
        playerName: players[0]?.name ?? 'Captain Violet',
        text: 'Let us see it.',
        sentAtMs: 1_701_000_030_000,
      },
    ],
    match: {
      phase: 'awaiting-response',
      roundNumber: 3,
      starterPlayerId: playerCount > 1 ? 'p2' : 'p1',
      currentTurnPlayerId: playerCount > 2 ? 'p3' : 'p2',
      turnTimer: {
        durationSeconds: 60,
        remainingMs: 26_000,
        isPaused: false,
      },
      lastClaim: buildPairClaim(10),
      claimHistory: [
        {
          sequenceNumber: 1,
          playerId: playerCount > 1 ? 'p2' : 'p1',
          claim: buildPairClaim(10),
        },
      ],
      yourHand: [
        buildCard(14, 'spades'),
        buildCard(10, 'hearts'),
        buildCard(6, 'clubs'),
      ],
    },
  };

  return roomSnapshotSchema.parse({
    ...snapshot,
    ...overrides,
    players: overrides.players ?? snapshot.players,
    chatMessages: overrides.chatMessages ?? snapshot.chatMessages,
    match:
      overrides.match === null || snapshot.match === undefined
        ? undefined
        : overrides.match === undefined
          ? snapshot.match
          : mergeMatch(snapshot.match, overrides.match),
  }) as RoomSnapshot;
}

function renderTable(snapshot: RoomSnapshot) {
  return renderToStaticMarkup(
    <TableView
      snapshot={snapshot}
      serverClockOffsetMs={0}
      isConnected
      pendingCommand={null}
      isTablePanelOpen={false}
      onSubmitClaim={() => {}}
      onChallengeClaim={() => {}}
      onSetPauseState={() => {}}
      onRestartMatch={() => {}}
      onLeaveRoom={() => {}}
      onKickPlayer={() => {}}
      onBecomeSpectator={() => {}}
      onSetSpectatorCardReveal={() => {}}
      onSendChatMessage={() => {}}
      onSetTablePanelOpen={() => {}}
    />,
  );
}

describe('TableView match fixtures', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([2, 4, 6, 8])(
    'renders avatar anchors and table objects for %i players',
    (playerCount) => {
      const markup = renderTable(buildSnapshot(playerCount));

      expect(markup.match(/poker-seat-anchor-opponent/g)?.length ?? 0).toBe(
        playerCount - 1,
      );
      expect(markup).toContain('aria-label="Opponent seats"');
      expect(markup).toContain('aria-label="Your seat"');
      expect(markup).toContain('aria-label="Current claim"');
      expect(markup).toContain('poker-table-deck');
      expect(markup).toContain('Cards in round');
    },
  );

  it('keeps the 4-player layout out of the blocked top-center lane', () => {
    const markup = renderTable(buildSnapshot(4));

    expect(markup).not.toContain('--poker-seat-left:50%;--poker-seat-top:24%');
    expect(markup).toContain('--poker-seat-left:30%;--poker-seat-top:25%');
    expect(markup).toContain('--poker-seat-left:70%;--poker-seat-top:25%');
  });

  it('renders the dealing phase as a non-interactive table animation synced from snapshot time', () => {
    vi.setSystemTime(new Date('2026-03-20T12:00:00.300Z'));

    const markup = renderTable(
      buildSnapshot(4, {
        match: {
          phase: 'dealing',
          currentTurnPlayerId: 'p2',
          turnTimer: null,
          lastClaim: null,
          claimHistory: [],
          dealing: {
            startedAtMs: new Date('2026-03-20T12:00:00.000Z').getTime(),
            durationMs: calculateDealingDurationMs({
              totalCardCount: 10,
            }),
          },
        },
      }),
    );

    expect(markup).toContain('poker-deal-layer');
    expect(markup).toContain('Dealing round');
    expect(markup).toContain('Cards on the way');
    expect(markup).toContain('dealing');
    expect(markup).toContain('poker-self-dealt-hand');
    expect(markup).toContain('poker-deal-flight-card');
    expect(markup).toContain('Open claim');
    expect(markup).toContain('Check');
  });

  it('renders the opening table state without a prior claim', () => {
    const markup = renderTable(
      buildSnapshot(4, {
        match: {
          phase: 'awaiting-opening-claim',
          roundNumber: 4,
          starterPlayerId: 'p1',
          currentTurnPlayerId: 'p1',
          turnTimer: {
            durationSeconds: 60,
            remainingMs: 60_000,
            isPaused: false,
          },
          lastClaim: null,
          claimHistory: [],
          yourHand: [
            buildCard(13, 'clubs'),
            buildCard(8, 'spades'),
            buildCard(3, 'hearts'),
          ],
        },
      }),
    );

    expect(markup).toContain('Open table');
    expect(markup).not.toContain('Any legal claim can open the round.');
    expect(markup).toContain('Open claim');
    expect(markup).not.toContain('poker-claim-pot-layer is-current');
  });

  it('renders the round claim rail in chronological order plus personal options copy', () => {
    const markup = renderTable(
      buildSnapshot(4, {
        match: {
          currentTurnPlayerId: 'p1',
          lastClaim: buildPairClaim(11),
          claimHistory: [
            {
              sequenceNumber: 1,
              playerId: 'p2',
              claim: buildPairClaim(10),
            },
            {
              sequenceNumber: 2,
              playerId: 'p3',
              claim: buildPairClaim(11),
            },
          ],
        },
      }),
    );

    expect(markup).toContain('Claims this round');
    expect(markup).toContain('Hide claims');
    expect(markup).toContain('Options');
    expect(markup).toContain('Personal options');
    expect(markup).toContain('Open the claim builder automatically when it');
    expect(markup).toContain('Current');
    expect(markup.indexOf('#1')).toBeLessThan(markup.indexOf('#2'));
  });

  it('renders suit-plus-rank flush labels on the live table', () => {
    const markup = renderTable(
      buildSnapshot(4, {
        settings: {
          ...DEFAULT_ROOM_SETTINGS,
          flushRule: 'suit-plus-rank',
        },
        match: {
          lastClaim: {
            category: 'flush',
            suit: 'hearts',
            rank: 12,
          },
          claimHistory: [
            {
              sequenceNumber: 1,
              playerId: 'p2',
              claim: {
                category: 'flush',
                suit: 'hearts',
                rank: 12,
              },
            },
          ],
        },
      }),
    );

    expect(markup).toContain('♥ flush + Q');
    expect(markup).toContain('Claim on table');
  });

  it('renders paused and critical timer states', () => {
    const pausedMarkup = renderTable(
      buildSnapshot(4, {
        match: {
          currentTurnPlayerId: 'p2',
          turnTimer: {
            durationSeconds: 60,
            remainingMs: 18_000,
            isPaused: true,
          },
        },
      }),
    );
    const criticalMarkup = renderTable(
      buildSnapshot(4, {
        match: {
          currentTurnPlayerId: 'p2',
          turnTimer: {
            durationSeconds: 60,
            remainingMs: 8_000,
            isPaused: false,
          },
        },
      }),
    );

    expect(pausedMarkup).toContain('Clock paused');
    expect(pausedMarkup).toContain('Paused');
    expect(criticalMarkup).toContain('Critical');
    expect(criticalMarkup).toContain('00:08');
  });

  it('only plays the turn ring on a live handoff to the local player', () => {
    expect(
      shouldPlaySelfTurnRing({
        previousTurnPlayerId: 'p2',
        currentTurnPlayerId: 'p1',
        selfPlayerId: 'p1',
        resumedFromBlockedPhase: false,
        isDealing: false,
        isShowingResult: false,
        hasWinner: false,
        isActionableOnCurrentTurn: true,
      }),
    ).toBe(true);

    expect(
      shouldPlaySelfTurnRing({
        previousTurnPlayerId: 'p2',
        currentTurnPlayerId: 'p3',
        selfPlayerId: 'p1',
        resumedFromBlockedPhase: false,
        isDealing: false,
        isShowingResult: false,
        hasWinner: false,
        isActionableOnCurrentTurn: true,
      }),
    ).toBe(false);

    expect(
      shouldPlaySelfTurnRing({
        previousTurnPlayerId: null,
        currentTurnPlayerId: 'p1',
        selfPlayerId: 'p1',
        resumedFromBlockedPhase: false,
        isDealing: false,
        isShowingResult: false,
        hasWinner: false,
        isActionableOnCurrentTurn: true,
      }),
    ).toBe(false);

    expect(
      shouldPlaySelfTurnRing({
        previousTurnPlayerId: 'p2',
        currentTurnPlayerId: 'p1',
        selfPlayerId: 'p1',
        resumedFromBlockedPhase: false,
        isDealing: true,
        isShowingResult: false,
        hasWinner: false,
        isActionableOnCurrentTurn: false,
      }),
    ).toBe(false);

    expect(
      shouldPlaySelfTurnRing({
        previousTurnPlayerId: 'p1',
        currentTurnPlayerId: 'p1',
        selfPlayerId: 'p1',
        resumedFromBlockedPhase: true,
        isDealing: false,
        isShowingResult: false,
        hasWinner: false,
        isActionableOnCurrentTurn: true,
      }),
    ).toBe(true);

    expect(
      shouldPlaySelfTurnRing({
        previousTurnPlayerId: 'p2',
        currentTurnPlayerId: 'p3',
        selfPlayerId: 'p1',
        resumedFromBlockedPhase: true,
        isDealing: false,
        isShowingResult: false,
        hasWinner: false,
        isActionableOnCurrentTurn: false,
      }),
    ).toBe(false);

    expect(
      shouldPlaySelfTurnRing({
        previousTurnPlayerId: 'p1',
        currentTurnPlayerId: 'p1',
        selfPlayerId: 'p1',
        resumedFromBlockedPhase: false,
        isDealing: false,
        isShowingResult: false,
        hasWinner: false,
        wasActionableOnCurrentTurn: false,
        isActionableOnCurrentTurn: true,
      }),
    ).toBe(true);

    expect(
      shouldPlaySelfTurnRing({
        previousTurnPlayerId: 'p1',
        currentTurnPlayerId: 'p1',
        selfPlayerId: 'p1',
        resumedFromBlockedPhase: false,
        isDealing: false,
        isShowingResult: false,
        hasWinner: false,
        wasActionableOnCurrentTurn: true,
        isActionableOnCurrentTurn: true,
      }),
    ).toBe(false);
  });

  it('renders showdown and timeout as on-table result stages from authoritative match state', () => {
    const showdownMarkup = renderTable(
      buildSnapshot(4, {
        match: {
          phase: 'showing-result',
          currentTurnPlayerId: 'p2',
          showdown: {
            startedAtMs: new Date('2026-03-20T11:59:50.000Z').getTime(),
            spokenClaim: buildPairClaim(12),
            claimantPlayerId: 'p2',
            challengerPlayerId: 'p3',
            claimWasValid: true,
            loserPlayerId: 'p3',
            loserHandSize: 4,
            loserEliminated: false,
            revealedHands: [
              {
                playerId: 'p1',
                cards: [buildCard(12, 'spades'), buildCard(2, 'clubs')],
              },
              {
                playerId: 'p2',
                cards: [buildCard(12, 'hearts'), buildCard(9, 'diamonds')],
              },
              {
                playerId: 'p3',
                cards: [buildCard(8, 'clubs'), buildCard(5, 'hearts')],
              },
            ],
            deckDraws: [],
          },
        },
      }),
    );
    const timeoutMarkup = renderTable(
      buildSnapshot(4, {
        match: {
          phase: 'showing-result',
          currentTurnPlayerId: 'p2',
          timeout: {
            startedAtMs: new Date('2026-03-20T11:59:51.000Z').getTime(),
            timedOutPlayerId: 'p2',
            loserHandSize: 4,
            loserEliminated: false,
            lastClaim: buildPairClaim(8),
            lastClaimantPlayerId: 'p1',
            revealedHands: [
              {
                playerId: 'p1',
                cards: [buildCard(8, 'spades'), buildCard(4, 'clubs')],
              },
              {
                playerId: 'p2',
                cards: [buildCard(14, 'hearts'), buildCard(5, 'diamonds')],
              },
            ],
          },
        },
      }),
    );

    expect(showdownMarkup).toContain('Claim found');
    expect(showdownMarkup).toContain('poker-result-stage');
    expect(showdownMarkup).toContain('Spoken claim');
    expect(showdownMarkup).toContain('poker-result-claim-marker');
    expect(showdownMarkup).toContain('poker-result-construction-slots');
    expect(showdownMarkup).toContain('poker-result-fireflies');
    expect(showdownMarkup).not.toContain('poker-result-summary');
    expect(showdownMarkup).not.toContain('poker-result-fireworks');
    expect(showdownMarkup).not.toContain('poker-claim-pot');
    expect(showdownMarkup).not.toContain('poker-result-centerpiece');
    expect(showdownMarkup).not.toContain('<dialog');
    expect(timeoutMarkup).toContain('ran out of time');
    expect(timeoutMarkup).toContain(
      'Timeout ends the round without validating the claim',
    );
    expect(timeoutMarkup).toContain('poker-result-stage');
    expect(timeoutMarkup).toContain('Last table claim');
    expect(timeoutMarkup).toContain('poker-result-stage is-timeout');
    expect(timeoutMarkup).not.toContain('poker-claim-pot');
    expect(timeoutMarkup).not.toContain('poker-result-construction-slots');
  });

  it('renders draw-assisted showdowns with a suspense deck lane before the verdict resolves', () => {
    vi.setSystemTime(new Date('2026-03-20T12:00:01.500Z'));

    const markup = renderTable(
      buildSnapshot(4, {
        settings: {
          ...DEFAULT_ROOM_SETTINGS,
          showdownDrawRule: 'draw-until-miss',
        },
        match: {
          phase: 'showing-result',
          showdown: {
            startedAtMs: new Date('2026-03-20T12:00:00.000Z').getTime(),
            spokenClaim: buildPairClaim(14),
            claimantPlayerId: 'p2',
            challengerPlayerId: 'p3',
            claimWasValid: true,
            loserPlayerId: 'p3',
            loserHandSize: 4,
            loserEliminated: false,
            revealedHands: [
              {
                playerId: 'p1',
                cards: [buildCard(14, 'hearts'), buildCard(2, 'clubs')],
              },
              {
                playerId: 'p2',
                cards: [buildCard(9, 'spades'), buildCard(4, 'diamonds')],
              },
            ],
            deckDraws: [buildCard(14, 'spades')],
          },
        },
      }),
    );

    expect(markup).toContain('Drawing from deck');
    expect(markup).toContain('Top-deck reveal');
    expect(markup).toContain('poker-result-deck-draw-lane');
    expect(markup).toContain('poker-result-deck-source');
    expect(markup).toContain('poker-result-construction-slots');
    expect(markup).not.toContain('Claim found');
  });

  it('withholds the losing seat marker until the showdown resolve beat lands', () => {
    const snapshot = buildSnapshot(4, {
      match: {
        phase: 'showing-result',
        showdown: {
          startedAtMs: new Date('2026-03-20T12:00:00.000Z').getTime(),
          spokenClaim: buildPairClaim(12),
          claimantPlayerId: 'p2',
          challengerPlayerId: 'p3',
          claimWasValid: true,
          loserPlayerId: 'p3',
          loserHandSize: 4,
          loserEliminated: false,
          revealedHands: [
            {
              playerId: 'p1',
              cards: [buildCard(12, 'spades'), buildCard(2, 'clubs')],
            },
            {
              playerId: 'p2',
              cards: [buildCard(12, 'hearts'), buildCard(9, 'diamonds')],
            },
            {
              playerId: 'p3',
              cards: [buildCard(8, 'clubs'), buildCard(5, 'hearts')],
            },
          ],
          deckDraws: [],
        },
      },
    });

    vi.setSystemTime(new Date('2026-03-20T12:00:01.500Z'));
    const beforeResolveMarkup = renderTable(snapshot);

    vi.setSystemTime(new Date('2026-03-20T12:00:05.000Z'));
    const afterResolveMarkup = renderTable(snapshot);

    expect(beforeResolveMarkup).not.toContain('>Lost<');
    expect(afterResolveMarkup).toContain('>Lost<');
  });

  it('renders showdown reveals against estimated server time when the client clock is skewed', () => {
    vi.setSystemTime(new Date('2026-03-20T11:58:00.000Z'));

    const skewedSnapshot = buildSnapshot(4, {
      serverNowMs: new Date('2026-03-20T12:00:05.000Z').getTime(),
      match: {
        phase: 'showing-result',
        showdown: {
          startedAtMs: new Date('2026-03-20T12:00:00.000Z').getTime(),
          spokenClaim: buildPairClaim(12),
          claimantPlayerId: 'p2',
          challengerPlayerId: 'p3',
          claimWasValid: true,
          loserPlayerId: 'p3',
          loserHandSize: 4,
          loserEliminated: false,
          revealedHands: [
            {
              playerId: 'p1',
              cards: [buildCard(12, 'spades'), buildCard(2, 'clubs')],
            },
            {
              playerId: 'p2',
              cards: [buildCard(12, 'hearts'), buildCard(9, 'diamonds')],
            },
            {
              playerId: 'p3',
              cards: [buildCard(8, 'clubs'), buildCard(5, 'hearts')],
            },
          ],
          deckDraws: [],
        },
      },
    });
    const markup = renderToStaticMarkup(
      <TableView
        snapshot={skewedSnapshot}
        serverClockOffsetMs={
          new Date('2026-03-20T11:58:00.000Z').getTime() -
          skewedSnapshot.serverNowMs
        }
        isConnected
        pendingCommand={null}
        isTablePanelOpen={false}
        onSubmitClaim={() => {}}
        onChallengeClaim={() => {}}
        onSetPauseState={() => {}}
        onRestartMatch={() => {}}
        onLeaveRoom={() => {}}
        onKickPlayer={() => {}}
        onBecomeSpectator={() => {}}
        onSetSpectatorCardReveal={() => {}}
        onSendChatMessage={() => {}}
        onSetTablePanelOpen={() => {}}
      />,
    );

    expect(markup).toContain('Claim found');
    expect(markup).toContain('>Lost<');
    expect(markup).toContain(
      'poker-result-seat-reveal seat-placement-top is-revealed',
    );
  });

  it('renders the match-complete state with the host restart action', () => {
    const markup = renderTable(
      buildSnapshot(4, {
        phase: 'match-complete',
        match: {
          phase: 'match-complete',
          currentTurnPlayerId: 'p2',
          winnerPlayerId: 'p2',
          turnTimer: null,
        },
      }),
    );

    expect(markup).toContain('Match winner');
    expect(markup).toContain('Player 2');
    expect(markup).toContain('poker-winner-pot');
    expect(markup).toContain('Return to lobby');
  });

  it('keeps one primary claim-entry control in the live footer', () => {
    const markup = renderTable(buildSnapshot(4));

    expect(markup.match(/poker-footer-button-primary/g)?.length ?? 0).toBe(1);
    expect(markup).toContain('Build claim');
    expect(markup.match(/poker-footer-button-check/g)?.length ?? 0).toBe(1);
    expect(markup).not.toContain('table-selected-claim-pill');
    expect(markup).not.toContain('claim-tray-shell');
  });

  it('renders eliminated viewers as spectators with private reveal controls and no live table seat', () => {
    const markup = renderTable(
      buildSnapshot(4, {
        players: [
          {
            playerId: 'p1',
            name: 'Captain Violet',
            seatIndex: 0,
            isHost: true,
            isBot: false,
            isReady: true,
            connectionStatus: 'connected',
            handSize: 4,
            isEliminated: true,
            cardCount: 0,
          },
          {
            playerId: 'p2',
            name: 'Player 2',
            seatIndex: 1,
            isHost: false,
            isBot: false,
            isReady: true,
            connectionStatus: 'connected',
            handSize: 2,
            isEliminated: false,
            cardCount: 2,
          },
          {
            playerId: 'p3',
            name: 'Player 3',
            seatIndex: 2,
            isHost: false,
            isBot: false,
            isReady: true,
            connectionStatus: 'connected',
            handSize: 1,
            isEliminated: false,
            cardCount: 1,
          },
          {
            playerId: 'p4',
            name: 'Nova Bot',
            seatIndex: 3,
            isHost: false,
            isBot: true,
            isReady: true,
            connectionStatus: 'connected',
            handSize: 3,
            isEliminated: true,
            cardCount: 0,
          },
        ],
        match: {
          phase: 'awaiting-response',
          currentTurnPlayerId: 'p2',
          spectator: {
            isSpectator: true,
            revealCardsEnabled: true,
            revealedHands: [
              {
                playerId: 'p2',
                cards: [buildCard(14, 'spades'), buildCard(7, 'hearts')],
              },
              {
                playerId: 'p3',
                cards: [buildCard(12, 'clubs')],
              },
            ],
          },
          yourHand: [],
        },
      }),
    );

    expect(markup).not.toContain('aria-label="Your seat"');
    expect(markup).toContain('Spectators');
    expect(markup).toContain('Hide live cards');
    expect(markup).toContain('Live hand');
    expect(markup).toContain('Spectating from the rail');
    expect(markup).toContain('You can currently see the active hands live.');
    expect(markup.match(/poker-seat-live-hand/g)?.length ?? 0).toBe(2);
    expect(markup).not.toContain('poker-hidden-card-fan poker-seat-fan');
  });

  it('renders joker cards distinctly during showdown results', () => {
    const markup = renderTable(
      buildSnapshot(2, {
        match: {
          phase: 'showing-result',
          showdown: {
            startedAtMs: Date.now(),
            spokenClaim: buildPairClaim(14),
            claimantPlayerId: 'p1',
            challengerPlayerId: 'p2',
            claimWasValid: true,
            loserPlayerId: 'p2',
            loserHandSize: 2,
            loserEliminated: false,
            revealedHands: [
              { playerId: 'p1', cards: [createJoker('black')] },
              { playerId: 'p2', cards: [buildCard(14, 'spades')] },
            ],
            deckDraws: [],
          },
        },
      }),
    );

    expect(markup).toContain('BJ');
    expect(markup).toContain('JOKER');
  });

  it('renders one hidden card back per opponent card beyond three cards', () => {
    const markup = renderTable(
      buildSnapshot(2, {
        players: [
          {
            playerId: 'p1',
            name: 'Captain Violet',
            seatIndex: 0,
            isHost: true,
            isBot: false,
            isReady: true,
            connectionStatus: 'connected',
            handSize: 3,
            isEliminated: false,
            cardCount: 3,
          },
          {
            playerId: 'p2',
            name: 'Player 2',
            seatIndex: 1,
            isHost: false,
            isBot: false,
            isReady: true,
            connectionStatus: 'connected',
            handSize: 5,
            isEliminated: false,
            cardCount: 5,
          },
        ],
      }),
    );

    expect(markup.match(/class="poker-hidden-card"/g)?.length ?? 0).toBe(5);
  });

  it('renders host kick controls and the self stop-playing action in the players drawer', () => {
    const markup = renderTable(
      buildSnapshot(4, {
        players: [
          {
            playerId: 'p1',
            name: 'Captain Violet',
            seatIndex: 0,
            isHost: true,
            isBot: false,
            isReady: true,
            connectionStatus: 'connected',
            handSize: 2,
            isEliminated: false,
            cardCount: 2,
          },
          {
            playerId: 'p2',
            name: 'Player 2',
            seatIndex: 1,
            isHost: false,
            isBot: false,
            isReady: true,
            connectionStatus: 'disconnected',
            handSize: 2,
            isEliminated: false,
            cardCount: 2,
          },
          {
            playerId: 'p3',
            name: 'Player 3',
            seatIndex: 2,
            isHost: false,
            isBot: false,
            isReady: true,
            connectionStatus: 'connected',
            handSize: 1,
            isEliminated: false,
            cardCount: 1,
          },
          {
            playerId: 'p4',
            name: 'Nova Bot',
            seatIndex: 3,
            isHost: false,
            isBot: true,
            isReady: true,
            connectionStatus: 'connected',
            handSize: 1,
            isEliminated: true,
            cardCount: 0,
          },
        ],
      }),
    );

    expect(markup).toContain('Kick');
    expect(markup).toContain('Stop playing');
    expect(markup).toContain('offline');
  });
});
