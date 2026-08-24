import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import type { GroupDetail } from '@tianshangchat/shared';

function JoinGroupModal({
  onClose,
  onJoinSuccess,
}: {
  onClose: () => void;
  onJoinSuccess?: (group: GroupDetail) => void;
}) {
  const { t } = useLanguage();
  const { token, serverUrl } = useAuth();
  const [groupId, setGroupId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleJoin = async () => {
    const id = parseInt(groupId);
    if (!id || id <= 0) {
      setError('Invalid group ID');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${serverUrl}/api/groups/${id}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data: unknown = await response.json();

      const d = asRecord(data);
      if (d?.['success'] === true) {
        setSuccess(t('joinSuccess') || 'Joined successfully!');
        if (onJoinSuccess) {
          onJoinSuccess(d['group'] as GroupDetail);
        }
        setTimeout(() => onClose(), 1500);
      } else {
        const msg =
          typeof data === 'object' &&
          data !== null &&
          'error' in data &&
          typeof (data as { error: unknown }).error === 'string'
            ? (data as { error: string }).error
            : 'Failed to join group';
        setError(msg);
      }
    } catch (err) {
      console.error('Join group error:', err);
      setError('Failed to join group');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleJoin();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content mobile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('joinGroup')}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>{t('enterGroupId')}</label>
            <input
              type="number"
              className="auth-input"
              placeholder={t('enterGroupId')}
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
              min="1"
            />
          </div>

          {error && <div className="search-error">{error}</div>}
          {success && <div className="search-success">{success}</div>}

          <div className="modal-footer">
            <button className="cancel-btn" onClick={onClose}>{t('cancel')}</button>
            <button className="confirm-btn" onClick={() => void handleJoin()} disabled={loading || !groupId}>
              {loading ? '...' : t('joinGroup')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function asRecord(obj: unknown): Record<string, unknown> | null {
  return typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>) : null;
}

export default JoinGroupModal;
