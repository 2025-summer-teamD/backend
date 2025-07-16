# 프로젝트 실행 안내 (Docker 기반)

이 프로젝트는 Docker 환경에서 개발 및 실행합니다. 로컬에 Node.js, npm, nvm 등은 설치할 필요가 없습니다.

---

## 1. Docker Desktop 설치
- [공식 다운로드](https://www.docker.com/products/docker-desktop/)
- 설치 후 Docker Desktop을 실행하세요.

## 2. 컨테이너 실행 및 종료

### 실행

#### Mac
```bash
sh start.sh
```
- Docker 데몬이 실행 중인지 자동으로 확인합니다.
- Express, PostgreSQL, Redis가 함께 실행됩니다.

#### Window

docker compose up --build -d

### 종료

#### Mac
```bash
sh stop.sh
```
- 모든 컨테이너를 중지 및 정리합니다.

#### Window

docker compose down

## 3.환경 변수 설정
./.env 파일 생성 및 변수 입력
./google-credentials 디렉토리 생성 및 안에 json 키 입력

## 4. 서버 접속
- 브라우저에서 (http://localhost:EXPRESS_PORT) 접속

---

## 5. Swagger API 문서 접속 방법
- 브라우저에서 아래 주소로 접속하면 API 명세(Swagger UI)를 확인할 수 있습니다.

```
http://localhost:EXPRESS_PORT/api-docs
```

- API 엔드포인트, 파라미터, 응답 예시 등을 한눈에 볼 수 있습니다.
- Swagger 문서는 코드의 JSDoc 주석을 기반으로 자동 생성됩니다.

---

# 디렉토리 구조
```text
.
├── __tests__/
│   ├── setup.js                # 테스트 전역 설정 (DB 초기화 등)
│   ├── fixtures/               # 테스트용 가짜 데이터
│   │   └── user.fixture.js
│   ├── unit/                   # 유닛 테스트
│   │   ├── services/
│   │   │   └── userService.spec.js
│   │   └── utils/
│   │       └── token.spec.js
│   └── integration/            # 통합 테스트
│       └── user.integration.spec.js
├── src/                        # 소스 코드를 담는 메인 디렉토리
│   ├── app.js                  #Express 애플리케이션의 핵심 설정 파일
│   ├── index.js                #진입점
│   ├── config/                 #설정 관련 파일 디렉토리
│   │   ├── index.js            # 환경 변수 로드 및 관리
│   │   └── prisma.js           # Prisma Client 싱글톤 인스턴스
│   ├── controllers/            #요청-응답 처리 로직 디렉토리
│   │   ├──index.js
│   │   └── userController.js
│   ├── routes/                 #라우팅(경로) 설정 디렉토리
│   │   ├──index.js
│   │   └── userRoutes.js
│   ├── services/               #핵심 비즈니스 로직 디렉토리
│   │   ├──index.js
│   │   └── userService.js
│   ├── middlewares/            #요청과 응답 사이의 중간 처리 로직 디렉토리
│   │   ├──index.js
│   │   ├── errorHandler.js
│   │   └── authMiddleware.js
│   └── utils/                  #재사용 가능한 유틸리티 함수 디렉토리
│       ├──index.js
│       └── token.js
├── prisma/
│   └── schema.prisma
├── .env                        #환경 변수 설정 파일
├── .env.test                   #테스트 환경 전용 환경 변수
├── jest.config.js              #Jest 테스트 설정 파일
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── package.json
└── README.md
```

## src/index.js 와 src/app.js 차이

## 요청 처리 흐름
1. 클라이언트 → src/app.js (요청 수신 및 미들웨어 실행)
2. app.js → src/routes/index.js (메인 라우팅)
3. routes/index.js → src/routes/*.js (세부 라우팅)
4. routes/*.js → src/middlewares/authMiddleware.js (인증 처리)
5. routes/*.js → src/controllers/ (컨트롤러 연결)
6. services → controllers (결과 반환)
7. controllers → 클라이언트 (최종 응답)
8. (에러 발생 시) (모든 단계) → src/middlewares/errorHandler.js

app.js는 “Express 앱의 모든 설정(미들웨어, 라우트, 에러처리 등)”을 담당하는 파일
실제 서버 실행(포트 listen)은 index.js에서 담당

서비스 → 컨트롤러 → 클라이언트로의 데이터 흐름이 실제로 잘 분리되어 있는지, 컨트롤러에서 비즈니스 로직이 섞여 있지 않은지 점검 필요.
에러 핸들러가 모든 라우터/미들웨어 뒤에 등록되어 있는지(Express에서 순서 중요) 확인.

    클라이언트 (손님): 주문을 합니다.

    요청 (주문서): 손님의 주문 내용입니다.

    미들웨어 (웨이터/지배인):

        손님을 맞이하고 예약 여부를 확인합니다. (인증/권한 미들웨어)

        주문서를 주방에 전달하기 전에 읽기 쉽게 정리합니다. (body-parser 미들웨어)

        모든 주문에 공통적으로 물을 한 잔씩 제공합니다. (로깅 또는 공통 데이터 추가 미들웨어)

        웨이터는 주방장(컨트롤러)에게 주문서를 전달할지 말지를 결정할 수 있습니다. (예약이 없으면 돌려보냄)

    컨트롤러 (주방장/셰프):

        웨이터에게 주문서를 받습니다.

        주문서 내용을 보고 어떤 요리를 만들지 결정합니다.

        직접 모든 요리를 하지 않고, 각 분야의 전문 요리사에게 지시합니다. "스테이크 담당, 미디움 레어로 구워줘!", "파스타 담당, 알리오 올리오 만들어줘!"

    서비스 (전문 요리사들 - 그릴, 파스타, 샐러드 담당):

        주방장의 지시를 받아 **실제 요리(핵심 로직, DB 작업 등)**를 합니다.

        완성된 요리를 주방장에게 전달합니다.

    응답 (완성된 요리): 주방장이 요리들을 예쁘게 플레이팅해서 웨이터를 통해 손님에게 전달합니다.

