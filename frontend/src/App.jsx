import React, { useState, useEffect, useRef } from 'react';
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
import io from 'socket.io-client';

const API_URL = 'http://localhost:3000/api';

function AuthScreen() {
  const [authMode, setAuthMode] = useState('login');

  if (authMode === 'login') {
    return <LoginForm onSwitchToRegister={() => setAuthMode('register')} />;
  }
  return <RegisterForm onSwitchToLogin={() => setAuthMode('login')} />;
}

function ChatLayout({ 
  currentUser, users, groups, messages, privateMessages, groupMessages,
  privateChatUser, selectedGroup, groupSettingsGroup,
  unreadPrivate, unreadGroup, privateTyping,
  onOpenPrivateChat, onClosePrivateChat, 
  onSelectGroup, onOpenGroupSettings, onCloseGroupSettings,
  onSendMessage, onSendPrivateMessage, onSendGroupMessage,
  onSendVoice, onSendPrivateVoice, onSendGroupVoice,
  onTyping, onPrivateTyping,
  onCreateGroup, onJoinGroup,
  onAddGroupMember, onRemoveGroupMember, onSetAdmin, onTransferOwner, onLeaveGroup, onDeleteGroup
}) {
  const { t, language, setLanguage, languages, languageNames } = useLanguage();
  const { logout } = useAuth();

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>{t('appName')}</h2>
          <UserAvatar currentUser={currentUser} />
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
            onUserClick={onOpenPrivateChat}
            unreadCounts={unreadPrivate}
          />
          <GroupList 
            groups={groups}
            currentUser={currentUser}
            onGroupClick={onSelectGroup}
            onCreateGroup={onJoinGroup}
            selectedGroupId={selectedGroup?.id}
            unreadCounts={unreadGroup}
          />
        </div>
        
        <div className="sidebar-footer">
          <button className="logout-btn-sidebar" onClick={logout}>
            {t('logout')}
          </button>
        </div>
      </div>

      <div className="main-chat-area">
        {selectedGroup ? (
          <GroupChat
            group={selectedGroup}
            messages={groupMessages[selectedGroup.id] || []}
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
                <span className="online-count">{users.length} {t('onlineUsers').toLowerCase()}</span>
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
          messages={privateMessages[privateChatUser.id] || []}
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

function UserAvatar({ currentUser }) {
  const { token } = useAuth();
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 1024 * 1024) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const response = await fetch(`${API_URL}/upload/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();
      if (data.success) {
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
          <img src={`http://localhost:3000${currentUser.avatar}`} alt="" className="avatar-preview" />
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

function PublicMessageList({ messages, currentUserId }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="message-list" ref={listRef}>
      {messages.map((msg) => (
        <div key={msg.id} className={`message ${msg.senderId === currentUserId ? 'own' : ''}`}>
          {msg.senderAvatar ? (
            <img src={`http://localhost:3000${msg.senderAvatar}`} alt="" className="message-avatar" />
          ) : (
            <div className="message-avatar">{msg.senderName?.charAt(0).toUpperCase()}</div>
          )}
          <div className="message-content">
            {msg.senderId !== currentUserId && <div className="message-sender">{msg.senderName}</div>}
            {msg.type === 'voice' ? (
              <div className="voice-message">
                <button className="voice-btn" onClick={() => new Audio(`http://localhost:3000${msg.audioUrl}`).play()}>▶</button>
                <span>{msg.duration}</span>
              </div>
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

function PublicMessageInput({ onSendMessage, onSendVoice, onTyping }) {
  const { t } = useLanguage();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('voice', blob, 'voice.webm');
        const response = await fetch(`${API_URL}/upload/voice`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: formData
        });
        const data = await response.json();
        if (data.success) onSendVoice(data.url, `${Math.round(blob.size / 10000)}s`);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording failed:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  return (
    <form className="message-input-container" onSubmit={handleSubmit}>
      <button type="button" className={`icon-btn ${isRecording ? 'recording' : ''}`} onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? '⏹' : '🎤'}
      </button>
      <input type="text" className="message-input" placeholder={t('placeholder')} value={message} onChange={e => { setMessage(e.target.value); onTyping(); }} />
      <button type="submit" className="send-btn" disabled={!message.trim()}>{t('send')}</button>
    </form>
  );
}

function CreateGroupModalWrapper({ users, currentUser, onClose, onCreate }) {
  const [show, setShow] = useState(false);
  
  useEffect(() => { setShow(true); }, []);
  
  if (!show) return null;
  
  return <CreateGroupModal users={users} currentUser={currentUser} onClose={onClose} onCreate={onCreate} />;
}

function AppContent() {
  const { user, token, loading } = useAuth();
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [messages, setMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState({});
  const [groupMessages, setGroupMessages] = useState({});
  const [privateChatUser, setPrivateChatUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupSettingsGroup, setGroupSettingsGroup] = useState(null);
  const [unreadPrivate, setUnreadPrivate] = useState({});
  const [unreadGroup, setUnreadGroup] = useState({});
  const [privateTyping, setPrivateTyping] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (user && token) {
      const socket = io('http://localhost:3000', { transports: ['websocket', 'polling'] });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('authenticate', { token });
      });

      socket.on('authenticated', async (data) => {
        setCurrentUser(data.user);
        await loadHistory();
      });

      socket.on('user-list-update', (userList) => {
        setUsers(userList.filter(u => u.id !== currentUser?.id));
      });

      socket.on('user-left', ({ userId }) => {
        setUsers(prev => prev.filter(u => u.id !== userId));
      });

      socket.on('group-list-update', ({ groups: groupList }) => {
        setGroups(groupList);
      });

      socket.on('group-created', ({ group }) => {
        setGroups(prev => [...prev, group]);
      });

      socket.on('receive-message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      socket.on('receive-private-message', ({ message, fromUser }) => {
        const isSentByMe = message.senderId === currentUser?.id;
        const chatPartnerId = isSentByMe ? message.recipientId : fromUser.id;
        
        setPrivateMessages(prev => ({
          ...prev,
          [chatPartnerId]: [...(prev[chatPartnerId] || []), message]
        }));
        
        if (privateChatUser?.id !== chatPartnerId) {
          setUnreadPrivate(prev => ({
            ...prev,
            [chatPartnerId]: (prev[chatPartnerId] || 0) + 1
          }));
        }
      });

      socket.on('private-typing-start', ({ username }) => {
        if (privateChatUser) setPrivateTyping(username);
      });

      socket.on('private-typing-stop', () => {
        setPrivateTyping(null);
      });

      socket.on('receive-group-message', ({ message, group }) => {
        setGroupMessages(prev => ({
          ...prev,
          [group.id]: [...(prev[group.id] || []), message]
        }));
        if (selectedGroup?.id !== group.id) {
          setUnreadGroup(prev => ({
            ...prev,
            [group.id]: (prev[group.id] || 0) + 1
          }));
        }
      });

      socket.on('group-updated', ({ group }) => {
        setGroups(prev => prev.map(g => g.id === group.id ? group : g));
        if (selectedGroup?.id === group.id) setSelectedGroup(group);
        if (groupSettingsGroup?.id === group.id) setGroupSettingsGroup(group);
      });

      socket.on('member-joined', ({ group }) => {
        setGroups(prev => prev.map(g => g.id === group.id ? group : g));
        if (selectedGroup?.id === group.id) setSelectedGroup(group);
      });

      socket.on('member-left', ({ groupId }) => {
        fetch(`${API_URL}/groups/${groupId}`, { headers: { 'Authorization': `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => {
            if (data.success) {
              setGroups(prev => prev.map(g => g.id === groupId ? data.group : g));
              if (selectedGroup?.id === groupId) setSelectedGroup(data.group);
            }
          });
      });

      return () => socket.disconnect();
    }
  }, [user, token]);

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/messages/history`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setMessages(data.messages);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const openPrivateChat = async (targetUser) => {
    setPrivateChatUser(targetUser);
    const newUnread = { ...unreadPrivate };
    newUnread[targetUser.id] = 0;
    setUnreadPrivate(newUnread);
    try {
      const res = await fetch(API_URL + '/messages/private/' + targetUser.id, { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      if (data.success) {
        const newMessages = { ...privateMessages };
        newMessages[targetUser.id] = data.messages;
        setPrivateMessages(newMessages);
      }
    } catch (error) {
      console.error('Failed to load private messages:', error);
    }
  };

  const selectGroup = async (group) => {
    setSelectedGroup(group);
    const newUnread = { ...unreadGroup };
    newUnread[group.id] = 0;
    setUnreadGroup(newUnread);
    try {
      const res = await fetch(API_URL + '/groups/' + group.id + '/messages', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      if (data.success) {
        const newMessages = { ...groupMessages };
        newMessages[group.id] = data.messages;
        setGroupMessages(newMessages);
      }
    } catch (error) {
      console.error('Failed to load group messages:', error);
    }
  };

  const handleCreateGroup = async (name, memberIds) => {
    socketRef.current?.emit('create-group', { name, memberIds });
  };

  const sendPublicMessage = (content) => socketRef.current?.emit('send-message', { content });
  const sendGroupMessage = (groupId, content) => socketRef.current?.emit('send-group-message', { groupId, content });
  const sendPrivateMessage = (recipientId, content) => socketRef.current?.emit('send-private-message', { recipientId, content });
  const sendPublicVoice = (url, duration) => socketRef.current?.emit('send-voice', { audioUrl: url, duration });
  const sendGroupVoice = (groupId, url, duration) => socketRef.current?.emit('send-group-voice', { groupId, audioUrl: url, duration });
  const sendPrivateVoice = (recipientId, url, duration) => socketRef.current?.emit('send-private-voice', { recipientId, audioUrl: url, duration });
  const handleTyping = () => {
    socketRef.current?.emit('typing');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socketRef.current?.emit('stop-typing'), 2000);
  };
  const handlePrivateTyping = (recipientId) => {
    socketRef.current?.emit('private-typing', { recipientId });
  };

  const addGroupMember = async (groupId, userId) => {
    await fetch(`${API_URL}/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
  };

  const removeGroupMember = async (groupId, userId) => {
    await fetch(`${API_URL}/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  };

  const setAdmin = async (groupId, userId, isAdmin) => {
    await fetch(`${API_URL}/groups/${groupId}/admin/${userId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin })
    });
  };

  const transferOwner = async (groupId, newOwnerId) => {
    await fetch(`${API_URL}/groups/${groupId}/transfer`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ newOwnerId })
    });
  };

  const leaveGroup = async (groupId) => {
    await fetch(`${API_URL}/groups/${groupId}/leave`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    socketRef.current?.emit('leave-group', { groupId });
    if (selectedGroup?.id === groupId) setSelectedGroup(null);
  };

  const deleteGroup = async (groupId) => {
    if (confirm('Delete this group?')) {
      await fetch(`${API_URL}/groups/${groupId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (selectedGroup?.id === groupId) setSelectedGroup(null);
      setGroupSettingsGroup(null);
    }
  };

  if (loading) return <div className="welcome-screen"><h1>TianshangChat</h1><p>Loading...</p></div>;
  if (!user) return <div className="welcome-screen"><h1>{t('welcomeTitle')}</h1><p>{t('welcomeSubtitle')}</p><AuthScreen /></div>;
  if (!currentUser) return <div className="welcome-screen"><h1>{t('welcomeTitle')}</h1><p>{t('connecting')}...</p></div>;

  return (
    <>
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
        onOpenPrivateChat={openPrivateChat}
        onClosePrivateChat={() => setPrivateChatUser(null)}
        onSelectGroup={selectGroup}
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
        onJoinGroup={(group) => { socketRef.current?.emit('join-group', { groupId: group.id }); selectGroup(group); }}
        onAddGroupMember={addGroupMember}
        onRemoveGroupMember={removeGroupMember}
        onSetAdmin={setAdmin}
        onTransferOwner={transferOwner}
        onLeaveGroup={leaveGroup}
        onDeleteGroup={deleteGroup}
      />
      {showCreateGroup && (
        <CreateGroupModalWrapper
          users={users}
          currentUser={currentUser}
          onClose={() => setShowCreateGroup(false)}
          onCreate={handleCreateGroup}
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
