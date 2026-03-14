import {
  CLAIM_ORDER_PRESETS,
  CLAIM_ORDER_PRESET_DESCRIPTIONS,
  CLAIM_ORDER_PRESET_LABELS,
  type ClaimOrderPreset,
  ELIMINATION_HAND_SIZE_OPTIONS,
  type RoomSnapshot,
  TURN_TIME_LIMIT_SECONDS_OPTIONS,
} from '@bluff-game/shared';

interface LobbyViewProps {
  snapshot: RoomSnapshot;
  isConnected: boolean;
  pendingCommand: string | null;
  onSetReady: (ready: boolean) => void;
  onAddBot: () => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
  onUpdateSettings: (settings: RoomSnapshot['settings']) => void;
}

export function LobbyView({
  snapshot,
  isConnected,
  pendingCommand,
  onSetReady,
  onAddBot,
  onStartMatch,
  onLeaveRoom,
  onUpdateSettings,
}: LobbyViewProps) {
  const self = snapshot.players.find(
    (player) => player.playerId === snapshot.selfPlayerId,
  );
  const everyoneReady =
    snapshot.players.length >= 2 &&
    snapshot.players.every((player) => player.isReady);
  const isHost = snapshot.hostPlayerId === snapshot.selfPlayerId;
  const controlsDisabled = !isConnected || pendingCommand !== null;
  const roomIsFull = snapshot.players.length >= 8;

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
            disabled={controlsDisabled}
          >
            {self.isReady ? 'Mark not ready' : 'Mark ready'}
          </button>

          {isHost ? (
            <button
              type="button"
              className="secondary-button"
              onClick={onAddBot}
              disabled={controlsDisabled || roomIsFull}
            >
              Add bot
            </button>
          ) : null}

          {isHost ? (
            <button
              type="button"
              className="primary-button"
              onClick={onStartMatch}
              disabled={!everyoneReady || controlsDisabled}
            >
              Start match
            </button>
          ) : null}

          <button
            type="button"
            className="ghost-button"
            onClick={onLeaveRoom}
            disabled={controlsDisabled}
          >
            Leave room
          </button>
        </div>
      </article>

      <article className="panel">
        <h2>Room settings</h2>
        <div className="settings-grid">
          <div className="field-label">
            Combination order
            {isHost ? (
              <select
                className="text-input"
                value={snapshot.settings.claimOrderPreset}
                disabled={controlsDisabled}
                onChange={(event) =>
                  onUpdateSettings({
                    ...snapshot.settings,
                    claimOrderPreset: event.target.value as ClaimOrderPreset,
                  })
                }
              >
                {CLAIM_ORDER_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {CLAIM_ORDER_PRESET_LABELS[preset]}
                  </option>
                ))}
              </select>
            ) : (
              <div className="settings-value">
                {CLAIM_ORDER_PRESET_LABELS[snapshot.settings.claimOrderPreset]}
              </div>
            )}
          </div>

          <p className="claim-helper-text">
            {
              CLAIM_ORDER_PRESET_DESCRIPTIONS[
                snapshot.settings.claimOrderPreset
              ]
            }
          </p>

          <div className="field-label">
            Eliminate at hand size
            {isHost ? (
              <select
                className="text-input"
                value={snapshot.settings.eliminationHandSize}
                disabled={controlsDisabled}
                onChange={(event) =>
                  onUpdateSettings({
                    ...snapshot.settings,
                    eliminationHandSize: Number(event.target.value),
                  })
                }
              >
                {ELIMINATION_HAND_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} cards
                  </option>
                ))}
              </select>
            ) : (
              <div className="settings-value">
                {snapshot.settings.eliminationHandSize} cards
              </div>
            )}
          </div>

          <p className="claim-helper-text">
            A player who loses while already holding this many cards is
            eliminated instead of drawing more. Changing settings resets ready
            states.
          </p>

          <div className="field-label">
            Turn timer
            {isHost ? (
              <select
                className="text-input"
                value={snapshot.settings.turnTimeLimitSeconds}
                disabled={controlsDisabled}
                onChange={(event) =>
                  onUpdateSettings({
                    ...snapshot.settings,
                    turnTimeLimitSeconds: Number(event.target.value),
                  })
                }
              >
                {TURN_TIME_LIMIT_SECONDS_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds} seconds
                  </option>
                ))}
              </select>
            ) : (
              <div className="settings-value">
                {snapshot.settings.turnTimeLimitSeconds} seconds
              </div>
            )}
          </div>

          <p className="claim-helper-text">
            If the active player runs out of time, they automatically lose the
            round. The host can pause and resume the live turn clock during a
            match.
          </p>
        </div>
      </article>

      <article className="panel">
        <h2>Players</h2>
        <ul className="player-list">
          {snapshot.players.map((player) => (
            <li key={player.playerId} className="player-row">
              <div>
                <div className="player-name-row">
                  <strong>{player.name}</strong>
                  {player.isHost ? (
                    <span className="host-star" aria-label="Host">
                      ★
                    </span>
                  ) : null}
                </div>
                <p className="row-meta">
                  Seat {player.seatIndex + 1}
                  {player.playerId === snapshot.selfPlayerId ? ' • you' : ''}
                </p>
              </div>

              <div className="status-pills">
                {player.isBot ? <span className="pill bot">bot</span> : null}
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
