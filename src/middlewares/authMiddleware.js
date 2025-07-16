// JWT 토큰 검증 미들웨어

// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'your-secret-key'; // 실제 서비스에서는 환경변수로 관리하세요!

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: '토큰이 필요합니다.' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    }
    req.user = user; // 토큰에 담긴 정보 사용 가능
    next();
  });
}

module.exports = { verifyToken };