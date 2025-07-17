import express from 'express';
import { prisma } from './config/prisma.js';
import personaRoutes from './routes/personaRoute.js';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import chatRouter from './routes/chat.js';
import mainRouter from './routes/index.js';


const app = express();

// Swagger 설정
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Express API',
      version: '1.0.0',
      description: 'Swagger API 문서',
    },
    components: {              //여기서부터 토큰 생성을 위해 추가함
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

// 미들웨어
app.use(express.json());

// 기본 라우트


// chat 라우터
app.use('/chat', chatRouter);

// persona 라우터
app.use('/personas', personaRoutes);

// 기본 라우트

app.use('/', mainRouter); // 모든 라우트의 엔트리 포인트


app.get('/', (req, res) => {
  res.send('Hello, Express!');
});


export default app;


