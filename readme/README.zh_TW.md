# TianshangChat

[![CI](https://github.com/Tianshang301/TianshangChat/actions/workflows/ci.yml/badge.svg)](https://github.com/Tianshang301/TianshangChat/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)

- en [English](../README.md)
- zh_CN [简体中文](README.zh_CN.md)
- zh_TW [繁體中文](README.zh_TW.md)
- ja [日本語](README.ja.md)
- ko [한국어](README.ko.md)

一套支援公開頻道、私訊與群組聊天的即時通訊應用——離線可用、端對端加密、可透過外掛擴充。涵蓋 Web（PWA）、Android 與 Windows 桌面端。

> **說明**：專案正依階段進行工業化改造（工程基準見 [AGENTS.md](../AGENTS.md)）。Phase 0–5 已合併：pnpm monorepo、全面 TypeScript、E2EE、離線優先、測試/CI 體系、PWA + 外掛系統。

## 功能特色

### 核心功能
- **公開聊天**：所有線上使用者的即時聊天室
- **私訊**：一對一對話
- **群組聊天**：建立 / 以 ID 加入、成員角色（creator/admin/member）、群主不可退出
- **語音訊息**：錄製與播放語音
- **自訂頭像**：上傳個人資料圖片
- **多語言支援**：英語、簡體中文、繁體中文、日語、韓語
- **輸入狀態與未讀標記**：公開與私訊皆支援

### 安全（E2EE）
- **私訊**採用精簡版 Signal 協定：X3DH 金鑰協商 + Double Ratchet 棘輪
- **群組**採用 Sender Keys（由發送方分發，伺服器不經手）
- 伺服器只儲存密文（`e2ee:v1.*` / `gsk:v1.*` 信封）；明文僅存在於裝置上
- 本地訊息快取以不可匯出的裝置金鑰加密（WebCrypto）
- 防截圖：Electron `setContentProtection`、Android `FLAG_SECURE`

### 離線優先
- 本地快取（IndexedDB/Dexie），斷網可讀歷史訊息
- 寄件匣佇列 + 指數退避重試——離線送出的訊息在重連後自動補送
- 傳送回執：`sending → sent → delivered → read` 狀態機
- 增量同步（`GET /api/sync?cursor=`），重連/啟動時補拉

### PWA 與 Web 推播
- 可安裝的 Web 應用（manifest、Service Worker、app-shell 快取）
- 分頁關閉或背景時的 Web Push 通知（VAPID）
- 上傳媒體（頭像/語音）快取優先，重播即時

### 外掛系統
- 第三方外掛無須修改宿主即可註冊能力：斜線指令、訊息觀察器、出站轉換器、設定儲存
- 權限閘門 API（manifest 宣告的能力在執行時強制驗證）
- 內建範例外掛 `ai-assistant`：`/ai <提問>` 與 `/translate <文字>`，相容任意 OpenAI 相容端點（搭配本機 [Ollama](https://ollama.com) 開箱即用）

### 平台支援
| 平台 | 說明 |
|------|------|
| **Web / PWA** | 瀏覽器端應用；可安裝、離線可用、支援推播 |
| **Android** | Capacitor 殼 + 底部導覽 |
| **Windows** | Electron 桌面客戶端 + 系統匣 |

## 技術堆疊

- **語言**：TypeScript（strict 模式，零 `any`）涵蓋伺服器、Web 與共享套件
- **Monorepo**：pnpm workspaces + Turborepo
- **前端**：React 18、Vite、vite-plugin-pwa、Dexie (IndexedDB)、Socket.IO 客戶端、Capacitor、Electron
- **後端**：Node.js、Express、Socket.IO、Drizzle ORM + better-sqlite3、Zod 驗證、helmet/rate-limit/CORS 白名單、bcrypt + JWT 工作階段
- **加密**：自行維護的精簡 Signal 實作（@noble/curves + hashes + ciphers）
- **測試**：Vitest（單元 + 基於 Supertest 的臨時 SQLite 整合測試）、Playwright（E2E）
- **CI/CD**：GitHub Actions（lint → typecheck → unit → integration → build → docker)；Docker Compose 部署（server + Caddy TLS + coturn）

## 專案結構

```
TianshangChat/
├── apps/
│   ├── server/               # Express + Socket.IO API（TypeScript）
│   │   └── src/
│   │       ├── api/routes/   # auth, messages, groups, users, sync, e2ee, push, upload
│   │       ├── socket/handlers/
│   │       ├── infra/        # Drizzle schema + 資料庫初始化
│   │       └── app.ts        # 應用工廠（測試亦複用）
│   ├── web/                  # React 18 + Vite PWA
│   │   └── src/
│   │       ├── core/         # 加密銜接層、推播客戶端、純邏輯
│   │       ├── domain/       # 使用案例層（訊息、群組、E2EE 建立）
│   │       ├── data/         # Dexie 儲存庫、Socket 轉接器
│   │       ├── state/        # 聊天/UI 狀態
│   │       ├── plugins/      # 外掛宿主載入器
│   │       └── ui/           # React 元件
│   └── desktop/              # Electron 殼（重用 web 构建產物）
├── packages/
│   ├── shared/               # Socket 事件型別、Zod DTO、錯誤碼
│   ├── core/                 # 跨端共享純邏輯
│   ├── crypto/               # X3DH / Double Ratchet / Sender Keys（含 KAT）
│   └── plugins-sdk/          # 外掛 manifest schema + 宿主 API 契約
├── android/                  # Capacitor Android 專案
├── docs/                     # 工程報告（如 pwa-vs-capacitor）
├── docker-compose.yml        # server + Caddy (TLS) + coturn
└── AGENTS.md                 # 工程基準與路線圖
```

## 快速開始

### 環境需求
- Node.js 22+
- pnpm 11+（`corepack enable`）

### 安裝

```bash
pnpm install

# 設定伺服器
cp apps/server/.env.example apps/server/.env
#   - 設定 JWT_SECRET（檔案內提供產生指令）
#   - 如需 Web Push，設定 VAPID_* 金鑰：
#       npx web-push generate-vapid-keys

# 執行資料庫遷移
pnpm db:migrate

# 啟動 server + web 開發伺服器（Turbo）
pnpm dev
```

Web 應用執行於 http://localhost:5173（代理至 :3000 的 API）。

### 正式環境構建

```bash
pnpm build        # 全部套件與應用
pnpm --filter @tianshangchat/web preview   # 本機預覽构建後的 PWA
```

### Android

```bash
pnpm --filter @tianshangchat/web build
npx cap sync android
cd android && ./gradlew assembleDebug
```

### Docker 部署

```bash
docker compose up -d    # server + Caddy（自動 TLS）+ coturn 中繼
```

## 常用指令

| 指令 | 說明 |
|------|------|
| `pnpm dev` | 以 watch 模式執行 server + web |
| `pnpm build` | 構建全部套件/應用 |
| `pnpm lint` | ESLint（零警告） |
| `pnpm typecheck` | 全工作區 `tsc --noEmit` |
| `pnpm test` | Vitest 單元 + 整合測試 |
| `pnpm test:e2e` | Playwright 端對端測試 |
| `pnpm db:migrate` | 套用 Drizzle 遷移 |

## 設定（`apps/server/.env`）

| 變數 | 必填 | 說明 |
|------|------|------|
| `PORT` | 否（預設 3000） | HTTP 連接埠 |
| `NODE_ENV` | 否 | development / production |
| `JWT_SECRET` | **是** | 工作階段簽署密鑰 |
| `DATABASE_PATH` | 否 | SQLite 檔案位置 |
| `UPLOAD_DIR` | 否 | `/uploads` 服務目錄 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | 否 | Web Push（留空則停用推播） |

## API 一覽

所有請求主體經 Zod 驗證；認證為 JWT Bearer。

### 認證
| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/auth/register` | 註冊 |
| POST | `/api/auth/login` | 登入（限流） |
| POST | `/api/auth/logout` | 登出工作階段 |
| GET | `/api/auth/verify` | 驗證權杖 |
| GET | `/api/auth/user` | 當前使用者資料 |

### 訊息與同步
| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/messages/history` | 公開頻道歷史 |
| GET | `/api/messages/private/:userId` | 與某使用者的私訊歷史 |
| GET | `/api/messages/private-list` | 會話列表 |
| GET | `/api/messages/unread` | 未讀計數 |
| GET | `/api/sync?cursor=` | 增量同步流 |

### 群組
| 方法 | 端點 | 說明 |
|------|------|------|
| GET / POST | `/api/groups` | 我的群組 / 建立 |
| GET | `/api/groups/:id` | 群組詳情 |
| PUT / DELETE | `/api/groups/:id` | 更新 / 刪除（群主） |
| GET | `/api/groups/:id/messages` | 群組歷史 |
| GET / POST | `/api/groups/:id/members` | 成員列表 / 新增成員 |
| DELETE | `/api/groups/:id/members/:userId` | 移除成員 |
| PUT | `/api/groups/:id/admin/:userId` | 設/撤管理員 |
| POST | `/api/groups/:id/join` | 以 ID 加入 |
| POST | `/api/groups/:id/leave` | 退出（群主不可） |
| POST | `/api/groups/:id/transfer` | 移轉群主 |

### 使用者
| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/users/search?q=` | 搜尋使用者 |
| GET | `/api/users/:id` | 使用者資料 |

### E2EE / 推播 / 上傳
| 方法 | 端點 | 說明 |
|------|------|------|
| PUT / GET | `/api/e2ee/bundle`、`/api/e2ee/bundle/:userId` | 發布/取得預鑰信封 |
| GET | `/api/push/vapid-public` | 取得 VAPID 公鑰 |
| POST | `/api/push/subscribe` / `/api/push/unsubscribe` | 管理推播訂閱 |
| POST | `/api/upload/avatar` / `/api/upload/voice` | 上傳（類型+大小+路徑白名單） |

## Socket 協定

事件名稱與承載型別定義於 `@tianshangchat/shared`（`ClientToServerEvents` / `ServerToClientEvents`）。重點：

- **客戶端 → 伺服器**：`send-message`、`send-private-message`、`send-group-message` 及語音對應事件（`send-*-voice`）、`create-group`、`join-group`、`leave-group`、`mark-delivered`、`mark-read`、輸入指示、`update-avatar`
- **伺服器 → 客戶端**：`receive-message`、`receive-private-message`、`receive-group-message`、`message-status`、線上狀態（`user-list-update`、`user-left`）、群組生命週期（`group-created`、`group-updated`、`member-joined`、`member-left`）、`avatar-updated`、`auth-error`

私訊/群組訊息本體以 E2EE 信封傳輸；伺服器永遠看不到明文。

## 外掛

無須修改宿主程式碼的即插式擴充：

1. 提供一個匯出 `manifest` 與 `activate(api)`（可選 `deactivate`）的 ESM JS 模組
2. 在 `apps/web/public/plugins/registry.json` 中登記：

```json
[
  { "id": "my-plugin", "entry": "/plugins/my-plugin/index.js", "enabled": true }
]
```

Manifest 宣告權限——`settings`、`messages:observe`、`messages:transform`、`commands:register`——每項解鎖對應的 `PluginApi` 介面；未授權呼叫在執行時直接拋錯。

內建 `ai-assistant` 外掛示範完整能力面：

```
/ai 棘輪金鑰如何輪替？
/translate Good morning, everyone.
```

它呼叫 OpenAI 相容端點（預設本機 Ollama `http://127.0.0.1:11434/v1`）；base URL/模型/金鑰保存在裝置端外掛設定中，不會送往聊天伺服器。契約詳見 [`packages/plugins-sdk`](../packages/plugins-sdk/src/plugin.ts)。

## 資料庫

SQLite + Drizzle ORM（遷移位於 `apps/server/drizzle/`）：`users`、`sessions`、`messages`（E2EE 範圍存密文）、`groups`、`group_members`、`e2ee_bundles`、`push_subscriptions`。

## 授權條款

MIT License
