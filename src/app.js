const express = require('express');
const app = express();

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
  },
  apis: ['./src/routes/*.js'], // JSDoc 주석에서 API 정보 추출
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// 미들웨어
app.use(express.json());

app.use('/api/personas', personaRoutes);

// 기본 라우트
app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

module.exports = app;