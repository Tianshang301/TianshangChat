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

공개 채널, 개인 메시지, 그룹 대화를 지원하는 실시간 채팅 애플리케이션 — 오프라인 사용 가능, 종단간 암호화, 플러그인 확장 지원. Web(PWA), Android, Windows 데스크톱에서 이용할 수 있습니다.

> **참고**: 이 프로젝트는 단계적으로 산업화를 진행 중입니다(엔지니어링 기준은 [AGENTS.md](../AGENTS.md) 참조). Phase 0–5 병합 완료: pnpm 모노레포, 전체 TypeScript, E2EE, 오프라인 우선, 테스트/CI 체계, PWA + 플러그인 시스템.

## 주요 기능

### 핵심 기능
- **공개 채팅**: 모든 접속 사용자가 참여하는 실시간 채팅방
- **개인 메시지**: 1:1 대화
- **그룹 채팅**: 생성 / ID로 참여, 멤버 역할(creator/admin/member), 방장은 탈퇴 불가
- **음성 메시지**: 녹음 및 재생
- **커스텀 아바타**: 프로필 이미지 업로드
- **다국어 지원**: 영어, 중국어(간체/번체), 일본어, 한국어
- **입력 표시·안 읽은 메시지 배지**: 공개/개인 모두 지원

### 보안 (E2EE)
- **개인 메시지**는 단순화된 Signal 프로토콜 사용: X3DH 키 합의 + Double Ratchet
- **그룹**은 Sender Keys 사용(발신자가 배포하며 서버는 개입하지 않음)
- 서버는 암호문만 저장(`e2ee:v1.*` / `gsk:v1.*` 봉투); 평문은 기기에만 존재
- 로컬 메시지 캐시는 내보낼 수 없는 기기 키로 암호화(WebCrypto)
- 스크린샷 방지: Electron `setContentProtection`, Android `FLAG_SECURE`

### 오프라인 우선
- 로컬 캐시(IndexedDB/Dexie)로 오프라인에서도 기록 열람 가능
- 발신함 큐 + 지수 백오프 재시도 — 오프라인 발송 메시지는 재접속 시 자동 전송
- 전송 확인: `sending → sent → delivered → read` 상태 머신
- 증분 동기화(`GET /api/sync?cursor=`), 재접속/시작 시 보완 조회

### PWA 및 웹 푸시
- 설치 가능한 웹 앱(manifest, 서비스 워커, app-shell 캐싱)
- 탭이 닫혔거나 백그라운드일 때 Web Push 알림(VAPID)
- 업로드 미디어(아바타/음성) 캐시 우선으로 즉시 재생

