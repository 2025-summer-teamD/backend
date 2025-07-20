import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mainRouter from './routes/_index.js'; // mainRouter 경로 확인
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS 설정
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // 프론트엔드 주소들
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 업로드된 이미지를 정적 파일로 서빙 (이 부분은 GCS에서 이미지를 서빙할 경우 필요 없습니다.)
// GCS를 통해 이미지를 서빙할 것이므로 이 라인을 주석 처리했습니다.
// app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// Swagger 설정
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Express API',
      version: '1.0.0',
      description: 'API 문서 (Swagger)',
    },
    servers: [
      {
        url: '/api', // 모든 API 경로 앞에 /api가 붙습니다.
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

app.get('/', (req, res) => {
    res.send('Welcome!');
});
  
app.use(express.json());

// mainRouter는 '/api' 접두사로 마운트됩니다.
// 따라서 uploadRouter의 '/uploads/:filename' 경로는 최종적으로 '/api/uploads/:filename'이 됩니다.
app.use('/api', mainRouter);

export default app;