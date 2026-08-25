# TianshangChat

- en [English](../README.md)
- zh_CN [简体中文](README.zh_CN.md)
- zh_TW [繁體中文](README.zh_TW.md)
- ja [日本語](README.ja.md)
- ko [한국어](README.ko.md)

公開チャンネル・個人チャット・グループ会話に対応したリアルタイムチャットアプリ——オフライン対応・エンドツーエンド暗号化・プラグインで拡張可能。Web（PWA）・Android・Windows デスクトップで利用できます。

> **注記**：本プロジェクトは段階的に工業化を進めています（エンジニアリング基準は [AGENTS.md](../AGENTS.md) を参照）。Phase 0–5 はマージ済み：pnpm モノレポ、全面 TypeScript、E2EE、オフラインファースト、テスト/CI 基盤、PWA + プラグインシステム。

## 主な機能

### コア機能
- **公開チャット**：全ユーザーが参加するリアルタイムチャットルーム
- **個人チャット**：1対1の会話
- **グループチャット**：作成 / ID で参加、メンバー権限（creator/admin/member）、オーナーは退会不可
- **ボイスメッセージ**：録音と再生
- **カスタムアバター**：プロフィール画像のアップロード
- **多言語対応**：英語・簡体字中国語・繁体字中国語・日本語・韓国語
- **入力中表示・未読バッジ**：公開・個人ともに対応

### セキュリティ（E2EE）
- **個人チャット**は簡略化 Signal 方式：X3DH 鍵合意 + Double Ratchet
- **グループ**は Sender Keys（送信者側が配布し、サーバーは関与しない）
- サーバーは暗号文のみ保存（`e2ee:v1.*` / `gsk:v1.*` エンベロープ）；平文は端末上にのみ存在
- ローカルメッセージキャッシュは書き出し不可のデバイス鍵で暗号化（WebCrypto）
- スクリーンショット防止：Electron `setContentProtection`、Android `FLAG_SECURE`

### オフラインファースト
- ローカルキャッシュ（IndexedDB/Dexie）によりオフラインでも履歴閲覧可
- 送信トレイqueue + 指数バックオフ再試行——オフライン送信メッセージは再接続時に自動送信
- 配信レシート：`sending → sent → delivered → read` ステータスマシン
- 増分同期（`GET /api/sync?cursor=`）、再接続・起動時に取得

### PWA と Web Push
- インストール可能な Web アプリ（manifest、Service Worker、app-shell キャッシュ）
- タブを閉じている・バックグラウンド時の Web Push 通知（VAPID）
- アップロード媒体（アバター/音声）はキャッシュ優先で即時再生

### プラグインシステム
- サードパーティ製プラグインがホスト変更なしで機能を登録：スラッシュコマンド、メッセージオブザーバー、送信トランスフォーマー、設定ストレージ
- 権限ゲート API（manifest 宣言された能力を実行時に強制検証）
- 同梱サンプル `ai-assistant`：`/ai <質問>` と `/translate <テキスト>`。OpenAI 互換エンドポイントに対応（ローカル [Ollama](https://ollama.com) でそのまま動作）

### プラットフォーム対応
| プラットフォーム | 説明 |
|------|------|
| **Web / PWA** | ブラウザアプリ；インストール可・オフライン対応・Push 対応 |
| **Android** | Capacitor シェル + ボトムナビゲーション |
| **Windows** | Electron デスクトップクライアント + システムトレイ |

## 技術スタック

- **言語**：TypeScript（strict モード、`any` 禁止）——サーバー・Web・共有パッケージ全体
- **モノレポ**：pnpm workspaces + Turborepo
- **フロントエンド**：React 18、Vite、vite-plugin-pwa、Dexie (IndexedDB)、Socket.IO クライアント、Capacitor、Electron
- **バックエンド**：Node.js、Express、Socket.IO、Drizzle ORM + better-sqlite3、Zod バリデーション、helmet/rate-limit/CORS ホワイトリスト、bcrypt + JWT セッション
- **暗号**：自己管理の簡略 Signal 実装（@noble/curves + hashes + ciphers）
- **テスト**：Vitest（単体 + Supertest による一時 SQLite 統合テスト）、Playwright（E2E）
- **CI/CD**：GitHub Actions（lint → typecheck → unit → integration → build → docker)；Docker Compose デプロイ（server + Caddy TLS + coturn）

