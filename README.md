# Character Chat Backend API

Express.js 기반의 캐릭터 채팅 백엔드 API 서버입니다.

## 🚀 주요 기능

- **사용자 인증**: Clerk 기반 JWT 인증
- **캐릭터 관리**: 캐릭터 생성, 수정, 삭제, 조회
- **채팅 시스템**: 실시간 AI 채팅 (Google Vertex AI)
- **파일 업로드**: Google Cloud Storage 연동
- **분산 트레이싱**: OpenTelemetry + Jaeger 
- **모니터링**: ELK Stack + Prometheus + Grafana
- **로드 밸런싱**: Traefik 리버스 프록시

## 🔧 기술 스택

- **Runtime**: Node.js 22+
- **Framework**: Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Cache**: Redis
- **Authentication**: Clerk
- **AI**: Google Vertex AI (Gemini)
- **Storage**: Google Cloud Storage
- **Monitoring**: 
  - Logs: ELK Stack (Elasticsearch, Logstash, Kibana)
  - Metrics: Prometheus + Grafana
  - Tracing: OpenTelemetry + Jaeger
- **Proxy**: Traefik

## 📊 모니터링 & 트레이싱

### 🔍 분산 트레이싱 접속

```bash
# 모니터링 스택 시작
npm run monitoring

# 접속 URLs
- Jaeger UI: http://localhost:16686 (트레이싱)
- Traefik Dashboard: http://localhost:8080 (프록시 상태)
- Kibana: http://localhost:5601 (로그 분석)
- Grafana: http://localhost:3000 (메트릭 대시보드)
- Prometheus: http://localhost:9090 (메트릭 수집)
```

### 🎯 트레이싱 기능

1. **요청 추적**: 모든 API 요청에 고유 추적 ID 부여
2. **분산 추적**: Traefik → Backend → Database 전체 플로우 추적
3. **성능 모니터링**: 병목 지점 및 지연 시간 분석
4. **에러 추적**: 에러 발생 지점과 전파 경로 추적
5. **사용자 활동**: 인증된 사용자의 모든 활동 추적

### 📈 추적 ID 활용

```javascript
// API 응답에 추적 ID 포함
{
  "data": {...},
  "traceId": "abc123def456"
}

// 로그에서 추적 ID로 검색
// Kibana: traceId:"abc123def456"
// Jaeger: Trace ID 검색
```

## 🚀 시작하기

### 개발 환경 설정

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일 편집 필요

# 데이터베이스 마이그레이션
npx prisma migrate dev

# 개발 서버 시작 (트레이싱 비활성화)
npm run dev
```

### 환경변수 설정

```bash
# 서버 설정
PORT=3001
NODE_ENV=development

# 트레이싱 설정 (개발: false, 운영: true)
ENABLE_TRACING=false
OTEL_SERVICE_NAME=character-chat-backend
JAEGER_ENDPOINT=http://localhost:4318/v1/traces

# Clerk 인증
CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_secret

# 데이터베이스
DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# Google Cloud
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials/service-account.json
GCS_BUCKET_NAME=your-bucket
```

### Docker 환경

```bash
# 개발 환경 (트레이싱 비활성화)
docker-compose -f docker-compose.dev.yml up

# 운영 환경 (트레이싱 활성화)
docker-compose up

# 모니터링 스택 (Traefik + Jaeger + ELK + Grafana)
docker-compose -f docker-compose.monitoring.yml up
```

## 🔍 API 문서

```bash
# 서버 시작 후 접속
http://localhost:3001/api-docs
```

## 📋 사용 가능한 스크립트

```bash
npm start          # 운영 모드 시작
npm run dev        # 개발 모드 시작 (nodemon)
npm test          # 테스트 실행
npm run monitoring # 모니터링 스택 시작
```

## 🐛 트레이싱 디버깅

### Jaeger에서 추적하기

1. **Jaeger UI** 접속: http://localhost:16686
2. **Service 선택**: `character-chat-backend`
3. **추적 ID 검색**: API 응답의 `traceId` 사용
4. **전체 플로우 확인**: Traefik → Backend → Database

### 로그 연결 분석

```bash
# Kibana에서 특정 추적 ID의 모든 로그 검색
traceId:"abc123def456"

# 특정 사용자의 모든 활동 추적
userId:"user_12345" AND traceId:*
```

## 🚨 문제 해결

### 트레이싱 관련

1. **Jaeger 연결 실패**
   ```bash
   # Jaeger 컨테이너 상태 확인
   docker logs jaeger
   
   # 네트워크 연결 확인
   docker network ls
   ```

2. **추적 ID가 전파되지 않음**
   - `ENABLE_TRACING=true` 환경변수 확인
   - OpenTelemetry 초기화 로그 확인

3. **성능 이슈**
   - 개발환경에서는 `ENABLE_TRACING=false` 사용 권장
   - 운영환경에서만 분산 트레이싱 활성화

## 📞 지원

트레이싱 및 모니터링 관련 문의사항이 있으시면 개발팀에 문의해주세요.

##BullMQ install
npm install bullmq ioredis