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

一款支持公共频道、私聊与群组聊天的实时聊天应用——离线可用、端到端加密、可插件扩展。覆盖 Web（PWA）、Android 与 Windows 桌面端。

> **说明**：项目正按阶段工业化改造（工程基准见 [AGENTS.md](../AGENTS.md)）。Phase 0–5 已合并：pnpm monorepo、全量 TypeScript、E2EE、离线优先、测试/CI 体系、PWA + 插件系统。

## 功能特点

### 核心功能
- **公共聊天**：所有在线用户的实时聊天室
- **私聊**：一对一对话
- **群聊**：创建 / 按 ID 加入、成员角色（creator/admin/member）、群主不可退出
- **语音消息**：录制与播放语音
- **自定义头像**：上传个人资料图片
- **多语言支持**：英语、简体中文、繁体中文、日语、韩语
- **输入状态与未读徽标**：公共与私聊均支持

### 安全（E2EE）
- **私聊**采用简化版 Signal 协议：X3DH 密钥协商 + Double Ratchet 棘轮
- **群聊**采用 Sender Keys（由发送方分发，服务端不经手）
- 服务端只存密文（`e2ee:v1.*` / `gsk:v1.*` 信封）；明文仅存在于设备上
- 本地消息缓存使用不可导出的设备密钥加密（WebCrypto）
- 防截屏：Electron `setContentProtection`、Android `FLAG_SECURE`

### 离线优先
- 本地缓存（IndexedDB/Dexie），断网可读历史
- 发件箱队列 + 指数退避重试——离线发送的消息在重连后自动补投
- 投递回执：`sending → sent → delivered → read` 状态机
- 增量同步（`GET /api/sync?cursor=`），重连/启动时补拉

### PWA 与 Web 推送
- 可安装的 Web 应用（manifest、Service Worker、app-shell 缓存）
- 页面关闭或后台时的 Web Push 通知（VAPID）
- 上传媒体（头像/语音）缓存优先，回放即时

### 插件系统
- 第三方插件无需改动宿主即可注册能力：斜杠命令、消息观察者、出站变换器、设置存储
- 权限闸门 API（manifest 声明的能力在运行时强制校验）
- 内置示例插件 `ai-assistant`：`/ai <提问>` 与 `/translate <文本>`，兼容任意 OpenAI 兼容端点（配合本地 [Ollama](https://ollama.com) 开箱即用）

### 平台支持
| 平台 | 说明 |
|------|------|
| **Web / PWA** | 浏览器端应用；可安装、离线可用、支持推送 |
| **Android** | Capacitor 壳 + 底部导航 |
| **Windows** | Electron 桌面客户端 + 系统托盘 |

## 技术栈

- **语言**：TypeScript（strict 模式，零 `any`）覆盖服务端、Web 与共享包
- **Monorepo**：pnpm workspaces + Turborepo
- **前端**：React 18、Vite、vite-plugin-pwa、Dexie (IndexedDB)、Socket.IO 客户端、Capacitor、Electron
- **后端**：Node.js、Express、Socket.IO、Drizzle ORM + better-sqlite3、Zod 校验、helmet/rate-limit/CORS 白名单、bcrypt + JWT 会话
- **加密**：自维护精简 Signal 实现（@noble/curves + hashes + ciphers）
- **测试**：Vitest（单测 + 基于 Supertest 的临时 SQLite 集成测试）、Playwright（E2E）
- **CI/CD**：GitHub Actions（lint → typecheck → unit → integration → build → docker)；Docker Compose 部署（server + Caddy TLS + coturn）

## 项目结构

```
TianshangChat/
├── apps/
│   ├── server/               # Express + Socket.IO API（TypeScript）
│   │   └── src/
│   │       ├── api/routes/   # auth, messages, groups, users, sync, e2ee, push, upload
│   │       ├── socket/handlers/
│   │       ├── infra/        # Drizzle schema + 数据库引导
│   │       └── app.ts        # 应用工厂（测试亦复用）
│   ├── web/                  # React 18 + Vite PWA
│   │   └── src/
│   │       ├── core/         # 加密胶水层、推送客户端、纯逻辑
│   │       ├── domain/       # 用例层（消息、群组、E2EE 建立）
│   │       ├── data/         # Dexie 仓库、Socket 适配器
│   │       ├── state/        # 聊天/UI 状态
│   │       ├── plugins/      # 插件宿主加载器
│   │       └── ui/           # React 组件
│   └── desktop/              # Electron 壳（复用 web 构建产物）
├── packages/
│   ├── shared/               # Socket 事件类型、Zod DTO、错误码
│   ├── core/                 # 跨端共享纯逻辑
│   ├── crypto/               # X3DH / Double Ratchet / Sender Keys（含 KAT）
│   └── plugins-sdk/          # 插件 manifest schema + 宿主 API 契约
├── android/                  # Capacitor Android 工程
├── docs/                     # 工程报告（如 pwa-vs-capacitor）
├── docker-compose.yml        # server + Caddy (TLS) + coturn
└── AGENTS.md                 # 工程基准与路线图
```

## 快速开始

### 前置要求
- Node.js 22+
- pnpm 11+（`corepack enable`）

### 安装

```bash
pnpm install

# 配置服务端
cp apps/server/.env.example apps/server/.env
#   - 设置 JWT_SECRET（文件内提供生成命令）
#   - 如需 Web Push，设置 VAPID_* 密钥：
#       npx web-push generate-vapid-keys

# 执行数据库迁移
pnpm db:migrate

# 启动 server + web 开发服务器（Turbo）
pnpm dev
```

