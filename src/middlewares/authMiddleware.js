/**
 * 인증 미들웨어
 * 
 * 사용 위치:
 * - 모든 보호된 라우트에서 사용자 인증 검증
 * 
 * 기능:
 * - Clerk 토큰 검증
 * - 사용자 인증 상태 확인
 * - 권한 검증
 */

import { ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';
import { sendUnauthorized } from '../utils/responseHandler.js';
import { logUserActivity } from '../utils/logger.js';

// Clerk 인증 미들웨어를 생성합니다.
// 이 미들웨어는 토큰을 검증하고 성공 시 req.auth 객체를 채웁니다.
const clerkAuthMiddleware = ClerkExpressWithAuth();

/**
 * 인증이 필요한 라우트를 보호하는 미들웨어
 * 
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const requireAuth = (req, res, next) => {
  if (!req.auth) {
    logUserActivity('AUTH_FAILED', null, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    });
    return sendUnauthorized(res, '인증이 필요합니다.');
  }
  
  // 인증 성공 로깅
  logUserActivity('AUTH_SUCCESS', req.auth.userId, {
    ip: req.ip,
    url: req.originalUrl
  });
  
  next();
};

/**
 * 선택적 인증 미들웨어 (인증이 있으면 사용자 정보를, 없으면 null을 설정)
 * 
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const optionalAuth = (req, res, next) => {
  // req.auth가 없어도 에러를 발생시키지 않음
  // 단순히 다음 미들웨어로 진행
  next();
};

/**
 * 관리자 권한 검증 미들웨어
 * 
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const requireAdmin = (req, res, next) => {
  if (!req.auth) {
    return sendUnauthorized(res, '인증이 필요합니다.');
  }
  
  // 관리자 권한 확인 (예시 - 실제 구현에 맞게 수정 필요)
  const isAdmin = req.auth.userId && req.auth.userId.includes('admin');
  
  if (!isAdmin) {
    logUserActivity('ADMIN_ACCESS_DENIED', req.auth.userId, {
      ip: req.ip,
      url: req.originalUrl
    });
    return sendUnauthorized(res, '관리자 권한이 필요합니다.');
  }
  
  logUserActivity('ADMIN_ACCESS', req.auth.userId, {
    ip: req.ip,
    url: req.originalUrl
  });
  
  next();
};

export {
  clerkAuthMiddleware,
  requireAuth,
  optionalAuth,
  requireAdmin
};
