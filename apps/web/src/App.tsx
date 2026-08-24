import React, { useState, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  GroupDetail,
  GroupSummary,
  MessageDTO,
  OnlineUser,
  ServerToClientEvents,
  UserSummary,
} from '@tianshangchat/shared';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import UserList from './components/UserList';
import GroupList from './components/GroupList';
import PrivateChatPanel from './components/PrivateChatPanel';
import GroupChat from './components/GroupChat';
import CreateGroupModal from './components/CreateGroupModal';
import GroupSettingsModal from './components/GroupSettingsModal';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import BottomNav, { type MobileTab } from './components/BottomNav';
import UserSearchModal from './components/UserSearchModal';
import JoinGroupModal from './components/JoinGroupModal';
import RecentChats from './components/RecentChats';
import VoicePlayer from './components/VoicePlayer';
import { showNotification } from './utils/notifications';

type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type UnreadMap = Record<number, number>;

const isAndroid = typeof window !== 'undefined' && window.Capacitor !== undefined;

interface ChatPartner {
  id: number;
  username: string;
  avatar: string | null;
}

function AuthScreen() {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  if (authMode === 'login') {
    return <LoginForm onSwitchToRegister={() => setAuthMode('register')} />;
  }
  return <RegisterForm onSwitchToLogin={() => setAuthMode('login')} />;
}

interface ChatLayoutProps {
  currentUser: UserSummary;
  users: OnlineUser[];
  groups: GroupSummary[];
  messages: MessageDTO[];
  privateMessages: Record<number, MessageDTO[]>;
  groupMessages: Record<number, MessageDTO[]>;
  privateChatUser: ChatPartner | null;
  selectedGroup: GroupDetail | null;
  groupSettingsGroup: GroupDetail | null;
  unreadPrivate: UnreadMap;
  unreadGroup: UnreadMap;
  privateTyping: string | null;
  onOpenPrivateChat: (user: ChatPartner) => void;
  onClosePrivateChat: () => void;
  onSelectGroup: (group: GroupDetail) => void;
  onOpenGroupSettings: (group: GroupDetail) => void;
  onCloseGroupSettings: () => void;
  onSendMessage: (content: string) => void;
  onSendPrivateMessage: (recipientId: number, content: string) => void;
  onSendGroupMessage: (groupId: number, content: string) => void;
  onSendVoice: (url: string, duration: string) => void;
  onSendPrivateVoice: (recipientId: number, url: string, duration: string) => void;
  onSendGroupVoice: (groupId: number, url: string, duration: string) => void;
  onTyping: () => void;
  onPrivateTyping: (recipientId: number) => void;
  onCreateGroup: () => void;
  onJoinGroup: (group: GroupDetail) => void;  onAddGroupMember: (groupId: number, userId: number) => void;
  onRemoveGroupMember: (groupId: number, userId: number) => void;
  onSetAdmin: (groupId: number, userId: number, isAdmin: boolean) => void;
  onTransferOwner: (groupId: number, userId: number) => void;
  onLeaveGroup: (groupId: number) => void;
  onDeleteGroup: (groupId: number) => void;
}

