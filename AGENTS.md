# AGENTS.md · TianshangChat 工程指南

> 本文档是 TianshangChat 的**工程基准与执行计划**。任何自动化代理或人类协作者在改动本仓库前必须先阅读本文；与 README.md 冲突时，以本文为准。
>
> 目标一句话：把 TianshangChat 从"一个能聊天的全栈 Demo"变成**离线可用、端到端加密、可插件扩展的通信基础设施**——对齐 TianshangGuard / TianshangHealth / TianshangScribe 的工业级水准。

---

## 1. 项目定位

实时聊天应用，支持公共频道、私聊、群聊、语音消息、头像、多语言（en / zh-CN / zh-TW / ja / ko），覆盖 Web / Android / Windows 三端。

**不可破坏的既有功能清单**（重构全程保持可用）：
- 公共聊天 / 私聊 / 群聊收发消息与语音
- 注册、登录、remember-me 会话、登出
- 头像上传、语音上传（`/uploads/avatars`、`/uploads/voice` 路径白名单）
- 群组创建 / 按 ID 加入 / 成员角色（creator/admin/member）/ 群主不可退出
- LAN 直连 + 手动 IP 配置（Android / 远程客户端）
- 四语言 i18n、Electron 托盘 + 自动更新、Capacitor Android 打包

---

## 2. 重构起点 · 现状基线（2026-08 勘察结论）

| 维度 | 已核实现状 | 问题定性 |
|------|-----------|----------|
| 类型 | 前端全 JSX 无 strict tsconfig；后端纯 JS（约 1.6k 行）；Electron JS | 三端类型割裂 |
| 架构 | `backend/server.js` 551 行单体（13 个 socket handler 内联）；`frontend/src/App.jsx` 741 行单体 | 业务/UI/IO 耦合 |
| 安全 | `utils/crypto.js` 的 `encryptPassword()` 为空操作；JWT 存 localStorage；SQLite 明文；README 却宣称 "encrypted" | 名不副实，Phase 3 重点 |
| 离线 | 零本地持久化，无 sent/delivered/read 回执 | 断网即不可用 |
| 工程 | 0 测试、无 CI、无 ESLint/tsconfig/Dockerfile；3 个独立 package.json | Phase 0/4 补齐 |
| 可保留资产 ✅ | helmet、express-rate-limit、CORS 私网白名单、sessions 表、bcrypt；Electron 已开 contextIsolation；`isAllowedOrigin()` 逻辑 | 迁移时原样保留语义 |

---

## 3. 目标结构（pnpm workspace + Turborepo）

```
TianshangChat/
├── apps/
│   ├── server/          # 后端：Express + TypeScript + Socket.IO + Drizzle(better-sqlite3)
│   ├── web/             # React 18 + Vite，升级为 PWA（vite-plugin-pwa）
│   └── desktop/         # Electron 主进程 TS 化（复用 web 产物）
├── packages/
│   ├── shared/          # Socket 事件类型、Zod DTO、错误码、同步协议 —— 唯一协议真相源
│   ├── core/            # 纯逻辑：加密会话、消息状态机、outbox、格式化（零 IO，三端共享）
│   └── plugins-sdk/     # 插件接口与生命周期钩子（Phase 5）
├── android/             # Capacitor 壳，引用 apps/web 构建产物
├── docker-compose.yml   # server + Caddy(TLS) + coturn 中继
└── AGENTS.md
```

### 分层依赖规则（强制）

```
ui/ → state/ → domain/ → data/        上层可依赖下层，严禁反向
packages/core 不得 import 任何 IO 库（fetch/socket/fs/Dexie 除外仅限类型）
apps/* 只能通过 packages/shared 的类型通信，禁止手写字符串事件名
```

