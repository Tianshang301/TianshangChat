import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';

function GroupChat({ group, messages, currentUser, onSendMessage, onSendVoice, onTyping, onOpenSettings }) {
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
      const response = await fetch('http://localhost:3000/api/upload/voice', {
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
    <div className="group-chat">
      <div className="group-chat-header">
        <div className="group-info-header">
          <span className="group-icon">👥</span>
          <div className="group-details">
            <span className="group-name">{group.name}</span>
            <span className="member-count">{(group.members || []).length} {t('members')}</span>
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
                <img src={`http://localhost:3000${msg.senderAvatar}`} alt="" className="message-avatar" />
              ) : (
                <div className="message-avatar">{msg.senderName?.charAt(0).toUpperCase()}</div>
              )
            )}
            <div className="message-content">
              {msg.senderId !== currentUser?.id && (
                <div className="message-sender">{msg.senderName}</div>
              )}
              {msg.type === 'voice' ? (
                <div className="voice-message">
                  <button className="voice-btn" onClick={() => {
                    const audio = new Audio(`http://localhost:3000${msg.audioUrl}`);
                    audio.play();
                  }}>▶</button>
                  <span>{msg.duration}</span>
                </div>
              ) : (
                <div className="message-text">{msg.content}</div>
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

export default GroupChat;
