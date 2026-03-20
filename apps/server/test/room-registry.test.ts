import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_ROOM_SETTINGS,
  MAX_ROOM_CHAT_MESSAGES,
  calculateDealingDurationMs,
  calculateResolutionDisplayDurationMs,
  parseClaimKey,
} from '@bluff-game/shared';

import { RoomRegistry } from '../src/room-registry.js';

async function advanceThroughDealing(
  registry: RoomRegistry,
  roomCode: string,
  viewerPlayerId: string,
) {
  const snapshot = registry.buildSnapshot(roomCode, viewerPlayerId);
  const durationMs = snapshot.match?.dealing?.durationMs ?? 0;

  await vi.advanceTimersByTimeAsync(durationMs);

  return registry.buildSnapshot(roomCode, viewerPlayerId);
}

describe('RoomRegistry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts matches in a dealing phase before the turn timer begins', async () => {
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

    const dealing = registry.buildSnapshot(host.roomCode, host.playerId);

    expect(dealing.match?.phase).toBe('dealing');
    expect(dealing.match?.turnTimer).toBeUndefined();
    expect(dealing.match?.dealing).toEqual({
      startedAtMs: Date.now(),
      durationMs: calculateDealingDurationMs({
        totalCardCount: 2,
      }),
    });

    const liveRound = await advanceThroughDealing(
      registry,
      host.roomCode,
      host.playerId,
    );

    expect(liveRound.match?.phase).toBe('awaiting-opening-claim');
    expect(liveRound.match?.turnTimer?.remainingMs).toBe(15000);
    expect(liveRound.match?.dealing).toBeUndefined();
  });

  it('rejects room commands with stable error codes', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');

    await expect(registry.joinRoom('NOPE', 'Guest')).rejects.toMatchObject({
      code: 'room-not-found',
    });

    await expect(
      registry.startMatch(host.roomCode, host.playerId),
    ).rejects.toMatchObject({
      code: 'start-match-min-players',
    });
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
    const beforeTimeout = await advanceThroughDealing(
      registry,
      host.roomCode,
      host.playerId,
    );
    const timedOutPlayerId = beforeTimeout.match?.currentTurnPlayerId;

    expect(beforeTimeout.match?.turnTimer?.remainingMs).toBe(15000);
    expect(timedOutPlayerId).toBeTruthy();

    await vi.advanceTimersByTimeAsync(15000);

    const afterTimeout = registry.buildSnapshot(host.roomCode, host.playerId);
    const timedOutPlayer = afterTimeout.players.find(
      (player) => player.playerId === timedOutPlayerId,
    );
    const resultHoldMs = calculateResolutionDisplayDurationMs({
      kind: 'timeout',
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
    expect(nextRound.match?.phase).toBe('dealing');
    expect(nextRound.match?.turnTimer).toBeUndefined();
    expect(nextRound.match?.dealing?.durationMs).toBe(
      calculateDealingDurationMs({
        totalCardCount: 3,
      }),
    );
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
    const opening = await advanceThroughDealing(
      registry,
      host.roomCode,
      host.playerId,
    );
    const claimantPlayerId = opening.match?.currentTurnPlayerId;
    const challengerPlayerId =
      claimantPlayerId === host.playerId ? guest.playerId : host.playerId;
    const resultHoldMs = calculateResolutionDisplayDurationMs({
      kind: 'showdown',
      revealedHandCount: 2,
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
    expect(afterChallenge.match?.showdown?.startedAtMs).toBe(Date.now());
    expect(afterChallenge.match?.showdown?.deckDraws).toEqual([]);

    await vi.advanceTimersByTimeAsync(resultHoldMs - 1);

    const duringHold = registry.buildSnapshot(host.roomCode, host.playerId);

    expect(duringHold.match?.roundNumber).toBe(1);
    expect(duringHold.match?.phase).toBe('showing-result');
    expect(duringHold.match?.turnTimer).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);

    const nextRound = registry.buildSnapshot(host.roomCode, host.playerId);

    expect(nextRound.match?.roundNumber).toBe(2);
    expect(nextRound.match?.phase).toBe('dealing');
    expect(nextRound.match?.turnTimer).toBeUndefined();
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
    const started = await advanceThroughDealing(
      registry,
      host.roomCode,
      host.playerId,
    );
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

  it('lets the host remove a bot from the lobby and compacts seat indexes', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    await registry.addBot(host.roomCode, host.playerId);

    const beforeRemoval = registry.buildSnapshot(host.roomCode, host.playerId);
    const bot = beforeRemoval.players.find((player) => player.isBot);

    expect(bot).toBeTruthy();

    await registry.removeBot(
      host.roomCode,
      host.playerId,
      bot?.playerId as string,
    );

    const afterRemoval = registry.buildSnapshot(host.roomCode, host.playerId);

    expect(afterRemoval.players.map((player) => player.name)).toEqual([
      'Host',
      'Guest',
    ]);
    expect(afterRemoval.players.map((player) => player.seatIndex)).toEqual([
      0, 1,
    ]);
    expect(
      afterRemoval.players.find((player) => player.playerId === guest.playerId),
    ).toMatchObject({
      seatIndex: 1,
    });
  });

  it('rejects bot removal when the target is not a bot', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    await expect(
      registry.removeBot(host.roomCode, host.playerId, guest.playerId),
    ).rejects.toMatchObject({
      code: 'player-not-bot',
    });
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
    await advanceThroughDealing(registry, host.roomCode, host.playerId);

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

  it('rejects gameplay commands while the authoritative deal is still running', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    await registry.setReady(host.roomCode, host.playerId, true);
    await registry.setReady(host.roomCode, guest.playerId, true);
    await registry.startMatch(host.roomCode, host.playerId);

    const snapshot = registry.buildSnapshot(host.roomCode, host.playerId);
    const starterPlayerId =
      snapshot.match?.currentTurnPlayerId ?? host.playerId;
    const otherPlayerId =
      starterPlayerId === host.playerId ? guest.playerId : host.playerId;

    await expect(
      registry.submitClaim(host.roomCode, starterPlayerId, 'high-card:2'),
    ).rejects.toThrow('Cards are still being dealt.');
    await expect(
      registry.challengeClaim(host.roomCode, otherPlayerId),
    ).rejects.toThrow('Cards are still being dealt.');
    await expect(
      registry.setMatchPaused(host.roomCode, host.playerId, true),
    ).rejects.toThrow('Cards are still being dealt.');
  });

  it('preserves dealing timing metadata for reconnect snapshots mid-deal', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    await registry.setReady(host.roomCode, host.playerId, true);
    await registry.setReady(host.roomCode, guest.playerId, true);
    await registry.startMatch(host.roomCode, host.playerId);

    const initial = registry.buildSnapshot(host.roomCode, host.playerId);

    await vi.advanceTimersByTimeAsync(200);

    const reconnectSnapshot = registry.buildSnapshot(
      host.roomCode,
      guest.playerId,
    );

    expect(reconnectSnapshot.match?.phase).toBe('dealing');
    expect(reconnectSnapshot.match?.dealing).toEqual(initial.match?.dealing);
    expect(
      (reconnectSnapshot.match?.dealing?.startedAtMs ?? 0) +
        (reconnectSnapshot.match?.dealing?.durationMs ?? 0) -
        Date.now(),
    ).toBeGreaterThan(0);
  });

  it('uses the draw-until-miss showdown rule with the round remainder deck', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    await registry.updateRoomSettings(host.roomCode, host.playerId, {
      ...DEFAULT_ROOM_SETTINGS,
      showdownDrawRule: 'draw-until-miss',
    });
    await registry.setReady(host.roomCode, host.playerId, true);
    await registry.setReady(host.roomCode, guest.playerId, true);
    await registry.startMatch(host.roomCode, host.playerId);
    const opening = await advanceThroughDealing(
      registry,
      host.roomCode,
      host.playerId,
    );
    const claimantPlayerId = opening.match?.currentTurnPlayerId;
    const challengerPlayerId =
      claimantPlayerId === host.playerId ? guest.playerId : host.playerId;

    await registry.submitClaim(
      host.roomCode,
      claimantPlayerId as string,
      'pair:14',
    );
    await registry.challengeClaim(host.roomCode, challengerPlayerId);

    const showdown = registry.buildSnapshot(host.roomCode, host.playerId).match
      ?.showdown;

    expect(showdown).toBeTruthy();
    expect(showdown?.startedAtMs).toBe(Date.now());
    expect(showdown?.deckDraws.length).toBeGreaterThan(0);
  });

  it('emits spectator snapshots only for eliminated human viewers and allows their private reveal toggle', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    await registry.setReady(host.roomCode, host.playerId, true);
    await registry.setReady(host.roomCode, guest.playerId, true);
    await registry.startMatch(host.roomCode, host.playerId);
    await advanceThroughDealing(registry, host.roomCode, host.playerId);

    const room = registry.getRoom(host.roomCode);
    const hostState = room?.players.find(
      (player) => player.playerId === host.playerId,
    );

    expect(room).toBeTruthy();
    expect(hostState).toBeTruthy();

    if (!room || !hostState) {
      throw new Error('Expected room and host state to exist.');
    }

    hostState.isEliminated = true;
    hostState.handSize = room.settings.eliminationHandSize;

    await expect(
      registry.setSpectatorCardReveal(host.roomCode, guest.playerId, true),
    ).rejects.toThrow(
      'Only eliminated human spectators can reveal live cards.',
    );

    await registry.setSpectatorCardReveal(host.roomCode, host.playerId, true);

    const spectatorSnapshot = registry.buildSnapshot(
      host.roomCode,
      host.playerId,
    );
    const activeSnapshot = registry.buildSnapshot(
      host.roomCode,
      guest.playerId,
    );

    expect(spectatorSnapshot.match?.spectator).toEqual({
      isSpectator: true,
      revealCardsEnabled: true,
      revealedHands: [
        {
          playerId: guest.playerId,
          cards:
            spectatorSnapshot.match?.spectator?.revealedHands?.[0]?.cards ?? [],
        },
      ],
    });
    expect(activeSnapshot.match?.spectator).toBeUndefined();

    await registry.attachConnection({
      roomCode: host.roomCode,
      playerId: host.playerId,
      sessionToken: host.sessionToken,
      socketId: 'spectator-socket',
    });

    const reconnectedSnapshot = registry.buildSnapshot(
      host.roomCode,
      host.playerId,
    );

    expect(reconnectedSnapshot.match?.spectator?.revealCardsEnabled).toBe(true);

    await registry.restartMatch(host.roomCode, host.playerId);

    const lobbyRoom = registry.getRoom(host.roomCode);
    const resetHost = lobbyRoom?.players.find(
      (player) => player.playerId === host.playerId,
    );

    expect(resetHost?.spectatorRevealEnabled).toBe(false);
  });

  it('lets the host kick a player to the spectator rail and restarts the live round', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');
    const third = await registry.joinRoom(host.roomCode, 'Third');

    await registry.setReady(host.roomCode, host.playerId, true);
    await registry.setReady(host.roomCode, guest.playerId, true);
    await registry.setReady(host.roomCode, third.playerId, true);
    await registry.startMatch(host.roomCode, host.playerId);
    await advanceThroughDealing(registry, host.roomCode, host.playerId);

    await registry.kickPlayerToSpectator(
      host.roomCode,
      host.playerId,
      third.playerId,
    );

    const snapshot = registry.buildSnapshot(host.roomCode, host.playerId);
    const kickedPlayer = snapshot.players.find(
      (player) => player.playerId === third.playerId,
    );

    expect(snapshot.match?.phase).toBe('dealing');
    expect(snapshot.match?.roundNumber).toBe(1);
    expect(snapshot.match?.claimHistory).toEqual([]);
    expect(snapshot.match?.dealing?.durationMs).toBe(
      calculateDealingDurationMs({
        totalCardCount: 2,
      }),
    );
    expect(kickedPlayer?.isEliminated).toBe(true);
    expect(kickedPlayer?.cardCount).toBe(0);
  });

  it('lets a player stop playing and become a spectator', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    await registry.setReady(host.roomCode, host.playerId, true);
    await registry.setReady(host.roomCode, guest.playerId, true);
    await registry.startMatch(host.roomCode, host.playerId);
    await advanceThroughDealing(registry, host.roomCode, host.playerId);

    await registry.becomeSpectator(host.roomCode, guest.playerId);

    const snapshot = registry.buildSnapshot(host.roomCode, host.playerId);
    const guestPlayer = snapshot.players.find(
      (player) => player.playerId === guest.playerId,
    );

    expect(snapshot.phase).toBe('match-complete');
    expect(snapshot.match?.phase).toBe('match-complete');
    expect(snapshot.match?.winnerPlayerId).toBe(host.playerId);
    expect(guestPlayer?.isEliminated).toBe(true);
  });

  it('reassigns the host after a 10-second disconnect window', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    await registry.attachConnection({
      roomCode: host.roomCode,
      playerId: host.playerId,
      sessionToken: host.sessionToken,
      socketId: 'host-socket',
    });
    await registry.attachConnection({
      roomCode: host.roomCode,
      playerId: guest.playerId,
      sessionToken: guest.sessionToken,
      socketId: 'guest-socket',
    });

    await registry.disconnect(host.roomCode, host.playerId, 'host-socket');
    await vi.advanceTimersByTimeAsync(9_999);

    expect(
      registry.buildSnapshot(host.roomCode, guest.playerId).hostPlayerId,
    ).toBe(host.playerId);

    await vi.advanceTimersByTimeAsync(1);

    expect(
      registry.buildSnapshot(host.roomCode, guest.playerId).hostPlayerId,
    ).toBe(guest.playerId);
  });

  it('keeps the host when they reconnect before the 10-second handoff window closes', async () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    await registry.attachConnection({
      roomCode: host.roomCode,
      playerId: host.playerId,
      sessionToken: host.sessionToken,
      socketId: 'host-socket',
    });
    await registry.attachConnection({
      roomCode: host.roomCode,
      playerId: guest.playerId,
      sessionToken: guest.sessionToken,
      socketId: 'guest-socket',
    });

    await registry.disconnect(host.roomCode, host.playerId, 'host-socket');
    await vi.advanceTimersByTimeAsync(5_000);
    await registry.attachConnection({
      roomCode: host.roomCode,
      playerId: host.playerId,
      sessionToken: host.sessionToken,
      socketId: 'host-returned',
    });
    await vi.advanceTimersByTimeAsync(5_001);

    expect(
      registry.buildSnapshot(host.roomCode, guest.playerId).hostPlayerId,
    ).toBe(host.playerId);
  });

  it('self-heals expired dealing and timeout-result phases when timer callbacks are missed', async () => {
    const registry = new RoomRegistry({
      setTimer: (() =>
        0 as unknown as ReturnType<
          typeof setTimeout
        >) as unknown as typeof setTimeout,
      clearTimer: (() => {}) as typeof clearTimeout,
    });
    const host = registry.createRoom('Host');
    const guest = await registry.joinRoom(host.roomCode, 'Guest');

    await registry.updateRoomSettings(host.roomCode, host.playerId, {
      ...DEFAULT_ROOM_SETTINGS,
      turnTimeLimitSeconds: 15,
    });
    await registry.setReady(host.roomCode, host.playerId, true);
    await registry.setReady(host.roomCode, guest.playerId, true);
    await registry.startMatch(host.roomCode, host.playerId);

    const initial = registry.buildSnapshot(host.roomCode, host.playerId);

    expect(initial.match?.phase).toBe('dealing');

    await vi.advanceTimersByTimeAsync(
      (initial.match?.dealing?.durationMs ?? 0) + 1,
    );

    const healedLiveRound = registry.buildSnapshot(
      host.roomCode,
      host.playerId,
    );

    expect(healedLiveRound.match?.phase).toBe('awaiting-opening-claim');
    expect(healedLiveRound.match?.dealing).toBeUndefined();
    expect(healedLiveRound.match?.turnTimer?.remainingMs).toBe(15000);

    await vi.advanceTimersByTimeAsync(15001);

    const healedTimeout = registry.buildSnapshot(host.roomCode, host.playerId);
    const resultHoldMs = calculateResolutionDisplayDurationMs({
      kind: 'timeout',
      revealedHandCount:
        healedTimeout.match?.timeout?.revealedHands.length ?? 0,
    });

    expect(healedTimeout.match?.phase).toBe('showing-result');
    expect(healedTimeout.match?.timeout).toBeTruthy();

    await vi.advanceTimersByTimeAsync(resultHoldMs + 1);

    const healedNextRound = registry.buildSnapshot(
      host.roomCode,
      host.playerId,
    );

    expect(healedNextRound.match?.roundNumber).toBe(2);
    expect(healedNextRound.match?.phase).toBe('dealing');
    expect(healedNextRound.match?.turnTimer).toBeUndefined();
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