前端源码分层：
```
src/
├── core/      # 纯业务逻辑（加密、状态机、消息格式化）→ 逐步上移至 packages/core
├── domain/    # Use Cases：SendMessage、CreateGroup、SyncMessages…
├── data/      # Repository：Dexie 本地库、ApiClient、SocketAdapter
├── state/     # Zustand 或轻量 Observable
└── ui/        # React 组件，纯展示，禁止直接 fetch/socket
```

---

## 4. 技术决策记录（已确认，不再重复讨论）

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| D1 | 后端框架 | **Express + 全量 TS** | helmet/rate-limit/CORS 结构已就绪，渐进迁移风险最低；Fastify 收益在此规模不明显 |
| D2 | ORM | **Drizzle** | 原生构建于现有 better-sqlite3，同步 API 与现模型层契合，迁移成本最低 |
| D3 | 协议校验 | Zod（shared 包内定义，前后端同源） | 运行时校验 + 类型推导一体 |
| D4 | 本地存储 | Web: IndexedDB(Dexie) + WebCrypto AES-GCM 包裹；Electron: safeStorage/SQLCipher；密钥 Argon2id 派生 | 对标 TianshangGuard |
| D5 | E2EE | 私聊 X3DH + Double Ratchet（libsignal 系实现）；群聊 Sender Keys | 对标 Signal；服务端只存密文 |
| D6 | 凭证存储 | JWT → httpOnly + SameSite=Strict cookie；Socket 握手改 cookie 鉴权 | 消除 localStorage XSS 面 |
| D7 | 离线 | Dexie 缓存 + outbox 队列 + `GET /api/sync?cursor=` 增量同步 + PWA Service Worker | 对标 Matrix sync 思路 |
| D8 | 测试 | Vitest + Supertest(内存 SQLite) + Playwright | 测试金字塔 |
| D9 | CI/CD | GitHub Actions：Lint → Typecheck → Unit → Integration → Build → Docker | 全绿方可合并 |

> 遗留决策点（Phase 5 内评估并出报告）：PWA 能否替代 Capacitor Android 壳。

---

## 5. 命令速查（monorepo 化后生效）

```bash
pnpm install                 # 安装全部工作区依赖
pnpm dev                     # Turbo 并行启动 server + web
pnpm build                   # 三端构建（web/desktop/android 产物）
pnpm lint && pnpm typecheck  # ESLint + tsc --noEmit（零 any 容忍）
pnpm test                    # Vitest 单测 + Supertest 集成
pnpm test:e2e                # Playwright E2E
pnpm db:migrate              # Drizzle 迁移（替代手写 schema.sql 建表）
docker compose up -d         # 一键部署 server + Caddy TLS + coturn
```

迁移完成前旧命令仍可用：`backend: npm start`、`frontend: npm run dev`。

---

## 6. 编码规范

- **TypeScript strict 全栈**，`tsc --noEmit` 零错误；**禁止 `any`**（确需逃生舱用 `unknown` + 收窄）。
- Socket 事件名、API DTO、错误码一律从 `@tianshangchat/shared` 导入，禁止内联字面量。
- React 组件只做展示与回调转发，不写 fetch/socket/加密逻辑；数据访问只经 `data/` 层 repository 接口。
- 新增文案必须走 i18n 键（en/zh-CN/zh-TW/ja/ko 五份同步补齐），禁止硬编码字符串进组件。
- 上传路径白名单沿用 `/uploads/voice/`、`/uploads/avatars/` 前缀校验，新增资源类型先扩白名单再使用。
- 提交信息：`type(scope): subject`（feat/chat、fix/e2ee、refactor/state、test/sync…）；每个 Phase 至少一个可运行的里程碑提交。

## 7. 安全红线（任何时候不得违反）

