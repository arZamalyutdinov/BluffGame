import { type FormEvent, useEffect, useRef, useState } from 'react';

import { MAX_CHAT_MESSAGE_LENGTH, type RoomSnapshot } from '@bluff-game/shared';

interface RoomChatProps {
  messages: RoomSnapshot['chatMessages'];
  selfPlayerId: string;
  disabled: boolean;
  isConnected: boolean;
  pendingCommand: string | null;
  onSendMessage: (text: string) => void;
}

function formatSentAt(sentAtMs: number): string {
  return new Date(sentAtMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RoomChat({
  messages,
  selfPlayerId,
  disabled,
  isConnected,
  pendingCommand,
  onSendMessage,
}: RoomChatProps) {
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const log = logRef.current;

    if (!log) {
      return;
    }

    log.scrollTop = log.scrollHeight;
  }, [messages.length]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextMessage = draft.trim();

    if (!nextMessage || disabled) {
      return;
    }

    onSendMessage(nextMessage);
    setDraft('');
  }

  return (
    <section className="side-panel-section room-chat">
      <div className="side-panel-header">
        <div>
          <h2>Room chat</h2>
          <p className="claim-helper-text">
            In-memory per room. It clears when the server restarts.
          </p>
        </div>

        <span className={isConnected ? 'pill connected' : 'pill idle'}>
          {isConnected ? 'connected' : 'offline'}
        </span>
      </div>

      <div ref={logRef} className="chat-log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-empty">
            No messages yet. Use chat for table talk and coordination.
          </div>
        ) : (
          messages.map((message) => {
            const isSelf = message.playerId === selfPlayerId;

            return (
              <article
                key={message.messageId}
                className={`chat-message ${isSelf ? 'is-self' : ''}`}
              >
                <div className="chat-message-header">
                  <strong>{isSelf ? 'You' : message.playerName}</strong>
                  <span>{formatSentAt(message.sentAtMs)}</span>
                </div>
                <p className="chat-message-body">{message.text}</p>
              </article>
            );
          })
        )}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <label className="field-label">
          Message
          <input
            className="text-input chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Say something to the room"
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
            disabled={disabled}
          />
        </label>

        <button
          type="submit"
          className="secondary-button"
          disabled={disabled || !draft.trim()}
        >
          {pendingCommand === 'sendChatMessage' ? 'Sending...' : 'Send'}
        </button>
      </form>
    </section>
  );
}
