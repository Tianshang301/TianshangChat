import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import type { GroupSummary, GroupRole } from '@tianshangchat/shared';

function GroupList({
  groups,
  onGroupClick,
  onCreateGroup,
  selectedGroupId,
  unreadCounts,
}: {
  groups: GroupSummary[];
  currentUser?: unknown;
  onGroupClick: (group: GroupSummary) => void;
  onCreateGroup: () => void;
  selectedGroupId?: number | null;
  unreadCounts?: Record<number, number>;
}) {
  const { t } = useLanguage();

  const roleBadge = (role: GroupRole): React.ReactNode => {
    if (role === 'creator') return <span className="role-badge owner">👑</span>;
    if (role === 'admin') return <span className="role-badge admin">⭐</span>;
    return null;
  };

  return (
    <div className="group-list-section">
      <div className="section-header">
        <span>
          {t('myGroups')} ({groups.length})
        </span>
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
              <span className="group-members">
                {group.memberCount || 0} {t('members')}
              </span>
            </div>
            {(unreadCounts?.[group.id] ?? 0) > 0 && (
              <span className="unread-badge">{unreadCounts?.[group.id]}</span>
            )}
            {roleBadge(group.role)}
          </div>
        ))
      )}
    </div>
  );
}

export default GroupList;
