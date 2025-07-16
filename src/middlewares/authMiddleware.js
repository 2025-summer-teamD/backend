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

const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// Clerk 인증 미들웨어
const requireAuth = ClerkExpressRequireAuth();

// 사용자 ID 추출 미들웨어
const extractUserId = (req, res, next) => {
  try {
    // Clerk에서 인증된 사용자 정보 가져오기
    const userId = req.auth?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '인증이 필요합니다.'
      });
    }
    
    // req.user에 사용자 ID 저장
    req.user = { clerk_id: userId };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '인증 처리 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

module.exports = {
  requireAuth,
  extractUserId,
  verifyToken
};
