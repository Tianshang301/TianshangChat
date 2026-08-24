import { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import type { Conversation } from '@tianshangchat/shared';

function RecentChats({
  onSelectChat,
  unreadCounts,
}: {
  onSelectChat: (user: { id: number; username: string; avatar: string | null }) => void;
  unreadCounts?: Record<number, number>;
}) {
  const { t } = useLanguage();
  const { token, serverUrl } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConversations = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/messages/private-list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: unknown = await response.json();
      if (
        typeof data === 'object' &&
        data !== null &&
        'success' in data &&
        (data as { success: boolean }).success &&
        'conversations' in data
      ) {
        setConversations((data as { conversations: Conversation[] }).conversations);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string | null): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 86400000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 604800000) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return <div className="loading-state">{t('loadingHistory') || 'Loading...'}</div>;
  }

  return (
    <div className="recent-chats-container">
      <div className="recent-chats-header">
        <h2>{t('recentChats')}</h2>
      </div>
      {conversations.length === 0 ? (
        <div className="empty-state">{t('noConversations') || 'No conversations yet'}</div>
      ) : (
        <div className="conversations-list">
          {conversations.map((conv) => (
            <div
              key={conv.userId}
              className="conversation-item"
              onClick={() => onSelectChat({ id: conv.userId, username: conv.username, avatar: conv.avatar })}
            >
              {conv.avatar ? (
                <img src={`${serverUrl}${conv.avatar}`} alt="" className="conv-avatar" />
              ) : (
                <div className="conv-avatar-placeholder">{conv.username?.charAt(0).toUpperCase()}</div>
              )}
              <div className="conv-info">
                <div className="conv-name">{conv.username}</div>
                <div className="conv-last-message">{conv.lastMessage || '[No messages]'}</div>
              </div>
              <div className="conv-meta">
                <span className="conv-time">{formatTime(conv.lastMessageTime)}</span>
                {(unreadCounts?.[conv.userId] ?? 0) > 0 && (
                  <span className="unread-badge">{unreadCounts?.[conv.userId]}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecentChats;
