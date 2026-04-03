import type {
  EmojiClickData,
  Props as EmojiPickerProps,
} from 'emoji-picker-react';
import russianEmojiData from 'emoji-picker-react/dist/data/emojis-ru';
import {
  type ComponentType,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { MAX_CHAT_MESSAGE_LENGTH, type RoomSnapshot } from '@bluff-game/shared';

import { useLocale } from '../lib/i18n/index.js';
import { ChatIcon, EmojiIcon, SendIcon, SignalIcon } from './Icons.js';

interface RoomChatProps {
  messages: RoomSnapshot['chatMessages'];
  selfPlayerId: string;
  disabled: boolean;
  isConnected: boolean;
  pendingCommand: string | null;
  hideHeader?: boolean;
  onSendMessage: (text: string) => void;
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
  const { catalog, formatChatTime, locale, t } = useLocale();
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [EmojiPickerComponent, setEmojiPickerComponent] =
    useState<ComponentType<EmojiPickerProps> | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const latestMessageId = messages.at(-1)?.messageId;
  const pickerEmojiData = locale.startsWith('ru') ? russianEmojiData : null;

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

  useEffect(() => {
    if (!pickerOpen || EmojiPickerComponent) {
      return;
    }

    let isActive = true;

    void import('emoji-picker-react').then((module) => {
      if (isActive) {
        setEmojiPickerComponent(() => module.default);
      }
    });

    return () => {
      isActive = false;
    };
  }, [pickerOpen, EmojiPickerComponent]);

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (disabled) {
      setPickerOpen(false);
    }
  }, [disabled]);

  function insertTextAtCursor(insertedText: string) {
    const input = inputRef.current;
    const selectionStart = input?.selectionStart ?? draft.length;
    const selectionEnd = input?.selectionEnd ?? draft.length;
    const nextDraft =
      draft.slice(0, selectionStart) + insertedText + draft.slice(selectionEnd);
    const nextCaret = selectionStart + insertedText.length;

    setDraft(nextDraft);

    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleEmojiClick(emojiData: EmojiClickData) {
    insertTextAtCursor(emojiData.emoji);
  }

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
            <h2>{t('roomChat')}</h2>
          </div>

          <span className={isConnected ? 'pill connected' : 'pill idle'}>
            <SignalIcon className="status-icon" />
            {isConnected ? t('connected') : t('offline')}
          </span>
        </div>
      ) : null}

      <div ref={logRef} className="chat-log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-empty">{t('noMessagesYet')}</div>
        ) : (
          messages.map((message) => {
            const isSelf = message.playerId === selfPlayerId;

            return (
              <article
                key={message.messageId}
                className={`chat-message ${isSelf ? 'is-self' : ''} ${message.messageId === latestMessageId ? 'is-latest' : ''}`}
              >
                <div className="chat-message-header">
                  <strong>{isSelf ? t('you') : message.playerName}</strong>
                  <span>{formatChatTime(message.sentAtMs)}</span>
                </div>
                <p className="chat-message-body">{message.text}</p>
              </article>
            );
          })
        )}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <label className="field-label">
          {t('message')}
          <input
            ref={inputRef}
            className="text-input chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={catalog.chat.placeholder}
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
            disabled={disabled}
          />
        </label>

        <div className="chat-form-actions">
          <div ref={pickerRef} className="chat-emoji-shell">
            <button
              type="button"
              className="secondary-button chat-emoji-button"
              aria-label={
                pickerOpen
                  ? catalog.chat.closeEmojiPicker
                  : catalog.chat.openEmojiPicker
              }
              title={
                pickerOpen
                  ? catalog.chat.closeEmojiPicker
                  : catalog.chat.openEmojiPicker
              }
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((current) => !current)}
              disabled={disabled}
            >
              <EmojiIcon className="button-icon" />
            </button>

            {pickerOpen ? (
              <div className="chat-emoji-popover">
                {EmojiPickerComponent ? (
                  <EmojiPickerComponent
                    theme={'dark' as NonNullable<EmojiPickerProps['theme']>}
                    emojiStyle={
                      'native' as NonNullable<EmojiPickerProps['emojiStyle']>
                    }
                    lazyLoadEmojis
                    searchPlaceholder={catalog.chat.searchPlaceholder}
                    searchClearButtonLabel={catalog.chat.searchClearButtonLabel}
                    previewConfig={{
                      showPreview: true,
                      defaultCaption: catalog.chat.previewCaption,
                    }}
                    {...(pickerEmojiData ? { emojiData: pickerEmojiData } : {})}
                    onEmojiClick={handleEmojiClick}
                  />
                ) : (
                  <div className="chat-emoji-loading">
                    {catalog.chat.loadingPicker}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            className="secondary-button chat-send-button"
            disabled={disabled || !draft.trim()}
          >
            <SendIcon className="button-icon" />
            {pendingCommand === 'sendChatMessage' ? t('sending') : t('send')}
          </button>
        </div>
      </form>
    </section>
  );
}
