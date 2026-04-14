import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { SERVER_URL } from '../config';

function UserList({ users, currentUser, onUserClick, unreadCounts }) {
  const { t } = useLanguage();
  const otherUsers = users.filter(u => u.id !== currentUser?.id);

  return (
    <div className="user-list-section">
      <div className="section-header">
        <span>{t('onlineUsers')} ({otherUsers.length})</span>
      </div>
      {otherUsers.length === 0 ? (
        <div className="empty-list">{t('noOnlineUsers')}</div>
      ) : (
        otherUsers.map((user) => (
          <div 
            key={user.id} 
            className="user-item clickable"
            onClick={() => onUserClick(user)}
          >
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
            <span className="user-name">{user.username}</span>
            {unreadCounts?.[user.id] > 0 && (
              <span className="unread-badge">{unreadCounts[user.id]}</span>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default UserList;
