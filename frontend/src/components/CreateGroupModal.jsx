import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

function CreateGroupModal({ users, currentUser, onClose, onCreate }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);

  const otherUsers = users.filter(u => u.id !== currentUser?.id);

  const toggleUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = () => {
    if (name.trim()) {
      onCreate(name, selectedUsers);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('createGroup')}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>{t('groupName')}</label>
            <input
              type="text"
              className="auth-input"
              placeholder={t('enterGroupName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
          </div>
          <div className="form-group">
            <label>{t('selectMembers')}</label>
            <div className="user-select-list">
              {otherUsers.map((user) => (
                <div 
                  key={user.id}
                  className={`user-select-item ${selectedUsers.includes(user.id) ? 'selected' : ''}`}
                  onClick={() => toggleUser(user.id)}
                >
                  {user.avatar ? (
                    <img src={`http://localhost:3000${user.avatar}`} alt="" className="select-avatar" />
                  ) : (
                    <div className="select-avatar-placeholder">{user.username?.charAt(0).toUpperCase()}</div>
                  )}
                  <span>{user.username}</span>
                  {selectedUsers.includes(user.id) && <span className="check-mark">✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>{t('cancel')}</button>
          <button className="confirm-btn" onClick={handleCreate} disabled={!name.trim()}>
            {t('create')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateGroupModal;
