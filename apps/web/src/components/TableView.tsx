import { useEffect, useState } from 'react';

import {
  type PlayerSnapshot,
  type RoomSnapshot,
  cardToShortLabel,
  claimToLabel,
  getNextActiveSeatIndex,
} from '@bluff-game/shared';

import { ClaimComposer } from './ClaimComposer.js';
import { ClaimPreviewPanel } from './ClaimPreview.js';
import { RoomChat } from './RoomChat.js';

interface TableViewProps {
  snapshot: RoomSnapshot;
  isConnected: boolean;
  pendingCommand: string | null;
  onSubmitClaim: (claimKey: string) => void;
  onChallengeClaim: () => void;
  onSetPauseState: (paused: boolean) => void;
  onRestartMatch: () => void;
  onSendChatMessage: (text: string) => void;
}

function formatRemainingMs(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function sortPlayersForTurnOrder(snapshot: RoomSnapshot): PlayerSnapshot[] {
  const seatSortedPlayers = [...snapshot.players].sort(
    (left, right) => left.seatIndex - right.seatIndex,
  );
  const match = snapshot.match;

  if (!match) {
    return seatSortedPlayers;
  }

  const currentPlayer = seatSortedPlayers.find(
    (player) => player.playerId === match.currentTurnPlayerId,
  );
  const activePlayers = seatSortedPlayers.filter(
    (player) => !player.isEliminated,
  );

  if (!currentPlayer || activePlayers.length === 0) {
    return seatSortedPlayers;
  }

  const orderedActivePlayers: PlayerSnapshot[] = [];
  const remainingSeatIndexes = new Set(
    activePlayers.map((player) => player.seatIndex),
  );
  const playersBySeat = new Map(
    seatSortedPlayers.map((player) => [player.seatIndex, player]),
  );
  const playerStates = activePlayers.map((player) => ({
    playerId: player.playerId,
    seatIndex: player.seatIndex,
    handSize: player.handSize,
    isEliminated: player.isEliminated,
  }));
  let seatIndex = currentPlayer.seatIndex;

  while (remainingSeatIndexes.size > 0) {
    const player = playersBySeat.get(seatIndex);

    if (player && remainingSeatIndexes.has(seatIndex)) {
      orderedActivePlayers.push(player);
      remainingSeatIndexes.delete(seatIndex);
    }

    if (remainingSeatIndexes.size === 0) {
      break;
    }

    seatIndex = getNextActiveSeatIndex(playerStates, seatIndex);
  }

  const eliminatedPlayers = seatSortedPlayers.filter(
    (player) => player.isEliminated,
  );

  return [...orderedActivePlayers, ...eliminatedPlayers];
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

export function TableView({
  snapshot,
  isConnected,
  pendingCommand,
  onSubmitClaim,
  onChallengeClaim,
  onSetPauseState,
  onRestartMatch,
  onSendChatMessage,
}: TableViewProps) {
  const match = snapshot.match;
  const [nowMs, setNowMs] = useState(() => Date.now());
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

  if (!match) {
    return null;
  }

  const isMyTurn = match.currentTurnPlayerId === snapshot.selfPlayerId;
  const isHost = snapshot.hostPlayerId === snapshot.selfPlayerId;
  const playersById = new Map(
    snapshot.players.map((player) => [player.playerId, player]),
  );
  const currentPlayer = playersById.get(match.currentTurnPlayerId);
  const orderedPlayers = sortPlayersForTurnOrder(snapshot);
  const activePlayersInOrder = orderedPlayers.filter(
    (player) => !player.isEliminated,
  );
  const activeTurnPositionById = new Map(
    activePlayersInOrder.map((player, index) => [player.playerId, index]),
  );
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
          <div className="panel inset-panel">
            <h2>Your hand</h2>
            <div className="card-row">
              {match.yourHand.map((card) => (
                <div
                  key={`${card.rank}-${card.suit}`}
                  className={`playing-card suit-${card.suit}`}
                >
                  {cardToShortLabel(card)}
                </div>
              ))}
            </div>
          </div>

          <div className="panel inset-panel">
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
            />
          </div>
        </div>

        <div className="panel inset-panel">
          <h2>Claim history</h2>
          <ul className="claim-history">
            {match.claimHistory.map((entry) => (
              <li key={entry.sequenceNumber}>
                <strong>
                  {playersById.get(entry.playerId)?.name ?? 'Unknown'}:
                </strong>{' '}
                {claimToLabel(entry.claim)}
              </li>
            ))}
          </ul>
        </div>

        {showdown ? (
          <div className="showdown-panel">
            <h3>Last showdown</h3>
            <p>
              <strong>
                {playersById.get(showdown.claimantPlayerId)?.name}
              </strong>{' '}
              said <strong>{claimToLabel(showdown.spokenClaim)}</strong>.{' '}
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
          </div>
        ) : null}

        {timeout ? (
          <div className="showdown-panel">
            <h3>Last timeout</h3>
            <p>
              <strong>{playersById.get(timeout.timedOutPlayerId)?.name}</strong>{' '}
              ran out of time
              {timeout.lastClaim
                ? ` while facing ${claimToLabel(timeout.lastClaim)}`
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
          </div>
        ) : null}

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
                  onSubmit={onSubmitClaim}
                />

                {match.lastClaim ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={onChallengeClaim}
                    disabled={actionDisabled}
                  >
                    Check
                  </button>
                ) : null}
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
      </article>

      <aside className="panel table-side-panel table-side-panel-right">
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
                  {isPaused ? 'Resume clock' : 'Pause clock'}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="side-panel-section">
          <div className="side-panel-header">
            <h2>Table</h2>

            <span className="pill connected">
              {activePlayersInOrder.length} active
            </span>
          </div>

          <ul className="player-list">
            {orderedPlayers.map((player) => {
              const turnPosition = activeTurnPositionById.get(player.playerId);

              return (
                <li
                  key={player.playerId}
                  className={`player-row ${player.playerId === match.currentTurnPlayerId ? 'turn-row' : ''}`}
                >
                  <div>
                    <strong>{player.name}</strong>
                    <p className="row-meta">
                      Seat {player.seatIndex + 1}
                      {player.isHost ? ' • host' : ''}
                      {player.playerId === snapshot.selfPlayerId
                        ? ' • you'
                        : ''}
                    </p>
                  </div>

                  <div className="status-pills">
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

      <aside className="panel table-side-panel chat-side-panel">
        <RoomChat
          messages={snapshot.chatMessages}
          selfPlayerId={snapshot.selfPlayerId}
          disabled={!isConnected || pendingCommand !== null}
          isConnected={isConnected}
          pendingCommand={pendingCommand}
          onSendMessage={onSendChatMessage}
        />
      </aside>
    </section>
  );
}