function ChatLayout(props: ChatLayoutProps) {
  const {
    currentUser,
    users,
    groups,
    messages,
    privateMessages,
    groupMessages,
    privateChatUser,
    selectedGroup,
    groupSettingsGroup,
    unreadPrivate,
    unreadGroup,
    privateTyping,
    onOpenPrivateChat,
    onClosePrivateChat,
    onSelectGroup,
    onOpenGroupSettings,
    onCloseGroupSettings,
    onSendMessage,
    onSendPrivateMessage,
    onSendGroupMessage,
    onSendVoice,
    onSendPrivateVoice,
    onSendGroupVoice,
    onTyping,
    onPrivateTyping,
    onCreateGroup,
    onAddGroupMember,
    onRemoveGroupMember,
    onSetAdmin,
    onTransferOwner,
    onLeaveGroup,
    onDeleteGroup,
  } = props;
  const { t, language, setLanguage, languages, languageNames } = useLanguage();
  const { logout, connectionType } = useAuth();

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
          <UserList users={users} currentUser={currentUser} onUserClick={onOpenPrivateChat} unreadCounts={unreadPrivate} />
          <GroupList
            groups={groups}
            currentUser={currentUser}
            onGroupClick={(g) => {
              // Desktop sidebar join/enter: reuse select flow via settings-less path.
              onSelectGroup(g as unknown as GroupDetail);
            }}
            onCreateGroup={onCreateGroup}
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
            messages={groupMessages[selectedGroup.id] ?? []}
            currentUser={currentUser}
            onSendMessage={(content) => onSendGroupMessage(selectedGroup.id, content)}
            onSendVoice={(url, duration) => onSendGroupVoice(selectedGroup.id, url, duration)}
            onTyping={() => {}}
            onOpenSettings={() => onOpenGroupSettings(selectedGroup)}
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
            <PublicMessageList messages={messages} currentUserId={currentUser?.id} />
            <PublicMessageInput onSendMessage={onSendMessage} onSendVoice={onSendVoice} onTyping={onTyping} />
          </div>
        )}
      </div>

      {privateChatUser && (
        <PrivateChatPanel
          user={privateChatUser}
          currentUserId={currentUser?.id}
          messages={privateMessages[privateChatUser.id] ?? []}
          onSendMessage={(content) => onSendPrivateMessage(privateChatUser.id, content)}
          onSendVoice={(url, duration) => onSendPrivateVoice(privateChatUser.id, url, duration)}
          onTyping={() => onPrivateTyping(privateChatUser.id)}
          onClose={onClosePrivateChat}
          typingUser={privateTyping}
        />
      )}

      {groupSettingsGroup && (
        <GroupSettingsModal
          group={groupSettingsGroup}
          currentUser={currentUser}
          onClose={onCloseGroupSettings}
          onAddMember={(userId) => onAddGroupMember(groupSettingsGroup.id, userId)}
          onRemoveMember={(userId) => onRemoveGroupMember(groupSettingsGroup.id, userId)}
          onSetAdmin={(userId, isAdmin) => onSetAdmin(groupSettingsGroup.id, userId, isAdmin)}
          onTransferOwner={(userId) => onTransferOwner(groupSettingsGroup.id, userId)}
          onLeaveGroup={() => onLeaveGroup(groupSettingsGroup.id)}
          onDeleteGroup={() => onDeleteGroup(groupSettingsGroup.id)}
        />
      )}
    </div>
  );
}

