# TianshangChat

パブリックチャット、プライベートメッセージ、グループ会話に対応したリアルタイムチャットアプリケーション。Web、Android、Windows デスクトップで利用可能。

## 機能

### コア機能
- **パブリックチャット**：接続された全ユーザーのリアルタイムチャットルーム
- **プライベートメッセージ**：1対1の暗号化会話
- **グループチャット**：グループ会話の作成と管理
- **音声メッセージ**：音声録音の送信と受信
- **カスタムアバター**：プロフィール画像をアップロード
- **多言語対応**：英語、中国語（簡体字/繁体字）、日本語、韓国語

### プラットフォーム対応
| プラットフォーム | 説明 |
|-----------------|------|
| **Web** | ブラウザベースのアプリケーション |
| **Android** | 底部ナビゲーション付きモバイルアプリ |
| **Windows** | システムトレイ付きデスクトップクライアント |

### ネットワーク
- **LANサポート**：ローカルネットワーク上のサーバーに接続
- **手動IP設定**：Androidおよびリモート接続用
- **クロスプラットフォーム認証**：JWTベースの認証、ログイン保持機能

## 技術スタック

### フロントエンド
- **React** - UIフレームワーク
- **Vite** - ビルドツール
- **Socket.io Client** - リアルタイム通信
- **Capacitor** - モバイルアプリラッパー
- **Electron** - デスクトップアプリケーション

### バックエンド
- **Express.js** - REST APIサーバー
- **Socket.io** - WebSocketサーバー
- **SQLite** - データベース
- **bcrypt** - パスワードハッシュ化
- **JWT** - 認証

## プロジェクト構造

```
TianshangChat/
├── backend/                    # Express.js バックエンドサーバー
│   ├── database/              # SQLite データベース設定
│   ├── middleware/            # 認証ミドルウェア
│   ├── models/                // データベースモデル
│   ├── routes/                # APIルート
│   ├── uploads/               # アップロードされたファイル
│   └── server.js              # メインサーバーファイル
├── frontend/                   # React フロントエンド
│   ├── src/
│   │   ├── components/        # React コンポーネント
│   │   ├── context/           # React コンテキスト
│   │   ├── i18n/              # 翻訳ファイル
│   │   └── utils/             # ユーティリティ
│   ├── android/               # Android プロジェクト (Capacitor)
│   ├── electron/              # デスクトップアプリ (Electron)
│   └── capacitor.config.json  # Capacitor 設定
├── electron/                   # Electron デスクトップアプリ
│   ├── main.js                # メインプロセス
│   └── preload.js             # プレロードスクリプト
└── android-app.apk            # 最新 Android APK
```

## 始め方

### 前提条件
- Node.js 18+
- npm または yarn
- Android: Android Studio、Android SDK
- デスクトップ: Node.js

### バックエンド設定

```bash
cd TianshangChat/backend
npm install
npm start
```

サーバーはデフォルトでポート3000で起動します。

### フロントエンド Web 設定

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

APKは `android/app/build/outputs/apk/debug/app-debug.apk` にあります。

### デスクトップ設定

```bash
cd TianshangChat/frontend
npm run build

cd ../electron
npm install
npm start
```

## APIエンドポイント

### 認証
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | `/api/auth/register` | 新規ユーザー登録 |
| POST | `/api/auth/login` | ログイン |
| POST | `/api/auth/logout` | ログアウト |
| GET | `/api/auth/verify` | トークン検証 |

### メッセージ
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/messages/history` | パブリックチャット履歴取得 |
| GET | `/api/messages/private/:userId` | プライベートメッセージ取得 |
| GET | `/api/messages/private-list` | 会話リスト取得 |

### グループ
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/groups` | ユーザーのグループ取得 |
| POST | `/api/groups` | グループ作成 |
| POST | `/api/groups/:id/join` | IDでグループに参加 |

### ユーザー
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/users/search?q=` | ユーザー検索 |

### アップロード
| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | `/api/upload/avatar` | アバターアップロード |
| POST | `/api/upload/voice` | 音声メッセージアップロード |

## Socketイベント

### クライアント -> サーバー
- `authenticate` - JWTトークンで認証
- `send-message` - パブリックメッセージ送信
- `send-private-message` - プライベートメッセージ送信
- `send-group-message` - グループメッセージ送信
- `create-group` - 新規グループ作成
- `join-group` - 既存グループに参加

### サーバー -> クライアント
- `authenticated` - 認証成功
- `user-list-update` - オンラインユーザー変更
- `receive-message` - 新規パブリックメッセージ
- `receive-private-message` - 新規プライベートメッセージ
- `receive-group-message` - 新規グループメッセージ
- `group-updated` - グループ設定変更

## 設定

### バックエンド (.env)
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

## データベーススキーマ

### Users
- id (主キー)
- username (一意)
- password_hash
- avatar
- created_at

### Messages
- id (主キー)
- sender_id
- recipient_id (nullable)
- group_id (nullable)
- type (text/voice)
- content
- audio_url

### Groups
- id (主キー)
- name
- creator_id
- created_at

### Sessions
- id (主キー)
- user_id
- token (一意)
- expires_at
- remember_me

## ライセンス

MIT ライセンス