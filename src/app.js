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
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mainRouter from './routes/_index.js';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import errorHandler from './middlewares/errorHandler.js';
import logger from './utils/logger.js';

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
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 요청 로깅 미들웨어
app.use(logger.logRequest);

// 업로드된 이미지를 정적 파일로 서빙
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

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

// 기본 라우트
app.get('/', (req, res) => {
    res.json({
      message: 'Character Chat API 서버에 오신 것을 환영합니다!',
      version: '1.0.0',
      docs: '/api-docs'
    });
});

// API 라우터
app.use('/api', mainRouter);

// 404 에러 핸들러 (라우터 이후에 배치)
app.use(errorHandler.notFoundHandler);

// 전역 에러 핸들러 (마지막에 배치)
app.use(errorHandler.errorHandler);

export default app;


