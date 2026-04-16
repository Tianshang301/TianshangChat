# TianshangChat

공개 채팅, 개인 메시지 및 그룹 대화를 지원하는 실시간 채팅 애플리케이션입니다. Web, Android, Windows 데스크톱에서 사용 가능합니다.

## 기능

### 핵심 기능
- **공개 채팅**: 연결된 모든 사용자를 위한 실시간 채팅방
- **개인 메시지**: 1:1 암호화된 대화
- **그룹 채팅**: 그룹 대화 생성 및 관리
- **음성 메시지**: 음성 녹음 전송 및 수신
- **사용자 정의 아바타**: 개인 프로필 사진 업로드
- **다국어 지원**: 영어, 중국어(간체/번체), 일본어, 한국어

### 플랫폼 지원
| 플랫폼 | 설명 |
|--------|------|
| **Web** | 브라우저 기반 애플리케이션 |
| **Android** | 하단 내비게이션 모바일 앱 |
| **Windows** | 시스템 트레이가 있는 데스크톱 클라이언트 |

### 네트워킹
- **LAN 지원**: 로컬 네트워크의 서버에 연결
- **수동 IP 설정**: Android 및 원격 연결용
- **クロス플랫폼 인증**: JWT 기반 인증, 로그인 유지 기능

## 기술 스택

### 프론트엔드
- **React** - UI 프레임워크
- **Vite** - 빌드 도구
- **Socket.io Client** - 실시간 통신
- **Capacitor** - 모바일 앱 래퍼
- **Electron** - 데스크톱 애플리케이션

### 백엔드
- **Express.js** - REST API 서버
- **Socket.io** - WebSocket 서버
- **SQLite** - 데이터베이스
- **bcrypt** - 비밀번호 해싱
- **JWT** - 인증

## 프로젝트 구조

```
TianshangChat/
├── backend/                    # Express.js 백엔드 서버
│   ├── database/              # SQLite 데이터베이스 설정
│   ├── middleware/            # 인증 미들웨어
│   ├── models/                # 데이터베이스 모델
│   ├── routes/                # API 라우트
│   ├── uploads/               # 업로드된 파일
│   └── server.js              # 메인 서버 파일
├── frontend/                   # React 프론트엔드
│   ├── src/
│   │   ├── components/        # React 컴포넌트
│   │   ├── context/           # React 컨텍스트
│   │   ├── i18n/              # 번역 파일
│   │   └── utils/             # 유틸리티
│   ├── android/               # Android 프로젝트 (Capacitor)
│   ├── electron/              # 데스크톱 앱 (Electron)
│   └── capacitor.config.json  # Capacitor 설정
├── electron/                   # Electron 데스크톱 앱
│   ├── main.js                # 메인 프로세스
│   └── preload.js             # 프리로드 스크립트
└── android-app.apk            # 최신 Android APK
```

## 시작하기

### 전제 조건
- Node.js 18+
- npm 또는 yarn
- Android: Android Studio, Android SDK
- 데스크톱: Node.js

### 백엔드 설정

```bash
cd TianshangChat/backend
npm install
npm start
```

서버는 기본적으로 포트 3000에서 실행됩니다.

### 프론트엔드 Web 설정

```bash
cd TianshangChat/frontend
npm install
npm run dev
```

### Android 설정

```bash
cd TianshangChat/frontend
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

APK는 `android/app/build/outputs/apk/debug/app-debug.apk`에 있습니다.

### 데스크톱 설정

```bash
cd TianshangChat/frontend
npm run build

cd ../electron
npm install
npm start
```

## API 엔드포인트

### 인증
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/auth/register` | 새 사용자 등록 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/verify` | 토큰 검증 |

### 메시지
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/messages/history` | 공개 채팅 기록 가져오기 |
| GET | `/api/messages/private/:userId` | 개인 메시지 가져오기 |
| GET | `/api/messages/private-list` | 대화 목록 가져오기 |

### 그룹
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/groups` | 사용자의 그룹 가져오기 |
| POST | `/api/groups` | 그룹 생성 |
| POST | `/api/groups/:id/join` | ID로 그룹 참가 |

### 사용자
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/users/search?q=` | 사용자 검색 |

### 업로드
| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| POST | `/api/upload/avatar` | 아바타 업로드 |
| POST | `/api/upload/voice` | 음성 메시지 업로드 |

## Socket 이벤트

### 클라이언트 -> 서버
- `authenticate` - JWT 토큰으로 인증
- `send-message` - 공개 메시지 전송
- `send-private-message` - 개인 메시지 전송
- `send-group-message` - 그룹 메시지 전송
- `create-group` - 새 그룹 생성
- `join-group` - 기존 그룹 참가

### 서버 -> 클라이언트
- `authenticated` - 인증 성공
- `user-list-update` - 온라인 사용자 변경
- `receive-message` - 새 공개 메시지
- `receive-private-message` - 새 개인 메시지
- `receive-group-message` - 새 그룹 메시지
- `group-updated` - 그룹 설정 변경

## 설정

### 백엔드 (.env)
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

## 데이터베이스 스키마

### Users
- id (기본 키)
- username (고유)
- password_hash
- avatar
- created_at

### Messages
- id (기본 키)
- sender_id
- recipient_id (nullable)
- group_id (nullable)
- type (text/voice)
- content
- audio_url

### Groups
- id (기본 키)
- name
- creator_id
- created_at

### Sessions
- id (기본 키)
- user_id
- token (고유)
- expires_at
- remember_me

## 라이선스

MIT 라이선스