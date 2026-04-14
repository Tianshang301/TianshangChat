import React, { useEffect, useRef, useState } from 'react';
import MessageInput from './MessageInput';
import VoiceRecorder from './VoiceRecorder';
import { useLanguage } from '../context/LanguageContext';

function MessageList({ messages, currentUserId }) {
  const listRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const playVoice = (message) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    audioRef.current = new Audio(`http://localhost:3000${message.audioUrl}`);
    audioRef.current.onended = () => setPlayingId(null);
    audioRef.current.onerror = () => setPlayingId(null);
    audioRef.current.play();
    setPlayingId(message.id);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    return date.toLocaleDateString();
  };

  const groupedMessages = [];
  let lastDate = null;

  messages.forEach((msg) => {
    const msgDate = new Date(msg.timestamp).toDateString();
    if (msgDate !== lastDate) {
      groupedMessages.push({ type: 'date', date: msg.timestamp, key: `date-${msg.id}` });
      lastDate = msgDate;
    }
    groupedMessages.push({ ...msg, key: msg.id });
  });

  return (
    <div className="message-list" ref={listRef}>
      {groupedMessages.map((item) => {
        if (item.type === 'date') {
          return (
            <div key={item.key} className="date-separator">
              {formatDate(item.date)}
            </div>
          );
        }

        const message = item;
        const isOwn = message.senderId === currentUserId;

        return (
          <div
            key={message.key}
            className={`message ${isOwn ? 'own' : ''}`}
          >
            {message.senderAvatar ? (
              <img
                src={`http://localhost:3000${message.senderAvatar}`}
                alt={message.senderName}
                className="message-avatar"
              />
            ) : (
              <div className="message-avatar">
                {message.senderName?.charAt(0).toUpperCase() || '?'}
              </div>
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

function ChatRoom({ messages, currentUser, onSendMessage, onSendVoice, onTyping }) {
  const { t } = useLanguage();

  return (
    <>
      <MessageList messages={messages} currentUserId={currentUser?.id} />
      <div className="message-input-container">
        <VoiceRecorder onSendVoice={onSendVoice} />
        <MessageInput
          onSendMessage={onSendMessage}
          onTyping={onTyping}
        />
      </div>
    </>
  );
}

export default ChatRoom;
