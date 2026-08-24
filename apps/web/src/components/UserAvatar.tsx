import React, { useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SERVER_URL, API_URL } from '../config';
import type { UserSummary } from '@tianshangchat/shared';

function UserAvatar({
  currentUser,
  onAvatarUpdate,
}: {
  currentUser?: UserSummary | null;
  onAvatarUpdate: (url: string) => void;
}) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert('Image must be smaller than 1MB');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch(`${API_URL}/upload/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data: unknown = await response.json();
      if (
        typeof data === 'object' &&
        data !== null &&
        'success' in data &&
        (data as { success: boolean }).success &&
        'url' in data &&
        typeof (data as { url: unknown }).url === 'string'
      ) {
        onAvatarUpdate((data as { url: string }).url);
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
            src={`${SERVER_URL}${currentUser.avatar}`}
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
      <span style={{ color: 'white', fontWeight: 600 }}>{currentUser?.username}</span>
    </div>
  );
}

export default UserAvatar;
