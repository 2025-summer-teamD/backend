const express = require('express');
const app = express();

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
  },
  apis: ['./src/routes/**/*.js'], // JSDoc 주석에서 API 정보 추출
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 미들웨어
app.use(express.json());

// ... 기존 코드 (express, swagger 등 설정) ...

const mainRouter = require('./routes'); // src/routes/index.js를 불러옴
app.use('/', mainRouter); // 모든 라우트의 엔트리 포인트

// ... 기존 코드 (기본 라우트 등) ...
// 기본 라우트
app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

module.exports = app;

