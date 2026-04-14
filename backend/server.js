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
const Message = require('./models/Message');
const User = require('./models/User');
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

const onlineUsers = new Map();

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

      socket.emit('authenticated', { user });
      socket.broadcast.emit('user-list-update', Array.from(onlineUsers.values()));
      
      console.log('User authenticated:', user.username);
    } catch (error) {
      console.error('Auth error:', error);
      socket.emit('auth-error', { error: 'Authentication failed' });
    }
  });

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

  socket.on('update-avatar', (avatarUrl) => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      User.updateAvatar(user.id, avatarUrl);
      user.avatar = avatarUrl;
      onlineUsers.set(socket.id, user);
      io.emit('avatar-updated', {
        userId: socket.id,
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
      io.emit('user-left', {
        userId: socket.id,
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
