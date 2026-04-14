import React, { useState } from 'react';
import UserAvatar from './UserAvatar';
import { useLanguage } from '../context/LanguageContext';
import { SERVER_URL } from '../config';

function Sidebar({ users = [], currentUser, onJoin, onAvatarUpdate, socket }) {
  const { t, language, setLanguage, languages, languageNames } = useLanguage();
  const [username, setUsername] = useState('');

  const handleJoin = () => {
    if (username.trim()) {
      onJoin(username.trim());
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJoin();
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>{t('appName')}</h2>
        {!currentUser ? (
          <>
            <input
              type="text"
              className="username-input"
              placeholder={t('enterName')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              maxLength={20}
            />
            <button className="join-btn" onClick={handleJoin}>
              {t('joinChat')}
            </button>
          </>
        ) : (
          <UserAvatar
            currentUser={currentUser}
            onAvatarUpdate={onAvatarUpdate}
          />
        )}
        <div className="language-selector">
          {languages.map((lang) => (
            <button
              key={lang}
              className={`lang-btn ${language === lang ? 'active' : ''}`}
              onClick={() => setLanguage(lang)}
            >
              {languageNames[lang]}
            </button>
          ))}
        </div>
      </div>
      <div className="user-list">
        <h3>{t('onlineUsers')} ({users.length})</h3>
        {users.map((user) => (
          <div key={user.id} className="user-item">
            <span className="online-indicator"></span>
            {user.avatar ? (
              <img
                src={`${SERVER_URL}${user.avatar}`}
                alt={user.username}
                className="message-avatar"
                style={{ width: 32, height: 32 }}
              />
            ) : (
              <div className="message-avatar" style={{ width: 32, height: 32 }}>
                {user.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <span>{user.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Sidebar;
