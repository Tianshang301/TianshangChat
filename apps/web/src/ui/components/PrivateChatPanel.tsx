import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { SERVER_URL } from '../../config';
import VoicePlayer from './VoicePlayer';
import type { MessageDTO } from '@tianshangchat/shared';

interface ChatPartner {
  id: number;
  username: string;
  avatar: string | null;
}

function PrivateChatPanel({
  user,
  messages,
  currentUserId,
  onSendMessage,
  onSendVoice,
  onTyping,
  onClose,
  typingUser,
}: {
  user: ChatPartner;
  messages: MessageDTO[];
  currentUserId?: number | null;
  onSendMessage: (content: string) => void;
  onSendVoice: (url: string, duration: string) => void;
  onTyping: () => void;
  onClose: () => void;
  typingUser?: string | null;
}) {
  const { t } = useLanguage();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    onTyping();
  };

  const formatTime = (timestamp: string): string =>
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadAudio(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const uploadAudio = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('voice', blob, 'voice.webm');
    try {
      const response = await fetch(`${SERVER_URL}/api/upload/voice`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      });
      const data: unknown = await response.json();
      if (
        typeof data === 'object' &&
        data !== null &&
        'success' in data &&
        (data as { success: boolean }).success &&
        'url' in data &&
        typeof (data as { url: unknown }).url === 'string'
      ) {
        const duration = Math.round(blob.size / 10000);
        onSendVoice((data as { url: string }).url, `${duration}s`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div className="private-chat-panel">
      <div className="panel-header">
        <div className="user-info-header">
          {user.avatar ? (
            <img src={`${SERVER_URL}${user.avatar}`} alt="" className="panel-avatar" />
          ) : (
            <div className="panel-avatar-placeholder">{user.username?.charAt(0).toUpperCase()}</div>
          )}
          <span className="panel-username">{user.username}</span>
        </div>
        <button className="close-panel-btn" onClick={onClose}>×</button>
      </div>

      <div className="private-messages" ref={listRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`private-message ${msg.senderId === currentUserId ? 'sent' : 'received'}`}
          >
            <div className="message-bubble">
              {msg.type === 'voice' ? (
                <VoicePlayer audioUrl={`${SERVER_URL}${msg.audioUrl ?? ''}`} duration={msg.duration} />
              ) : (
                <div className="message-text">{msg.content}</div>
              )}
              <span className="message-time">{formatTime(msg.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>

      {typingUser && (
        <div className="typing-indicator">
          {typingUser} {t('typing')}
        </div>
      )}

      <form className="private-input-form" onSubmit={handleSubmit}>
        <button
          type="button"
          className={`icon-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopRecording : () => void startRecording()}
        >
          {isRecording ? '⏹' : '🎤'}
        </button>
        <input
          type="text"
          className="message-input"
          placeholder={t('placeholder')}
          value={message}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
        />
        <button type="submit" className="send-btn" disabled={!message.trim()}>
          {t('send')}
        </button>
      </form>
    </div>
  );
}

export default PrivateChatPanel;