## プロジェクト構成

```
TianshangChat/
├── apps/
│   ├── server/               # Express + Socket.IO API（TypeScript）
│   │   └── src/
│   │       ├── api/routes/   # auth, messages, groups, users, sync, e2ee, push, upload
│   │       ├── socket/handlers/
│   │       ├── infra/        # Drizzle schema + DB ブートストラップ
│   │       └── app.ts        # アプリファクトリ（テストでも使用）
│   ├── web/                  # React 18 + Vite PWA
│   │   └── src/
│   │       ├── core/         # 暗号グルーコード、Push クライアント、純粋ロジック
│   │       ├── domain/       # ユースケース（メッセージ、グループ、E2EE 準備）
│   │       ├── data/         # Dexie リポジトリ、ソケットアダプタ
│   │       ├── state/        # チャット/UI ストア
│   │       ├── plugins/      # プラグインホストローダ
│   │       └── ui/           # React コンポーネント
│   └── desktop/              # Electron シェル（web ビルドを再利用）
├── packages/
│   ├── shared/               # ソケットイベント型、Zod DTO、エラーコード
│   ├── core/                 # 各端末共通の純粋ロジック
│   ├── crypto/               # X3DH / Double Ratchet / Sender Keys（KAT 付き）
│   └── plugins-sdk/          # プラグイン manifest schema + ホスト API 契約
├── android/                  # Capacitor Android プロジェクト
├── docs/                     # エンジニアリングレポート（pwa-vs-capacitor 等）
├── docker-compose.yml        # server + Caddy (TLS) + coturn
└── AGENTS.md                 # エンジニアリング基準とロードマップ
```

## はじめに

### 必要要件
- Node.js 22+
- pnpm 11+（`corepack enable`）

### セットアップ

```bash
pnpm install

# サーバー設定
cp apps/server/.env.example apps/server/.env
#   - JWT_SECRET を設定（生成コマンドはファイル内に記載）
#   - Web Push を使う場合は VAPID_* 鍵を設定：
#       npx web-push generate-vapid-keys

# データベースマイグレーション実行
pnpm db:migrate

# server + web 開発サーバー起動（Turbo）
pnpm dev
```

Web アプリは http://localhost:5173 で起動（API の :3000 へプロキシ）。

### 本番ビルド

```bash
pnpm build        # 全パッケージ・アプリ
pnpm --filter @tianshangchat/web preview   # ビルド済み PWA をローカル表示
```

### Android

```bash
pnpm --filter @tianshangchat/web build
npx cap sync android
cd android && ./gradlew assembleDebug
```

### Docker デプロイ

```bash
docker compose up -d    # server + Caddy（自動 TLS）+ coturn リレー
```

## コマンド一覧

| コマンド | 説明 |
|---------|-------------|
| `pnpm dev` | server + web をウォッチモードで起動 |
| `pnpm build` | 全パッケージ/アプリをビルド |
| `pnpm lint` | ESLint（警告ゼロ） |
| `pnpm typecheck` | ワークスペース全体 `tsc --noEmit` |
| `pnpm test` | Vitest 単体 + 統合テスト |
| `pnpm test:e2e` | Playwright E2E テスト |
| `pnpm db:migrate` | Drizzle マイグレーション適用 |

## 設定（`apps/server/.env`）

| 変数 | 必須 | 説明 |
|------|------|------|
| `PORT` | いいえ（既定 3000） | HTTP ポート |
| `NODE_ENV` | いいえ | development / production |
| `JWT_SECRET` | **はい** | セッション署名鍵 |
| `DATABASE_PATH` | いいえ | SQLite ファイルの場所 |
| `UPLOAD_DIR` | いいえ | `/uploads` で提供するディレクトリ |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | いいえ | Web Push（空なら無効） |

## API 概要

すべてのリクエストボディは Zod で検証。認証は JWT Bearer。

### 認証
| メソッド | エンドポイント | 説明 |
|--------|----------|-------------|
| POST | `/api/auth/register` | 登録 |
| POST | `/api/auth/login` | ログイン（レート制限あり） |
| POST | `/api/auth/logout` | セッション無効化 |
| GET | `/api/auth/verify` | トークン検証 |
| GET | `/api/auth/user` | 現在のユーザープロフィール |

