import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { SERVER_URL } from '../../config';
import VoicePlayer from './VoicePlayer';
import { isEnvelope } from '@tianshangchat/crypto';
import type { StoreMessage } from '../../state/chatStore';
import type { GroupDetail, UserSummary } from '@tianshangchat/shared';

function GroupChat({
  group,
  messages,
  currentUser,
  onSendMessage,
  onSendVoice,
  onTyping,
  onOpenSettings,
}: {
  group: GroupDetail;
  messages: StoreMessage[];
  currentUser?: UserSummary | null;
  onSendMessage: (content: string) => void;
  onSendVoice: (url: string, duration: string) => void;
  onTyping: () => void;
  onOpenSettings: () => void;
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
    <div className="group-chat">
      <div className="group-chat-header">
        <div className="group-info-header">
          <span className="group-icon">👥</span>
          <div className="group-details">
            <span className="group-name">{group.name}</span>
            <span className="member-count">
              {(group.members ?? []).length} {t('members')}
            </span>
          </div>
        </div>
        <button className="settings-btn" onClick={onOpenSettings}>⚙️</button>
      </div>

      <div className="group-messages" ref={listRef}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.senderId === currentUser?.id ? 'own' : ''}`}
          >
            {msg.senderId !== currentUser?.id && (
              msg.senderAvatar ? (
                <img src={`${SERVER_URL}${msg.senderAvatar}`} alt="" className="message-avatar" />
              ) : (
                <div className="message-avatar">{msg.senderName?.charAt(0).toUpperCase()}</div>
              )
            )}
            <div className="message-content">
              {msg.senderId !== currentUser?.id && <div className="message-sender">{msg.senderName}</div>}
              {msg.type === 'voice' ? (
                <VoicePlayer audioUrl={`${SERVER_URL}${msg.audioUrl ?? ''}`} duration={msg.duration} />
              ) : (
                <div className={"message-text"}>{renderGroupText(msg)}</div>
              )}
              <div className="message-time">{formatTime(msg.timestamp)}</div>
            </div>
          </div>
        ))}
      </div>

      <form className="message-input-form" onSubmit={handleSubmit}>
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


function renderGroupText(m: StoreMessage): string {
  if (m.decrypted?.body !== undefined) return m.decrypted.body;
  if (isEnvelope(m.content)) return m.secureFailed ? '🔒 无法解密' : '🔒 解密中…';
  return m.content ?? '';
}

export default GroupChat;
