# TianshangChat

一款支持公共聊天、私人消息和群组聊天的实时聊天应用。支持 Web、Android 和 Windows 桌面端。

## 功能特点

### 核心功能
- **公共聊天**：所有已连接用户的实时聊天室
- **私人消息**：一对一加密对话
- **群组聊天**：创建和管理群组对话
- **语音消息**：发送和接收语音录音
- **自定义头像**：上传个人头像
- **多语言支持**：英语、简体中文、繁体中文、日语、韩语

### 平台支持
| 平台 | 说明 |
|------|------|
| **Web** | 浏览器端应用 |
| **Android** | 底部导航移动应用 |
| **Windows** | 带系统托盘的桌面客户端 |
Tianshang
### 网络功能
- **局域网支持**：连接本地网络服务器
- **手动IP配置**：适用于 Android 和远程连接
- **跨平台认证**：基于 JWT 的认证，支持记住我

## 技术栈

### 前端
- **React** - UI 框架
- **Vite** - 构建工具
- **Socket.io Client** - 实时通信
- **Capacitor** - 移动应用包装
- **Electron** - 桌面应用

### 后端
- **Express.js** - REST API 服务器
- **Socket.io** - WebSocket 服务器
- **SQLite** - 数据库
- **bcrypt** - 密码加密
- **JWT** - 认证

## 项目结构

```
TianshangChat/
├── backend/                    # Express.js 后端服务器
│   ├── database/              # SQLite 数据库设置
│   ├── middleware/            # 认证中间件
│   ├── models/                # 数据库模型
│   ├── routes/                # API 路由
│   ├── uploads/               # 上传的文件
│   └── server.js              # 主服务器文件
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── components/        # React 组件
│   │   ├── context/           # React 上下文
│   │   ├── i18n/              # 国际化翻译
│   │   └── utils/             # 工具函数
│   ├── android/               # Android 项目 (Capacitor)
│   ├── electron/              # 桌面应用 (Electron)
│   └── capacitor.config.json  # Capacitor 配置
├── electron/                   # Electron 桌面应用
│   ├── main.js                # 主进程
│   └── preload.js             # 预加载脚本
└── android-app.apk            # 最新 Android APK
```

## 开始使用

### 前置要求
- Node.js 18+
- npm 或 yarn
- Android：Android Studio、Android SDK
- 桌面端：Node.js

### 后端设置

```bash
cd TianshangChat/backend
npm install
npm start
```

服务器默认运行在端口 3000。

### 前端 Web 设置

```bash
cd TianshangChat/frontend
npm install
npm run dev
```

### Android 设置

```bash
cd TianshangChat/frontend
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

APK 位于 `android/app/build/outputs/apk/debug/app-debug.apk`

### 桌面端设置

```bash
cd TianshangChat/frontend
npm run build

cd ../electron
npm install
npm start
```

## API 端点

### 认证
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册新用户 |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/verify` | 验证令牌 |

### 消息
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/messages/history` | 获取公共聊天历史 |
| GET | `/api/messages/private/:userId` | 获取私人消息 |
| GET | `/api/messages/private-list` | 获取会话列表 |

### 群组
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/groups` | 获取用户的群组 |
| POST | `/api/groups` | 创建群组 |
| POST | `/api/groups/:id/join` | 通过 ID 加入群组 |

### 用户
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/users/search?q=` | 搜索用户 |

### 上传
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/upload/avatar` | 上传头像 |
| POST | `/api/upload/voice` | 上传语音消息 |

## Socket 事件

### 客户端 -> 服务器
- `authenticate` - 使用 JWT 令牌认证
- `send-message` - 发送公共消息
- `send-private-message` - 发送私人消息
- `send-group-message` - 发送群组消息
- `create-group` - 创建新群组
- `join-group` - 加入现有群组

### 服务器 -> 客户端
- `authenticated` - 认证成功
- `user-list-update` - 在线用户变更
- `receive-message` - 新公共消息
- `receive-private-message` - 新私人消息
- `receive-group-message` - 新群组消息
- `group-updated` - 群组设置变更

## 配置

### 后端 (.env)
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

## 数据库架构

### Users
- id (主键)
- username (唯一)
- password_hash
- avatar
- created_at

### Messages
- id (主键)
- sender_id
- recipient_id (可为空)
- group_id (可为空)
- type (text/voice)
- content
- audio_url

### Groups
- id (主键)
- name
- creator_id
- created_at

### Sessions
- id (主键)
- user_id
- token (唯一)
- expires_at
- remember_me

## 许可证

MIT 许可证
