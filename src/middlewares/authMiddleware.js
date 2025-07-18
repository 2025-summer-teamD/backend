import { ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';

// Clerk 인증 미들웨어를 생성합니다.
// 이 미들웨어는 토큰을 검증하고 성공 시 req.auth 객체를 채웁니다.
const clerkAuthMiddleware = ClerkExpressWithAuth();

// 추가로, req.auth가 존재하는지 확인하는 미들웨어를 만들 수 있습니다.
// 이 미들웨어는 로그인한 사용자만 접근 가능한 라우트를 보호하는 데 사용됩니다.
const requireAuth = (req, res, next) => {
  // 개발 환경에서 테스트용 인증 우회 (강제 설정)
  if (process.env.NODE_ENV === 'development') {
    req.auth = { userId: 'dvb_2zs0L9gT06uGpbdHSqTl5UgrL0p' };
    console.log('🔧 개발 환경: 인증 우회됨 (테스트용) - userId:', req.auth.userId);
  }
  
  if (!req.auth) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }
  next();
};

const authMiddleware = {
  clerkAuthMiddleware,
  requireAuth,
};

export default authMiddleware;