1. E2EE 私钥/根密钥永不明文落盘、不上报服务端、不打日志。
2. 服务端数据库只存私聊/群聊**密文**；明文仅存在于端上内存与加密本地库。
3. Cookie 必须带 `httpOnly; SameSite=Strict; Secure`（LAN HTTP 场景按环境降级并在配置中显式标注）。
4. 所有 API 入口过 Zod 校验后才触达业务层。
5. CORS 白名单维持私网段逻辑（192.168/10/172.16-31 + localhost），拒绝 `file://` 与 `null` origin。
6. Electron 保持 contextIsolation=true、nodeIntegration=false；启用 `setContentProtection(true)` 防截屏；Android 启用 `FLAG_SECURE`。
7. 语音/头像上传：multer 文件类型 + 大小限制 + 路径白名单三重校验缺一不可。

---

## 8. 路线图（六阶段 · 总周期 ≈ 10 周）

> 进度勾选表即当前状态。开工一个条目前先把它勾成 `[x]` 所在项的上下文读完。

### Phase 0 · 工程基线（≈4 天）
- [x] pnpm workspace + Turborepo；backend/frontend/electron 迁入 `apps/`
- [x] ESLint(typescript-eslint) + Prettier + strict tsconfig 骨架
- [x] 目录骨架（apps/packages）与依赖规则约束落地
- **DoD**：旧功能在 monorepo 下照常启动 ✅（2026-08-24，commit 0dd304b）

### Phase 1 · TypeScript 全栈 + 共享协议层（≈2 周）
- [x] `packages/shared`：`ClientToServerEvents` / `ServerToClientEvents`、Zod DTO、错误码
- [x] 后端 TS 化；`server.js`(551行) 拆为 `socket/handlers/{auth,message,group,presence}.ts`
- [x] Drizzle schema 接管 `schema.sql`，含迁移脚本与既有库兼容
- [x] 前端 `.tsx` 转换（context/utils 与组件一次性全量完成，超出渐进计划）
- **DoD**：`pnpm typecheck` 全绿 ✅；socket 收发全编译期校验 ✅；API 入口 100% Zod ✅（2026-08-24）
- 备注：群组/用户 REST 响应由 snake_case 统一为 camelCase（与 shared DTO 对齐），重构前的旧客户端需更新后兼容

### Phase 2 · 分层架构 + 离线优先（≈2 周）
- [x] `App.jsx`(741行)/ChatRoom 拆解至 domain/data/ui/state
- [x] Dexie 消息缓存；outbox 队列（指数退避重试）
- [x] 消息状态机 `sending→sent→delivered→read` 持久化；服务端补回执事件
- [x] `GET /api/sync?cursor=` 增量同步端点（重连/启动补拉）
- [x] vite-plugin-pwa：壳缓存，离线读历史 + 排队发送
- **DoD**：飞行模式收发不丢，恢复网络自动补投 ✅（2026-08-24，运行时冒烟 5/5：ack/delivered/read/sync/增量；Playwright 断网用例随 Phase 4 测试体系落地）

### Phase 3 · 安全纵深（≈2 周）
- [ ] 私聊 X3DH + Double Ratchet；群聊 Sender Keys
- [ ] DB 迁移 `messages.content → ciphertext`；旧明文标记 legacy 不回溯加密
- [ ] 本地库加密（Web AES-GCM / Electron SQLCipher·safeStorage；Argon2id 口令派生）
- [ ] JWT → httpOnly cookie；Socket 握手改 cookie 鉴权
- [ ] 防截屏：Electron setContentProtection / Android FLAG_SECURE
- **DoD**：抓包只见密文；DB 文件直读失败；XSS 用例无法窃取凭证

### Phase 4 · 测试体系 + CI/CD（≈2 周）
- [ ] Vitest 单测 core/domain（加密向量、状态机、outbox，覆盖率 ≥80%）
- [ ] Supertest + 内存 SQLite：auth/messages/groups/upload/sync 全端点集成
- [ ] Playwright E2E：注册→搜索→私聊→群组→断网恢复→多端同步
- [ ] GitHub Actions 流水线 + Dockerfile + docker-compose(server+Caddy+coturn)
- **DoD**：CI 全绿方可合并；一条命令拉起完整部署

