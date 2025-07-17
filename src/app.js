const express = require('express');
const app = express();
const prisma = require('./config/prisma'); // Prisma 클라이언트 추가

const personaRoutes = require('./routes/personaRoutes');

const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');

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
  
  // apis: [__dirname + '/routes/*.js'],   여기까지 토큰 생성을 위해 추가함

  apis: ['./src/routes/**/*.js'], // JSDoc 주석에서 API 정보 추출

};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 미들웨어
app.use(express.json());

// 기본 라우트


// chat 라우터
const chatRouter = require('./routes/chat');
app.use('/chat', chatRouter);

// 기본 라우트

const mainRouter = require('./routes'); // src/routes/index.js를 불러옴
app.use('/', mainRouter); // 모든 라우트의 엔트리 포인트


app.get('/', (req, res) => {
  res.send('Hello, Express!');
});


module.exports = app;

// /api-docs

