import express from 'express';
import mainRouter from './routes/_index.js';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

const app = express();

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


