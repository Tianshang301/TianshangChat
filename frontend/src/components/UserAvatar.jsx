import React, { useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

function UserAvatar({ currentUser, onAvatarUpdate }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const fileInputRef = useRef(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert('Image must be smaller than 1MB');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch('http://localhost:3000/api/upload/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();
      if (data.success && data.url) {
        onAvatarUpdate(data.url);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div className="user-info">
      <div className="avatar-upload">
        {currentUser?.avatar ? (
          <img
            src={`http://localhost:3000${currentUser.avatar}`}
            alt="Your avatar"
            className="avatar-preview"
            onClick={handleAvatarClick}
          />
        ) : (
          <div className="avatar-upload-btn" onClick={handleAvatarClick}>
            <span>📷</span>
            <span>{t('uploadAvatar')}</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden-input"
          onChange={handleFileChange}
        />
      </div>
      <span style={{ color: 'white', fontWeight: 600 }}>
        {currentUser?.username}
      </span>
    </div>
  );
}

export default UserAvatar;
