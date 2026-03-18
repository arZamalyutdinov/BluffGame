import { renderToStaticMarkup } from 'react-dom/server';

import {
  type Card,
  type Claim,
  DEFAULT_ROOM_SETTINGS,
  type MatchSnapshot,
  type RoomSnapshot,
  roomSnapshotSchema,
} from '@bluff-game/shared';
import { describe, expect, it } from 'vitest';

import { TableView } from './TableView.js';

function buildPairClaim(rank: 8 | 10 | 12 = 10): Claim {
  return {
    category: 'pair',
    pairRank: rank,
  };
}

function buildCard(rank: Card['rank'], suit: Card['suit']): Card {
  return {
    rank,
    suit,
  };
}

type MatchOverrides = Omit<
  Partial<MatchSnapshot>,
  'lastClaim' | 'showdown' | 'timeout' | 'turnTimer'
> & {
  lastClaim?: MatchSnapshot['lastClaim'] | null;
  turnTimer?: MatchSnapshot['turnTimer'] | null;
  showdown?: MatchSnapshot['showdown'] | null;
  timeout?: MatchSnapshot['timeout'] | null;
};

interface SnapshotOverrides {
  phase?: RoomSnapshot['phase'];
  players?: RoomSnapshot['players'];
  chatMessages?: RoomSnapshot['chatMessages'];
  match?: MatchOverrides | null;
}

function mergeMatch(baseMatch: MatchSnapshot, overrides: MatchOverrides) {
  const { lastClaim, turnTimer, showdown, timeout, ...rest } = overrides;
  let nextMatch: MatchSnapshot = {
    ...baseMatch,
    ...rest,
  };

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
      isConnected
      pendingCommand={null}
      isTablePanelOpen={false}
      onSubmitClaim={() => {}}
      onChallengeClaim={() => {}}
      onSetPauseState={() => {}}
      onRestartMatch={() => {}}
      onSendChatMessage={() => {}}
      onSetTablePanelOpen={() => {}}
    />,
  );
}

describe('TableView match fixtures', () => {
  it.each([2, 4, 6, 8])(
    'renders avatar anchors and table objects for %i players',
    (playerCount) => {
      const markup = renderTable(buildSnapshot(playerCount));

      expect(markup.match(/poker-seat-anchor-opponent/g)?.length ?? 0).toBe(
        playerCount - 1,
      );
      expect(markup).toContain('poker-self-rail');
      expect(markup).toContain('poker-claim-pot');
      expect(markup).toContain('poker-table-deck');
      expect(markup).toContain('Cards in round');
    },
  );

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
    expect(markup).toContain('Any legal claim can open the round.');
    expect(markup).toContain('Open claim');
    expect(markup).not.toContain('poker-claim-pot-layer is-current');
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

  it('renders showdown and timeout as on-table result stages from authoritative match state', () => {
    const showdownMarkup = renderTable(
      buildSnapshot(4, {
        match: {
          phase: 'showing-result',
          currentTurnPlayerId: 'p2',
          showdown: {
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
    expect(showdownMarkup).toContain('poker-result-construction-slots');
    expect(showdownMarkup).not.toContain('poker-claim-pot');
    expect(showdownMarkup).not.toContain('<dialog');
    expect(timeoutMarkup).toContain('ran out of time');
    expect(timeoutMarkup).toContain('The round ended before anyone checked');
    expect(timeoutMarkup).toContain('poker-result-stage');
    expect(timeoutMarkup).toContain('Last table claim');
    expect(timeoutMarkup).not.toContain('poker-claim-pot');
    expect(timeoutMarkup).not.toContain('poker-result-construction-slots');
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

    expect(markup.match(/Open claim|Build claim|Edit claim|Hide claim/g)?.length ?? 0).toBe(1);
    expect(markup.match(/>Check</g)?.length ?? 0).toBe(1);
    expect(markup).not.toContain('table-selected-claim-pill');
    expect(markup).not.toContain('claim-tray-shell');
  });
});
