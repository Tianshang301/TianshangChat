# TianshangChat

**TianshangChat** is a real-time online chat room application with text messaging, customizable avatars, and voice messaging. The frontend is built with **React** (chosen for its ecosystem and flexibility) and **HTML/CSS**, while the backend runs on **Node.js** with WebSocket (Socket.io) for real-time communication. The project can be packaged as a Windows installer (`.exe`) using Electron, and as an Android APK (`.apk`) using Capacitor.

## Table of Contents

- [Multi-Language Documentation](#multi-language-documentation)
  - [English](#english)
  - [简体中文](#简体中文)
  - [日本語](#日本語)
  - [한국어](#한국어)
  - [繁體中文](#繁體中文)

---

## Multi-Language Documentation

### English

#### 1. File Directory

```
TianshangChat/
├── frontend/                 # React frontend
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatRoom.jsx      # Main chat interface
│   │   │   ├── MessageList.jsx   # Displays message history
│   │   │   ├── MessageInput.jsx  # Text input & send button
│   │   │   ├── UserAvatar.jsx    # Avatar display and upload
│   │   │   ├── VoiceRecorder.jsx # Voice recording & playback
│   │   │   └── Sidebar.jsx       # Online users list
│   │   ├── App.jsx               # Root component, WebSocket setup
│   │   ├── index.css             # Global styles
│   │   └── main.jsx              # Entry point
│   ├── package.json
│   └── vite.config.js            # Vite configuration
├── backend/                  # Node.js backend
│   ├── server.js             # Main server (Express + Socket.io)
│   ├── routes/
│   │   └── upload.js         # Avatar image upload handling
│   ├── controllers/
│   │   └── userController.js # User logic (avatar update, etc.)
│   ├── models/
│   │   └── Message.js        # Message data structure (optional)
│   ├── uploads/              # Stored avatars and voice files
│   ├── package.json
│   └── .env                  # Environment variables
├── electron/                 # Electron packaging for Windows
│   ├── main.js               # Electron main process
│   ├── preload.js            # Preload script
│   └── installer/            # NSIS/electron-builder scripts
├── android/                  # Capacitor Android project
│   ├── app/                  # Generated Android studio project
│   └── capacitor.config.json # Capacitor config
├── README.md
└── .gitignore
```

#### 2. Features & Implementation Details

- **Text Chat (Typing & Messaging)**
  
  - Real-time message exchange via **Socket.io** (WebSocket).
  - Messages include sender name, avatar, timestamp, and content.
  - "User is typing..." indicator.

- **Avatar Replacement**
  
  - Users can upload a custom avatar (JPG/PNG) from local device.
  - Backend stores avatars in `uploads/avatars/` and serves via static route.
  - Avatar is broadcasted to all chat participants instantly.

- **Voice Chat (Voice Messaging)**
  
  - Record voice messages using browser's `MediaRecorder` API.
  - Send recorded audio (WebM/MP3) to backend; stored in `uploads/voice/`.
  - Playback in chat with a voice message bubble.
  - *(Optional extension: Real-time voice call using WebRTC)*

#### 3. Build & Package

##### Windows Installer (`.exe`)

- Use **Electron** + **electron-builder** to package the frontend as a desktop app.
- Steps:
  
  ```bash
  cd frontend
  npm run build          # Build React static files
  cd ../electron
  npm install
  npm run dist           # Generate installer.exe in /dist
  ```
- Output: `TianshangChat Setup.exe` (Windows installer).

##### Android APK (`.apk`)

- Use **Capacitor** to wrap the web app into native Android.
- Steps:
  
  ```bash
  cd frontend
  npm run build
  npx cap init TianshangChat com.tianshang.chat
  npx cap add android
  npx cap copy
  npx cap open android   # Open in Android Studio
  # Build signed APK from Android Studio (Build → Build Bundle(s) / APK(s))
  ```
- Output: `TianshangChat.apk` (ready for installation).

#### 4. Project Name

**TianshangChat**

#### 5. Supported Languages in UI

- English, Simplified Chinese, Japanese, Korean, Traditional Chinese (i18n ready).

---

### 简体中文

#### 1. 文件目录

同上（英文部分），结构一致。

#### 2. 功能实现细节

- **文字聊天**
  - 基于 Socket.io 的实时消息收发，支持“正在输入”提示。
- **头像替换**
  - 用户可上传本地图片作为头像，后端存储并广播更新。
- **语音聊天**
  - 浏览器录音（MediaRecorder），发送语音消息，后端存储并在聊天中播放。

#### 3. 编译打包

##### Windows 安装程序（`.exe`）

- 使用 Electron + electron-builder 打包为桌面应用。
- 执行上述英文步骤中的命令，生成 `TianshangChat Setup.exe`。

##### Android APK（`.apk`）

- 使用 Capacitor 将 Web 应用转为 Android 原生应用。
- 执行上述英文步骤，通过 Android Studio 生成签名 APK。

#### 4. 项目名称

**TianshangChat**

#### 5. 界面支持语言

英语、简体中文、日语、韩语、繁体中文（已做国际化）。

---

### 日本語

#### 1. ファイルディレクトリ

英語版と同じ。

#### 2. 機能詳細

- **テキストチャット**
  - Socket.ioによるリアルタイムメッセージ交換。「入力中…」表示。
- **アバター変更**
  - ローカルから画像をアップロード、サーバー保存、全員に反映。
- **ボイスチャット（ボイスメッセージ）**
  - ブラウザで録音→音声メッセージ送信→再生可能。

#### 3. ビルドとパッケージング

##### Windowsインストーラ（`.exe`）

- Electron + electron-builder を使用。`TianshangChat Setup.exe` が生成される。

##### Android APK（`.apk`）

- Capacitor を使用。Android Studio で署名付きAPKをビルド。

#### 4. プロジェクト名

**TianshangChat**

#### 5. UI対応言語

英語、日本語、中国語（簡体字/繁体字）、韓国語。

---

### 한국어

#### 1. 파일 디렉터리

영어 버전과 동일.

#### 2. 기능 세부사항

- **텍스트 채팅**
  - Socket.io 기반 실시간 메시지, "입력 중..." 표시.
- **아바타 교체**
  - 로컬 이미지 업로드 → 서버 저장 → 즉시 업데이트.
- **음성 채팅 (음성 메시지)**
  - 브라우저 녹음 → 음성 메시지 전송 → 재생 가능.

#### 3. 빌드 및 패키징

##### Windows 설치 프로그램 (`.exe`)

- Electron + electron-builder 사용. `TianshangChat Setup.exe` 생성.

##### Android APK (`.apk`)

- Capacitor 사용. Android Studio에서 서명된 APK 빌드.

#### 4. 프로젝트명

**TianshangChat**

#### 5. UI 지원 언어

영어, 한국어, 중국어(간체/번체), 일본어.

---

### 繁體中文

#### 1. 檔案目錄

同英文部分。

#### 2. 功能實作細節

- **文字聊天**
  - 基於 Socket.io 即時訊息，支援「正在輸入」提示。
- **頭像替換**
  - 上傳本地圖片作為頭像，後端儲存並廣播更新。
- **語音聊天**
  - 瀏覽器錄音（MediaRecorder），發送語音訊息，後端儲存並播放。

#### 3. 編譯打包

##### Windows 安裝程式（`.exe`）

- 使用 Electron + electron-builder 打包桌面應用。產生 `TianshangChat Setup.exe`。

##### Android APK（`.apk`）

- 使用 Capacitor 將網頁應用轉為 Android 原生應用。透過 Android Studio 產生簽章 APK。

#### 4. 專案名稱

**TianshangChat**

#### 5. 界面支援語言

英文、繁體中文、簡體中文、日文、韓文（已做國際化）。

---

## Getting Started (Quick Start)

```bash
# Clone repository
git clone https://github.com/your-repo/TianshangChat.git
cd TianshangChat

# Backend setup
cd backend
npm install
npm start          # Runs on http://localhost:3000

# Frontend setup (another terminal)
cd frontend
npm install
npm run dev        # Runs on http://localhost:5173

# For production builds, refer to packaging sections above.
```

## Requirements

- Node.js 18+
- npm or yarn
- Android Studio (for APK build)
- Electron (for Windows installer)

## License

MIT

---

**TianshangChat** – Chat freely, across any language and platform.