### 플러그인 시스템
- 서드파티 플러그인이 호스트 수정 없이 기능 등록: 슬래시 명령, 메시지 옵저버, 발신 변환기, 설정 저장소
- 권한 게이트 API(manifest에 선언된 기능을 런타임에 강제 검증)
- 번들 예제 플러그인 `ai-assistant`: `/ai <질문>`, `/translate <텍스트>` — OpenAI 호환 엔드포인트 지원(로컬 [Ollama](https://ollama.com)으로 바로 동작)

### 플랫폼 지원
| 플랫폼 | 설명 |
|------|------|
| **Web / PWA** | 브라우저 앱; 설치 가능, 오프라인 지원, 푸시 지원 |
| **Android** | Capacitor 셸 + 하단 내비게이션 |
| **Windows** | Electron 데스크톱 클라이언트 + 시스템 트레이 |

## 기술 스택

- **언어**: TypeScript(strict 모드, `any` 금지) — 서버·웹·공유 패키지 전반
- **모노레포**: pnpm workspaces + Turborepo
- **프론트엔드**: React 18, Vite, vite-plugin-pwa, Dexie(IndexedDB), Socket.IO 클라이언트, Capacitor, Electron
- **백엔드**: Node.js, Express, Socket.IO, Drizzle ORM + better-sqlite3, Zod 검증, helmet/rate-limit/CORS 화이트리스트, bcrypt + JWT 세션
- **암호**: 자체 관리 경량 Signal 구현(@noble/curves + hashes + ciphers)
- **테스트**: Vitest(단위 + Supertest 기반 임시 SQLite 통합 테스트), Playwright(E2E)
- **CI/CD**: GitHub Actions(lint → typecheck → unit → integration → build → docker); Docker Compose 배포(server + Caddy TLS + coturn)

## 프로젝트 구조

```
TianshangChat/
├── apps/
│   ├── server/               # Express + Socket.IO API (TypeScript)
│   │   └── src/
│   │       ├── api/routes/   # auth, messages, groups, users, sync, e2ee, push, upload
│   │       ├── socket/handlers/
│   │       ├── infra/        # Drizzle 스키마 + DB 부트스트랩
│   │       └── app.ts        # 앱 팩토리(테스트에서도 사용)
│   ├── web/                  # React 18 + Vite PWA
│   │   └── src/
│   │       ├── core/         # 암호 연결 계층, 푸시 클라이언트, 순수 로직
│   │       ├── domain/       # 유스케이스(메시징, 그룹, E2EE 설정)
│   │       ├── data/         # Dexie 리포지터리, 소켓 어댑터
│   │       ├── state/        # 채팅/UI 스토어
│   │       ├── plugins/      # 플러그인 호스트 로더
│   │       └── ui/           # React 컴포넌트
│   └── desktop/              # Electron 셸(웹 빌드 재사용)
├── packages/
│   ├── shared/               # 소켓 이벤트 타입, Zod DTO, 에러 코드
│   ├── core/                 # 각 단말 공통 순수 로직
│   ├── crypto/               # X3DH / Double Ratchet / Sender Keys (KAT 포함)
│   └── plugins-sdk/          # 플러그인 manifest 스키마 + 호스트 API 계약
├── android/                  # Capacitor Android 프로젝트
├── docs/                     # 엔지니어링 리포트(pwa-vs-capacitor 등)
├── docker-compose.yml        # server + Caddy(TLS) + coturn
└── AGENTS.md                 # 엔지니어링 기준 및 로드맵
```

## 시작하기

### 필수 요건
- Node.js 22+
- pnpm 11+ (`corepack enable`)

### 설정

```bash
pnpm install

# 서버 설정
cp apps/server/.env.example apps/server/.env
#   - JWT_SECRET 설정(생성 명령은 파일 안에 있음)
#   - 웹 푸시를 사용하려면 VAPID_* 키 설정:
#       npx web-push generate-vapid-keys

# 데이터베이스 마이그레이션 실행
pnpm db:migrate

# server + web 개발 서버 실행(Turbo)
pnpm dev
```

웹 앱은 http://localhost:5173 에서 실행됩니다(API :3000으로 프록시).

### 프로덕션 빌드

```bash
pnpm build        # 모든 패키지·앱
pnpm --filter @tianshangchat/web preview   # 빌드된 PWA 로컬 미리보기
```

### Android

```bash
pnpm --filter @tianshangchat/web build
npx cap sync android
cd android && ./gradlew assembleDebug
```

### Docker 배포

```bash
docker compose up -d    # server + Caddy(자동 TLS) + coturn 릴레이
```

## 명령어

| 명령 | 설명 |
|---------|-------------|
| `pnpm dev` | server + web을 watch 모드로 실행 |
| `pnpm build` | 모든 패키지/앱 빌드 |
| `pnpm lint` | ESLint(경고 0 허용) |
| `pnpm typecheck` | 전체 워크스페이스 `tsc --noEmit` |
| `pnpm test` | Vitest 단위 + 통합 테스트 |
| `pnpm test:e2e` | Playwright E2E 테스트 |
| `pnpm db:migrate` | Drizzle 마이그레이션 적용 |

## 설정 (`apps/server/.env`)

| 변수 | 필수 | 설명 |
|----------|----------|-------------|
| `PORT` | 아니오(기본 3000) | HTTP 포트 |
| `NODE_ENV` | 아니오 | development / production |
| `JWT_SECRET` | **예** | 세션 서명 키 |
| `DATABASE_PATH` | 아니오 | SQLite 파일 위치 |
| `UPLOAD_DIR` | 아니오 | `/uploads`로 제공되는 디렉터리 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | 아니오 | 웹 푸시(비워두면 비활성) |

## API 개요

모든 요청 본문은 Zod로 검증됩니다. 인증은 JWT Bearer 방식.

### 인증
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|-------------|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인(요청 제한 적용) |
| POST | `/api/auth/logout` | 세션 무효화 |
| GET | `/api/auth/verify` | 토큰 검증 |
| GET | `/api/auth/user` | 현재 사용자 프로필 |

### 메시지·동기화
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|-------------|
| GET | `/api/messages/history` | 공개 채널 기록 |
| GET | `/api/messages/private/:userId` | 특정 사용자와의 개인 기록 |
| GET | `/api/messages/private-list` | 대화 목록 |
| GET | `/api/messages/unread` | 안 읽은 메시지 카운트 |
| GET | `/api/sync?cursor=` | 증분 동기화 피드 |

### 그룹
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|-------------|
| GET / POST | `/api/groups` | 내 그룹 목록 / 생성 |
| GET | `/api/groups/:id` | 그룹 상세 |
| PUT / DELETE | `/api/groups/:id` | 수정 / 삭제(방장) |
| GET | `/api/groups/:id/messages` | 그룹 기록 |
| GET / POST | `/api/groups/:id/members` | 멤버 목록 / 추가 |
| DELETE | `/api/groups/:id/members/:userId` | 멤버 추방 |
| PUT | `/api/groups/:id/admin/:userId` | 관리자 임명/해임 |
| POST | `/api/groups/:id/join` | ID로 참여 |
| POST | `/api/groups/:id/leave` | 탈퇴(방장은 불가) |
| POST | `/api/groups/:id/transfer` | 방장 위임 |

### 사용자
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|-------------|
| GET | `/api/users/search?q=` | 사용자 검색 |
| GET | `/api/users/:id` | 사용자 프로필 |

### E2EE / 푸시 / 업로드
| 메서드 | 엔드포인트 | 설명 |
|--------|----------|-------------|
| PUT / GET | `/api/e2ee/bundle`, `/api/e2ee/bundle/:userId` | 프리키 번들 게시/조회 |
| GET | `/api/push/vapid-public` | VAPID 공개 키 조회 |
| POST | `/api/push/subscribe` / `/api/push/unsubscribe` | 푸시 구독 관리 |
| POST | `/api/upload/avatar` / `/api/upload/voice` | 업로드(형식+크기+경로 허용목록) |

## 소켓 프로토콜

이벤트 이름과 페이로드는 `@tianshangchat/shared`에 타입으로 정의되어 있습니다(`ClientToServerEvents` / `ServerToClientEvents`). 주요 항목:

- **클라이언트 → 서버**: `send-message`, `send-private-message`, `send-group-message` 및 음성 버전(`send-*-voice`), `create-group`, `join-group`, `leave-group`, `mark-delivered`, `mark-read`, 입력 표시, `update-avatar`
- **서버 → 클라이언트**: `receive-message`, `receive-private-message`, `receive-group-message`, `message-status`, 접속 상태(`user-list-update`, `user-left`), 그룹 생명주기(`group-created`, `group-updated`, `member-joined`, `member-left`), `avatar-updated`, `auth-error`

개인/그룹 메시지 본문은 E2EE 봉투로 전송되며 서버는 평문을 볼 수 없습니다.

## 플러그인

호스트 코드 수정 없이 확장하는 방식:

1. `manifest`와 `activate(api)`(선택적 `deactivate`)를 export하는 ESM JS 모듈 준비
2. `apps/web/public/plugins/registry.json`에 등록:

```json
[
  { "id": "my-plugin", "entry": "/plugins/my-plugin/index.js", "enabled": true }
]
```

Manifest에 권한 선언 — `settings`, `messages:observe`, `messages:transform`, `commands:register` — 각각 대응하는 `PluginApi` 표면을 열어주며, 권한 없는 호출은 런타임에 예외가 발생합니다.

번들된 `ai-assistant` 플러그인이 전체 기능을 시연합니다:

```
/ai 래치 키는 어떻게 교체하나요?
/translate Good morning, everyone.
```

OpenAI 호환 엔드포인트를 호출합니다(기본값: 로컬 Ollama `http://127.0.0.1:11434/v1`). 베이스 URL/모델/키는 기기별 플러그인 설정에 저장되며 채팅 서버로 전송되지 않습니다. 계약 상세는 [`packages/plugins-sdk`](../packages/plugins-sdk/src/plugin.ts) 참조.

## 데이터베이스

SQLite + Drizzle ORM(마이그레이션 위치: `apps/server/drizzle/`): `users`, `sessions`, `messages`(E2EE 대상은 암호문), `groups`, `group_members`, `e2ee_bundles`, `push_subscriptions`.

## 라이선스

MIT License
