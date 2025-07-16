const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const userRoutes = require('./routes/userRoutes');
const charactersRoutes = require('./routes/charactersRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

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
  apis: ['./src/routes/*.js'],
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 라우터 등록
app.use('/users', userRoutes);
app.use('/characters', charactersRoutes);

// 기본 라우트
app.get('/', (req, res) => {
  res.send('Hello, Express!');
});

// 에러 핸들러 등록
app.use(errorHandler);

module.exports = app;

