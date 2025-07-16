const express = require('express');
const cors = require('cors');
const app = express();
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const userRoutes = require('./routes/userRoutes');
const charactersRoutes = require('./routes/charactersRoutes');
const errorHandler = require('./middlewares/errorHandler');

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
app.use(cors()); // ✅ CORS 허용!
app.use(express.json());

// 라우터 등록
app.use('/users', userRoutes);
app.use('/characters', charactersRoutes);

// 에러 핸들러 등록
app.use(errorHandler);

module.exports = app