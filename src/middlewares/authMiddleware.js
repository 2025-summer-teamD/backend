const { verifyToken } = require('@clerk/clerk-sdk-node');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
    }

    const token = authHeader.split(' ')[1];
    // Clerk JWT 토큰 검증
    const payload = await verifyToken(token);

    // payload에 유저 정보가 들어있음
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
}

module.exports = authMiddleware;
