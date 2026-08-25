import React, { useCallback, useEffect, useState } from 'react';
import type { GroupSummary, MessageDTO } from '@tianshangchat/shared';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useChatStore, type ChatPartner } from './state/chatStore';
import { useUiStore } from './state/uiStore';
import { useChatConnection } from './hooks/useChatConnection';
import { sendText, sendVoice } from './domain/messaging';
import {
  openGroupConversation,
  openPrivateConversation,
} from './domain/conversations';
import { makeGroupUseCases } from './domain/groups';
import UserList from './ui/components/UserList';
import GroupList from './ui/components/GroupList';
import PrivateChatPanel from './ui/components/PrivateChatPanel';
import GroupChat from './ui/components/GroupChat';
import CreateGroupModal from './ui/components/CreateGroupModal';
import GroupSettingsModal from './ui/components/GroupSettingsModal';
import LoginForm from './ui/components/LoginForm';
import RegisterForm from './ui/components/RegisterForm';
import BottomNav from './ui/components/BottomNav';
import UserSearchModal from './ui/components/UserSearchModal';
import JoinGroupModal from './ui/components/JoinGroupModal';
import RecentChats from './ui/components/RecentChats';
import VoicePlayer from './ui/components/VoicePlayer';
import { PwaIndicators } from './ui/components/PwaIndicators';
import { listLoadedPlugins } from './plugins/host';
import { subscribePush, unsubscribePush } from './core/push';

const isAndroid = typeof window !== 'undefined' && window.Capacitor !== undefined;

function AuthScreen() {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  if (authMode === 'login') {
    return <LoginForm onSwitchToRegister={() => setAuthMode('register')} />;
  }
  return <RegisterForm onSwitchToLogin={() => setAuthMode('login')} />;
}

