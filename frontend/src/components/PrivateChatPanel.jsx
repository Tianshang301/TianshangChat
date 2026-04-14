import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { SERVER_URL, API_URL } from '../config';

function PrivateChatPanel({ user, messages, currentUserId, onSendMessage, onSendVoice, onTyping, onClose, typingUser }) {
  const { t } = useLanguage();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const listRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleChange = (e) => {
    setMessage(e.target.value);
    onTyping();
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadAudio(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAudio = async (blob) => {
    const formData = new FormData();
    formData.append('voice', blob, 'voice.webm');
    try {
      const response = await fetch(`${API_URL}/upload/voice`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        const duration = Math.round(blob.size / 10000);
        onSendVoice(data.url, `${duration}s`);
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
                <div className="voice-message">
                  <button className="voice-btn" onClick={() => {
                    const audio = new Audio(`${SERVER_URL}${msg.audioUrl}`);
                    audio.play();
                  }}>▶</button>
                  <span>{msg.duration}</span>
                </div>
              ) : (
                <div className="message-text">{msg.content}</div>
              )}
              <span className="message-time">{formatTime(msg.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>

      {typingUser && <div className="typing-indicator">{typingUser} {t('typing')}</div>}

      <form className="private-input-form" onSubmit={handleSubmit}>
        <button
          type="button"
          className={`icon-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
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
