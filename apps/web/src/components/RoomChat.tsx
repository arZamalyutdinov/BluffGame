import { type FormEvent, useEffect, useRef, useState } from 'react';

import { MAX_CHAT_MESSAGE_LENGTH, type RoomSnapshot } from '@bluff-game/shared';

import { ChatIcon, SendIcon, SignalIcon } from './Icons.js';

interface RoomChatProps {
  messages: RoomSnapshot['chatMessages'];
  selfPlayerId: string;
  disabled: boolean;
  isConnected: boolean;
  pendingCommand: string | null;
  hideHeader?: boolean;
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
  hideHeader = false,
  onSendMessage,
}: RoomChatProps) {
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement | null>(null);
  const latestMessageId = messages.at(-1)?.messageId;

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
      {!hideHeader ? (
        <div className="side-panel-header">
          <div className="panel-title-with-icon">
            <ChatIcon className="status-icon" />
            <h2>Room chat</h2>
          </div>

          <span className={isConnected ? 'pill connected' : 'pill idle'}>
            <SignalIcon className="status-icon" />
            {isConnected ? 'connected' : 'offline'}
          </span>
        </div>
      ) : null}

      <div ref={logRef} className="chat-log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-empty">No messages yet.</div>
        ) : (
          messages.map((message) => {
            const isSelf = message.playerId === selfPlayerId;

            return (
              <article
                key={message.messageId}
                className={`chat-message ${isSelf ? 'is-self' : ''} ${message.messageId === latestMessageId ? 'is-latest' : ''}`}
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
          className="secondary-button chat-send-button"
          disabled={disabled || !draft.trim()}
        >
          <SendIcon className="button-icon" />
          {pendingCommand === 'sendChatMessage' ? 'Sending...' : 'Send'}
        </button>
      </form>
    </section>
  );
}
