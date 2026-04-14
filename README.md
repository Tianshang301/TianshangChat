# TianshangChat

A real-time chat application with support for public chat, private messaging, and group conversations. Available on Web, Android, and Windows Desktop.

## Features

### Core Features
- **Public Chat**: Real-time chat room for all connected users
- **Private Messaging**: One-on-one encrypted conversations
- **Group Chat**: Create and manage group conversations
- **Voice Messages**: Send and receive voice recordings
- **Custom Avatars**: Upload personal profile pictures
- **Multi-language Support**: English, Chinese (Simplified/Traditional), Japanese, Korean

### Platform Support
| Platform | Description |
|----------|-------------|
| **Web** | Browser-based application |
| **Android** | Mobile app with bottom navigation |
| **Windows** | Desktop client with system tray |

### Networking
- **LAN Support**: Connect to servers on local network
- **Manual IP Configuration**: For Android and remote connections
- **Cross-platform Authentication**: JWT-based auth with remember-me

## Tech Stack

### Frontend
- **React** - UI framework
- **Vite** - Build tool
- **Socket.io Client** - Real-time communication
- **Capacitor** - Mobile app wrapper
- **Electron** - Desktop application

### Backend
- **Express.js** - REST API server
- **Socket.io** - WebSocket server
- **SQLite** - Database
- **bcrypt** - Password hashing
- **JWT** - Authentication

## Project Structure

```
TianshangChat/
├── backend/                    # Express.js backend server
│   ├── database/              # SQLite database setup
│   ├── middleware/            # Auth middleware
│   ├── models/                # Database models
│   ├── routes/                # API routes
│   ├── uploads/               # Uploaded files
│   └── server.js              # Main server file
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── context/           # React contexts
│   │   ├── i18n/              # Translations
│   │   └── utils/             # Utilities
│   ├── android/               # Android project (Capacitor)
│   ├── electron/              # Desktop app (Electron)
│   └── capacitor.config.json  # Capacitor config
├── electron/                   # Electron desktop app
│   ├── main.js                # Main process
│   └── preload.js             # Preload script
└── android-app.apk            # Latest Android APK
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- For Android: Android Studio, Android SDK
- For Desktop: Node.js

### Backend Setup

```bash
cd TianshangChat/backend
npm install
npm start
```

The server runs on port 3000 by default.

### Frontend Web Setup

```bash
cd TianshangChat/frontend
npm install
npm run dev
```

### Android Setup

```bash
cd TianshangChat/frontend
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

The APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`

### Desktop Setup

```bash
cd TianshangChat/frontend
npm run build

cd ../electron
npm install
npm start
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/verify` | Verify token |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/history` | Get public chat history |
| GET | `/api/messages/private/:userId` | Get private messages |
| GET | `/api/messages/private-list` | Get conversation list |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | Get user's groups |
| POST | `/api/groups` | Create group |
| POST | `/api/groups/:id/join` | Join group by ID |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/search?q=` | Search users |

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/avatar` | Upload avatar |
| POST | `/api/upload/voice` | Upload voice message |

## Socket Events

### Client -> Server
- `authenticate` - Authenticate with JWT token
- `send-message` - Send public message
- `send-private-message` - Send private message
- `send-group-message` - Send group message
- `create-group` - Create new group
- `join-group` - Join existing group

### Server -> Client
- `authenticated` - Authentication successful
- `user-list-update` - Online users changed
- `receive-message` - New public message
- `receive-private-message` - New private message
- `receive-group-message` - New group message
- `group-updated` - Group settings changed

## Configuration

### Backend (.env)
```
PORT=3000
JWT_SECRET=your-secret-key
```

### Capacitor (capacitor.config.json)
```json
{
  "server": {
    "hostname": "localhost",
    "androidScheme": "http"
  }
}
```

## Database Schema

### Users
- id (PRIMARY KEY)
- username (UNIQUE)
- password_hash
- avatar
- created_at

### Messages
- id (PRIMARY KEY)
- sender_id
- recipient_id (nullable)
- group_id (nullable)
- type (text/voice)
- content
- audio_url

### Groups
- id (PRIMARY KEY)
- name
- creator_id
- created_at

### Sessions
- id (PRIMARY KEY)
- user_id
- token (UNIQUE)
- expires_at
- remember_me

## License

MIT License