### Phase 5 · PWA 完善 + 插件系统（≈2 周）
- [ ] PWA 安装体验 + Push API(VAPID)；产出"PWA 替代 Capacitor"可行性报告
- [ ] `plugins-sdk`：生命周期钩子 + 能力注册表
- [ ] 示例插件：plugin-translate(WASM 本地翻译)、plugin-ai(ONNX 端侧接口预留)
- [ ] Electron 主进程接入共享 `packages/core`
- **DoD**：第三方插件无需改动宿主即可注册能力

### 风险登记
| 风险 | 缓解 |
|------|------|
| E2EE 与历史明文消息冲突 | 旧消息标 legacy 只读，不参与新会话加密 |
| libsignal npm 维护状态不确定 | Phase 3 首日做选型 spike；备选 @privacyresearch 系或自维护精简 ratchet |
| Capacitor WebView 对 WebCrypto/PWA 能力差异 | Phase 2 在真机回归；必要时插件封装原生能力 |

---

## 9. 测试与 PR 准入

- PR 合并门槛：CI 六步全绿 + 覆盖率不低于当前基线 + 更新本文件进度勾选。
- 加密相关改动必须附带已知答案测试向量（KAT）。
- 涉及 DB 结构的改动必须带 Drizzle 迁移脚本，禁止手写 ALTER 散落在代码里。
- 影响既有功能的改动，需对照 §1 清单自测对应条目并在 PR 描述勾选。

## 10. 目录遗留说明

- 根目录 `android-app.apk` 为最新构建产物快照；归档去向改为 GitHub Releases（§11.3），不再手工放置于仓库。
- `TianshangChat/readme/` 存放多语言 README（ja/ko/zh_CN/zh_TW），重大变更需同步翻译键。

---

## 11. 分支、发布与遗留代码处置

> 本章固化分支策略结论，与 §8 路线图、§9 PR 准入配合使用。

### 11.1 分支模型 · 精简 GitHub Flow

- `main` 是**唯一**长期分支，任何时刻应可运行、CI 应可绿。
- 一切改动的唯一入口：短生命周期分支（存活 ≤3 天）→ PR → 检查全绿 → **squash merge** 进 `main` → 删除分支。
- 禁止直接向 `main` 提交；禁止为一个 Phase 开存活数周的巨型 epic 分支。确需跨多 PR 的集成线用 `phase/<N>-<slug>`，每周从 `main` 同步一次，达成该阶段 DoD 即删。

### 11.2 分支命名（与 §6 提交格式同构）

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat/` | 新功能 | `feat/message-receipts` |
| `fix/` | 缺陷修复 | `fix/socket-auth-race` |
| `refactor/` | 结构重构 | `refactor/split-server-monolith` |
| `phase/<N>-<slug>` | 临时阶段集成线 | `phase/3-e2ee-integration` |
| `chore/` `docs/` `test/` `ci/` | 工程 / 文档 / 测试 / 流水线 | `ci/github-actions-pipeline` |

规则：全小写连字符、可带 issue 号后缀（`-#12`）、合并即删。

### 11.3 Tag 与发布

- **锚点原则：tag 负责记住过去，main 负责走向未来，分支只服务于正在进行的开发。**
- 基线 tag `v1.0-legacy`（重构起点的最后快照）；此后每个 Phase 达成 DoD 打 `v2.0.0-alpha.<N>`（SemVer）。
- 发布物（APK / Electron installer）一律挂 GitHub Releases 附产物，禁止以二进制形式入库。
- **禁止为旧代码开长期 legacy 分支**。仅当旧版本仍有外部用户需要持续出补丁时才允许 `maintenance/v1.x`，且必须带明确退役日期。回看历史的方式：`git switch -c <rescue-branch> v1.0-legacy`，或在 GitHub 页面按 tag 浏览源码。

