import type { RoomSnapshot } from '@bluff-game/shared';

interface LobbyViewProps {
  snapshot: RoomSnapshot;
  isConnected: boolean;
  onSetReady: (ready: boolean) => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

export function LobbyView({
  snapshot,
  isConnected,
  onSetReady,
  onStartMatch,
  onLeaveRoom,
}: LobbyViewProps) {
  const self = snapshot.players.find(
    (player) => player.playerId === snapshot.selfPlayerId,
  );
  const everyoneReady =
    snapshot.players.length >= 2 &&
    snapshot.players.every((player) => player.isReady);

  if (!self) {
    return null;
  }

  return (
    <section className="surface-grid">
      <article className="hero-panel">
        <div>
          <p className="eyebrow">Lobby</p>
          <h1>Room {snapshot.roomCode}</h1>
          <p className="lead">
            Seats are fixed clockwise. Everyone must ready up before the host
            can start the first round.
          </p>
        </div>

        <div className="action-row">
          <button
            type="button"
            className={self.isReady ? 'secondary-button' : 'primary-button'}
            onClick={() => onSetReady(!self.isReady)}
            disabled={!isConnected}
          >
            {self.isReady ? 'Mark not ready' : 'Mark ready'}
          </button>

          {snapshot.hostPlayerId === snapshot.selfPlayerId ? (
            <button
              type="button"
              className="primary-button"
              onClick={onStartMatch}
              disabled={!everyoneReady || !isConnected}
            >
              Start match
            </button>
          ) : null}

          <button type="button" className="ghost-button" onClick={onLeaveRoom}>
            Leave room
          </button>
        </div>
      </article>

      <article className="panel">
        <h2>Players</h2>
        <ul className="player-list">
          {snapshot.players.map((player) => (
            <li key={player.playerId} className="player-row">
              <div>
                <strong>{player.name}</strong>
                <p className="row-meta">
                  Seat {player.seatIndex + 1}
                  {player.isHost ? ' • host' : ''}
                  {player.playerId === snapshot.selfPlayerId ? ' • you' : ''}
                </p>
              </div>

              <div className="status-pills">
                <span className={player.isReady ? 'pill ready' : 'pill idle'}>
                  {player.isReady ? 'ready' : 'waiting'}
                </span>
                <span
                  className={
                    player.connectionStatus === 'connected'
                      ? 'pill connected'
                      : 'pill idle'
                  }
                >
                  {player.connectionStatus}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
