import { useEffect, useRef, useState } from 'react';
import { SERVER_URL } from '../config';
import type { MessageDTO } from '@tianshangchat/shared';

interface GroupedItem {
  key: string;
  kind: 'date' | 'message';
  date?: string;
  message?: MessageDTO;
}

function MessageList({
  messages,
  currentUserId,
}: {
  messages: MessageDTO[];
  currentUserId?: number | null;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const playVoice = (message: MessageDTO) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (!message.audioUrl) return;
    const audio = new Audio(`${SERVER_URL}${message.audioUrl}`);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    void audio.play();
    setPlayingId(message.id);
  };

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    return date.toLocaleDateString();
  };

  const groupedMessages: GroupedItem[] = [];
  let lastDate: string | null = null;

  messages.forEach((msg) => {
    const msgDate = new Date(msg.timestamp).toDateString();
    if (msgDate !== lastDate) {
      groupedMessages.push({ kind: 'date', date: msg.timestamp, key: `date-${msg.id}` });
      lastDate = msgDate;
    }
    groupedMessages.push({ kind: 'message', message: msg, key: String(msg.id) });
  });

  return (
    <div className="message-list" ref={listRef}>
      {groupedMessages.map((item) => {
        if (item.kind === 'date') {
          return (
            <div key={item.key} className="date-separator">
              {formatDate(item.date ?? '')}
            </div>
          );
        }

        const message = item.message as MessageDTO;
        const isOwn = message.senderId === currentUserId;

        return (
          <div key={item.key} className={`message ${isOwn ? 'own' : ''}`}>
            {message.senderAvatar ? (
              <img
                src={`${SERVER_URL}${message.senderAvatar}`}
                alt={message.senderName}
                className="message-avatar"
              />
            ) : (
              <div className="message-avatar">{message.senderName?.charAt(0).toUpperCase() || '?'}</div>
            )}
            <div className="message-content">
              {!isOwn && <div className="message-sender">{message.senderName}</div>}
              {message.type === 'voice' ? (
                <div className="voice-message">
                  <button
                    className={`voice-btn ${playingId === message.id ? 'playing' : ''}`}
                    onClick={() => playVoice(message)}
                  >
                    {playingId === message.id ? '⏸' : '▶'}
                  </button>
                  <div className="voice-wave">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.1}s` }}></div>
                    ))}
                  </div>
                  <span className="voice-duration">{message.duration}</span>
                </div>
              ) : (
                <div className="message-text">{message.content}</div>
              )}
              <div className="message-time">{formatTime(message.timestamp)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MessageList;
