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
  apis: [__dirname + '/routes/*.js'], // 민정 수정 오류떠서 이거 한줄만 수정함. 
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 미들웨어
app.use(express.json());

// chat 라우터
const chatRouter = require('./routes/chat');
app.use('/chat', chatRouter);

// 기본 라우트
app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

module.exports = app;

