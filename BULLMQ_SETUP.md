# BullMQ 큐 시스템 설정 가이드

이 문서는 BullMQ 기반 비동기 AI 처리 및 푸시 알림 시스템의 설정과 사용법을 설명합니다.

## 🏗️ 시스템 아키텍처

```
사용자 → WebSocket → 큐 등록 → Worker → AI 처리 → DB 저장 → 실시간 전송
                  ↓
                 오프라인 사용자 → 푸시 알림
```

## 📋 단계별 플로우

1. **사용자 → 서버**: WebSocket으로 메시지 전송
2. **서버 → BullMQ**: Redis 기반 큐에 AI 처리 작업 등록
3. **Worker**: Redis에서 작업을 가져와 AI 호출
4. **DB/Cache**: 응답 결과를 데이터베이스와 Redis에 저장
5. **WebSocket 전송**: 온라인 사용자에게 실시간 응답 전송
6. **푸시 알림**: 오프라인 사용자에게 Firebase FCM으로 알림 전송

## 🔧 환경변수 설정

### `.env` 파일 필수 설정

```bash
# 기본 서버 설정
PORT=3001
NODE_ENV=development

# Redis 설정 (BullMQ용)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# BullMQ 워커 설정
AI_WORKER_CONCURRENCY=3          # AI 처리 동시 작업 수
PUSH_WORKER_CONCURRENCY=5        # 푸시 알림 동시 전송 수
WORKER_NAME=worker-1             # 워커 식별 이름

# Firebase 푸시 알림 설정
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"

# 또는 서비스 계정 파일 경로
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-credentials/service-account.json

# Google Cloud 설정 (Vertex AI용)
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials/service-account.json
GOOGLE_CLOUD_PROJECT=your-gcp-project
GOOGLE_CLOUD_REGION=us-central1

# Gemini API
GEMINI_API_KEY=your-gemini-api-key

# 데이터베이스
DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# Clerk 인증
CLERK_PUBLISHABLE_KEY=your-clerk-key
CLERK_SECRET_KEY=your-clerk-secret
```

## 🚀 실행 방법

### 1. 개발 환경

```bash
# 의존성 설치
npm install

# 데이터베이스 마이그레이션
npx prisma migrate dev

# 서버와 워커를 각각 실행
npm run dev        # 터미널 1: Express 서버
npm run worker:dev # 터미널 2: BullMQ 워커

# 또는 Docker Compose 사용
docker-compose -f docker-compose.dev.yml up
```

### 2. 운영 환경

```bash
# Docker Compose로 전체 시스템 실행
docker-compose up -d

# 개별 실행
npm start       # Express 서버
npm run worker  # BullMQ 워커
```

## 📊 모니터링 및 관리

### API 엔드포인트

```bash
# 큐 상태 조회
GET /api/queue/status

# FCM 토큰 등록
POST /api/queue/fcm-token
{
  "token": "firebase-fcm-token"
}

# 테스트 푸시 알림 (개발환경만)
POST /api/queue/test-notification
{
  "title": "테스트 제목",
  "body": "테스트 내용"
}

# 큐 정리 (관리자만)
POST /api/queue/clean
```

### 큐 상태 확인

```bash
# Redis CLI로 직접 확인
redis-cli
> KEYS bull:*
> LLEN bull:ai-chat-processing:waiting
> LLEN bull:push-notification:waiting
```

## 🔄 워크플로우 상세

### AI 채팅 처리 과정

1. **메시지 수신**: WebSocket으로 사용자 메시지 수신
2. **즉시 응답**: 온라인 사용자들에게 사용자 메시지 전송
3. **큐 등록**: AI 처리 작업을 `ai-chat-processing` 큐에 추가
4. **워커 처리**: 별도 프로세스의 워커가 작업 수행
   - Vertex AI 호출
   - 응답 생성
   - DB 저장
   - Redis Pub/Sub으로 WebSocket 서버에 전송
5. **실시간 전송**: 온라인 사용자들에게 AI 응답 전송
6. **친밀도 업데이트**: 경험치 및 레벨 계산

### 푸시 알림 처리 과정

1. **오프라인 감지**: 사용자 온라인 상태 확인
2. **알림 큐 등록**: `push-notification` 큐에 작업 추가
3. **FCM 전송**: Firebase Cloud Messaging으로 알림 전송
4. **토큰 관리**: 만료된 토큰 자동 정리

## 🔐 보안 고려사항

### FCM 토큰 관리
- Redis에 30일 TTL로 저장
- 만료된 토큰 자동 제거
- 사용자별 여러 디바이스 지원

### 작업 재시도
- AI 처리: 최대 3회 재시도 (지수 백오프)
- 푸시 알림: 최대 2회 재시도 (고정 지연)

### 리소스 제한
- AI 워커: 동시 처리 3개 작업
- 푸시 워커: 동시 처리 5개 작업
- Rate Limiting 적용

## 🚨 문제 해결

### 일반적인 문제들

#### 1. 워커가 작업을 처리하지 않음
```bash
# Redis 연결 확인
docker logs bullmq_worker
# 또는
npm run worker:dev

# 큐 상태 확인
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/queue/status
```

#### 2. 푸시 알림이 전송되지 않음
```bash
# Firebase 설정 확인
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL

# FCM 토큰 등록 확인
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_FCM_TOKEN"}' \
  http://localhost:3001/api/queue/fcm-token
```

#### 3. AI 응답이 느림
```bash
# 워커 동시 처리 수 조정
export AI_WORKER_CONCURRENCY=5

# 큐 적체 상황 확인
redis-cli LLEN bull:ai-chat-processing:waiting
```

### 로그 모니터링

```bash
# 워커 로그 실시간 확인
docker logs -f bullmq_worker

# 서버 로그 확인
docker logs -f express_app

# Redis 모니터
redis-cli MONITOR
```

## 📈 성능 최적화

### 워커 스케일링
```yaml
# docker-compose.yml에서 워커 복제
worker:
  # ... 기존 설정
  deploy:
    replicas: 3  # 3개의 워커 인스턴스
```

### Redis 최적화
```bash
# Redis 메모리 사용량 모니터링
redis-cli INFO memory

# 큐 정리 자동화 (cron job)
0 2 * * * curl -X POST http://localhost:3001/api/queue/clean
```

## 🔧 개발자 도구

### 큐 시각화 도구 설치
```bash
# Bull Dashboard (선택사항)
npm install -g bull-board
bull-board --redis redis://localhost:6379
```

### 테스트 스크립트
```bash
# 부하 테스트
node test-scripts/load-test-chat.js

# FCM 토큰 테스트
node test-scripts/test-push-notification.js
```

이 시스템을 통해 확장 가능하고 안정적인 실시간 AI 채팅과 푸시 알림 기능을 구현할 수 있습니다. 