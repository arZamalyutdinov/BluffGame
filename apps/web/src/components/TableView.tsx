import { type ReactNode, useEffect, useState } from 'react';

import {
  type Claim,
  type PlayerSnapshot,
  type RoomSnapshot,
  cardToShortLabel,
  claimToCompactLabel,
  claimToLabel,
} from '@bluff-game/shared';

import { claimToIllustrationCards } from '../lib/claimVisuals.js';
import { ClaimComposer } from './ClaimComposer.js';
import { ClaimCardStack, ClaimPreviewPanel } from './ClaimPreview.js';
import { RoomChat } from './RoomChat.js';

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

function buildActiveTurnPositionById(
  players: PlayerSnapshot[],
  currentTurnPlayerId: string,
): Map<string, number> {
  const activePlayers = players.filter((player) => !player.isEliminated);
  const currentPosition = activePlayers.findIndex(
    (player) => player.playerId === currentTurnPlayerId,
  );
  const positions = new Map<string, number>();

  if (currentPosition === -1) {
    return positions;
  }

  for (let index = 0; index < activePlayers.length; index += 1) {
    const player =
      activePlayers[(currentPosition + index) % activePlayers.length];

    if (player) {
      positions.set(player.playerId, index);
    }
  }

  return positions;
}

function getTurnOrderLabel(position: number | undefined): string {
  if (position === undefined) {
    return 'out';
  }

  if (position === 0) {
    return 'acting now';
  }

  if (position === 1) {
    return 'up next';
  }

  return `order ${position + 1}`;
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
  const [selectedComposerClaim, setSelectedComposerClaim] = useState<
    Claim | undefined
  >(undefined);
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

  const isMyTurn = match.currentTurnPlayerId === snapshot.selfPlayerId;
  const isHost = snapshot.hostPlayerId === snapshot.selfPlayerId;
  const playersById = new Map(
    snapshot.players.map((player) => [player.playerId, player]),
  );
  const currentPlayer = playersById.get(match.currentTurnPlayerId);
  const orderedPlayers = sortPlayersBySeat(snapshot);
  const activePlayersInOrder = orderedPlayers.filter(
    (player) => !player.isEliminated,
  );
  const activeTurnPositionById = buildActiveTurnPositionById(
    orderedPlayers,
    match.currentTurnPlayerId,
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
  const winner = match.winnerPlayerId
    ? playersById.get(match.winnerPlayerId)
    : undefined;
  const lastClaimEntry = match.claimHistory.at(-1);
  const remainingMs = turnTimer
    ? turnTimer.isPaused || turnTimer.deadlineAtMs === undefined
      ? turnTimer.remainingMs
      : Math.max(0, turnTimer.deadlineAtMs - nowMs)
    : null;
  const isPaused = turnTimer?.isPaused ?? false;
  const actionDisabled =
    !isConnected || pendingCommand !== null || isPaused || remainingMs === 0;
  const checkDisabled =
    !match.lastClaim || !isMyTurn || !!winner || actionDisabled;
  const selectedClaimEmptyState = winner
    ? {
        title: 'No active move',
        text: 'The match is over.',
      }
    : isPaused
      ? {
          title: 'Claim selection paused',
          text: 'The host has paused the active turn.',
        }
      : isMyTurn
        ? {
            title: 'Pick a claim',
            text: 'Choose a category below, then tune the exact hand.',
          }
        : {
            title: 'Waiting for your turn',
            text: 'Your next move will appear here once the turn comes around.',
          };

  function renderChatRailContent(hideChatHeader = false) {
    return (
      <>
        {turnTimer && remainingMs !== null && !winner ? (
          <section className="side-panel-section side-panel-card turn-timer-panel turn-timer-side-panel">
            <div className="turn-timer-header">
              <h2>Turn clock</h2>
            </div>

            <div className={`turn-timer-value ${isPaused ? 'is-paused' : ''}`}>
              {formatRemainingMs(remainingMs)}
            </div>

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

  return (
    <section className="surface-grid match-layout">
      <article className="hero-panel match-main-panel">
        <div className="table-headline">
          <div>
            <p className="eyebrow">Match</p>
            <h1>Round {match.roundNumber}</h1>
            <p className="lead">
              {winner
                ? `${winner.name} won the match.`
                : isPaused
                  ? `Paused on ${currentPlayer?.name ?? 'the active player'}.`
                  : isMyTurn
                    ? 'Your turn.'
                    : `${currentPlayer?.name ?? 'Another player'} is acting.`}
            </p>
          </div>

          <div className="status-pills">
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
              {isTablePanelOpen ? 'Hide table' : 'Show table'}
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
            <span className="pill ready">Room {snapshot.roomCode}</span>
            {turnTimer && remainingMs !== null ? (
              <span className={isPaused ? 'pill idle' : 'pill connected'}>
                {isPaused ? 'paused' : formatRemainingMs(remainingMs)}
              </span>
            ) : null}
            <span className={isConnected ? 'pill connected' : 'pill idle'}>
              {isConnected ? 'live' : 'reconnecting'}
            </span>
          </div>
        </div>

        <div className="table-grid">
          <section className="claim-visual-panel hand-preview-panel">
            <div className="claim-panel-header">
              <p className="claim-panel-label">Your hand</p>
            </div>
            <div className="claim-panel-stack-area">
              <ClaimCardStack cards={match.yourHand} />
            </div>
          </section>

          <ClaimPreviewPanel
            label="Selected claim"
            claim={selectedComposerClaim}
            emptyTitle={selectedClaimEmptyState.title}
            emptyText={selectedClaimEmptyState.text}
            helperText={
              selectedComposerClaim && match.lastClaim
                ? `Must beat ${claimToCompactLabel(match.lastClaim)}.`
                : undefined
            }
            className="claim-selection-panel"
          />

          <div className="claim-to-beat-column">
            <ClaimPreviewPanel
              label="Claim to beat"
              claim={match.lastClaim}
              emptyTitle="Opening move"
              emptyText="No claim is on the table yet. The starter can open with any legal claim."
              helperText={
                lastClaimEntry
                  ? `Last spoken by ${playersById.get(lastClaimEntry.playerId)?.name ?? 'Unknown'}.`
                  : undefined
              }
              className="claim-to-beat-panel"
            />

            <div className="claim-side-action claim-check-action">
              <button
                type="button"
                className="secondary-button check-action-button"
                onClick={onChallengeClaim}
                disabled={checkDisabled}
              >
                Check
              </button>
            </div>
          </div>
        </div>

        {!winner ? (
          <div className="action-column">
            {isPaused ? (
              <div className="muted-panel">
                Game paused. Waiting for the host to resume the current turn.
              </div>
            ) : isMyTurn ? (
              <>
                <ClaimComposer
                  claimOrderPreset={snapshot.settings.claimOrderPreset}
                  disabled={actionDisabled}
                  {...(match.lastClaim ? { lastClaim: match.lastClaim } : {})}
                  onSelectedClaimChange={setSelectedComposerClaim}
                  onSubmit={onSubmitClaim}
                />
              </>
            ) : (
              <div className="muted-panel">
                Waiting for {currentPlayer?.name ?? 'the active player'} to make
                a move.
              </div>
            )}
          </div>
        ) : (
          <div className="action-row">
            {isHost ? (
              <button
                type="button"
                className="primary-button"
                onClick={onRestartMatch}
              >
                Return to lobby
              </button>
            ) : null}
          </div>
        )}

        {showdown ? (
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
                    {hand.cards.map((card) => (
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

        {timeout ? (
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
                    {hand.cards.map((card) => (
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

      <aside className="panel table-side-panel chat-side-panel">
        {renderChatRailContent()}
      </aside>

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
            <p className="eyebrow">Table</p>
            <h2>Round order</h2>
          </div>

          <button
            type="button"
            className="ghost-button"
            onClick={() => onSetTablePanelOpen(false)}
          >
            Close
          </button>
        </div>

        <section className="side-panel-section">
          <div className="side-panel-header">
            <h2>Players</h2>

            <span className="pill connected">
              {activePlayersInOrder.length} active
            </span>
          </div>

          <ul className="player-list">
            {orderedPlayers.map((player) => {
              const turnPosition = activeTurnPositionById.get(player.playerId);
              const playerClaims = claimsByPlayerId.get(player.playerId) ?? [];

              return (
                <li
                  key={player.playerId}
                  className={`player-row ${player.playerId === match.currentTurnPlayerId ? 'turn-row' : ''}`}
                >
                  <div className="player-primary">
                    <div className="player-name-row">
                      <strong>{player.name}</strong>
                      {player.isHost ? (
                        <span className="host-star" aria-label="Host">
                          ★
                        </span>
                      ) : null}
                    </div>

                    {player.playerId === snapshot.selfPlayerId ? (
                      <p className="row-meta">you</p>
                    ) : null}

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
                    ) : null}
                  </div>

                  <div className="status-pills player-status-pills">
                    <span
                      className={
                        turnPosition === 0 && !player.isEliminated
                          ? 'pill connected'
                          : 'pill idle'
                      }
                    >
                      {getTurnOrderLabel(turnPosition)}
                    </span>
                    <span
                      className={
                        player.isEliminated ? 'pill idle' : 'pill ready'
                      }
                    >
                      {player.isEliminated
                        ? 'out'
                        : `${player.cardCount} dealt`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
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
