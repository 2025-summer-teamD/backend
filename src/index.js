// =========================
// 서버 실행의 진입점 (index.js)
// - app.js에서 설정한 Express 앱을 불러와 실제로 서버를 실행
// =========================

const app = require('./app');

const PORT = process.env.EXPRESS_PORT ;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});