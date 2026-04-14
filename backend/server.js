const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const messageRoutes = require('./routes/messages');
const groupRoutes = require('./routes/groups');
const Message = require('./models/Message');
const User = require('./models/User');
const Group = require('./models/Group');
const db = require('./database/db');

dotenv.config();

const app = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'TianshangChatSecretKey2024';

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);

const onlineUsers = new Map();
const userSockets = new Map();

function getSocketByUserId(userId) {
  return userSockets.get(userId);
}

function broadcastGroupUpdate(groupId) {
  const group = Group.findById(groupId);
  if (group) {
    io.to(`group-${groupId}`).emit('group-updated', { group });
  }
}

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('authenticate', (data) => {
    try {
      const { token } = data;
      if (!token) {
        socket.emit('auth-error', { error: 'No token provided' });
        return;
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const session = db.prepare(`
        SELECT * FROM sessions 
        WHERE token = ? AND expires_at > datetime('now')
      `).get(token);

      if (!session) {
        socket.emit('auth-error', { error: 'Token expired or invalid' });
        return;
      }

      const dbUser = User.findById(decoded.id);
      if (!dbUser) {
        socket.emit('auth-error', { error: 'User not found' });
        return;
      }

      const user = {
        id: dbUser.id,
        username: dbUser.username,
        avatar: dbUser.avatar,
        socketId: socket.id
      };

      onlineUsers.set(socket.id, user);
      userSockets.set(user.id, socket);

      socket.emit('authenticated', { user });
      socket.emit('user-list-update', Array.from(onlineUsers.values()));
      socket.broadcast.emit('user-list-update', Array.from(onlineUsers.values()));
      
      const userGroups = Group.getUserGroups(user.id);
      userGroups.forEach(g => {
        socket.join(`group-${g.id}`);
      });
      socket.emit('group-list-update', { groups: userGroups });
      
      console.log('User authenticated:', user.username);
    } catch (error) {
      console.error('Auth error:', error);
      socket.emit('auth-error', { error: 'Authentication failed' });
    }
  });

  // Public message
  socket.on('send-message', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) {
      socket.emit('error', { error: 'Not authenticated' });
      return;
    }

    const message = Message.create({
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      content: data.content,
      type: 'text'
    });

    const broadcastMessage = {
      id: message.id,
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      content: data.content,
      type: 'text',
      timestamp: new Date()
    };

    io.emit('receive-message', broadcastMessage);
  });

  // Public voice message
  socket.on('send-voice', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) {
      socket.emit('error', { error: 'Not authenticated' });
      return;
    }

    const message = Message.create({
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      audioUrl: data.audioUrl,
      duration: data.duration,
      type: 'voice'
    });

    const broadcastMessage = {
      id: message.id,
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      audioUrl: data.audioUrl,
      duration: data.duration,
      type: 'voice',
      timestamp: new Date()
    };

    io.emit('receive-message', broadcastMessage);
  });

  // Private message
  socket.on('send-private-message', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) {
      socket.emit('error', { error: 'Not authenticated' });
      return;
    }

    const { recipientId, content } = data;
    
    const message = Message.create({
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      recipientId: recipientId,
      content: content,
      type: 'text'
    });

    const broadcastMessage = {
      id: message.id,
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      recipientId: recipientId,
      content: content,
      type: 'text',
      timestamp: new Date()
    };

    socket.emit('receive-private-message', { message: broadcastMessage, fromUser: user });
    
    const recipientSocket = getSocketByUserId(recipientId);
    if (recipientSocket) {
      recipientSocket.emit('receive-private-message', { message: broadcastMessage, fromUser: user });
    }
  });

  // Private voice message
  socket.on('send-private-voice', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) {
      socket.emit('error', { error: 'Not authenticated' });
      return;
    }

    const { recipientId, audioUrl, duration } = data;
    
    const message = Message.create({
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      recipientId: recipientId,
      audioUrl: audioUrl,
      duration: duration,
      type: 'voice'
    });

    const broadcastMessage = {
      id: message.id,
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      recipientId: recipientId,
      audioUrl: audioUrl,
      duration: duration,
      type: 'voice',
      timestamp: new Date()
    };

    socket.emit('receive-private-message', { message: broadcastMessage, fromUser: user });
    
    const recipientSocket = getSocketByUserId(recipientId);
    if (recipientSocket) {
      recipientSocket.emit('receive-private-message', { message: broadcastMessage, fromUser: user });
    }
  });

  // Private typing
  socket.on('private-typing', (data) => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      const recipientSocket = getSocketByUserId(data.recipientId);
      if (recipientSocket) {
        recipientSocket.emit('private-typing-start', { 
          fromUserId: user.id, 
          username: user.username,
          senderName: user.username,
          senderAvatar: user.avatar 
        });
      }
    }
  });

  socket.on('stop-private-typing', (data) => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      const recipientSocket = getSocketByUserId(data.recipientId);
      if (recipientSocket) {
        recipientSocket.emit('private-typing-stop', { fromUserId: user.id });
      }
    }
  });

  // Group message
  socket.on('send-group-message', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) {
      socket.emit('error', { error: 'Not authenticated' });
      return;
    }

    const { groupId, content } = data;

    if (!Group.isMember(groupId, user.id)) {
      socket.emit('error', { error: 'Not a member of this group' });
      return;
    }

    const message = Message.create({
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      groupId: groupId,
      content: content,
      type: 'text'
    });

    const broadcastMessage = {
      id: message.id,
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      groupId: groupId,
      content: content,
      type: 'text',
      timestamp: new Date()
    };

    io.to(`group-${groupId}`).emit('receive-group-message', { 
      message: broadcastMessage,
      group: Group.findById(groupId)
    });
  });

  // Group voice message
  socket.on('send-group-voice', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) {
      socket.emit('error', { error: 'Not authenticated' });
      return;
    }

    const { groupId, audioUrl, duration } = data;

    if (!Group.isMember(groupId, user.id)) {
      socket.emit('error', { error: 'Not a member of this group' });
      return;
    }

    const message = Message.create({
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      groupId: groupId,
      audioUrl: audioUrl,
      duration: duration,
      type: 'voice'
    });

    const broadcastMessage = {
      id: message.id,
      senderId: user.id,
      senderName: user.username,
      senderAvatar: user.avatar,
      groupId: groupId,
      audioUrl: audioUrl,
      duration: duration,
      type: 'voice',
      timestamp: new Date()
    };

    io.to(`group-${groupId}`).emit('receive-group-message', { 
      message: broadcastMessage,
      group: Group.findById(groupId)
    });
  });

  // Create group
  socket.on('create-group', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) {
      socket.emit('error', { error: 'Not authenticated' });
      return;
    }

    const { name, memberIds } = data;
    const group = Group.create(name, user.id, memberIds || []);
    
    socket.join(`group-${group.id}`);
    
    const userGroups = Group.getUserGroups(user.id);
    socket.emit('group-list-update', { groups: userGroups });
    socket.emit('group-created', { group });
  });

  // Join group
  socket.on('join-group', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) {
      socket.emit('error', { error: 'Not authenticated' });
      return;
    }

    const { groupId } = data;
    const group = Group.findById(groupId);
    
    if (!group) {
      socket.emit('error', { error: 'Group not found' });
      return;
    }

    if (Group.isMember(groupId, user.id)) {
      socket.join(`group-${groupId}`);
      const userGroups = Group.getUserGroups(user.id);
      socket.emit('group-list-update', { groups: userGroups });
      return;
    }

    const role = Group.getMemberRole(groupId, user.id);
    if (role === 'creator' || role === 'admin') {
      Group.addMember(groupId, user.id);
      socket.join(`group-${groupId}`);
      
      const newMember = { id: user.id, username: user.username, avatar: user.avatar };
      io.to(`group-${groupId}`).emit('member-joined', { groupId, user: newMember, group });
      
      const userGroups = Group.getUserGroups(user.id);
      socket.emit('group-list-update', { groups: userGroups });
    }
  });

  // Leave group
  socket.on('leave-group', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) {
      socket.emit('error', { error: 'Not authenticated' });
      return;
    }

    const { groupId } = data;
    const group = Group.findById(groupId);
    
    if (!group) {
      socket.emit('error', { error: 'Group not found' });
      return;
    }

    if (group.creator_id === user.id) {
      socket.emit('error', { error: 'Creator cannot leave. Transfer ownership or delete the group.' });
      return;
    }

    socket.leave(`group-${groupId}`);
    Group.removeMember(groupId, user.id);
    
    io.to(`group-${groupId}`).emit('member-left', { groupId, userId: user.id, username: user.username });
    
    const userGroups = Group.getUserGroups(user.id);
    socket.emit('group-list-update', { groups: userGroups });
  });

  // Typing indicators
  socket.on('typing', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit('user-typing', {
        userId: socket.id,
        username: user.username
      });
    }
  });

  socket.on('stop-typing', () => {
    socket.broadcast.emit('user-stop-typing', {
      userId: socket.id
    });
  });

  // Avatar update
  socket.on('update-avatar', (avatarUrl) => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      User.updateAvatar(user.id, avatarUrl);
      user.avatar = avatarUrl;
      onlineUsers.set(socket.id, user);
      userSockets.set(user.id, socket);
      
      io.emit('avatar-updated', {
        userId: user.id,
        username: user.username,
        avatar: avatarUrl
      });
    }
  });

  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);
    if (user) {
      userSockets.delete(user.id);
      io.emit('user-left', {
        userId: user.id,
        username: user.username
      });
    }
    console.log('Socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
