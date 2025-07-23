/**
 * 요청 추적 미들웨어
 * 
 * 기능:
 * - 각 API 요청에 고유한 추적 ID 생성
 * - 요청 컨텍스트에 추적 ID 저장
 * - 로그에 추적 ID 자동 포함
 * - 응답 헤더에 추적 ID 포함
 * - 환경별 활성화/비활성화 지원
 */

import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

// AsyncLocalStorage를 사용하여 요청별 컨텍스트 관리
const traceContext = new AsyncLocalStorage();

// 환경변수로 트레이스 기능 제어
const TRACE_ENABLED = process.env.ENABLE_TRACING === 'true' || process.env.NODE_ENV === 'production';

/**
 * 추적 ID 생성 미들웨어
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const traceMiddleware = (req, res, next) => {
  // 클라이언트에서 전달된 추적 ID가 있으면 사용, 없으면 새로 생성
  const traceId = req.headers['x-trace-id'] || generateTraceId();
  
  // 요청 객체에 추적 ID 저장
  req.traceId = traceId;
  
  // 응답 헤더에 추적 ID 포함
  res.setHeader('x-trace-id', traceId);

  // 트레이스가 비활성화된 경우 기본 처리만 수행
  if (!TRACE_ENABLED) {
    return next();
  }

  // AsyncLocalStorage를 사용하여 요청별 컨텍스트 생성 (OpenTelemetry 없이)
  const requestContext = {
    traceId,
    startTime: Date.now(),
    userId: null, // 인증 후 설정됨
    sessionId: null,
  };

  // AsyncLocalStorage만 사용
  traceContext.run(requestContext, () => {
    next();
  });
};

/**
 * 추적 ID 생성
 * @returns {string} 고유한 추적 ID
 */
const generateTraceId = () => {
  return randomUUID().replace(/-/g, '').substring(0, 16);
};

/**
 * 현재 컨텍스트의 추적 ID 가져오기
 * @returns {string|null} 현재 요청의 추적 ID
 */
const getCurrentTraceId = () => {
  if (!TRACE_ENABLED) return null;
  const context = traceContext.getStore();
  return context?.traceId || null;
};

/**
 * 현재 컨텍스트 전체 가져오기
 * @returns {object|null} 현재 요청 컨텍스트
 */
const getCurrentContext = () => {
  if (!TRACE_ENABLED) return null;
  return traceContext.getStore() || null;
};

/**
 * 컨텍스트에 사용자 정보 설정
 * @param {string} userId - 사용자 ID
 * @param {string} sessionId - 세션 ID (선택사항)
 */
const setUserContext = (userId, sessionId = null) => {
  if (!TRACE_ENABLED) return;
  const requestContext = traceContext.getStore();
  if (requestContext) {
    requestContext.userId = userId;
    requestContext.sessionId = sessionId;
  }
};

/**
 * 요청 처리 시간 계산
 * @returns {number} 요청 시작부터 현재까지의 시간 (ms)
 */
const getRequestDuration = () => {
  if (!TRACE_ENABLED) return 0;
  const requestContext = traceContext.getStore();
  if (requestContext && requestContext.startTime) {
    return Date.now() - requestContext.startTime;
  }
  return 0;
};

/**
 * 트레이스 활성화 상태 확인
 * @returns {boolean} 트레이스 활성화 여부
 */
const isTraceEnabled = () => {
  return TRACE_ENABLED;
};

export default {
  traceMiddleware,
  generateTraceId,
  getCurrentTraceId,
  getCurrentContext,
  setUserContext,
  getRequestDuration,
  isTraceEnabled
}; 