function SidebarAvatar({ currentUser }: { currentUser: UserSummary }) {
  const { token, serverUrl } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      if (typeof data === 'object' && data !== null && 'success' in data && (data as { success: boolean }).success) {
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

function PublicMessageList({ messages, currentUserId }: { messages: MessageDTO[]; currentUserId?: number }) {
  const { serverUrl } = useAuth();
  const listRef = useRef<HTMLDivElement | null>(null);

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

function PublicMessageInput({
  onSendMessage,
  onSendVoice,
  onTyping,
}: {
  onSendMessage: (content: string) => void;
  onSendVoice: (url: string, duration: string) => void;
  onTyping: () => void;
}) {
  const { t } = useLanguage();
  const { serverUrl, token } = useAuth();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
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
          onSendVoice((data as { url: string }).url, `${Math.round(blob.size / 10000)}s`);
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
        onChange={(e) => {
          setMessage(e.target.value);
          onTyping();
        }}
      />
      <button type="submit" className="send-btn" disabled={!message.trim()}>
        {t('send')}
      </button>
    </form>
  );
}

function AppContent() {
  const { user, token, loading, serverUrl, logout } = useAuth();
  const { t, language, setLanguage, languages, languageNames } = useLanguage();
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<number, MessageDTO[]>>({});
  const [groupMessages, setGroupMessages] = useState<Record<number, MessageDTO[]>>({});
  const [privateChatUser, setPrivateChatUser] = useState<ChatPartner | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupDetail | null>(null);
  const [groupSettingsGroup, setGroupSettingsGroup] = useState<GroupDetail | null>(null);
  const [unreadPrivate, setUnreadPrivate] = useState<UnreadMap>({});
  const [unreadGroup, setUnreadGroup] = useState<UnreadMap>({});
  const [privateTyping, setPrivateTyping] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>('public');
  const socketRef = useRef<ChatSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverUrlRef = useRef(serverUrl);

  useEffect(() => {
    serverUrlRef.current = serverUrl;
  }, [serverUrl]);

  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    if (user && token) {
      const socket: ChatSocket = io(serverUrlRef.current, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('authenticate', { token });
      });

      socket.on('authenticated', async () => {
        setCurrentUser({
          id: user.id,
          username: user.username,
          avatar: user.avatar ?? null,
        });
        await loadHistory();
      });

      socket.on('user-list-update', (userList) => {
        setUsers(userList.filter((u) => u.id !== user.id));
      });

      socket.on('user-left', ({ userId }) => {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      });

      socket.on('group-list-update', ({ groups: groupList }) => {
        setGroups(groupList);
      });

      socket.on('group-created', ({ group }) => {
        setGroups((prev) => [...prev, group as GroupSummary]);
      });

      socket.on('receive-message', (message) => {
        setMessages((prev) => [...prev, message]);
        if (!isWindowFocused && message.senderId !== user.id) {
          void showNotification(
            'TianshangChat',
            `${message.senderName}: ${message.content ?? '[语音消息]'}`,
          );
        }
      });

      socket.on('receive-private-message', ({ message, fromUser }) => {
        const isSentByMe = message.senderId === user.id;
        const chatPartnerId = (isSentByMe ? message.recipientId : fromUser.id) as number;

        setPrivateMessages((prev) => ({
          ...prev,
          [chatPartnerId]: [...(prev[chatPartnerId] ?? []), message],
        }));

        if (privateChatUser?.id !== chatPartnerId) {
          setUnreadPrivate((prev) => ({
            ...prev,
            [chatPartnerId]: (prev[chatPartnerId] ?? 0) + 1,
          }));

          if (!isWindowFocused && !isSentByMe) {
            void showNotification('私聊消息', `${fromUser.username}: ${message.content ?? '[语音消息]'}`);
          }
        }
      });

      socket.on('private-typing-start', ({ username }) => {
        if (privateChatUser) setPrivateTyping(username);
      });

      socket.on('private-typing-stop', () => {
        setPrivateTyping(null);
      });

      socket.on('receive-group-message', ({ message, group }) => {
        setGroupMessages((prev) => ({
          ...prev,
          [group.id]: [...(prev[group.id] ?? []), message],
        }));
        if (selectedGroup?.id !== group.id) {
          setUnreadGroup((prev) => ({
            ...prev,
            [group.id]: (prev[group.id] ?? 0) + 1,
          }));

          if (!isWindowFocused && message.senderId !== user.id) {
            void showNotification(`群聊: ${group.name}`, `${message.senderName}: ${message.content ?? '[语音消息]'}`);
          }
        }
      });

      socket.on('group-updated', ({ group }) => {
        setGroups((prev) => prev.map((g) => (g.id === group.id ? (group as GroupSummary) : g)));
        if (selectedGroup?.id === group.id) setSelectedGroup(group as GroupDetail);
        if (groupSettingsGroup?.id === group.id) setGroupSettingsGroup(group as GroupDetail);
      });

      socket.on('member-joined', ({ group }) => {
        setGroups((prev) => prev.map((g) => (g.id === group.id ? (group as GroupSummary) : g)));
        if (selectedGroup?.id === group.id) setSelectedGroup(group as GroupDetail);
      });

      socket.on('member-left', ({ groupId }) => {
        void fetch(`${serverUrl}/api/groups/${groupId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((data: { success?: boolean; group?: GroupDetail }) => {
            if (data.success && data.group) {
              setGroups((prev) => prev.map((g) => (g.id === groupId ? toSummary(data.group as GroupDetail) : g)));
              if (selectedGroup?.id === groupId) setSelectedGroup(data.group);
            }
          });
      });

      return () => {
        socket.disconnect();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  function toSummary(detail: GroupDetail): GroupSummary {
    return {
      id: detail.id,
      name: detail.name,
      creatorId: detail.creatorId,
      maxMembers: detail.maxMembers,
      createdAt: detail.createdAt,
      creatorName: detail.creatorName,
      role: 'member',
      memberCount: detail.members.length,
    };
  }

  async function loadHistory(): Promise<void> {
    try {
      const res = await fetch(`${serverUrl}/api/messages/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { success?: boolean; messages?: MessageDTO[] };
      if (data.success && data.messages) setMessages(data.messages);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }

  const openPrivateChat = async (targetUser: ChatPartner): Promise<void> => {
    setPrivateChatUser(targetUser);
    const newUnread = { ...unreadPrivate };
    newUnread[targetUser.id] = 0;
    setUnreadPrivate(newUnread);
    try {
      const res = await fetch(`${serverUrl}/api/messages/private/${targetUser.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { success?: boolean; messages?: MessageDTO[] };
      if (data.success && data.messages) {
        setPrivateMessages((prev) => ({ ...prev, [targetUser.id]: data.messages as MessageDTO[] }));
      }
    } catch (error) {
      console.error('Failed to load private messages:', error);
    }
  };

  const selectGroup = async (group: GroupDetail): Promise<void> => {
    setSelectedGroup(group);
    const newUnread = { ...unreadGroup };
    newUnread[group.id] = 0;
    setUnreadGroup(newUnread);
    try {
      const res = await fetch(`${serverUrl}/api/groups/${group.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { success?: boolean; messages?: MessageDTO[] };
      if (data.success && data.messages) {
        setGroupMessages((prev) => ({ ...prev, [group.id]: data.messages as MessageDTO[] }));
      }
    } catch (error) {
      console.error('Failed to load group messages:', error);
    }
  };

  const handleCreateGroup = (name: string, memberIds: number[]) => {
    socketRef.current?.emit('create-group', { name, memberIds });
  };

  const sendPublicMessage = (content: string) => socketRef.current?.emit('send-message', { content });
  const sendGroupMessage = (groupId: number, content: string) =>
    socketRef.current?.emit('send-group-message', { groupId, content });
  const sendPrivateMessage = (recipientId: number, content: string) =>
    socketRef.current?.emit('send-private-message', { recipientId, content });
  const sendPublicVoice = (url: string, duration: string) =>
    socketRef.current?.emit('send-voice', { audioUrl: url, duration });
  const sendGroupVoice = (groupId: number, url: string, duration: string) =>
    socketRef.current?.emit('send-group-voice', { groupId, audioUrl: url, duration });
  const sendPrivateVoice = (recipientId: number, url: string, duration: string) =>
    socketRef.current?.emit('send-private-voice', { recipientId, audioUrl: url, duration });

  const handleTyping = () => {
    socketRef.current?.emit('typing');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socketRef.current?.emit('stop-typing'), 2000);
  };
  const handlePrivateTyping = (recipientId: number) => {
    socketRef.current?.emit('private-typing', { recipientId });
  };

  const addGroupMember = async (groupId: number, userId: number): Promise<void> => {
    await fetch(`${serverUrl}/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
  };

  const removeGroupMember = async (groupId: number, userId: number): Promise<void> => {
    await fetch(`${serverUrl}/api/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  const setAdmin = async (groupId: number, userId: number, isAdmin: boolean): Promise<void> => {
    await fetch(`${serverUrl}/api/groups/${groupId}/admin/${userId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin }),
    });
  };

  const transferOwner = async (groupId: number, newOwnerId: number): Promise<void> => {
    await fetch(`${serverUrl}/api/groups/${groupId}/transfer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ newOwnerId }),
    });
  };

  const leaveGroup = async (groupId: number): Promise<void> => {
    await fetch(`${serverUrl}/api/groups/${groupId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    socketRef.current?.emit('leave-group', { groupId });
    if (selectedGroup?.id === groupId) setSelectedGroup(null);
  };

  const deleteGroup = async (groupId: number): Promise<void> => {
    if (confirm('Delete this group?')) {
      await fetch(`${serverUrl}/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (selectedGroup?.id === groupId) setSelectedGroup(null);
      setGroupSettingsGroup(null);
    }
  };

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
          messages={privateMessages[privateChatUser.id] ?? []}
          onSendMessage={(content) => sendPrivateMessage(privateChatUser.id, content)}
          onSendVoice={(url, duration) => sendPrivateVoice(privateChatUser.id, url, duration)}
          onTyping={() => handlePrivateTyping(privateChatUser.id)}
          onClose={() => setPrivateChatUser(null)}
          typingUser={privateTyping}
        />
      );
    }

    if (selectedGroup) {
      return (
        <GroupChat
          group={selectedGroup}
          messages={groupMessages[selectedGroup.id] ?? []}
          currentUser={currentUser}
          onSendMessage={(content) => sendGroupMessage(selectedGroup.id, content)}
          onSendVoice={(url, duration) => sendGroupVoice(selectedGroup.id, url, duration)}
          onTyping={() => {}}
          onOpenSettings={() => setGroupSettingsGroup(selectedGroup)}
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
            <PublicMessageList messages={messages} currentUserId={currentUser?.id} />
            <PublicMessageInput onSendMessage={sendPublicMessage} onSendVoice={sendPublicVoice} onTyping={handleTyping} />
          </div>
        );
      case 'private':
        return (
          <div style={{ position: 'relative', height: '100%' }}>
            <RecentChats
              onSelectChat={(u) => void openPrivateChat(u)}
              unreadCounts={unreadPrivate}
            />
            <button className="fab-button" onClick={() => setShowUserSearch(true)} style={{ position: 'absolute', bottom: '80px', right: '20px', width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', border: 'none', fontSize: '1.5rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <button className="group-action-btn" onClick={() => setShowJoinGroup(true)}>+</button>
              </div>
            </div>
            <div className="mobile-group-list-content">
              {groups.length === 0 ? (
                <div className="mobile-empty-groups">
                  <span>{t('noGroups')}</span>
                  <button onClick={() => setShowCreateGroup(true)}>{t('createGroup')}</button>
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    className="mobile-group-item"
                    onClick={() => void selectGroup(toDetailStub(group))}
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
        return (
          <div className="settings-panel">
            <h2>{t('settings')}</h2>
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
      default:
        return null;
    }
  };

  function toDetailStub(summary: GroupSummary): GroupDetail {
    return {
      id: summary.id,
      name: summary.name,
      creatorId: summary.creatorId,
      maxMembers: summary.maxMembers,
      createdAt: summary.createdAt,
      creatorName: summary.creatorName,
      members: [],
    };
  }

  return (
    <>
      {isAndroid ? (
        <div className="app-container">
          <div className="main-chat-area">{renderMobileContent()}</div>
          <BottomNav activeTab={mobileTab} onTabChange={setMobileTab} />
          {showUserSearch && (
            <UserSearchModal
              onClose={() => setShowUserSearch(false)}
              onSelectUser={(u) => {
                void openPrivateChat(u);
                setMobileTab('public');
              }}
            />
          )}
          {showJoinGroup && (
            <JoinGroupModal
              onClose={() => setShowJoinGroup(false)}
              onJoinSuccess={(group) => {
                void selectGroup(group as GroupDetail);
                setMobileTab('public');
              }}
            />
          )}
          {showCreateGroup && (
            <CreateGroupModal
              users={users}
              currentUser={currentUser}
              onClose={() => setShowCreateGroup(false)}
              onCreate={handleCreateGroup}
            />
          )}
          {groupSettingsGroup && (
            <GroupSettingsModal
              group={groupSettingsGroup}
              currentUser={currentUser}
              onClose={() => setGroupSettingsGroup(null)}
              onAddMember={(userId) => void addGroupMember(groupSettingsGroup.id, userId)}
              onRemoveMember={(userId) => void removeGroupMember(groupSettingsGroup.id, userId)}
              onSetAdmin={(userId, isAdmin) => void setAdmin(groupSettingsGroup.id, userId, isAdmin)}
              onTransferOwner={(userId) => void transferOwner(groupSettingsGroup.id, userId)}
              onLeaveGroup={() => void leaveGroup(groupSettingsGroup.id)}
              onDeleteGroup={() => void deleteGroup(groupSettingsGroup.id)}
            />
          )}
        </div>
      ) : (
        <ChatLayout
          currentUser={currentUser}
          users={users}
          groups={groups}
          messages={messages}
          privateMessages={privateMessages}
          groupMessages={groupMessages}
          privateChatUser={privateChatUser}
          selectedGroup={selectedGroup}
          groupSettingsGroup={groupSettingsGroup}
          unreadPrivate={unreadPrivate}
          unreadGroup={unreadGroup}
          privateTyping={privateTyping}
          onOpenPrivateChat={(u) => void openPrivateChat(u)}
          onClosePrivateChat={() => setPrivateChatUser(null)}
          onSelectGroup={(g) => void selectGroup(g)}
          onOpenGroupSettings={setGroupSettingsGroup}
          onCloseGroupSettings={() => setGroupSettingsGroup(null)}
          onSendMessage={sendPublicMessage}
          onSendPrivateMessage={sendPrivateMessage}
          onSendGroupMessage={sendGroupMessage}
          onSendVoice={sendPublicVoice}
          onSendPrivateVoice={sendPrivateVoice}
          onSendGroupVoice={sendGroupVoice}
          onTyping={handleTyping}
          onPrivateTyping={handlePrivateTyping}
          onCreateGroup={() => setShowCreateGroup(true)}
          onJoinGroup={(g) => {
            socketRef.current?.emit('join-group', { groupId: g.id });
            void selectGroup(g);
          }}
          onAddGroupMember={(groupId, userId) => void addGroupMember(groupId, userId)}
          onRemoveGroupMember={(groupId, userId) => void removeGroupMember(groupId, userId)}
          onSetAdmin={(groupId, userId, isAdmin) => void setAdmin(groupId, userId, isAdmin)}
          onTransferOwner={(groupId, userId) => void transferOwner(groupId, userId)}
          onLeaveGroup={(groupId) => void leaveGroup(groupId)}
          onDeleteGroup={(groupId) => void deleteGroup(groupId)}
        />
      )}
    </>
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
