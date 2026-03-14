import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_ROOM_SETTINGS,
  MAX_ROOM_CHAT_MESSAGES,
} from '@bluff-game/shared';

import { RoomRegistry } from '../src/room-registry.js';

describe('RoomRegistry turn timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('times out the active player and starts the next round automatically', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    await registry.updateRoomSettings(host.roomCode, host.playerId, {
      ...DEFAULT_ROOM_SETTINGS,
      turnTimeLimitSeconds: 15,
    });
    await registry.setReady(host.roomCode, host.playerId, true);
    await registry.setReady(host.roomCode, guest.playerId, true);
    await registry.startMatch(host.roomCode, host.playerId);

    const beforeTimeout = registry.buildSnapshot(host.roomCode, host.playerId);
    const timedOutPlayerId = beforeTimeout.match?.currentTurnPlayerId;

    expect(beforeTimeout.match?.turnTimer?.remainingMs).toBe(15000);
    expect(timedOutPlayerId).toBeTruthy();

    await vi.advanceTimersByTimeAsync(15000);

    const afterTimeout = registry.buildSnapshot(host.roomCode, host.playerId);
    const timedOutPlayer = afterTimeout.players.find(
      (player) => player.playerId === timedOutPlayerId,
    );

    expect(afterTimeout.match?.roundNumber).toBe(2);
    expect(afterTimeout.match?.timeout?.timedOutPlayerId).toBe(
      timedOutPlayerId,
    );
    expect(timedOutPlayer?.handSize).toBe(2);
  });

  it('pauses and resumes the active turn clock', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    await registry.updateRoomSettings(host.roomCode, host.playerId, {
      ...DEFAULT_ROOM_SETTINGS,
      turnTimeLimitSeconds: 15,
    });
    await registry.setReady(host.roomCode, host.playerId, true);
    await registry.setReady(host.roomCode, guest.playerId, true);
    await registry.startMatch(host.roomCode, host.playerId);

    const started = registry.buildSnapshot(host.roomCode, host.playerId);
    const timedOutPlayerId = started.match?.currentTurnPlayerId;

    await registry.setMatchPaused(host.roomCode, host.playerId, true);
    await vi.advanceTimersByTimeAsync(30000);

    const paused = registry.buildSnapshot(host.roomCode, host.playerId);

    expect(paused.match?.roundNumber).toBe(1);
    expect(paused.match?.turnTimer?.isPaused).toBe(true);
    expect(paused.match?.timeout).toBeUndefined();
    expect(paused.match?.currentTurnPlayerId).toBe(timedOutPlayerId);

    await registry.setMatchPaused(host.roomCode, host.playerId, false);
    await vi.advanceTimersByTimeAsync(15000);

    const resumed = registry.buildSnapshot(host.roomCode, host.playerId);

    expect(resumed.match?.timeout?.timedOutPlayerId).toBe(timedOutPlayerId);
  });

  it('rejects duplicate display names in the same room', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');

    await expect(registry.joinRoom(host.roomCode, ' host ')).rejects.toThrow(
      'That display name is already in use in this room.',
    );
  });

  it('keeps bounded room chat history on snapshots', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    for (
      let messageIndex = 0;
      messageIndex < MAX_ROOM_CHAT_MESSAGES + 2;
      messageIndex += 1
    ) {
      const senderId = messageIndex % 2 === 0 ? host.playerId : guest.playerId;

      await registry.sendChatMessage(
        host.roomCode,
        senderId,
        `message ${messageIndex}`,
      );
    }

    const snapshot = registry.buildSnapshot(host.roomCode, host.playerId);

    expect(snapshot.chatMessages).toHaveLength(MAX_ROOM_CHAT_MESSAGES);
    expect(snapshot.chatMessages[0]?.text).toBe('message 2');
    expect(snapshot.chatMessages[0]?.playerName).toBe('Host');
    expect(snapshot.chatMessages.at(-1)?.text).toBe(
      `message ${MAX_ROOM_CHAT_MESSAGES + 1}`,
    );
  });
});
