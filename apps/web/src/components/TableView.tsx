import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type Claim,
  type PlayerSnapshot,
  type RoomSnapshot,
  cardToShortLabel,
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
import { ClaimComposer } from './ClaimComposer.js';
import { ClaimCardStack } from './ClaimPreview.js';
import {
  BotIcon,
  CardsIcon,
  CrownIcon,
  ReadyIcon,
  SignalIcon,
  TimerIcon,
} from './Icons.js';
import { PlayerAvatar } from './PlayerAvatar.js';
import { RoomChat } from './RoomChat.js';
import { RoundResolutionOverlay } from './RoundResolutionOverlay.js';

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

function buildTableSeatStyle(index: number, total: number): CSSProperties {
  const presetPositions =
    total === 2
      ? [
          { x: 0, y: 1.04 },
          { x: 0, y: -1.22 },
        ]
      : total === 3
        ? [
            { x: 0, y: 1.04 },
            { x: -1.02, y: -0.42 },
            { x: 1.02, y: -0.42 },
          ]
        : total === 4
          ? [
              { x: 0, y: 1.04 },
              { x: -1.08, y: 0.12 },
              { x: 0, y: -1.16 },
              { x: 1.08, y: 0.12 },
            ]
          : null;

  if (presetPositions?.[index]) {
    return {
      '--table-seat-x': `${presetPositions[index].x}`,
      '--table-seat-y': `${presetPositions[index].y}`,
    } as CSSProperties;
  }

  const angleInRadians =
    ((90 + (360 / Math.max(total, 1)) * index) * Math.PI) / 180;
  const offsetX = Math.cos(angleInRadians);
  const offsetY = Math.sin(angleInRadians);

  return {
    '--table-seat-x': `${offsetX}`,
    '--table-seat-y': `${offsetY}`,
  } as CSSProperties;
}

interface ResultDetailsProps {
  title: string;
  summary: string;
  children: ReactNode;
}

