import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

function UserSearchModal({ onClose, onSelectUser }) {
  const { t } = useLanguage();
  const { token, serverUrl } = useAuth();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchUsers = async () => {
    if (query.length < 1) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${serverUrl}/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.users);
        if (data.users.length === 0) {
          setError(t('userNotFound') || 'No users found');
        }
      } else {
        setError(data.error || 'Search failed');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchUsers();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content mobile-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('searchUser')}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="search-input-container">
            <input
              type="text"
              className="auth-input"
              placeholder={t('enterUsername')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
            />
            <button className="search-btn" onClick={searchUsers} disabled={loading}>
              {loading ? '...' : '🔍'}
            </button>
          </div>
          
          {error && <div className="search-error">{error}</div>}
          
          <div className="search-results">
            {users.map((user) => (
              <div
                key={user.id}
                className="search-user-item"
                onClick={() => { onSelectUser(user); onClose(); }}
              >
                {user.avatar ? (
                  <img src={`${serverUrl}${user.avatar}`} alt="" className="user-avatar-small" />
                ) : (
                  <div className="user-avatar-placeholder-small">
                    {user.username?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="user-info">
                  <span className="username">{user.username}</span>
                  <span className="user-id">ID: {user.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserSearchModal;
