/**
 * Express 애플리케이션 설정
 * 
 * 기능:
 * - 미들웨어 설정
 * - 라우터 연결
 * - 에러 핸들링
 * - CORS 설정
 * - 정적 파일 서빙
 * - API 문서화 (Swagger)
 * - 요청 추적 (Tracing)
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mainRouter from './routes/_index.js'; // mainRouter 경로 확인
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import errorHandler from './middlewares/errorHandler.js';
import logger from './utils/logger.js';
import authMiddleware from './middlewares/authMiddleware.js';
import traceMiddleware from './middlewares/traceMiddleware.js';
import client from 'prom-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 기본 미들웨어
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS 설정
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // 프론트엔드 주소들
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-trace-id'], // 추적 ID 헤더 추가
}));

// 요청 추적 미들웨어 (가장 먼저 등록)
app.use(traceMiddleware.traceMiddleware);

// 요청 로깅 미들웨어 (인증 전에 등록)
app.use(logger.logRequest);

// Swagger 설정
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Character Chat API',
      version: '1.0.0',
      description: '캐릭터 채팅 애플리케이션 API 문서',
    },
    servers: [
      {

        url: '/api',
        description: '개발 서버'
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/**/*.js'], // JSDoc 주석에서 API 정보 추출
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// prom-client 기본 메트릭 수집
client.collectDefaultMetrics();

// /metrics 엔드포인트 추가 (가장 위쪽에 배치)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// 채팅방에서 이미지 보내기 폴더
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads'))); // 추가: /api/uploads도 인증 없이 서빙

// 기본 라우트 (인증 없이 접근 가능)
app.get('/', (req, res) => {
  res.json({
    message: 'Character Chat API 서버에 오신 것을 환영합니다!',
    version: '1.0.0',
    docs: '/api-docs',
    traceId: req.traceId // 추적 ID 포함
  });
});

// Clerk 인증 미들웨어 (API 경로에만 적용)
app.use('/api', authMiddleware.clerkAuthMiddleware);

// 인증 후 사용자 정보를 추적 컨텍스트에 추가하는 미들웨어 (API 경로에만 적용)
app.use('/api', (req, res, next) => {
  if (req.auth?.userId) {
    traceMiddleware.setUserContext(req.auth.userId, req.auth.sessionId);
  }
  next();
});

//app.use(express.json());

// API 라우터
app.use('/api', mainRouter);

// 404 에러 핸들러 (라우터 이후에 배치)
app.use(errorHandler.notFoundHandler);

// 전역 에러 핸들러 (마지막에 배치)
app.use(errorHandler.errorHandler);

// mainRouter는 '/api' 접두사로 마운트됩니다.
// 따라서 uploadRouter의 '/uploads/:filename' 경로는 최종적으로 '/api/uploads/:filename'이 됩니다.
app.use('/api', mainRouter);

export default app;