import {
  type RoomSnapshot,
  cardToShortLabel,
  claimToLabel,
} from '@bluff-game/shared';

import { ClaimComposer } from './ClaimComposer.js';

interface TableViewProps {
  snapshot: RoomSnapshot;
  isConnected: boolean;
  pendingCommand: string | null;
  onSubmitClaim: (claimKey: string) => void;
  onChallengeClaim: () => void;
  onRestartMatch: () => void;
}

export function TableView({
  snapshot,
  isConnected,
  pendingCommand,
  onSubmitClaim,
  onChallengeClaim,
  onRestartMatch,
}: TableViewProps) {
  const match = snapshot.match;

  if (!match) {
    return null;
  }

  const isMyTurn = match.currentTurnPlayerId === snapshot.selfPlayerId;
  const playersById = new Map(
    snapshot.players.map((player) => [player.playerId, player]),
  );
  const currentPlayer = playersById.get(match.currentTurnPlayerId);
  const showdown = match.showdown;
  const winner = match.winnerPlayerId
    ? playersById.get(match.winnerPlayerId)
    : undefined;

  return (
    <section className="surface-grid">
      <article className="hero-panel">
        <div className="table-headline">
          <div>
            <p className="eyebrow">Match</p>
            <h1>Round {match.roundNumber}</h1>
            <p className="lead">
              {winner
                ? `${winner.name} won the match.`
                : isMyTurn
                  ? 'Your turn.'
                  : `${currentPlayer?.name ?? 'Another player'} is acting.`}
            </p>
          </div>

          <div className="status-pills">
            <span className="pill ready">Room {snapshot.roomCode}</span>
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
            <h2>Claim stack</h2>
            <p className="claim-line">
              Last claim:{' '}
              <strong>
                {match.lastClaim ? claimToLabel(match.lastClaim) : 'none yet'}
              </strong>
            </p>

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
        </div>

        {!winner ? (
          <div className="action-column">
            {isMyTurn ? (
              <>
                <ClaimComposer
                  disabled={!isConnected || pendingCommand !== null}
                  {...(match.lastClaim ? { lastClaim: match.lastClaim } : {})}
                  onSubmit={onSubmitClaim}
                />

                {match.lastClaim ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={onChallengeClaim}
                    disabled={!isConnected || pendingCommand !== null}
                  >
                    Challenge claim
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
            {snapshot.hostPlayerId === snapshot.selfPlayerId ? (
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

      <article className="panel">
        <h2>Table</h2>
        <ul className="player-list">
          {snapshot.players.map((player) => (
            <li
              key={player.playerId}
              className={`player-row ${player.playerId === match.currentTurnPlayerId ? 'turn-row' : ''}`}
            >
              <div>
                <strong>{player.name}</strong>
                <p className="row-meta">
                  Seat {player.seatIndex + 1}
                  {player.playerId === snapshot.selfPlayerId ? ' • you' : ''}
                  {player.isEliminated ? ' • eliminated' : ''}
                </p>
              </div>

              <div className="status-pills">
                <span className="pill idle">{player.handSize} card hand</span>
                <span
                  className={player.isEliminated ? 'pill idle' : 'pill ready'}
                >
                  {player.isEliminated ? 'out' : `${player.cardCount} dealt`}
                </span>
              </div>
            </li>
          ))}
        </ul>

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
      </article>
    </section>
  );
}
