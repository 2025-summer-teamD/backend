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
  extractUserId
};
