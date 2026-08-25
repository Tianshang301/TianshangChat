# PWA 替代 Capacitor Android 壳 · 可行性报告

> Phase 5 交付物（AGENTS.md §8 / §4 遗留决策点）。结论先行：**混合策略**——国内/局域网场景保留 Capacitor 壳，海外/快速迭代场景用 PWA；不二选一。

## 1. 现状盘点（2026-08）

| 能力 | PWA（当前实现） | Capacitor Android |
|------|----------------|-------------------|
| 离线壳 + 历史 | ✅ Workbox precache + Dexie | 同一 web 产物，WebView 缓存 |
| 后台消息提醒 | ⚠️ Web Push 需 Google Play Services（见 §2.1） | ✅ 可接 FCM/厂商通道，进程级常驻 |
| E2EE 密钥存储 | IndexedDB（非导出 DEK 封装） | 同左；可升级 Keystore 硬件背书 |
| LAN 直连 | ✅ 页面本身即局域网可达 | ✅ 且可申请明文流量豁免更宽松 |
| 安装体验 | 浏览器"添加到主屏幕"，无商店分发 | APK / 商店签名分发 |
| 防截屏 FLAG_SECURE | ❌ Web 平台无此能力 | ✅ 已启用（Phase 3） |
| 自动更新 | ✅ SW 即发即弃 | 依赖商店审核或自更新通道 |

## 2. 关键限制分析

### 2.1 Web Push 在中国的现实
- Chrome Android 的推送走 FCM（`fcm.googleapis.com`），在国内网络不可达 → **PWA 推送在国内基本失效**。
- 国产浏览器（微信内置、UC、QQ）对 Push API/Service Worker 支持残缺或禁用。
- 本项目已实现 VAPID 全链路（`/api/push/*` + sw.ts），作为**海外/科学网络用户的增量能力**，不承担国内送达承诺。

### 2.2 安全红线对照（AGENTS.md §7）
- 红线 6 要求防截屏。PWA 无法阻止系统截图/录屏 → **凡涉及合规防泄露的部署必须走 Capacitor/Electron 壳**。
- 红线 3 cookie `Secure` 属性在纯 HTTP 的 LAN 场景需降级——Capacitor 允许 `android:usesCleartextTraffic` 定向豁免，PWA 只能靠 localhost 例外，远程 IP 直连 HTTP 下 SW/Push 直接被浏览器禁用（安全上下文要求）。这是**功能级差异**：LAN 下 `http://192.168.x.x` 打开 PWA 时，SW、Push、部分 WebCrypto 子能力全部不可用；Capacitor WebView 默认以 `https://localhost` 加载本地产物，无此限制。

### 2.3 插件系统兼容性
- Phase 5 插件宿主运行于页面 JS 上下文（ESM 动态 import + 权限闸门），两端行为一致。
- 未来需要原生能力的插件（蓝牙、NFC、本地 ONNX 加速）只能经 Capacitor bridge 暴露 → SDK 已预留 `permissions` 枚举扩展位。

## 3. 结论与建议

1. **保留 android/ Capacitor 壳为主分发渠道**：覆盖 FLAG_SECURE、国内推送（后续接厂商通道）、HTTP LAN 安全上下文三大硬需求。
2. **PWA 作为零安装轻量入口**：桌面浏览器 + 海外移动端；本次已补齐 manifest/SW/安装指示条/VAPID 推送。
3. **不做的事**：
   - 不追求 TWA/Bubblewrap 替代 Capacitor——TWA 同样受安全上下文限制且失去原生桥；
   - 不为 PWA 补国内推送 polyfill（维护成本 > 收益，等待 Web Push 生态变化）。

## 4. 复查触发条件

任一条件成立时重估本决策：
- 国内主流浏览器全面落地 Push API；
- 项目放弃 FLAG_SECURE 类合规需求；
- Capacitor 主版本破坏性变更导致维护成本超过自研壳。
