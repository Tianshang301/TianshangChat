import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { SERVER_URL } from '../config';

function GroupSettingsModal({ group, currentUser, onClose, onAddMember, onRemoveMember, onSetAdmin, onTransferOwner, onLeaveGroup, onDeleteGroup }) {
  const { t } = useLanguage();
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');

  const isCreator = group.creator_id === currentUser?.id;
  const canManage = isCreator || group.role === 'admin';

  const handleAddMember = () => {
    if (newMemberId) {
      onAddMember(parseInt(newMemberId));
      setNewMemberId('');
      setShowAddMember(false);
    }
  };

  const handleTransfer = () => {
    const newOwnerId = prompt(t('enterNewOwnerId'));
    if (newOwnerId) {
      onTransferOwner(parseInt(newOwnerId));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('groupSettings')}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="settings-section">
            <h4>{t('groupInfo')}</h4>
            <p><strong>{t('groupName')}:</strong> {group.name}</p>
            <p><strong>{t('creator')}:</strong> {group.creator_name}</p>
            <p><strong>{t('members')}:</strong> {(group.members || []).length}</p>
          </div>

          <div className="settings-section">
            <h4>{t('members')}</h4>
            <div className="member-list">
              {(group.members || []).map((member) => (
                <div key={member.user_id} className="member-item">
                  <div className="member-info">
                    {member.avatar ? (
                      <img src={`${SERVER_URL}${member.avatar}`} alt="" className="member-avatar" />
                    ) : (
                      <div className="member-avatar-placeholder">{member.username?.charAt(0).toUpperCase()}</div>
                    )}
                    <span>{member.username}</span>
                    {member.role === 'creator' && <span className="role-badge owner">👑 {t('creator')}</span>}
                    {member.role === 'admin' && <span className="role-badge admin">⭐ {t('admin')}</span>}
                  </div>
                  {canManage && member.user_id !== currentUser?.id && (
                    <div className="member-actions">
                      {isCreator && member.role !== 'admin' && (
                        <button className="action-btn" onClick={() => onSetAdmin(member.user_id, true)}>
                          {t('setAdmin')}
                        </button>
                      )}
                      {isCreator && member.role === 'admin' && (
                        <button className="action-btn" onClick={() => onSetAdmin(member.user_id, false)}>
                          {t('removeAdmin')}
                        </button>
                      )}
                      <button className="action-btn danger" onClick={() => onRemoveMember(member.user_id)}>
                        {t('remove')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {showAddMember ? (
            <div className="add-member-form">
              <input
                type="number"
                className="auth-input"
                placeholder={t('enterUserId')}
                value={newMemberId}
                onChange={(e) => setNewMemberId(e.target.value)}
              />
              <button className="confirm-btn" onClick={handleAddMember}>{t('add')}</button>
              <button className="cancel-btn" onClick={() => setShowAddMember(false)}>{t('cancel')}</button>
            </div>
          ) : (
            canManage && <button className="action-btn" onClick={() => setShowAddMember(true)}>+ {t('addMember')}</button>
          )}

          <div className="settings-section danger-zone">
            {isCreator ? (
              <button className="action-btn danger" onClick={onDeleteGroup}>
                {t('deleteGroup')}
              </button>
            ) : (
              <button className="action-btn danger" onClick={onLeaveGroup}>
                {t('leaveGroup')}
              </button>
            )}
            {isCreator && (
              <button className="action-btn" onClick={handleTransfer}>
                {t('transferOwner')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GroupSettingsModal;