/** Desktop three-column layout — reads everything from the chat store. */
function ChatLayout() {
  const { t, language, setLanguage, languages, languageNames } = useLanguage();
  const { logout, connectionType } = useAuth();
  const token = useAuth().token ?? '';

  const currentUser = useChatStore((s) => s.currentUser);
  const users = useChatStore((s) => s.users);
  const groups = useChatStore((s) => s.groups);
  const messagesByConv = useChatStore((s) => s.messagesByConv);
  const unreadPrivate = useChatStore((s) => s.unreadPrivate);
  const unreadGroup = useChatStore((s) => s.unreadGroup);
  const privateChatUser = useChatStore((s) => s.privateChatUser);
  const selectedGroup = useChatStore((s) => s.selectedGroup);
  const groupSettingsGroup = useChatStore((s) => s.groupSettingsGroup);
  const privateTyping = useChatStore((s) => s.privateTypingFrom);

  const groupUseCases = makeGroupUseCases(token);

  const openPrivate = useCallback(
    (partner: ChatPartner) => {
      const s = useChatStore.getState();
      s.openPrivateChat(partner);
      s.clearUnreadPrivate(partner.id);
      if (token) void openPrivateConversation(token, partner.id);
    },
    [token],
  );

  const selectGroup = useCallback(
    (summary: GroupSummary) => {
      if (!token) return;
      void (async () => {
        // Fetch detail for member list rendering.
        const { api } = await import('./data/apiClient');
        const detail = await api.groupDetail(token, summary.id);
        if (!detail) return;
        const st = useChatStore.getState();
        st.setSelectedGroup(detail);
        st.clearUnreadGroup(summary.id);
        await openGroupConversation(token, summary.id);
      })();
    },
    [token],
  );

  if (!currentUser) return null;

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>{t('appName')}</h2>
          <SidebarAvatar currentUser={currentUser} />
          <div className="connection-type-indicator">
            <span className={`connection-badge ${connectionType}`}>
              {connectionType === 'lan' ? '🌐 LAN' : '💻 Local'}
            </span>
          </div>
          <div className="language-selector">
            {languages.map((lang) => (
              <button
                key={lang}
                className={`lang-btn ${language === lang ? 'active' : ''}`}
                onClick={() => setLanguage(lang)}
              >
                {languageNames[lang]}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-content">
          <UserList
            users={users}
            currentUser={currentUser}
            onUserClick={openPrivate}
            unreadCounts={unreadPrivate}
          />
          <GroupList
            groups={groups}
            currentUser={currentUser}
            onGroupClick={selectGroup}
            onCreateGroup={() => useUiStore.getState().setShowCreateGroup(true)}
            selectedGroupId={selectedGroup?.id}
            unreadCounts={unreadGroup}
          />
        </div>

        <div className="sidebar-footer">
          <button className="logout-btn-sidebar" onClick={() => void logout()}>
            {t('logout')}
          </button>
        </div>
      </div>

      <div className="main-chat-area">
        {selectedGroup ? (
          <GroupChat
            group={selectedGroup}
            messages={messagesByConv[`g:${selectedGroup.id}`] ?? []}
            currentUser={currentUser}
            onSendMessage={(content) => void sendText({ kind: 'group', groupId: selectedGroup.id }, content)}
            onSendVoice={(url, duration) =>
              void sendVoice({ kind: 'group', groupId: selectedGroup.id }, url, duration)
            }
            onTyping={() => {}}
            onOpenSettings={() => useChatStore.getState().setGroupSettingsGroup(selectedGroup)}
          />
        ) : (
          <div className="public-chat">
            <div className="public-chat-header">
              <h1>{t('publicChat')}</h1>
              <div className="header-right">
                <span className="online-count">
                  {users.length} {t('onlineUsers').toLowerCase()}
                </span>
              </div>
            </div>
            <PublicMessageList messages={messagesByConv['public'] ?? []} currentUserId={currentUser?.id} />
            <PublicMessageInput />
          </div>
        )}
      </div>

      {privateChatUser && (
        <PrivateChatPanel
          user={privateChatUser}
          currentUserId={currentUser?.id}
          messages={messagesByConv[`p:${privateChatUser.id}`] ?? []}
          onSendMessage={(content) =>
            void sendText({ kind: 'private', peerId: privateChatUser.id }, content)
          }
          onSendVoice={(url, duration) =>
            void sendVoice({ kind: 'private', peerId: privateChatUser.id }, url, duration)
          }
          onTyping={() => {}}
          onClose={() => useChatStore.getState().closePrivateChat()}
          typingUser={privateTyping}
        />
      )}

      {groupSettingsGroup && (
        <GroupSettingsModal
          group={groupSettingsGroup}
          currentUser={currentUser}
          onClose={() => useChatStore.getState().setGroupSettingsGroup(null)}
          onAddMember={(userId) => void groupUseCases.addMember(groupSettingsGroup.id, userId)}
          onRemoveMember={(userId) => void groupUseCases.removeMember(groupSettingsGroup.id, userId)}
          onSetAdmin={(userId, isAdmin) =>
            void groupUseCases.setAdmin(groupSettingsGroup.id, userId, isAdmin)
          }
          onTransferOwner={(userId) => void groupUseCases.transferOwner(groupSettingsGroup.id, userId)}
          onLeaveGroup={() => void groupUseCases.leave(groupSettingsGroup.id)}
          onDeleteGroup={() => void groupUseCases.remove(groupSettingsGroup.id)}
        />
      )}

      {useUiStore.getState().showCreateGroup && (
        <CreateGroupModal
          users={users}
          currentUser={currentUser}
          onClose={() => useUiStore.getState().setShowCreateGroup(false)}
          onCreate={(name, memberIds) => {
            void import('./data/socketAdapter').then(({ getSocket }) => {
              getSocket()?.emit('create-group', { name, memberIds });
            });
          }}
        />
      )}
    </div>
  );
}

function SidebarAvatar({ currentUser }: { currentUser: { avatar: string | null; username: string } }) {
  const { serverUrl, token } = useAuth();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 1024 * 1024) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const response = await fetch(`${serverUrl}/api/upload/avatar`, {
        method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data: unknown = await response.json();
      if (
        typeof data === 'object' &&
        data !== null &&
        'success' in data &&
        (data as { success: boolean }).success
      ) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div className="user-info">
      <div onClick={() => fileInputRef.current?.click()}>
        {currentUser?.avatar ? (
          <img src={`${serverUrl}${currentUser.avatar}`} alt="" className="avatar-preview" />
        ) : (
          <div className="avatar-upload-btn">
            <span>📷</span>
          </div>
        )}
      </div>
      <span style={{ color: 'white', fontWeight: 600 }}>{currentUser?.username}</span>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden-input" onChange={handleFileChange} />
    </div>
  );
}

function PublicMessageList({ messages, currentUserId }: { messages: MessageDTO[]; currentUserId?: number | null }) {
  const { serverUrl } = useAuth();
  const listRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const formatTime = (ts: string): string =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="message-list" ref={listRef}>
      {messages.map((msg) => (
        <div key={msg.id} className={`message ${msg.senderId === currentUserId ? 'own' : ''}`}>
          {msg.senderAvatar ? (
            <img src={`${serverUrl}${msg.senderAvatar}`} alt="" className="message-avatar" />
          ) : (
            <div className="message-avatar">{msg.senderName?.charAt(0).toUpperCase()}</div>
          )}
          <div className="message-content">
            {msg.senderId !== currentUserId && <div className="message-sender">{msg.senderName}</div>}
            {msg.type === 'voice' ? (
              <VoicePlayer audioUrl={`${serverUrl}${msg.audioUrl ?? ''}`} duration={msg.duration} />
            ) : (
              <div className="message-text">{msg.content}</div>
            )}
            <div className="message-time">{formatTime(msg.timestamp)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PublicMessageInput() {
  const { t } = useLanguage();
  const { token, serverUrl } = useAuth();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      void sendText({ kind: 'public' }, message);
      setMessage('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('voice', blob, 'voice.webm');
        const response = await fetch(`${serverUrl}/api/upload/voice`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
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
          void sendVoice({ kind: 'public' }, (data as { url: string }).url, `${Math.round(blob.size / 10000)}s`);
        }
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording failed:', error);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <form className="message-input-container" onSubmit={handleSubmit}>
      <button
        type="button"
        className={`icon-btn ${isRecording ? 'recording' : ''}`}
        onClick={isRecording ? stopRecording : () => void startRecording()}
      >
        {isRecording ? '⏹' : '🎤'}
      </button>
      <input
        type="text"
        className="message-input"
        placeholder={t('placeholder')}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button type="submit" className="send-btn" disabled={!message.trim()}>
        {t('send')}
      </button>
    </form>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const rawToken = useAuth().token;
  const token = rawToken ?? '';
  const { t } = useLanguage();

  useChatConnection(
    user ? { id: user.id, username: user.username, avatar: user.avatar } : null,
    rawToken,
  );

  const currentUser = useChatStore((s) => s.currentUser);
  const users = useChatStore((s) => s.users);
  const groups = useChatStore((s) => s.groups);
  const messagesByConv = useChatStore((s) => s.messagesByConv);
  const unreadPrivate = useChatStore((s) => s.unreadPrivate);
  const unreadGroup = useChatStore((s) => s.unreadGroup);
  const privateChatUser = useChatStore((s) => s.privateChatUser);
  const selectedGroup = useChatStore((s) => s.selectedGroup);
  const groupSettingsGroup = useChatStore((s) => s.groupSettingsGroup);

  const mobileTab = useUiStore((s) => s.mobileTab);
  const showCreateGroup = useUiStore((s) => s.showCreateGroup);
  const showUserSearch = useUiStore((s) => s.showUserSearch);
  const showJoinGroup = useUiStore((s) => s.showJoinGroup);



  if (loading)
    return (
      <div className="welcome-screen">
        <h1>TianshangChat</h1>
        <p>Loading...</p>
      </div>
    );
  if (!user)
    return (
      <div className="welcome-screen">
        <h1>{t('welcomeTitle')}</h1>
        <p>{t('welcomeSubtitle')}</p>
        <AuthScreen />
      </div>
    );
  if (!currentUser)
    return (
      <div className="welcome-screen">
        <h1>{t('welcomeTitle')}</h1>
        <p>{t('connecting')}...</p>
      </div>
    );

  const renderMobileContent = (): React.ReactNode => {
    if (privateChatUser) {
      return (
        <PrivateChatPanel
          user={privateChatUser}
          currentUserId={currentUser?.id}
          messages={messagesByConv[`p:${privateChatUser.id}`] ?? []}
          onSendMessage={(content) =>
            void sendText({ kind: 'private', peerId: privateChatUser.id }, content)
          }
          onSendVoice={(url, duration) =>
            void sendVoice({ kind: 'private', peerId: privateChatUser.id }, url, duration)
          }
          onTyping={() => {}}
          onClose={() => useChatStore.getState().closePrivateChat()}
        />
      );
    }

    if (selectedGroup) {
      return (
        <GroupChat
          group={selectedGroup}
          messages={messagesByConv[`g:${selectedGroup.id}`] ?? []}
          currentUser={currentUser}
          onSendMessage={(content) => void sendText({ kind: 'group', groupId: selectedGroup.id }, content)}
          onSendVoice={(url, duration) =>
            void sendVoice({ kind: 'group', groupId: selectedGroup.id }, url, duration)
          }
          onTyping={() => {}}
          onOpenSettings={() => useChatStore.getState().setGroupSettingsGroup(selectedGroup)}
        />
      );
    }

    switch (mobileTab) {
      case 'public':
        return (
          <div className="public-chat">
            <div className="public-chat-header">
              <h1>{t('publicChat')}</h1>
              <div className="header-right">
                <span className="online-count">
                  {users.length} {t('onlineUsers').toLowerCase()}
                </span>
              </div>
            </div>
            <PublicMessageList messages={messagesByConv['public'] ?? []} currentUserId={currentUser?.id} />
            <PublicMessageInput />
          </div>
        );
      case 'private':
        return (
          <div style={{ position: 'relative', height: '100%' }}>
            <RecentChats
              onSelectChat={(partner) => {
                useChatStore.getState().openPrivateChat(partner);
                useChatStore.getState().clearUnreadPrivate(partner.id);
                void openPrivateConversation(token, partner.id);
              }}
              unreadCounts={unreadPrivate}
            />
            <button className="fab-button" onClick={() => useUiStore.getState().setShowUserSearch(true)} style={{ position: 'absolute', bottom: '80px', right: '20px', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', border: 'none', fontSize: '1.5rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              +
            </button>
          </div>
        );
      case 'groups':
        return (
          <div className="mobile-group-list">
            <div className="mobile-group-header">
              <h2>{t('myGroups')}</h2>
              <div className="group-actions">
                <button className="group-action-btn" onClick={() => useUiStore.getState().setShowJoinGroup(true)}>+</button>
              </div>
            </div>
            <div className="mobile-group-list-content">
              {groups.length === 0 ? (
                <div className="mobile-empty-groups">
                  <span>{t('noGroups')}</span>
                  <button onClick={() => useUiStore.getState().setShowCreateGroup(true)}>{t('createGroup')}</button>
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    className="mobile-group-item"
                    onClick={() => {
                      if (!token) return;
                      void (async () => {
                        const { api } = await import('./data/apiClient');
                        const detail = await api.groupDetail(token, group.id);
                        if (!detail) return;
                        const st = useChatStore.getState();
                        st.setSelectedGroup(detail);
                        st.clearUnreadGroup(group.id);
                        await openGroupConversation(token, group.id);
                      })();
                    }}
                  >
                    <span className="mobile-group-icon">👥</span>
                    <div className="mobile-group-info">
                      <div className="mobile-group-name">{group.name}</div>
                      <div className="mobile-group-members">{group.memberCount || 0} {t('members')}</div>
                    </div>
                    {(unreadGroup?.[group.id] ?? 0) > 0 && (
                      <span className="unread-badge">{unreadGroup[group.id]}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case 'settings':
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  const groupUseCases = makeGroupUseCases(token);

  return (
    <>
      <PwaIndicators />
      {isAndroid ? (
        <div className="app-container">
          <div className="main-chat-area">{renderMobileContent()}</div>
          <BottomNav activeTab={mobileTab} onTabChange={useUiStore.getState().setMobileTab} />
          {showUserSearch && (
            <UserSearchModal
              onClose={() => useUiStore.getState().setShowUserSearch(false)}
              onSelectUser={(partner) => {
                useChatStore.getState().openPrivateChat(partner);
                useChatStore.getState().clearUnreadPrivate(partner.id);
                void openPrivateConversation(token, partner.id);
                useUiStore.getState().setMobileTab('public');
              }}
            />
          )}
          {showJoinGroup && (
            <JoinGroupModal
              onClose={() => useUiStore.getState().setShowJoinGroup(false)}
              onJoinSuccess={(group) => {
                useChatStore.getState().upsertGroup(group);
                void (async () => {
                  const { api } = await import('./data/apiClient');
                  const detail = await api.groupDetail(token, group.id);
                  if (!detail) return;
                  const st = useChatStore.getState();
                  st.setSelectedGroup(detail);
                  st.clearUnreadGroup(group.id);
                  await openGroupConversation(token, group.id);
                })();
                useUiStore.getState().setMobileTab('public');
              }}
            />
          )}
          {showCreateGroup && (
            <CreateGroupModal
              users={users}
              currentUser={currentUser}
              onClose={() => useUiStore.getState().setShowCreateGroup(false)}
              onCreate={(name, memberIds) => {
                // create-group flows over the socket; store updates arrive via
                // group-created / group-list-update events.
                void (async () => {
                  const { getSocket } = await import('./data/socketAdapter');
                  getSocket()?.emit('create-group', { name, memberIds });
                })();
              }}
            />
          )}
          {groupSettingsGroup && (
            <GroupSettingsModal
              group={groupSettingsGroup}
              currentUser={currentUser}
              onClose={() => useChatStore.getState().setGroupSettingsGroup(null)}
              onAddMember={(userId) => void groupUseCases.addMember(groupSettingsGroup.id, userId)}
              onRemoveMember={(userId) => void groupUseCases.removeMember(groupSettingsGroup.id, userId)}
              onSetAdmin={(userId, isAdmin) =>
                void groupUseCases.setAdmin(groupSettingsGroup.id, userId, isAdmin)
              }
              onTransferOwner={(userId) => void groupUseCases.transferOwner(groupSettingsGroup.id, userId)}
              onLeaveGroup={() => void groupUseCases.leave(groupSettingsGroup.id)}
              onDeleteGroup={() => void groupUseCases.remove(groupSettingsGroup.id)}
            />
          )}
        </div>
      ) : (
        <ChatLayout />
      )}
    </>
  );
}

function SettingsPanel() {
  const { t, language, setLanguage, languages, languageNames } = useLanguage();
  const { logout, token } = useAuth();
  const [pushState, setPushState] = useState<string>('idle');
  const [plugins] = useState(() => listLoadedPlugins());

  const togglePush = async () => {
    if (!token) return;
    setPushState('working');
    try {
      if (localStorage.getItem('push:enabled') === '1') {
        await unsubscribePush(token);
        localStorage.removeItem('push:enabled');
        setPushState('已关闭');
      } else {
        const result = await subscribePush(token);
        localStorage.setItem('push:enabled', result === 'subscribed' ? '1' : '0');
        setPushState(
          result === 'subscribed'
            ? '已开启'
            : result === 'disabled'
              ? '服务器未启用推送'
              : result === 'denied'
                ? '权限被拒绝'
                : '浏览器不支持',
        );
      }
    } catch (err) {
      setPushState(`失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="settings-panel">
      <h2>{t('settings')}</h2>

      <div className="settings-section">
        <label>桌面推送通知</label>
        <div className="language-options">
          <button
            className="lang-option"
            onClick={() => void togglePush()}
            disabled={pushState === 'working'}
          >
            {localStorage.getItem('push:enabled') === '1' ? '关闭' : '开启'}
          </button>
          {pushState !== 'idle' && pushState !== 'working' && (
            <span style={{ marginLeft: 8 }}>{pushState}</span>
          )}
        </div>
      </div>

      <div className="settings-section">
        <label>插件（{plugins.length}）</label>
        {plugins.length === 0 ? (
          <div>暂无插件 — 放置于 /plugins/registry.json</div>
        ) : (
          plugins.map((p) => (
            <div key={p.manifest.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
              <strong>{p.manifest.name}</strong>
              <span style={{ opacity: 0.7 }}>v{p.manifest.version}</span>
              {p.error && <span style={{ color: 'crimson' }}>加载失败</span>}
            </div>
          ))
        )}
      </div>

      <div className="settings-section">
        <label>{t('language')}</label>
        <div className="language-options">
          {languages.map((lang) => (
            <button
              key={lang}
              className={`lang-option ${language === lang ? 'active' : ''}`}
              onClick={() => setLanguage(lang)}
            >
              {languageNames[lang]}
            </button>
          ))}
        </div>
      </div>
      <button className="logout-btn-mobile" onClick={() => void logout()}>
        {t('logout')}
      </button>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
