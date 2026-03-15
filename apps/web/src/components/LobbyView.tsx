import {
  CLAIM_ORDER_PRESETS,
  CLAIM_ORDER_PRESET_DESCRIPTIONS,
  CLAIM_ORDER_PRESET_LABELS,
  type ClaimOrderPreset,
  ELIMINATION_HAND_SIZE_OPTIONS,
  type RoomSnapshot,
  TURN_TIME_LIMIT_SECONDS_OPTIONS,
} from '@bluff-game/shared';

import {
  getPlayerInitials,
  getSeatToneClass,
} from '../lib/playerPresentation.js';
import {
  BotIcon,
  CardsIcon,
  CrownIcon,
  DoorIcon,
  PlayIcon,
  ReadyIcon,
  SeatsIcon,
  SignalIcon,
  TimerIcon,
} from './Icons.js';

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
  const readyCount = snapshot.players.filter((player) => player.isReady).length;

  if (!self) {
    return null;
  }

  return (
    <section className="surface-grid lobby-grid">
      <article className="hero-panel lobby-hero-panel">
        <div className="scene-chip-row">
          <span className="scene-chip scene-chip-accent">
            <SeatsIcon className="chip-icon" />
            {snapshot.players.length}/8 seated
          </span>
          <span className="scene-chip">
            <TimerIcon className="chip-icon" />
            {snapshot.settings.turnTimeLimitSeconds}s turn timer
          </span>
          <span className="scene-chip">
            <CardsIcon className="chip-icon" />
            {CLAIM_ORDER_PRESET_LABELS[snapshot.settings.claimOrderPreset]}
          </span>
        </div>

        <div className="lobby-hero-copy">
          <div>
            <p className="eyebrow">Lobby</p>
            <h1>Room {snapshot.roomCode}</h1>
          </div>

          <p className="lead">
            Seats stay fixed clockwise around the table. Everyone must ready up
            before the host can deal the opening round.
          </p>
        </div>

        <div className="action-row lobby-actions">
          <button
            type="button"
            className={self.isReady ? 'secondary-button' : 'primary-button'}
            onClick={() => onSetReady(!self.isReady)}
            disabled={controlsDisabled}
          >
            <span className="button-content">
              <ReadyIcon className="button-icon" />
              {self.isReady ? 'Mark not ready' : 'Mark ready'}
            </span>
          </button>

          {isHost ? (
            <button
              type="button"
              className="secondary-button"
              onClick={onAddBot}
              disabled={controlsDisabled || roomIsFull}
            >
              <span className="button-content">
                <BotIcon className="button-icon" />
                Add bot
              </span>
            </button>
          ) : null}

          {isHost ? (
            <button
              type="button"
              className="primary-button"
              onClick={onStartMatch}
              disabled={!everyoneReady || controlsDisabled}
            >
              <span className="button-content">
                <PlayIcon className="button-icon" />
                Start match
              </span>
            </button>
          ) : null}

          <button
            type="button"
            className="ghost-button"
            onClick={onLeaveRoom}
            disabled={controlsDisabled}
          >
            <span className="button-content">
              <DoorIcon className="button-icon" />
              Leave room
            </span>
          </button>
        </div>
      </article>

      <div className="lobby-content-grid">
        <article className="panel room-settings-panel">
          <div className="side-panel-header">
            <div>
              <p className="eyebrow">House rules</p>
              <h2>Room settings</h2>
            </div>

            <span className="pill connected">
              <SignalIcon className="status-icon" />
              {isHost ? 'Host can edit' : 'Read only'}
            </span>
          </div>

          <div className="settings-grid">
            <div className="field-label">
              <span className="field-title-with-icon">
                <CardsIcon className="field-icon" />
                Combination order
              </span>
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
                  {
                    CLAIM_ORDER_PRESET_LABELS[
                      snapshot.settings.claimOrderPreset
                    ]
                  }
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
              <span className="field-title-with-icon">
                <SeatsIcon className="field-icon" />
                Eliminate at hand size
              </span>
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
              <span className="field-title-with-icon">
                <TimerIcon className="field-icon" />
                Turn timer
              </span>
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

        <article className="panel lobby-seats-panel">
          <div className="side-panel-header">
            <div>
              <p className="eyebrow">Seat order</p>
              <h2>Players</h2>
            </div>

            <span className="pill ready">
              <ReadyIcon className="status-icon" />
              {readyCount}/{snapshot.players.length} ready
            </span>
          </div>

          <ul className="player-list lobby-player-list">
            {snapshot.players.map((player) => (
              <li
                key={player.playerId}
                className={`player-row lobby-player-row ${player.isReady ? 'player-row-ready' : ''} ${player.connectionStatus === 'connected' ? 'player-row-connected' : ''}`}
              >
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
                      {player.isBot ? ' • bot' : ''}
                    </p>
                  </div>

                  <div className="status-pills">
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
                      className={player.isReady ? 'pill ready' : 'pill idle'}
                    >
                      <ReadyIcon className="status-icon" />
                      {player.isReady ? 'ready' : 'waiting'}
                    </span>
                    <span
                      className={
                        player.connectionStatus === 'connected'
                          ? 'pill connected'
                          : 'pill idle'
                      }
                    >
                      <SignalIcon className="status-icon" />
                      {player.connectionStatus}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
