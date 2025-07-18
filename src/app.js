import express from 'express';
import cors from 'cors';
import mainRouter from './routes/_index.js';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

const app = express();

// CORS 설정
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // 프론트엔드 주소들
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

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
        url: '/api',
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
app.use('/api', mainRouter);

export default app;