function ResultDetails({ title, summary, children }: ResultDetailsProps) {
  return (
    <details className="showdown-panel result-details">
      <summary className="result-summary">
        <span className="result-summary-title">{title}</span>
        <span className="result-summary-text">{summary}</span>
      </summary>

      <div className="result-details-body">{children}</div>
    </details>
  );
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
  const [isClaimTrayOpen, setIsClaimTrayOpen] = useState(false);
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
  const previousTurnPlayerIdRef = useRef<string | null>(null);
  const previousClaimSequenceRef = useRef<number | null>(null);
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
    if (!isTablePanelOpen && !isChatPanelOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onSetTablePanelOpen(false);
        setIsChatPanelOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isChatPanelOpen, isTablePanelOpen, onSetTablePanelOpen]);

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

  const yourHand = match.yourHand;

  const resolutionKey = buildResolutionKey(match);
  const activeResolution = useMemo(() => {
    if (match.showdown) {
      return {
        kind: 'showdown' as const,
        key: resolutionKey ?? 'showdown',
        data: match.showdown,
      };
    }

    if (match.timeout) {
      return {
        kind: 'timeout' as const,
        key: resolutionKey ?? 'timeout',
        data: match.timeout,
      };
    }

    return undefined;
  }, [match.showdown, match.timeout, resolutionKey]);
  const isShowingResult = match.phase === 'showing-result';
  const isResolutionOverlayOpen = Boolean(activeResolution) && isShowingResult;

  const isMyTurn = match.currentTurnPlayerId === snapshot.selfPlayerId;
  const isHost = snapshot.hostPlayerId === snapshot.selfPlayerId;
  const playersById = new Map(
    snapshot.players.map((player) => [player.playerId, player]),
  );
  const currentPlayer = playersById.get(match.currentTurnPlayerId);
  const orderedPlayers = sortPlayersBySeat(snapshot);
  const tablePlayers = rotatePlayersForTable(
    orderedPlayers,
    snapshot.selfPlayerId,
  );
  const activePlayersInOrder = orderedPlayers.filter(
    (player) => !player.isEliminated,
  );
  const claimsByPlayerId = new Map<
    string,
    Array<(typeof match.claimHistory)[number]>
  >();

  for (const entry of match.claimHistory) {
    const playerClaims = claimsByPlayerId.get(entry.playerId) ?? [];
    playerClaims.push(entry);
    claimsByPlayerId.set(entry.playerId, playerClaims);
  }

  const showdown = match.showdown;
  const timeout = match.timeout;
  const currentTurnPlayerId = match.currentTurnPlayerId;
  const winner = match.winnerPlayerId
    ? playersById.get(match.winnerPlayerId)
    : undefined;
  const lastClaimEntry = match.claimHistory.at(-1);
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
    !match.lastClaim || !isMyTurn || !!winner || actionDisabled;
  const tableStatus = winner
    ? {
        label: 'Match winner',
        title: winner.name,
        detail: 'The table is closed until the host returns to the lobby.',
      }
    : isShowingResult
      ? {
          label: 'Showdown',
          title: 'Resolving round',
          detail: 'The server is presenting the round result right now.',
        }
      : isPaused
        ? {
            label: 'Clock paused',
            title: currentPlayer?.name ?? 'Paused',
            detail: 'The host paused this turn. No moves can be made yet.',
          }
        : match.lastClaim
          ? {
              label: 'Claim to beat',
              title: claimToCompactLabel(match.lastClaim),
              detail: lastClaimEntry
                ? `Spoken by ${playersById.get(lastClaimEntry.playerId)?.name ?? 'Unknown'}.`
                : 'Raise it or check it.',
            }
          : {
              label: 'Table open',
              title: 'Opening move',
              detail: 'Any legal claim can start the round.',
            };
  const canOpenClaimTray =
    isMyTurn && !winner && !isPaused && !isShowingResult && !actionDisabled;
  const dockMessage = winner
    ? `${winner.name} won the match.`
    : isPaused
      ? 'The turn clock is paused.'
      : isShowingResult
        ? 'Round result is being shown.'
        : isMyTurn
          ? match.lastClaim
            ? 'Raise the current claim or check it.'
            : 'Open the round with any legal claim.'
          : `Waiting for ${currentPlayer?.name ?? 'the active player'} to act.`;

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
    if (!canOpenClaimTray) {
      setIsClaimTrayOpen(false);
    }
  }, [canOpenClaimTray]);

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

  function renderTableSeatRing() {
    return (
      <div className="table-seat-ring" aria-label="Table seats">
        {tablePlayers.map((player, index) => {
          const isCurrentTurn = player.playerId === currentTurnPlayerId;
          const isSelf = player.playerId === snapshot.selfPlayerId;
          const isTurnArriving = turnAnnouncement?.playerId === player.playerId;
          const seatCountLabel = player.isEliminated
            ? 'Out'
            : `${player.cardCount} ${player.cardCount === 1 ? 'card' : 'cards'}`;
          const timerTone = isCurrentTurn ? timerUrgency : undefined;
          const seatBadgeTone = isSelf
            ? 'table-seat-chip-self'
            : player.isBot
              ? 'table-seat-chip-bot'
              : player.isHost
                ? 'table-seat-chip-host'
                : null;
          const seatBadgeLabel = isSelf
            ? 'You'
            : player.isBot
              ? 'Bot'
              : player.isHost
                ? 'Host'
                : null;

          return (
            <article
              key={player.playerId}
              className={`table-seat-card ${getSeatToneClass(player.seatIndex)} ${isCurrentTurn ? 'is-current-turn' : ''} ${player.isEliminated ? 'is-eliminated' : ''} ${isTurnArriving ? 'is-turn-arriving' : ''} ${isSelf ? 'is-self-seat' : ''}`}
              style={buildTableSeatStyle(index, tablePlayers.length)}
            >
              <div className="table-seat-avatar-wrap">
                <PlayerAvatar
                  name={player.name}
                  seatIndex={player.seatIndex}
                  size={isSelf ? 'md' : 'sm'}
                  {...(isCurrentTurn && turnProgress !== undefined
                    ? {
                        timerProgress: turnProgress,
                        timerTone,
                      }
                    : {})}
                />
                <span
                  className={`table-seat-count ${player.isEliminated ? 'is-eliminated' : ''} ${isCurrentTurn ? 'is-current-turn' : ''}`}
                >
                  {player.isEliminated ? 'Out' : player.cardCount}
                </span>
              </div>

              <div className="table-seat-badge">
                <div className="table-seat-name-row">
                  <strong>{player.name}</strong>
                  {seatBadgeLabel && seatBadgeTone ? (
                    <span className={`table-seat-chip ${seatBadgeTone}`}>
                      {seatBadgeLabel}
                    </span>
                  ) : null}
                </div>
                <span className="table-seat-meta">{seatCountLabel}</span>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <section className="surface-grid match-layout">
      <article className="hero-panel match-main-panel">
        <div className="match-scene-header">
          <div className="match-copy-stack">
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

          <div className="table-utility-strip">
            <button
              type="button"
              className="ghost-button table-launcher-button"
              aria-expanded={isTablePanelOpen}
              aria-controls="table-drawer"
              onClick={() => {
                setIsChatPanelOpen(false);
                onSetTablePanelOpen(!isTablePanelOpen);
              }}
            >
              {isTablePanelOpen ? 'Hide players' : 'Show players'}
            </button>
            <button
              type="button"
              className="ghost-button chat-toggle-button"
              aria-expanded={isChatPanelOpen}
              aria-controls="chat-drawer"
              onClick={() => {
                onSetTablePanelOpen(false);
                setIsChatPanelOpen((current) => !current);
              }}
            >
              {isChatPanelOpen ? 'Hide chat' : 'Show chat'}
            </button>
            {isHost && turnTimer && !winner ? (
              <button
                type="button"
                className="ghost-button table-utility-button"
                onClick={() => onSetPauseState(!isPaused)}
                disabled={!isConnected || pendingCommand !== null}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            ) : null}
            <span className="pill ready">
              <CardsIcon className="status-icon" />
              Room {snapshot.roomCode}
            </span>
            {turnTimer && remainingMs !== null ? (
              <span
                className={`${isPaused ? 'pill idle' : 'pill connected'} timer-pill timer-pill-${timerUrgency}`}
              >
                <TimerIcon className="status-icon" />
                {isPaused ? 'paused' : formatRemainingMs(remainingMs)}
              </span>
            ) : null}
            <span className={isConnected ? 'pill connected' : 'pill idle'}>
              <SignalIcon className="status-icon" />
              {isConnected ? 'live' : 'reconnecting'}
            </span>
          </div>
        </div>

        <div
          className={`table-stage ${timerUrgency === 'warning' ? 'is-warning-clock' : ''} ${timerUrgency === 'critical' ? 'is-critical-clock' : ''}`}
        >
          <div className="table-stage-scenery" aria-hidden="true">
            <div className="table-stage-glow table-stage-glow-left" />
            <div className="table-stage-glow table-stage-glow-right" />
            <div className="table-stage-city table-stage-city-left" />
            <div className="table-stage-city table-stage-city-right" />
            <div className="table-stage-hill table-stage-hill-left" />
            <div className="table-stage-hill table-stage-hill-right" />
          </div>

          <div className="table-stage-inner">
            {turnAnnouncement ? (
              <div
                key={turnAnnouncement.token}
                className={`turn-handoff-banner ${turnAnnouncement.playerId === snapshot.selfPlayerId ? 'is-self' : ''}`}
              >
                <span className="turn-handoff-kicker">Turn handoff</span>
                <strong>
                  {turnAnnouncement.playerId === snapshot.selfPlayerId
                    ? 'Your move'
                    : `${playersById.get(turnAnnouncement.playerId)?.name ?? 'Player'} to act`}
                </strong>
              </div>
            ) : null}

            <div
              className={`table-center-status ${claimPulse && lastClaimEntry?.sequenceNumber === claimPulse.sequenceNumber ? 'is-fresh-claim' : ''}`}
            >
              <span className="table-center-status-label">
                {tableStatus.label}
              </span>
              <strong className="table-center-status-title">
                {tableStatus.title}
              </strong>
              <span className="table-center-status-detail">
                {tableStatus.detail}
              </span>
            </div>

            {renderTableSeatRing()}

            <div className="table-hand-rail" aria-label="Your hand">
              <ClaimCardStack cards={sortCardsDescending(yourHand)} />
            </div>
          </div>
        </div>

        <div
          className={`table-action-stack ${canOpenClaimTray && isClaimTrayOpen ? 'has-open-tray' : ''}`}
        >
          <div className="table-action-note">{dockMessage}</div>

          {!isClaimTrayOpen && selectedComposerClaim ? (
            <div className="table-selected-claim-pill">
              Selected claim: {claimToCompactLabel(selectedComposerClaim)}
            </div>
          ) : null}

          {winner ? (
            <div className="table-action-dock">
              {isHost ? (
                <button
                  type="button"
                  className="table-action-button table-action-button-primary table-action-button-wide"
                  onClick={onRestartMatch}
                >
                  Return to lobby
                </button>
              ) : (
                <div className="table-action-placeholder">
                  Waiting for the host to return to the lobby.
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="table-action-zone">
                <div className="table-action-dock">
                  <button
                    type="button"
                    className={`table-action-button table-action-button-primary ${isClaimTrayOpen ? 'is-open' : ''}`}
                    onClick={() => setIsClaimTrayOpen((current) => !current)}
                    disabled={!canOpenClaimTray}
                  >
                    {isClaimTrayOpen
                      ? 'Hide claim'
                      : selectedComposerClaim
                        ? 'Edit claim'
                        : match.lastClaim
                          ? 'Build claim'
                          : 'Open claim'}
                  </button>

                  <button
                    type="button"
                    className="table-action-button table-action-button-check"
                    onClick={onChallengeClaim}
                    disabled={checkDisabled}
                  >
                    Check
                  </button>
                </div>

                {canOpenClaimTray && isClaimTrayOpen ? (
                  <div className="claim-tray-shell">
                    <div className="claim-tray-header">
                      <div>
                        <p className="eyebrow">Claim tray</p>
                        <h2>Pick a claim</h2>
                      </div>

                      <button
                        type="button"
                        className="ghost-button table-utility-button"
                        onClick={() => setIsClaimTrayOpen(false)}
                      >
                        Close
                      </button>
                    </div>

                    <ClaimComposer
                      claimOrderPreset={snapshot.settings.claimOrderPreset}
                      disabled={actionDisabled}
                      {...(match.lastClaim
                        ? { lastClaim: match.lastClaim }
                        : {})}
                      onSelectedClaimChange={setSelectedComposerClaim}
                      onSubmit={(claimKey) => {
                        setIsClaimTrayOpen(false);
                        onSubmitClaim(claimKey);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        {!isResolutionOverlayOpen && showdown ? (
          <ResultDetails
            title="Last showdown"
            summary={
              showdown.claimWasValid
                ? `${playersById.get(showdown.challengerPlayerId)?.name ?? 'The challenger'} lost on ${claimToCompactLabel(showdown.spokenClaim)}`
                : `${playersById.get(showdown.claimantPlayerId)?.name ?? 'The claimant'} bluffed ${claimToCompactLabel(showdown.spokenClaim)}`
            }
          >
            <p>
              <strong>
                {playersById.get(showdown.claimantPlayerId)?.name}
              </strong>{' '}
              said <strong>{claimToCompactLabel(showdown.spokenClaim)}</strong>.{' '}
              {showdown.claimWasValid
                ? `${playersById.get(showdown.challengerPlayerId)?.name} lost the challenge.`
                : `${playersById.get(showdown.claimantPlayerId)?.name} was bluffing.`}
            </p>
            <p>
              Loser:{' '}
              <strong>{playersById.get(showdown.loserPlayerId)?.name}</strong>
              {showdown.loserEliminated
                ? ' and they were eliminated.'
                : `, next hand size ${showdown.loserHandSize}.`}
            </p>

            <div className="revealed-hands">
              {showdown.revealedHands.map((hand) => (
                <div key={hand.playerId} className="revealed-hand">
                  <strong>{playersById.get(hand.playerId)?.name}</strong>
                  <div className="card-row compact-row">
                    {sortCardsDescending(hand.cards).map((card) => (
                      <span
                        key={`${hand.playerId}-${card.rank}-${card.suit}`}
                        className={`mini-card suit-${card.suit}`}
                      >
                        {cardToShortLabel(card)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ResultDetails>
        ) : null}

        {!isResolutionOverlayOpen && timeout ? (
          <ResultDetails
            title="Last timeout"
            summary={`${playersById.get(timeout.timedOutPlayerId)?.name ?? 'A player'} ran out of time`}
          >
            <p>
              <strong>{playersById.get(timeout.timedOutPlayerId)?.name}</strong>{' '}
              ran out of time
              {timeout.lastClaim
                ? ` while facing ${claimToCompactLabel(timeout.lastClaim)}`
                : ' before making the opening claim'}
              .
            </p>
            <p>
              Loss applied:
              {timeout.loserEliminated
                ? ' they were eliminated.'
                : ` next hand size ${timeout.loserHandSize}.`}
            </p>

            <div className="revealed-hands">
              {timeout.revealedHands.map((hand) => (
                <div key={hand.playerId} className="revealed-hand">
                  <strong>{playersById.get(hand.playerId)?.name}</strong>
                  <div className="card-row compact-row">
                    {sortCardsDescending(hand.cards).map((card) => (
                      <span
                        key={`${hand.playerId}-${card.rank}-${card.suit}`}
                        className={`mini-card suit-${card.suit}`}
                      >
                        {cardToShortLabel(card)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ResultDetails>
        ) : null}
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

      {activeResolution && isResolutionOverlayOpen ? (
        <RoundResolutionOverlay
          result={activeResolution}
          players={snapshot.players}
        />
      ) : null}
    </section>
  );
}
