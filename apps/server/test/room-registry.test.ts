import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_ROOM_SETTINGS,
  MAX_ROOM_CHAT_MESSAGES,
  calculateResolutionDisplayDurationMs,
  parseClaimKey,
} from '@bluff-game/shared';

import { RoomRegistry } from '../src/room-registry.js';

describe('RoomRegistry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds timeout results on screen before starting the next round', async () => {
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
    const resultHoldMs = calculateResolutionDisplayDurationMs({
      revealedHandCount: 2,
    });

    expect(afterTimeout.match?.roundNumber).toBe(1);
    expect(afterTimeout.match?.phase).toBe('showing-result');
    expect(afterTimeout.match?.turnTimer).toBeUndefined();
    expect(afterTimeout.match?.timeout?.timedOutPlayerId).toBe(
      timedOutPlayerId,
    );
    expect(timedOutPlayer?.handSize).toBe(2);

    await vi.advanceTimersByTimeAsync(resultHoldMs - 1);

    const duringHold = registry.buildSnapshot(host.roomCode, host.playerId);

    expect(duringHold.match?.roundNumber).toBe(1);
    expect(duringHold.match?.phase).toBe('showing-result');
    expect(duringHold.match?.turnTimer).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);

    const nextRound = registry.buildSnapshot(host.roomCode, host.playerId);

    expect(nextRound.match?.roundNumber).toBe(2);
    expect(nextRound.match?.phase).toBe('awaiting-opening-claim');
    expect(nextRound.match?.turnTimer?.remainingMs).toBe(15000);
  });

  it('holds showdown results on screen before starting the next round', async () => {
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

    const opening = registry.buildSnapshot(host.roomCode, host.playerId);
    const claimantPlayerId = opening.match?.currentTurnPlayerId;
    const challengerPlayerId =
      claimantPlayerId === host.playerId ? guest.playerId : host.playerId;
    const resultHoldMs = calculateResolutionDisplayDurationMs({
      revealedHandCount: 2,
      claim: parseClaimKey('four-of-a-kind:14'),
    });

    expect(claimantPlayerId).toBeTruthy();

    await registry.submitClaim(
      host.roomCode,
      claimantPlayerId as string,
      'four-of-a-kind:14',
    );
    await registry.challengeClaim(host.roomCode, challengerPlayerId);

    const afterChallenge = registry.buildSnapshot(host.roomCode, host.playerId);

    expect(afterChallenge.match?.roundNumber).toBe(1);
    expect(afterChallenge.match?.phase).toBe('showing-result');
    expect(afterChallenge.match?.turnTimer).toBeUndefined();
    expect(afterChallenge.match?.showdown?.challengerPlayerId).toBe(
      challengerPlayerId,
    );

    await vi.advanceTimersByTimeAsync(resultHoldMs - 1);

    const duringHold = registry.buildSnapshot(host.roomCode, host.playerId);

    expect(duringHold.match?.roundNumber).toBe(1);
    expect(duringHold.match?.phase).toBe('showing-result');
    expect(duringHold.match?.turnTimer).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);

    const nextRound = registry.buildSnapshot(host.roomCode, host.playerId);

    expect(nextRound.match?.roundNumber).toBe(2);
    expect(nextRound.match?.phase).toBe('awaiting-opening-claim');
    expect(nextRound.match?.turnTimer?.remainingMs).toBe(15000);
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

  it('lets the host add a ready bot in the lobby', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');

    await registry.addBot(host.roomCode, host.playerId);

    const snapshot = registry.buildSnapshot(host.roomCode, host.playerId);
    const bot = snapshot.players.find((player) => player.isBot);

    expect(bot).toMatchObject({
      isBot: true,
      isReady: true,
      connectionStatus: 'connected',
    });
    expect(bot?.name.length).toBeGreaterThan(0);
  });

  it('rejects add-bot requests from non-host players', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    await expect(
      registry.addBot(host.roomCode, guest.playerId),
    ).rejects.toThrow('Only the host can do that.');
  });

  it('keeps bot names reserved against later joins', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');

    await registry.addBot(host.roomCode, host.playerId);

    const snapshot = registry.buildSnapshot(host.roomCode, host.playerId);
    const botName = snapshot.players.find((player) => player.isBot)?.name;

    expect(botName).toBeTruthy();
    await expect(
      registry.joinRoom(host.roomCode, ` ${botName} `),
    ).rejects.toThrow('That display name is already in use in this room.');
  });

  it('keeps bots ready when the host changes room settings', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');

    await registry.addBot(host.roomCode, host.playerId);
    await registry.setReady(host.roomCode, host.playerId, true);
    await registry.updateRoomSettings(host.roomCode, host.playerId, {
      ...DEFAULT_ROOM_SETTINGS,
      eliminationHandSize: 4,
    });

    const snapshot = registry.buildSnapshot(host.roomCode, host.playerId);
    const bot = snapshot.players.find((player) => player.isBot);
    const humanHost = snapshot.players.find(
      (player) => player.playerId === host.playerId,
    );

    expect(bot?.isReady).toBe(true);
    expect(humanHost?.isReady).toBe(false);
  });

  it('executes bot turns automatically during a match', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');

    await registry.addBot(host.roomCode, host.playerId);
    await registry.setReady(host.roomCode, host.playerId, true);
    await registry.startMatch(host.roomCode, host.playerId);

    const bot = registry
      .buildSnapshot(host.roomCode, host.playerId)
      .players.find((player) => player.isBot);

    expect(bot).toBeTruthy();

    let beforeBotTurn = registry.buildSnapshot(host.roomCode, host.playerId);

    if (beforeBotTurn.match?.currentTurnPlayerId !== bot?.playerId) {
      await registry.submitClaim(host.roomCode, host.playerId, 'high-card:2');
      beforeBotTurn = registry.buildSnapshot(host.roomCode, host.playerId);
    }

    const claimCountBefore = beforeBotTurn.match?.claimHistory.length ?? 0;
    const roundBefore = beforeBotTurn.match?.roundNumber ?? 0;

    await vi.advanceTimersByTimeAsync(1200);

    const afterBotTurn = registry.buildSnapshot(host.roomCode, host.playerId);
    const claimCountAfter = afterBotTurn.match?.claimHistory.length ?? 0;
    const roundAfter = afterBotTurn.match?.roundNumber ?? 0;

    expect(claimCountAfter > claimCountBefore || roundAfter > roundBefore).toBe(
      true,
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
