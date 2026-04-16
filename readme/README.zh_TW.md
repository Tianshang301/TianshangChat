# TianshangChat

一款支援公共聊天、私人訊息和群組聊天的即時聊天應用程式。支援 Web、Android 和 Windows 桌面端。

## 功能特點

### 核心功能
- **公共聊天**：所有已連線使用者的即時聊天室
- **私人訊息**：一對一加密對話
- **群組聊天**：建立和管理群組對話
- **語音訊息**：傳送和接收語音錄音
- **自訂頭像**：上傳個人頭像
- **多語言支援**：英語、簡體中文、繁體中文、日語、韓語

### 平台支援
| 平台 | 說明 |
|------|------|
| **Web** | 瀏覽器端應用程式 |
| **Android** | 底部導航行動應用 |
| **Windows** | 帶系統匣的桌面客戶端 |

### 網路功能
- **區域網路支援**：連線至本機網路伺服器
- **手動IP設定**：適用於 Android 和遠端連線
- **跨平台認證**：基於 JWT 的認證，支援記住我

## 技術堆疊

### 前端
- **React** - UI 框架
- **Vite** - 建置工具
- **Socket.io Client** - 即時通訊
- **Capacitor** - 行動應用包裝
- **Electron** - 桌面應用

### 後端
- **Express.js** - REST API 伺服器
- **Socket.io** - WebSocket 伺服器
- **SQLite** - 資料庫
- **bcrypt** - 密碼加密
- **JWT** - 認證

## 專案結構

```
TianshangChat/
├── backend/                    # Express.js 後端伺服器
│   ├── database/              # SQLite 資料庫設定
│   ├── middleware/            # 認證中介軟體
│   ├── models/                # 資料庫模型
│   ├── routes/                # API 路由
│   ├── uploads/               # 上傳的檔案
│   └── server.js              # 主伺服器檔案
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── components/        # React 元件
│   │   ├── context/           # React 上下文
│   │   ├── i18n/              # 國際化翻譯
│   │   └── utils/             # 工具函式
│   ├── android/               # Android 專案 (Capacitor)
│   ├── electron/              # 桌面應用 (Electron)
│   └── capacitor.config.json  # Capacitor 設定
├── electron/                   # Electron 桌面應用
│   ├── main.js                # 主程序
│   └── preload.js             # 預先載入指令碼
└── android-app.apk            # 最新 Android APK
```

## 開始使用

### 前置要求
- Node.js 18+
- npm 或 yarn
- Android：Android Studio、Android SDK
- 桌面端：Node.js

### 後端設定

```bash
cd TianshangChat/backend
npm install
npm start
```

伺服器預設在連接埠 3000 執行。

### 前端 Web 設定

```bash
cd TianshangChat/frontend
npm install
npm run dev
```

### Android 設定

```bash
cd TianshangChat/frontend
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

APK 位於 `android/app/build/outputs/apk/debug/app-debug.apk`

### 桌面端設定

```bash
cd TianshangChat/frontend
npm run build

cd ../electron
npm install
npm start
```

## API 端點

### 認證
| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/auth/register` | 註冊新使用者 |
| POST | `/api/auth/login` | 登入 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/verify` | 驗證令牌 |

### 訊息
| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/messages/history` | 取得公共聊天歷史 |
| GET | `/api/messages/private/:userId` | 取得私人訊息 |
| GET | `/api/messages/private-list` | 取得對話列表 |

### 群組
| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/groups` | 取得使用者的群組 |
| POST | `/api/groups` | 建立群組 |
| POST | `/api/groups/:id/join` | 透過 ID 加入群組 |

### 使用者
| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/users/search?q=` | 搜尋使用者 |

### 上傳
| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/upload/avatar` | 上傳頭像 |
| POST | `/api/upload/voice` | 上傳語音訊息 |

## Socket 事件

### 客戶端 -> 伺服器
- `authenticate` - 使用 JWT 令牌認證
- `send-message` - 傳送公共訊息
- `send-private-message` - 傳送私人訊息
- `send-group-message` - 傳送群組訊息
- `create-group` - 建立新群組
- `join-group` - 加入現有群組

### 伺服器 -> 客戶端
- `authenticated` - 認證成功
- `user-list-update` - 上線使用者變更
- `receive-message` - 新公共訊息
- `receive-private-message` - 新私人訊息
- `receive-group-message` - 新群組訊息
- `group-updated` - 群組設定變更

## 設定

### 後端 (.env)
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

## 資料庫結構

### Users
- id (主鍵)
- username (唯一)
- password_hash
- avatar
- created_at

### Messages
- id (主鍵)
- sender_id
- recipient_id (可為空)
- group_id (可為空)
- type (text/voice)
- content
- audio_url

### Groups
- id (主鍵)
- name
- creator_id
- created_at

### Sessions
- id (主鍵)
- user_id
- token (唯一)
- expires_at
- remember_me

## 授權

MIT 授權