### 11.4 main 分支保护（GitHub Settings → Branches）

1. Require a pull request before merging（solo 场景允许自合，但保留流程闸门）。
2. Required status checks：`lint` / `typecheck` / `unit` / `integration` 全绿方可合并（Phase 4 流水线上线前先建规则）。
3. Require linear history（配合 squash merge）。
4. Do not allow force pushes / deletions。

### 11.5 开工前一次性收尾清单（✅ 已全部完成 · 2026-08-24）

- [x] **认证修复**：remote URL 已剥离内嵌 token（API 实测该令牌 HTTP 401 已失效，当前树与全部历史无泄漏）；凭据由 GitHub CLI 接管。
- [x] **数据库移出跟踪**：`backend/database/chat.db*` 入 `.gitignore`，两个 WAL 边车已移出索引。
- [x] **换行统一**：`.gitattributes` 已写入 `* text=auto`。
- [x] **收尾快照 + 基线锚点**：提交 `422ff98`（23 文件），tag `v1.0-legacy` 已推送；与上游唯一差异（LICENSE）无冲突合并后同步。
- [x] **Release 归档**：[Legacy Demo v1.0](https://github.com/Tianshang301/TianshangChat/releases/tag/v1.0-legacy) 已发布并附旧版 APK。
- [x] **分支保护（§11.4）**：PR 闸门（0 审批即可合）+ enforce_admins + linear history + 禁 force push/删除，已通过 API 生效；Required status checks 留待 Phase 4 流水线上线后追加。

> ⚠️ **保护生效后的工作流变化**：任何改动不得直接 `git push origin main`——一律短分支 → `gh pr create` → `gh pr merge --squash --delete-branch`。

### 11.6 遗留代码三档处置（勘察实证，迁移时的行为准绳）

**✅ 第一档 · 原样保留（资产，语义逐字搬运）**

| 资产 | 位置 |
|------|------|
| CORS 私网白名单 `isAllowedOrigin()` | 旧 `server.js` L44–70 |
| 双层限流（全局 200 / 登录注册 20，15min 窗口） | 旧 `server.js` L103–121 |
| Socket JWT + sessions 表双重验证 | 旧 `server.js` L172–221 |
| Electron contextIsolation=true / nodeIntegration=false | 旧 `electron/main.js` |
| 五语言 i18n 键组织结构 | `frontend/src/i18n/translations.js` |
| 上传路径白名单校验 `validateUploadPath()` | 旧 `server.js` |

**♻️ 第二档 · 改造后保留（保语义、换外壳）**

| 代码 | 处置 |
|------|------|
| `models/{User,Group,Message}.js` 手写 SQL | 翻译为 Drizzle schema + repository，接口签名尽量不变 |
| `routes/*` 模块化拆分 | 本身是好结构，TS 化后整体搬入 `apps/server` 对应目录 |
| `AuthContext.jsx` 会话流程 | remember-me / 登出流程保留，仅替换存储介质（localStorage → httpOnly cookie） |
| `database/schema.sql` | 作为 Drizzle 初始迁移的 baseline |

**❌ 第三档 · 必须重写（修补不如重建）**

| 代码 | 处置 |
|------|------|
| `backend/server.js` 551 行单体（13 个 handler 内联） | 拆为 `socket/handlers/{auth,message,group,presence}.ts` |
| `frontend/src/App.jsx` 741 行单体 | 按 domain / data / state / ui 分层重排 |
| `utils/crypto.js` 的空操作 `encryptPassword()` | **删除而非实现**：前端加密登录密码是反模式——传输安全靠 HTTPS、口令安全靠服务端 bcrypt（已有）；E2EE 属消息层协议，与登录密码无关 |
| JWT 存 localStorage | 整体迁 httpOnly cookie（Phase 3，D6） |
| 明文 SQLite 入库跟踪 | 见 §11.5 第 2 条，随首个提交清除 |