Web 应用运行于 http://localhost:5173（代理至 :3000 的 API）。

### 生产构建

```bash
pnpm build        # 全部包与应用
pnpm --filter @tianshangchat/web preview   # 本地预览构建后的 PWA
```

### Android

```bash
pnpm --filter @tianshangchat/web build
npx cap sync android
cd android && ./gradlew assembleDebug
```

### Docker 部署

```bash
docker compose up -d    # server + Caddy（自动 TLS）+ coturn 中继
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 以 watch 模式运行 server + web |
| `pnpm build` | 构建全部包/应用 |
| `pnpm lint` | ESLint（零警告） |
| `pnpm typecheck` | 全工作区 `tsc --noEmit` |
| `pnpm test` | Vitest 单测 + 集成测试 |
| `pnpm test:e2e` | Playwright 端到端测试 |
| `pnpm db:migrate` | 应用 Drizzle 迁移 |

## 配置（`apps/server/.env`）

| 变量 | 必填 | 说明 |
|------|------|------|
| `PORT` | 否（默认 3000） | HTTP 端口 |
| `NODE_ENV` | 否 | development / production |
| `JWT_SECRET` | **是** | 会话签名密钥 |
| `DATABASE_PATH` | 否 | SQLite 文件位置 |
| `UPLOAD_DIR` | 否 | `/uploads` 服务目录 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | 否 | Web Push（留空则禁用推送） |

## API 一览

所有请求体经 Zod 校验；认证为 JWT Bearer。

### 认证
| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录（限流） |
| POST | `/api/auth/logout` | 注销会话 |
| GET | `/api/auth/verify` | 校验令牌 |
| GET | `/api/auth/user` | 当前用户资料 |

### 消息与同步
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/messages/history` | 公共频道历史 |
| GET | `/api/messages/private/:userId` | 与某用户的私聊历史 |
| GET | `/api/messages/private-list` | 会话列表 |
| GET | `/api/messages/unread` | 未读计数 |
| GET | `/api/sync?cursor=` | 增量同步流 |

### 群组
| 方法 | 端点 | 说明 |
|------|------|------|
| GET / POST | `/api/groups` | 我的群组 / 创建 |
| GET | `/api/groups/:id` | 群详情 |
| PUT / DELETE | `/api/groups/:id` | 更新 / 删除（群主） |
| GET | `/api/groups/:id/messages` | 群历史 |
| GET / POST | `/api/groups/:id/members` | 成员列表 / 添加成员 |
| DELETE | `/api/groups/:id/members/:userId` | 移除成员 |
| PUT | `/api/groups/:id/admin/:userId` | 设/撤管理员 |
| POST | `/api/groups/:id/join` | 按 ID 加入 |
| POST | `/api/groups/:id/leave` | 退出（群主不可） |
| POST | `/api/groups/:id/transfer` | 转让群主 |

### 用户
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/users/search?q=` | 搜索用户 |
| GET | `/api/users/:id` | 用户资料 |

### E2EE / 推送 / 上传
| 方法 | 端点 | 说明 |
|------|------|------|
| PUT / GET | `/api/e2ee/bundle`、`/api/e2ee/bundle/:userId` | 发布/获取预钥信封 |
| GET | `/api/push/vapid-public` | 获取 VAPID 公钥 |
| POST | `/api/push/subscribe` / `/api/push/unsubscribe` | 管理推送订阅 |
| POST | `/api/upload/avatar` / `/api/upload/voice` | 上传（类型+大小+路径白名单） |

## Socket 协议

事件名与载荷类型定义于 `@tianshangchat/shared`（`ClientToServerEvents` / `ServerToClientEvents`）。要点：

- **客户端 → 服务端**：`send-message`、`send-private-message`、`send-group-message` 及语音孪生事件（`send-*-voice`）、`create-group`、`join-group`、`leave-group`、`mark-delivered`、`mark-read`、输入指示、`update-avatar`
- **服务端 → 客户端**：`receive-message`、`receive-private-message`、`receive-group-message`、`message-status`、在线状态（`user-list-update`、`user-left`）、群生命周期（`group-created`、`group-updated`、`member-joined`、`member-left`）、`avatar-updated`、`auth-error`

私聊/群聊消息体以 E2EE 信封传输；服务端永远看不到明文。

## 插件

无需改动宿主代码的即插式扩展：

1. 提供一个导出 `manifest` 与 `activate(api)`（可选 `deactivate`）的 ESM JS 模块
2. 在 `apps/web/public/plugins/registry.json` 中登记：

```json
[
  { "id": "my-plugin", "entry": "/plugins/my-plugin/index.js", "enabled": true }
]
```

Manifest 声明权限——`settings`、`messages:observe`、`messages:transform`、`commands:register`——每项解锁对应的 `PluginApi` 面；未授权调用在运行时直接抛错。

内置 `ai-assistant` 插件演示了完整能力面：

```
/ai 棘轮密钥如何轮换？
/translate Good morning, everyone.
```

它调用 OpenAI 兼容端点（默认本地 Ollama `http://127.0.0.1:11434/v1`）；base URL/模型/密钥保存在设备端插件设置中，不会发往聊天服务器。契约详见 [`packages/plugins-sdk`](../packages/plugins-sdk/src/plugin.ts)。

## 数据库

SQLite + Drizzle ORM（迁移位于 `apps/server/drizzle/`）：`users`、`sessions`、`messages`（E2EE 范围存密文）、`groups`、`group_members`、`e2ee_bundles`、`push_subscriptions`。

## 许可证

MIT License
