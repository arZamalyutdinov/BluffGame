import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type Claim,
  type PlayerSnapshot,
  type RoomSnapshot,
  claimToCompactLabel,
  claimToKey,
  claimToLabel,
  sortCardsDescending,
} from '@bluff-game/shared';

import { claimToIllustrationCards } from '../lib/claimVisuals.js';
import {
  getPlayerInitials,
  getSeatToneClass,
} from '../lib/playerPresentation.js';
import {
  type TableSeatSlot,
  getDesktopOpponentSeatSlots,
} from '../lib/tableLayout.js';
import { ClaimComposer } from './ClaimComposer.js';
import { ClaimCardStack } from './ClaimPreview.js';
import {
  BotIcon,
  CardsIcon,
  ChatIcon,
  CrownIcon,
  ReadyIcon,
  SeatsIcon,
  SignalIcon,
  TimerIcon,
} from './Icons.js';
import { PlayerAvatar } from './PlayerAvatar.js';
import { RoomChat } from './RoomChat.js';
import {
  type ResolutionSeatPosition,
  RoundResolutionOverlay,
} from './RoundResolutionOverlay.js';
import '../tableScene.css';

interface TableViewProps {
  snapshot: RoomSnapshot;
  isConnected: boolean;
  pendingCommand: string | null;
  isTablePanelOpen: boolean;
  onSubmitClaim: (claimKey: string) => void;
  onChallengeClaim: () => void;
  onSetPauseState: (paused: boolean) => void;
  onRestartMatch: () => void;
  onSendChatMessage: (text: string) => void;
  onSetTablePanelOpen: (open: boolean) => void;
}

type ClaimHistoryEntry = NonNullable<
  RoomSnapshot['match']
>['claimHistory'][number];

