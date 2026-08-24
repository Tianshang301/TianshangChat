import React from 'react';
import { useLanguage } from '../context/LanguageContext';

function GroupList({ groups, currentUser, onGroupClick, onCreateGroup, selectedGroupId, unreadCounts }) {
  const { t } = useLanguage();

  return (
    <div className="group-list-section">
      <div className="section-header">
        <span>{t('myGroups')} ({groups.length})</span>
        <button className="add-btn" onClick={onCreateGroup} title={t('createGroup')}>
          +
        </button>
      </div>
      {groups.length === 0 ? (
        <div className="empty-list">
          {t('noGroups')}
          <button className="create-group-btn" onClick={onCreateGroup}>
            {t('createGroup')}
          </button>
        </div>
      ) : (
        groups.map((group) => (
          <div 
            key={group.id} 
            className={`group-item clickable ${selectedGroupId === group.id ? 'active' : ''}`}
            onClick={() => onGroupClick(group)}
          >
            <span className="group-icon">👥</span>
            <div className="group-info">
              <span className="group-name">{group.name}</span>
              <span className="group-members">{group.member_count || 0} {t('members')}</span>
            </div>
            {unreadCounts?.[group.id] > 0 && (
              <span className="unread-badge">{unreadCounts[group.id]}</span>
            )}
            {group.role === 'creator' && <span className="role-badge owner">👑</span>}
            {group.role === 'admin' && <span className="role-badge admin">⭐</span>}
          </div>
        ))
      )}
    </div>
  );
}

export default GroupList;