### メッセージと同期
| メソッド | エンドポイント | 説明 |
|--------|----------|-------------|
| GET | `/api/messages/history` | 公開チャンネル履歴 |
| GET | `/api/messages/private/:userId` | 特定ユーザーとの個人履歴 |
| GET | `/api/messages/private-list` | 会話リスト |
| GET | `/api/messages/unread` | 未読カウント |
| GET | `/api/sync?cursor=` | 増分同期フィード |

### グループ
| メソッド | エンドポイント | 説明 |
|--------|----------|-------------|
| GET / POST | `/api/groups` | 自分のグループ / 作成 |
| GET | `/api/groups/:id` | グループ詳細 |
| PUT / DELETE | `/api/groups/:id` | 更新 / 削除（オーナー） |
| GET | `/api/groups/:id/messages` | グループ履歴 |
| GET / POST | `/api/groups/:id/members` | メンバー一覧 / 追加 |
| DELETE | `/api/groups/:id/members/:userId` | メンバー削除 |
| PUT | `/api/groups/:id/admin/:userId` | 管理者任命/解任 |
| POST | `/api/groups/:id/join` | ID で参加 |
| POST | `/api/groups/:id/leave` | 退会（オーナーは不可） |
| POST | `/api/groups/:id/transfer` | オーナー移譲 |

### ユーザー
| メソッド | エンドポイント | 説明 |
|--------|----------|-------------|
| GET | `/api/users/search?q=` | ユーザー検索 |
| GET | `/api/users/:id` | ユーザープロフィール |

### E2EE / Push / アップロード
| メソッド | エンドポイント | 説明 |
|--------|----------|-------------|
| PUT / GET | `/api/e2ee/bundle`、`/api/e2ee/bundle/:userId` | プリキーバンドルの公開/取得 |
| GET | `/api/push/vapid-public` | VAPID 公開鍵の取得 |
| POST | `/api/push/subscribe` / `/api/push/unsubscribe` | Push 購読の管理 |
| POST | `/api/upload/avatar` / `/api/upload/voice` | アップロード（種別+サイズ+パス許可リスト） |

## Socket プロトコル

イベント名とペイロードは `@tianshangchat/shared` に型定義されています（`ClientToServerEvents` / `ServerToClientEvents`）。主なもの：

- **クライアント → サーバー**：`send-message`、`send-private-message`、`send-group-message` とボイス版（`send-*-voice`）、`create-group`、`join-group`、`leave-group`、`mark-delivered`、`mark-read`、入力中表示、`update-avatar`
- **サーバー → クライアント**：`receive-message`、`receive-private-message`、`receive-group-message`、`message-status`、プレゼンス（`user-list-update`、`user-left`）、グループライフサイクル（`group-created`、`group-updated`、`member-joined`、`member-left`）、`avatar-updated`、`auth-error`

個人/グループのメッセージ本文は E2EE エンベロープで転送され、サーバーは平文を見ることができません。

## プラグイン

ホストコードに触れない拡張手段：

1. `manifest` と `activate(api)`（任意で `deactivate`）をエクスポートする ESM JS モジュールを用意
2. `apps/web/public/plugins/registry.json` に登録：

```json
[
  { "id": "my-plugin", "entry": "/plugins/my-plugin/index.js", "enabled": true }
]
```

Manifest には権限を宣言します——`settings`、`messages:observe`、`messages:transform`、`commands:register`——それぞれ対応する `PluginApi` 群が解放され、未許可の呼び出しは実行時に例外になります。

同梱の `ai-assistant` プラグインが全機能を実演：

```
/ai ラチェット鍵はどうローテーションする？
/translate Good morning, everyone.
```

OpenAI 互換エンドポイントを呼び出します（既定はローカル Ollama `http://127.0.0.1:11434/v1`）。ベース URL/モデル/キーはデバイス側のプラグイン設定に保存され、チャットサーバーには送信されません。契約の詳細は [`packages/plugins-sdk`](../packages/plugins-sdk/src/plugin.ts) を参照。

## データベース

SQLite + Drizzle ORM（マイグレーションは `apps/server/drizzle/`）：`users`、`sessions`、`messages`（E2EE 対象は暗号文）、`groups`、`group_members`、`e2ee_bundles`、`push_subscriptions`。

## ライセンス

MIT License