function formatRemainingMs(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function sortPlayersBySeat(snapshot: RoomSnapshot): PlayerSnapshot[] {
  return [...snapshot.players].sort(
    (left, right) => left.seatIndex - right.seatIndex,
  );
}

function rotatePlayersForTable(
  players: PlayerSnapshot[],
  anchorPlayerId: string,
): PlayerSnapshot[] {
  const anchorIndex = players.findIndex(
    (player) => player.playerId === anchorPlayerId,
  );

  if (anchorIndex === -1) {
    return players;
  }

  return [...players.slice(anchorIndex), ...players.slice(0, anchorIndex)];
}

function buildTableSeatStyle(slot: TableSeatSlot): CSSProperties {
  return {
    '--poker-seat-left': `${slot.leftPct}%`,
    '--poker-seat-top': `${slot.topPct}%`,
  } as CSSProperties;
}

interface SeatAnchorCopy {
  roleChipLabel?: string;
  stateChipLabel?: string;
}

function buildSeatAnchorCopy({
  player,
  isCurrentTurn,
  isLowCards,
  isDisconnected,
  isSelf,
  isPaused,
}: {
  player: PlayerSnapshot;
  isCurrentTurn: boolean;
  isLowCards: boolean;
  isDisconnected: boolean;
  isSelf: boolean;
  isPaused: boolean;
}): SeatAnchorCopy {
  const roleChipLabel = isSelf
    ? 'You'
    : player.isBot
      ? 'Bot'
      : player.isHost
        ? 'Host'
        : undefined;
  const stateChipLabel = player.isEliminated
    ? 'Out'
    : isDisconnected
      ? 'Offline'
      : isCurrentTurn
        ? isPaused
          ? 'Paused'
          : 'Acting'
        : isLowCards
          ? 'Pressure'
          : undefined;

  return {
    ...(roleChipLabel ? { roleChipLabel } : {}),
    ...(stateChipLabel ? { stateChipLabel } : {}),
  };
}

function buildResolutionKey(match: NonNullable<RoomSnapshot['match']>) {
  if (match.showdown) {
    return [
      'showdown',
      match.roundNumber,
      match.showdown.claimantPlayerId,
      match.showdown.challengerPlayerId,
      match.showdown.loserPlayerId,
      match.showdown.claimWasValid ? 'valid' : 'invalid',
      claimToKey(match.showdown.spokenClaim),
    ].join(':');
  }

  if (match.timeout) {
    return [
      'timeout',
      match.roundNumber,
      match.timeout.timedOutPlayerId,
      match.timeout.lastClaim ? claimToKey(match.timeout.lastClaim) : 'opening',
    ].join(':');
  }

  return null;
}

export function TableView({
  snapshot,
  isConnected,
  pendingCommand,
  isTablePanelOpen,
  onSubmitClaim,
  onChallengeClaim,
  onSetPauseState,
  onRestartMatch,
  onSendChatMessage,
  onSetTablePanelOpen,
}: TableViewProps) {
  const match = snapshot.match;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [claimComposerStage, setClaimComposerStage] = useState<
    'closed' | 'opening' | 'open' | 'closing'
  >('closed');
  const [selectedComposerClaim, setSelectedComposerClaim] = useState<
    Claim | undefined
  >(undefined);
  const [turnAnnouncement, setTurnAnnouncement] = useState<{
    playerId: string;
    token: number;
  } | null>(null);
  const [claimPulse, setClaimPulse] = useState<{
    playerId: string;
    sequenceNumber: number;
  } | null>(null);
  const [claimTransition, setClaimTransition] = useState<{
    phase: 'idle' | 'entering' | 'swapping';
    token: number;
    outgoingEntry: ClaimHistoryEntry | null;
  }>({
    phase: 'idle',
    token: 0,
    outgoingEntry: null,
  });
  const previousTurnPlayerIdRef = useRef<string | null>(null);
  const previousClaimSequenceRef = useRef<number | null>(null);
  const previousRenderedClaimRef = useRef<ClaimHistoryEntry | null>(null);
  const turnTimer = match?.turnTimer;

  useEffect(() => {
    setNowMs(Date.now());

    if (
      !turnTimer ||
      turnTimer.isPaused ||
      turnTimer.deadlineAtMs === undefined
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [turnTimer]);

  useEffect(() => {
    const isClaimComposerVisible = claimComposerStage !== 'closed';

    if (!isTablePanelOpen && !isChatPanelOpen && !isClaimComposerVisible) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onSetTablePanelOpen(false);
        setIsChatPanelOpen(false);
        if (isClaimComposerVisible) {
          setClaimComposerStage('closing');
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    claimComposerStage,
    isChatPanelOpen,
    isTablePanelOpen,
    onSetTablePanelOpen,
  ]);

  useEffect(() => {
    if (
      match &&
      (match.currentTurnPlayerId !== snapshot.selfPlayerId ||
        match.winnerPlayerId)
    ) {
      setSelectedComposerClaim(undefined);
    }
  }, [match, snapshot.selfPlayerId]);

  if (!match) {
    return null;
  }

  const currentMatch = match;
  const yourHand = currentMatch.yourHand;

  const resolutionKey = buildResolutionKey(currentMatch);
  const activeResolution = useMemo(() => {
    if (currentMatch.showdown) {
      return {
        kind: 'showdown' as const,
        key: resolutionKey ?? 'showdown',
        data: currentMatch.showdown,
      };
    }

    if (currentMatch.timeout) {
      return {
        kind: 'timeout' as const,
        key: resolutionKey ?? 'timeout',
        data: currentMatch.timeout,
      };
    }

    return undefined;
  }, [currentMatch.showdown, currentMatch.timeout, resolutionKey]);
  const isShowingResult = currentMatch.phase === 'showing-result';
  const isResolutionStageOpen = Boolean(activeResolution) && isShowingResult;

  const isMyTurn = currentMatch.currentTurnPlayerId === snapshot.selfPlayerId;
  const isHost = snapshot.hostPlayerId === snapshot.selfPlayerId;
  const playersById = useMemo(
    () => new Map(snapshot.players.map((player) => [player.playerId, player])),
    [snapshot.players],
  );
  const currentPlayer = playersById.get(currentMatch.currentTurnPlayerId);
  const orderedPlayers = useMemo(() => sortPlayersBySeat(snapshot), [snapshot]);
  const tablePlayers = useMemo(
    () => rotatePlayersForTable(orderedPlayers, snapshot.selfPlayerId),
    [orderedPlayers, snapshot.selfPlayerId],
  );
  const selfPlayer =
    tablePlayers.find((player) => player.playerId === snapshot.selfPlayerId) ??
    playersById.get(snapshot.selfPlayerId);
  const opponentPlayers = tablePlayers.filter(
    (player) => player.playerId !== snapshot.selfPlayerId,
  );
  const opponentSeatSlots = getDesktopOpponentSeatSlots(tablePlayers.length);
  const resolutionSeatPositions = useMemo(() => {
    const positions: Record<string, ResolutionSeatPosition> = {};

    opponentPlayers.forEach((player, index) => {
      const slot = opponentSeatSlots[index];

      if (!slot) {
        return;
      }

      let placement: ResolutionSeatPosition['placement'];

      if (slot.variant === 'top') {
        placement = 'top';
      } else if (slot.variant === 'corner') {
        placement = slot.leftPct < 50 ? 'corner-left' : 'corner-right';
      } else {
        placement = slot.leftPct < 50 ? 'side-left' : 'side-right';
      }

      positions[player.playerId] = {
        leftPct: slot.leftPct,
        topPct: slot.topPct,
        placement,
      };
    });

    if (selfPlayer) {
      positions[selfPlayer.playerId] = {
        leftPct: 50,
        topPct: 84,
        placement: 'self',
      };
    }

    return positions;
  }, [opponentPlayers, opponentSeatSlots, selfPlayer]);
  const activePlayersInOrder = orderedPlayers.filter(
    (player) => !player.isEliminated,
  );
  const cardsInRound = activePlayersInOrder.reduce(
    (total, player) => total + player.cardCount,
    0,
  );
  const claimsByPlayerId = new Map<
    string,
    Array<(typeof currentMatch.claimHistory)[number]>
  >();

  for (const entry of currentMatch.claimHistory) {
    const playerClaims = claimsByPlayerId.get(entry.playerId) ?? [];
    playerClaims.push(entry);
    claimsByPlayerId.set(entry.playerId, playerClaims);
  }

  const currentTurnPlayerId = currentMatch.currentTurnPlayerId;
  const winner = currentMatch.winnerPlayerId
    ? playersById.get(currentMatch.winnerPlayerId)
    : undefined;
  const lastClaimEntry = currentMatch.claimHistory.at(-1);
  const lastClaimPlayer = lastClaimEntry
    ? playersById.get(lastClaimEntry.playerId)
    : undefined;
  const remainingMs = turnTimer
    ? turnTimer.isPaused || turnTimer.deadlineAtMs === undefined
      ? turnTimer.remainingMs
      : Math.max(0, turnTimer.deadlineAtMs - nowMs)
    : null;
  const turnProgress =
    turnTimer && remainingMs !== null
      ? Math.min(
          Math.max(remainingMs / (turnTimer.durationSeconds * 1000), 0),
          1,
        )
      : undefined;
  const isPaused = turnTimer?.isPaused ?? false;
  const timerUrgency =
    isPaused || remainingMs === null
      ? 'paused'
      : remainingMs <= 10_000
        ? 'critical'
        : remainingMs <= 20_000
          ? 'warning'
          : 'steady';
  const actionDisabled =
    !isConnected ||
    pendingCommand !== null ||
    isPaused ||
    remainingMs === 0 ||
    isShowingResult;
  const checkDisabled =
    !currentMatch.lastClaim || !isMyTurn || !!winner || actionDisabled;
  const canOpenClaimComposer =
    isMyTurn && !winner && !isPaused && !isShowingResult && !actionDisabled;
  const dockMessage = winner
    ? `${winner.name} won the match.`
    : isPaused
      ? 'The turn clock is paused.'
      : isShowingResult
        ? 'Round result is being shown.'
        : isMyTurn
          ? currentMatch.lastClaim
            ? 'Raise the current claim or check it.'
            : 'Open the round with any legal claim.'
          : `Waiting for ${currentPlayer?.name ?? 'the active player'} to act.`;
  const claimPotCopy = winner
    ? null
    : isPaused
      ? {
          label: 'Clock paused',
          title: currentMatch.lastClaim
            ? claimToCompactLabel(currentMatch.lastClaim)
            : 'Table waiting',
          detail: currentPlayer
            ? `Paused on ${currentPlayer.name}.`
            : 'The host paused the turn clock.',
        }
      : currentMatch.lastClaim
        ? {
            label: 'Claim on table',
            title: claimToCompactLabel(currentMatch.lastClaim),
            detail: lastClaimPlayer
              ? `${lastClaimPlayer.name} set the pace.`
              : 'Raise it or check it.',
          }
        : {
            label: 'Open table',
            title: 'No claim yet',
            detail: 'Any legal claim can open the round.',
          };
  const isClaimComposerVisible = claimComposerStage !== 'closed';

  useEffect(() => {
    if (winner || isShowingResult) {
      previousTurnPlayerIdRef.current = currentTurnPlayerId;
      setTurnAnnouncement(null);
      return;
    }

    const previousTurnPlayerId = previousTurnPlayerIdRef.current;

    if (previousTurnPlayerId && previousTurnPlayerId !== currentTurnPlayerId) {
      setTurnAnnouncement({
        playerId: currentTurnPlayerId,
        token: Date.now(),
      });
    }

    previousTurnPlayerIdRef.current = currentTurnPlayerId;
  }, [currentTurnPlayerId, isShowingResult, winner]);

  useEffect(() => {
    if (!turnAnnouncement) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTurnAnnouncement(null);
    }, 1_500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [turnAnnouncement]);

  useEffect(() => {
    const nextSequenceNumber = lastClaimEntry?.sequenceNumber ?? null;
    const previousSequenceNumber = previousClaimSequenceRef.current;

    if (
      previousSequenceNumber !== null &&
      nextSequenceNumber !== null &&
      nextSequenceNumber !== previousSequenceNumber &&
      lastClaimEntry
    ) {
      setClaimPulse({
        playerId: lastClaimEntry.playerId,
        sequenceNumber: nextSequenceNumber,
      });
    }

    previousClaimSequenceRef.current = nextSequenceNumber;
  }, [lastClaimEntry]);

  useEffect(() => {
    if (!claimPulse) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setClaimPulse(null);
    }, 1_150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [claimPulse]);

  useEffect(() => {
    if (!canOpenClaimComposer) {
      setClaimComposerStage('closed');
    }
  }, [canOpenClaimComposer]);

  useEffect(() => {
    if (!isShowingResult) {
      return;
    }

    onSetTablePanelOpen(false);
    setIsChatPanelOpen(false);
  }, [isShowingResult, onSetTablePanelOpen]);

  useEffect(() => {
    if (claimComposerStage !== 'opening') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setClaimComposerStage('open');
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [claimComposerStage]);

  useEffect(() => {
    if (claimComposerStage !== 'closing') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setClaimComposerStage('closed');
    }, 260);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [claimComposerStage]);

  useEffect(() => {
    const nextEntry = lastClaimEntry ?? null;
    const previousEntry = previousRenderedClaimRef.current;
    const previousSequenceNumber = previousEntry?.sequenceNumber ?? null;
    const nextSequenceNumber = nextEntry?.sequenceNumber ?? null;

    if (previousSequenceNumber === nextSequenceNumber) {
      return;
    }

    previousRenderedClaimRef.current = nextEntry;

    if (!nextEntry) {
      setClaimTransition({
        phase: 'idle',
        token: Date.now(),
        outgoingEntry: null,
      });
      return;
    }

    const nextToken = Date.now();

    setClaimTransition({
      phase: previousEntry ? 'swapping' : 'entering',
      token: nextToken,
      outgoingEntry: previousEntry,
    });

    const timeoutId = window.setTimeout(() => {
      setClaimTransition((current) =>
        current.token === nextToken
          ? {
              phase: 'idle',
              token: current.token,
              outgoingEntry: null,
            }
          : current,
      );
    }, 480);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [lastClaimEntry]);

  function openClaimComposer() {
    if (!canOpenClaimComposer) {
      return;
    }

    setClaimComposerStage((current) =>
      current === 'closed' ? 'opening' : current,
    );
  }

  function closeClaimComposer() {
    setClaimComposerStage((current) => {
      if (current === 'closed' || current === 'closing') {
        return current;
      }

      return 'closing';
    });
  }

  function renderChatRailContent(hideChatHeader = false) {
    return (
      <>
        {turnTimer && remainingMs !== null && !winner ? (
          <section
            className={`side-panel-section side-panel-card turn-timer-panel turn-timer-side-panel is-${timerUrgency}`}
          >
            <div className="turn-timer-header">
              <div>
                <p className="claim-panel-label">Turn clock</p>
                <h2>{currentPlayer?.name ?? 'Active player'}</h2>
              </div>

              <span className={`turn-timer-state is-${timerUrgency}`}>
                {isPaused
                  ? 'Paused'
                  : timerUrgency === 'critical'
                    ? 'Critical'
                    : timerUrgency === 'warning'
                      ? 'Warning'
                      : 'Live'}
              </span>
            </div>

            <div
              className={`turn-timer-value ${isPaused ? 'is-paused' : ''} ${timerUrgency === 'warning' ? 'is-warning' : ''} ${timerUrgency === 'critical' ? 'is-critical' : ''}`}
            >
              {formatRemainingMs(remainingMs)}
            </div>

            <p className="claim-helper-text">
              {isPaused
                ? 'The host has paused the clock for the current seat.'
                : `${currentPlayer?.name ?? 'The active player'} is on the clock.`}
            </p>

            {isHost ? (
              <div className="turn-timer-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onSetPauseState(!isPaused)}
                  disabled={!isConnected || pendingCommand !== null}
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <RoomChat
          messages={snapshot.chatMessages}
          selfPlayerId={snapshot.selfPlayerId}
          disabled={!isConnected || pendingCommand !== null}
          isConnected={isConnected}
          pendingCommand={pendingCommand}
          hideHeader={hideChatHeader}
          onSendMessage={onSendChatMessage}
        />
      </>
    );
  }

  function renderPlayerTableSection() {
    return (
      <section className="side-panel-section">
        <div className="side-panel-header">
          <h2>Players</h2>

          <span className="pill connected">
            <ReadyIcon className="status-icon" />
            {activePlayersInOrder.length} active
          </span>
        </div>

        <ul className="player-list">
          {orderedPlayers.map((player) => {
            const playerClaims = claimsByPlayerId.get(player.playerId) ?? [];
            const isDisconnected = player.connectionStatus === 'disconnected';

            return (
              <li
                key={player.playerId}
                className={`player-row ${player.playerId === currentTurnPlayerId ? 'turn-row' : ''}`}
              >
                <details className="player-details">
                  <summary className="player-details-summary">
                    <div
                      className={`seat-emblem ${getSeatToneClass(player.seatIndex)}`}
                      aria-hidden="true"
                    >
                      <span className="seat-emblem-seat">
                        {player.seatIndex + 1}
                      </span>
                      <span className="seat-emblem-initials">
                        {getPlayerInitials(player.name)}
                      </span>
                    </div>

                    <div className="player-card-body">
                      <div className="player-primary">
                        <div className="player-name-row">
                          <strong>{player.name}</strong>
                          {player.playerId === snapshot.selfPlayerId ? (
                            <span className="scene-chip scene-chip-compact">
                              You
                            </span>
                          ) : null}
                        </div>

                        <p className="row-meta">
                          Seat {player.seatIndex + 1}
                          {player.isHost ? ' • host' : ''}
                        </p>
                      </div>

                      <div className="status-pills player-status-pills">
                        {player.isHost ? (
                          <span className="pill connected">
                            <CrownIcon className="status-icon" />
                            host
                          </span>
                        ) : null}
                        {player.isBot ? (
                          <span className="pill bot">
                            <BotIcon className="status-icon" />
                            bot
                          </span>
                        ) : null}
                        <span
                          className={
                            player.isEliminated ? 'pill idle' : 'pill ready'
                          }
                        >
                          <CardsIcon className="status-icon" />
                          {player.isEliminated
                            ? 'out'
                            : `${player.cardCount} dealt`}
                        </span>
                        {isDisconnected ? (
                          <span className="pill idle">
                            <SignalIcon className="status-icon" />
                            offline
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </summary>

                  <div className="player-details-body">
                    {playerClaims.length > 0 ? (
                      <div className="player-claim-history">
                        {playerClaims.map((entry) => (
                          <div
                            key={entry.sequenceNumber}
                            className="player-claim-chip"
                            aria-label={claimToLabel(entry.claim)}
                            title={claimToCompactLabel(entry.claim)}
                          >
                            <ClaimCardStack
                              cards={claimToIllustrationCards(entry.claim)}
                              compact
                            />
                            <span className="player-claim-label">
                              {claimToCompactLabel(entry.claim)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="row-meta">No claims yet.</p>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  function renderHiddenCardFan({
    count,
    className,
  }: {
    count: number;
    className?: string;
  }) {
    const visibleCount = Math.max(1, Math.min(count, 3));
    const hiddenCardOffsets = Array.from(
      { length: visibleCount },
      (_, slotIndex) => slotIndex - (visibleCount - 1) / 2,
    );

    return (
      <div
        className={`poker-hidden-card-fan ${className ?? ''}`.trim()}
        aria-hidden="true"
      >
        {hiddenCardOffsets.map((offset) => {
          return (
            <span
              key={`${count}-${offset}`}
              className="poker-hidden-card"
              style={
                {
                  '--poker-hidden-card-offset': `${offset * 0.72}rem`,
                  '--poker-hidden-card-rotation': `${offset * 10}deg`,
                } as CSSProperties
              }
            />
          );
        })}
      </div>
    );
  }

  function renderOpponentAnchors() {
    return (
      <div className="poker-seat-ring" aria-label="Opponent seats">
        {opponentPlayers.map((player, index) => {
          const slot = opponentSeatSlots[index];

          if (!slot) {
            return null;
          }

          const isCurrentTurn = player.playerId === currentTurnPlayerId;
          const isTurnArriving = turnAnnouncement?.playerId === player.playerId;
          const isDisconnected = player.connectionStatus === 'disconnected';
          const isLowCards = !player.isEliminated && player.cardCount <= 1;
          const isJustClaimed = claimPulse?.playerId === player.playerId;
          const seatCopy = buildSeatAnchorCopy({
            player,
            isCurrentTurn,
            isLowCards,
            isDisconnected,
            isSelf: false,
            isPaused,
          });
          const timerTone = isCurrentTurn ? timerUrgency : undefined;
          const slotSideClass =
            slot.leftPct < 50
              ? 'is-left'
              : slot.leftPct > 50
                ? 'is-right'
                : 'is-center';

          return (
            <article
              key={player.playerId}
              className={`poker-seat-anchor poker-seat-anchor-opponent seat-slot-${slot.variant} ${slotSideClass} ${getSeatToneClass(player.seatIndex)} ${isCurrentTurn ? 'is-current-turn' : ''} ${player.isEliminated ? 'is-eliminated' : ''} ${isTurnArriving ? 'is-turn-arriving' : ''} ${isJustClaimed ? 'is-just-claimed' : ''} ${isDisconnected ? 'is-disconnected' : ''} ${isLowCards ? 'is-low-cards' : ''}`}
              style={buildTableSeatStyle(slot)}
              aria-label={`${player.name}, ${player.cardCount} ${player.cardCount === 1 ? 'card' : 'cards'}`}
            >
              <div className="poker-seat-anchor-head">
                <div className="poker-seat-avatar-wrap">
                  <PlayerAvatar
                    name={player.name}
                    seatIndex={player.seatIndex}
                    size="sm"
                    {...(isCurrentTurn && turnProgress !== undefined
                      ? {
                          timerProgress: turnProgress,
                          timerTone,
                        }
                      : {})}
                  />
                  <span
                    className={`poker-seat-count ${player.isEliminated ? 'is-eliminated' : ''} ${isCurrentTurn ? 'is-current-turn' : ''} ${isLowCards ? 'is-low-cards' : ''}`}
                  >
                    {player.isEliminated ? 'Out' : player.cardCount}
                  </span>
                </div>

                {!isShowingResult
                  ? renderHiddenCardFan({
                      count: player.cardCount,
                      className: 'poker-seat-fan',
                    })
                  : null}
              </div>

              <div className="poker-seat-chip">
                <strong>{player.name}</strong>
                <div className="poker-seat-flags">
                  {seatCopy.roleChipLabel ? (
                    <span className="poker-seat-tag">
                      {player.isBot ? (
                        <BotIcon className="poker-seat-chip-icon" />
                      ) : null}
                      {player.isHost && !player.isBot ? (
                        <CrownIcon className="poker-seat-chip-icon" />
                      ) : null}
                      {seatCopy.roleChipLabel}
                    </span>
                  ) : null}
                  {seatCopy.stateChipLabel ? (
                    <span
                      className={`poker-seat-tag is-state ${player.isEliminated ? 'is-eliminated' : ''} ${isDisconnected ? 'is-offline' : ''} ${isCurrentTurn ? 'is-current-turn' : ''} ${isLowCards ? 'is-pressure' : ''}`}
                    >
                      {seatCopy.stateChipLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  function renderSelfAnchor() {
    if (!selfPlayer) {
      return null;
    }

    const isCurrentTurn = selfPlayer.playerId === currentTurnPlayerId;
    const isDisconnected = selfPlayer.connectionStatus === 'disconnected';
    const isLowCards = !selfPlayer.isEliminated && selfPlayer.cardCount <= 1;
    const seatCopy = buildSeatAnchorCopy({
      player: selfPlayer,
      isCurrentTurn,
      isLowCards,
      isDisconnected,
      isSelf: true,
      isPaused,
    });

    return (
      <section
        className={`poker-self-rail ${getSeatToneClass(selfPlayer.seatIndex)} ${isCurrentTurn ? 'is-current-turn' : ''} ${selfPlayer.isEliminated ? 'is-eliminated' : ''} ${isDisconnected ? 'is-disconnected' : ''} ${isShowingResult ? 'is-showing-result' : ''}`}
        aria-label="Your seat"
      >
        <div className="poker-self-identity">
          <div className="poker-seat-avatar-wrap">
            <PlayerAvatar
              name={selfPlayer.name}
              seatIndex={selfPlayer.seatIndex}
              size="md"
              {...(isCurrentTurn && turnProgress !== undefined
                ? {
                    timerProgress: turnProgress,
                    timerTone: timerUrgency,
                  }
                : {})}
            />
            <span
              className={`poker-seat-count ${selfPlayer.isEliminated ? 'is-eliminated' : ''} ${isCurrentTurn ? 'is-current-turn' : ''} ${isLowCards ? 'is-low-cards' : ''}`}
            >
              {selfPlayer.isEliminated ? 'Out' : selfPlayer.cardCount}
            </span>
          </div>

          <div className="poker-self-copy">
            <div className="poker-seat-chip is-self">
              <strong>{selfPlayer.name}</strong>
              <div className="poker-seat-flags">
                {seatCopy.roleChipLabel ? (
                  <span className="poker-seat-tag">
                    {seatCopy.roleChipLabel}
                  </span>
                ) : null}
                {seatCopy.stateChipLabel ? (
                  <span
                    className={`poker-seat-tag is-state ${selfPlayer.isEliminated ? 'is-eliminated' : ''} ${isDisconnected ? 'is-offline' : ''} ${isCurrentTurn ? 'is-current-turn' : ''} ${isLowCards ? 'is-pressure' : ''}`}
                  >
                    {seatCopy.stateChipLabel}
                  </span>
                ) : null}
              </div>
            </div>

            <span className="poker-self-hand-label">
              Your hand · {yourHand.length}{' '}
              {yourHand.length === 1 ? 'card' : 'cards'}
            </span>
          </div>
        </div>

        {!isShowingResult ? (
          <div className="poker-self-hand">
            <ClaimCardStack cards={sortCardsDescending(yourHand)} />
          </div>
        ) : null}
      </section>
    );
  }

  function renderClaimPot() {
    if (winner || isShowingResult || !claimPotCopy) {
      return null;
    }

    const outgoingClaim = claimTransition.outgoingEntry?.claim;
    const outgoingPlayerName = claimTransition.outgoingEntry
      ? (playersById.get(claimTransition.outgoingEntry.playerId)?.name ??
        'Unknown')
      : undefined;
    const activeClaim = currentMatch.lastClaim;

    return (
      <section
        className={`poker-claim-pot ${activeClaim ? 'has-claim' : 'is-opening'} ${isPaused ? 'is-paused' : ''} ${claimTransition.phase === 'entering' ? 'is-entering' : ''} ${claimTransition.phase === 'swapping' ? 'is-swapping' : ''}`}
        aria-label="Current claim"
      >
        <div className="poker-claim-pot-copy">
          <span className="poker-object-label">{claimPotCopy.label}</span>
          <strong className="poker-claim-pot-title">
            {claimPotCopy.title}
          </strong>
          <span className="poker-claim-pot-detail">{claimPotCopy.detail}</span>
        </div>

        <div className="poker-claim-pot-visual">
          {outgoingClaim && claimTransition.phase === 'swapping' ? (
            <div className="poker-claim-pot-layer is-outgoing">
              <ClaimCardStack
                cards={claimToIllustrationCards(outgoingClaim)}
                compact
              />
              <span className="poker-claim-pot-layer-text">
                {outgoingPlayerName
                  ? `${outgoingPlayerName} spoke ${claimToCompactLabel(outgoingClaim)}.`
                  : claimToCompactLabel(outgoingClaim)}
              </span>
            </div>
          ) : null}

          {activeClaim ? (
            <div className="poker-claim-pot-layer is-current">
              <ClaimCardStack
                cards={claimToIllustrationCards(activeClaim)}
                compact
              />
              <span className="poker-claim-pot-layer-text">
                {lastClaimPlayer
                  ? `${lastClaimPlayer.name} set ${claimToCompactLabel(activeClaim)}.`
                  : claimToCompactLabel(activeClaim)}
              </span>
            </div>
          ) : (
            <div className="poker-claim-pot-opening">
              <span className="poker-claim-pot-opening-dot" />
              <span>Open the round with any legal claim.</span>
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderDeckObject() {
    if (winner || isShowingResult) {
      return null;
    }

    return (
      <div
        className="poker-table-deck"
        aria-label={`Cards in round ${cardsInRound}`}
      >
        <div className="poker-table-deck-stack" aria-hidden="true">
          <span className="poker-table-deck-card poker-table-deck-card-back" />
          <span className="poker-table-deck-card poker-table-deck-card-back" />
          <span className="poker-table-deck-card poker-table-deck-card-back is-front" />
        </div>

        <div className="poker-table-deck-chip">
          <span className="poker-object-label">Cards in round</span>
          <strong>{cardsInRound}</strong>
        </div>
      </div>
    );
  }

  function renderWinnerPot() {
    if (!winner || isShowingResult) {
      return null;
    }

    return (
      <section className="poker-winner-pot" aria-label="Match winner">
        <PlayerAvatar
          name={winner.name}
          seatIndex={winner.seatIndex}
          size="lg"
        />
        <div className="poker-winner-copy">
          <span className="poker-object-label">Match winner</span>
          <strong>{winner.name}</strong>
          <span>The table is closed until the host returns to the lobby.</span>
        </div>
      </section>
    );
  }

  function renderClaimComposerPopup() {
    if (!isClaimComposerVisible) {
      return null;
    }

    const currentLastClaim = currentMatch.lastClaim;

    return (
      <div
        className={`poker-claim-popup-overlay is-${claimComposerStage}`}
        role="presentation"
      >
        <button
          type="button"
          className="poker-claim-popup-scrim"
          onClick={closeClaimComposer}
          aria-label="Close claim builder"
        />

        <dialog
          open
          className="poker-claim-popup-shell"
          aria-modal="true"
          aria-label="Claim builder"
        >
          <div className="poker-claim-popup-header">
            <div>
              <p className="eyebrow">Claim builder</p>
              <h2>Pick your exact claim</h2>
              <p className="claim-helper-text">
                {selectedComposerClaim
                  ? `Selected: ${claimToCompactLabel(selectedComposerClaim)}`
                  : currentLastClaim
                    ? 'Choose a stronger claim than the one on the table.'
                    : 'Choose the claim that opens the round.'}
              </p>
            </div>

            <button
              type="button"
              className="ghost-button poker-table-control-button"
              onClick={closeClaimComposer}
            >
              Close
            </button>
          </div>

          <ClaimComposer
            claimOrderPreset={snapshot.settings.claimOrderPreset}
            disabled={actionDisabled}
            {...(currentLastClaim ? { lastClaim: currentLastClaim } : {})}
            onSelectedClaimChange={setSelectedComposerClaim}
            onSubmit={(claimKey) => {
              closeClaimComposer();
              onSubmitClaim(claimKey);
            }}
          />
        </dialog>
      </div>
    );
  }

  return (
    <section className="surface-grid match-layout">
      <article className="hero-panel poker-match-shell">
        <div className="poker-match-header">
          <div className="poker-match-copy">
            <p className="eyebrow">Match</p>
            <h1>Round {match.roundNumber}</h1>
            <p className="lead">
              {winner
                ? `${winner.name} won the match.`
                : isShowingResult
                  ? 'Resolving the last round.'
                  : isPaused
                    ? `Paused on ${currentPlayer?.name ?? 'the active player'}.`
                    : isMyTurn
                      ? 'Your turn.'
                      : `${currentPlayer?.name ?? 'Another player'} is acting.`}
            </p>
          </div>
        </div>

        <div
          className={`poker-table-stage ${timerUrgency === 'warning' ? 'is-warning-clock' : ''} ${timerUrgency === 'critical' ? 'is-critical-clock' : ''} ${isResolutionStageOpen ? 'is-showing-result' : ''}`}
        >
          <div className="poker-table-scenery" aria-hidden="true">
            <div className="poker-table-ambient poker-table-ambient-left" />
            <div className="poker-table-ambient poker-table-ambient-right" />
            <div className="poker-table-ambient-center" />
            <div className="poker-table-foreground-glow" />
          </div>

          <div className="poker-table-stage-inner">
            <div
              className={`poker-table-controls poker-table-controls-left ${isResolutionStageOpen ? 'is-result-dimmed' : ''}`}
            >
              <button
                type="button"
                className="ghost-button poker-table-control-button"
                aria-expanded={isTablePanelOpen}
                aria-controls="table-drawer"
                disabled={isShowingResult}
                onClick={() => {
                  setIsChatPanelOpen(false);
                  onSetTablePanelOpen(!isTablePanelOpen);
                }}
              >
                <SeatsIcon className="status-icon" />
                {isTablePanelOpen ? 'Hide players' : 'Players'}
              </button>

              <button
                type="button"
                className="ghost-button poker-table-control-button"
                aria-expanded={isChatPanelOpen}
                aria-controls="chat-drawer"
                disabled={isShowingResult}
                onClick={() => {
                  onSetTablePanelOpen(false);
                  setIsChatPanelOpen((current) => !current);
                }}
              >
                <ChatIcon className="status-icon" />
                {isChatPanelOpen ? 'Hide chat' : 'Chat'}
              </button>

              {isHost && turnTimer && !winner ? (
                <button
                  type="button"
                  className="ghost-button poker-table-control-button"
                  onClick={() => onSetPauseState(!isPaused)}
                  disabled={
                    !isConnected || pendingCommand !== null || isShowingResult
                  }
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
              ) : null}
            </div>

            <div
              className={`poker-table-controls poker-table-controls-right ${isResolutionStageOpen ? 'is-result-dimmed' : ''}`}
            >
              <span className="pill ready poker-table-status">
                <CardsIcon className="status-icon" />
                Room {snapshot.roomCode}
              </span>
              {turnTimer && remainingMs !== null ? (
                <span
                  className={`${isPaused ? 'pill idle' : 'pill connected'} poker-table-status poker-table-timer timer-pill-${timerUrgency}`}
                >
                  <TimerIcon className="status-icon" />
                  {isPaused ? 'paused' : formatRemainingMs(remainingMs)}
                </span>
              ) : null}
              <span
                className={`${isConnected ? 'pill connected' : 'pill idle'} poker-table-status`}
              >
                <SignalIcon className="status-icon" />
                {isConnected ? 'live' : 'reconnecting'}
              </span>
            </div>

            {turnAnnouncement ? (
              <div
                key={turnAnnouncement.token}
                className={`poker-turn-banner ${turnAnnouncement.playerId === snapshot.selfPlayerId ? 'is-self' : ''}`}
              >
                <span className="poker-turn-banner-kicker">Turn handoff</span>
                <strong>
                  {turnAnnouncement.playerId === snapshot.selfPlayerId
                    ? 'Your move'
                    : `${playersById.get(turnAnnouncement.playerId)?.name ?? 'Player'} to act`}
                </strong>
              </div>
            ) : null}

            {renderClaimPot()}
            {renderDeckObject()}
            {renderWinnerPot()}
            {renderOpponentAnchors()}
            {renderSelfAnchor()}
            {activeResolution && isResolutionStageOpen ? (
              <RoundResolutionOverlay
                result={activeResolution}
                players={snapshot.players}
                seatPositions={resolutionSeatPositions}
              />
            ) : null}
            {renderClaimComposerPopup()}
          </div>
        </div>

        <div
          className={`poker-footer ${isClaimComposerVisible ? 'has-open-tray' : ''} ${isResolutionStageOpen ? 'is-result-dimmed' : ''}`}
        >
          <div className="poker-footer-note">{dockMessage}</div>

          {winner ? (
            <div className="poker-footer-dock">
              {isHost ? (
                <button
                  type="button"
                  className="poker-footer-button poker-footer-button-primary poker-footer-button-wide"
                  onClick={onRestartMatch}
                >
                  Return to lobby
                </button>
              ) : (
                <div className="poker-footer-placeholder">
                  Waiting for the host to return to the lobby.
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="poker-footer-zone">
                <div className="poker-footer-dock">
                  <button
                    type="button"
                    className={`poker-footer-button poker-footer-button-primary ${isClaimComposerVisible ? 'is-open' : ''}`}
                    onClick={() => {
                      if (isClaimComposerVisible) {
                        closeClaimComposer();
                        return;
                      }

                      openClaimComposer();
                    }}
                    disabled={!canOpenClaimComposer}
                  >
                    <span className="poker-footer-button-copy">
                      <span className="poker-footer-button-kicker">
                        {selectedComposerClaim
                          ? claimToCompactLabel(selectedComposerClaim)
                          : match.lastClaim
                            ? 'Raise the table'
                            : 'Start the round'}
                      </span>
                      <strong className="poker-footer-button-label">
                        {isClaimComposerVisible
                          ? 'Close builder'
                          : selectedComposerClaim
                            ? 'Edit claim'
                            : match.lastClaim
                              ? 'Build claim'
                              : 'Open claim'}
                      </strong>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="poker-footer-button poker-footer-button-check"
                    onClick={onChallengeClaim}
                    disabled={checkDisabled}
                  >
                    <span className="poker-footer-button-copy">
                      <span className="poker-footer-button-kicker">
                        Call it now
                      </span>
                      <strong className="poker-footer-button-label">
                        Check
                      </strong>
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </article>

      <button
        type="button"
        className={`table-drawer-backdrop ${isTablePanelOpen || isChatPanelOpen ? 'is-open' : ''}`}
        onClick={() => {
          onSetTablePanelOpen(false);
          setIsChatPanelOpen(false);
        }}
        aria-label="Close side panels"
        tabIndex={isTablePanelOpen || isChatPanelOpen ? 0 : -1}
      />

      <aside
        id="table-drawer"
        className={`panel table-drawer ${isTablePanelOpen ? 'is-open' : ''}`}
        aria-hidden={!isTablePanelOpen}
      >
        <div className="table-drawer-header">
          <div>
            <p className="eyebrow">Players</p>
            <h2>Table order</h2>
          </div>

          <button
            type="button"
            className="ghost-button"
            onClick={() => onSetTablePanelOpen(false)}
          >
            Close
          </button>
        </div>

        {renderPlayerTableSection()}
      </aside>

      <aside
        id="chat-drawer"
        className={`panel chat-drawer ${isChatPanelOpen ? 'is-open' : ''}`}
        aria-hidden={!isChatPanelOpen}
      >
        <div className="table-drawer-header">
          <div>
            <p className="eyebrow">Chat</p>
            <h2>Room chat</h2>
          </div>

          <button
            type="button"
            className="ghost-button"
            onClick={() => setIsChatPanelOpen(false)}
          >
            Close
          </button>
        </div>

        <div className="chat-drawer-content">{renderChatRailContent(true)}</div>
      </aside>
    </section>
  );
}
