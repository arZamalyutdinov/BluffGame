import { renderToStaticMarkup } from 'react-dom/server';

import {
  DEFAULT_ROOM_SETTINGS,
  type RoomSnapshot,
  roomSnapshotSchema,
} from '@bluff-game/shared';
import { describe, expect, it } from 'vitest';

import { LocaleProvider } from '../lib/i18n/index.js';
import { LobbyView } from './LobbyView.js';

function buildLobbySnapshot(
  overrides: Partial<RoomSnapshot> = {},
): RoomSnapshot {
  return roomSnapshotSchema.parse({
    roomCode: 'VCNE',
    phase: 'lobby',
    selfPlayerId: 'p1',
    hostPlayerId: 'p1',
    settings: DEFAULT_ROOM_SETTINGS,
    players: [
      {
        playerId: 'p1',
        name: 'Captain Violet',
        seatIndex: 0,
        isHost: true,
        isBot: false,
        isReady: true,
        connectionStatus: 'connected',
        handSize: 1,
        isEliminated: false,
        cardCount: 1,
      },
      {
        playerId: 'p2',
        name: 'Silas Sterling',
        seatIndex: 1,
        isHost: false,
        isBot: false,
        isReady: true,
        connectionStatus: 'connected',
        handSize: 1,
        isEliminated: false,
        cardCount: 1,
      },
      {
        playerId: 'p3',
        name: 'Nova Bot',
        seatIndex: 2,
        isHost: false,
        isBot: true,
        isReady: true,
        connectionStatus: 'connected',
        handSize: 1,
        isEliminated: false,
        cardCount: 1,
      },
    ],
    chatMessages: [],
    ...overrides,
  }) as RoomSnapshot;
}

function renderLobby(snapshot: RoomSnapshot) {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale="en">
      <LobbyView
        snapshot={snapshot}
        isConnected
        pendingCommand={null}
        onSetReady={() => {}}
        onAddBot={() => {}}
        onRemoveBot={() => {}}
        onStartMatch={() => {}}
        onLeaveRoom={() => {}}
        onUpdateSettings={() => {}}
      />
    </LocaleProvider>,
  );
}

function renderLobbyRu(snapshot: RoomSnapshot) {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale="ru">
      <LobbyView
        snapshot={snapshot}
        isConnected
        pendingCommand={null}
        onSetReady={() => {}}
        onAddBot={() => {}}
        onRemoveBot={() => {}}
        onStartMatch={() => {}}
        onLeaveRoom={() => {}}
        onUpdateSettings={() => {}}
      />
    </LocaleProvider>,
  );
}

describe('LobbyView', () => {
  it('renders host controls and editable rule settings for the room owner', () => {
    const markup = renderLobby(buildLobbySnapshot());

    expect(markup).toContain('Room VCNE');
    expect(markup).toContain('Host can edit');
    expect(markup).toContain('Flush rule');
    expect(markup).toContain('Suit only');
    expect(markup).toContain('Showdown deck rule');
    expect(markup).toContain('Revealed only');
    expect(markup).toContain('Jokers');
    expect(markup).toContain('No jokers');
    expect(markup).toContain('Mark not ready');
    expect(markup).toContain('Add bot');
    expect(markup).toContain('Remove bot');
    expect(markup).toContain('Start match');
    expect(markup).toContain('3/3 ready');
    expect(markup).toContain('Captain Violet');
    expect(markup).toContain('Nova Bot');
  });

  it('renders a read-only lobby view for non-host players', () => {
    const snapshot = buildLobbySnapshot({
      selfPlayerId: 'p2',
    });
    const markup = renderLobby(snapshot);

    expect(markup).toContain('Read only');
    expect(markup).toContain('Suit only');
    expect(markup).toContain('Revealed only');
    expect(markup).toContain('No jokers');
    expect(markup).toContain('Mark not ready');
    expect(markup).not.toContain('Add bot');
    expect(markup).not.toContain('Remove bot');
    expect(markup).not.toContain('Start match');
  });

  it('renders translated lobby copy in Russian', () => {
    const markup = renderLobbyRu(buildLobbySnapshot());

    expect(markup).toContain('Комната VCNE');
    expect(markup).toContain('Хост может менять');
    expect(markup).toContain('Правило флеша');
    expect(markup).toContain('Только масть');
    expect(markup).toContain('Джокеры');
    expect(markup).toContain('Без джокеров');
    expect(markup).toContain('Убрать бота');
    expect(markup).toContain('Игроки');
  });
});
