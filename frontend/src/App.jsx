import React, { useState, useEffect, useRef } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import ChatRoom from './components/ChatRoom';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import io from 'socket.io-client';

const API_URL = 'http://localhost:3000/api';

function AuthScreen() {
  const [authMode, setAuthMode] = useState('login');

  if (authMode === 'login') {
    return <LoginForm onSwitchToRegister={() => setAuthMode('register')} />;
  }
  return <RegisterForm onSwitchToLogin={() => setAuthMode('login')} />;
}

function ChatLayout({ currentUser, users, messages, typingUser, notifications, connectionStatus, onSendMessage, onSendVoice, onTyping, onAvatarUpdate }) {
  const { t, language, setLanguage, languages, languageNames } = useLanguage();
  const { logout } = useAuth();

  return (
    <div className="app-container">
      <div className="notifications">
        {notifications.map((n) => (
          <div key={n.id} className="notification-item">
            {n.text}
          </div>
        ))}
      </div>
      <Sidebar
        users={users}
        currentUser={currentUser}
        onAvatarUpdate={onAvatarUpdate}
      />
      <div className="main-chat">
        <div className="chat-header">
          <h1>{t('appName')}</h1>
          <div className="header-right">
            <div className="language-selector-header">
              {languages.map((lang) => (
                <button
                  key={lang}
                  className={`lang-btn-header ${language === lang ? 'active' : ''}`}
                  onClick={() => setLanguage(lang)}
                >
                  {languageNames[lang]}
                </button>
              ))}
            </div>
            <span className={`connection-dot ${connectionStatus}`}></span>
            <span className="online-count">{users.length} {t('onlineUsers').toLowerCase()}</span>
            {typingUser && (
              <span className="typing-indicator">{typingUser} {t('typing')}</span>
            )}
            <button className="logout-btn" onClick={logout}>
              {t('logout')}
            </button>
          </div>
        </div>
        <ChatRoom
          messages={messages}
          currentUser={currentUser}
          onSendMessage={onSendMessage}
          onSendVoice={onSendVoice}
          onTyping={onTyping}
        />
      </div>
    </div>
  );
}

function AppContent() {
  const { user, token, loading } = useAuth();
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (user && token) {
      const socket = io('http://localhost:3000', {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        transports: ['websocket', 'polling']
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setConnectionStatus('connected');
        socket.emit('authenticate', { token });
      });

      socket.on('disconnect', () => {
        setConnectionStatus('disconnected');
      });

      socket.on('authenticated', async (data) => {
        setCurrentUser(data.user);
        await loadHistory();
        addNotification(`${data.user.username} ${t('joinedChat')}`);
      });

      socket.on('auth-error', (data) => {
        console.error('Auth error:', data.error);
        setConnectionStatus('error');
      });

      socket.on('user-list-update', (userList) => {
        setUsers(userList);
      });

      socket.on('receive-message', (message) => {
        setMessages((prev) => [...prev, message]);
      });

      socket.on('user-typing', (data) => {
        setTypingUser(data.username);
      });

      socket.on('user-stop-typing', () => {
        setTypingUser(null);
      });

      socket.on('avatar-updated', (data) => {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === data.userId ? { ...u, avatar: data.avatar } : u
          )
        );
        if (currentUser?.id === data.userId) {
          setCurrentUser((prev) => ({ ...prev, avatar: data.avatar }));
        }
      });

      socket.on('user-left', (data) => {
        if (data.username) {
          addNotification(`${data.username} ${t('leftChat')}`);
        }
        setUsers((prev) => prev.filter((u) => u.id !== data.userId));
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user, token]);

  const loadHistory = async () => {
    if (!token) return;
    
    setLoadingHistory(true);
    try {
      const response = await fetch(`${API_URL}/messages/history?days=7&limit=500`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success && data.messages) {
        setMessages(data.messages);
        addNotification(t('historyLoaded'));
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const addNotification = (text) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3000);
  };

  const handleSendMessage = (content) => {
    if (socketRef.current && content.trim()) {
      socketRef.current.emit('send-message', { content });
    }
  };

  const handleSendVoice = (audioUrl, duration) => {
    if (socketRef.current) {
      socketRef.current.emit('send-voice', { audioUrl, duration });
    }
  };

  const handleTyping = () => {
    if (socketRef.current) {
      socketRef.current.emit('typing');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('stop-typing');
      }, 2000);
    }
  };

  const handleAvatarUpdate = (avatarUrl) => {
    if (socketRef.current) {
      socketRef.current.emit('update-avatar', avatarUrl);
    }
    setCurrentUser((prev) => ({ ...prev, avatar: avatarUrl }));
  };

  if (loading) {
    return (
      <div className="welcome-screen">
        <h1>TianshangChat</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="welcome-screen">
        <h1>{t('welcomeTitle')}</h1>
        <p>{t('welcomeSubtitle')}</p>
        <AuthScreen />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="welcome-screen">
        <h1>{t('welcomeTitle')}</h1>
        {loadingHistory && <p>{t('loadingHistory')}</p>}
        <div className={`connection-status ${connectionStatus}`}>
          {connectionStatus === 'connected' ? '🟢 ' + t('connected') : 
           connectionStatus === 'disconnected' ? '🔴 ' + t('disconnected') : 
           '🟡 ' + t('connecting')}
        </div>
      </div>
    );
  }

  return (
    <ChatLayout
      currentUser={currentUser}
      users={users}
      messages={messages}
      typingUser={typingUser}
      notifications={notifications}
      connectionStatus={connectionStatus}
      onSendMessage={handleSendMessage}
      onSendVoice={handleSendVoice}
      onTyping={handleTyping}
      onAvatarUpdate={handleAvatarUpdate}
    />
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
