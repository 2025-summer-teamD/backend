/**
 * 전역 에러 핸들러 미들웨어
 * 
 * 사용 위치:
 * - app.js에서 전역 에러 처리
 * 
 * 기능:
 * - 모든 에러를 일관되게 처리
 * - 에러 로깅
 * - 클라이언트에 적절한 에러 응답 전송
 * - 보안을 위해 민감한 에러 정보 숨김
 */

import { sendInternalError } from '../utils/responseHandler.js';

/**
 * 전역 에러 핸들러
 * @param {Error} err - 에러 객체
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
export const errorHandler = (err, req, res, next) => {
  // 에러 로깅
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Prisma 에러 처리
  if (err.code === 'P2002') {
    return res.status(400).json({
      success: false,
      message: '중복된 데이터가 존재합니다.',
      error: 'DUPLICATE_ENTRY'
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: '요청한 데이터를 찾을 수 없습니다.',
      error: 'RECORD_NOT_FOUND'
    });
  }

  // JWT 토큰 에러 처리
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: '유효하지 않은 토큰입니다.',
      error: 'INVALID_TOKEN'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: '토큰이 만료되었습니다.',
      error: 'TOKEN_EXPIRED'
    });
  }

  // 파일 업로드 에러 처리
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: '파일 크기가 너무 큽니다.',
      error: 'FILE_TOO_LARGE'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: '예상치 못한 파일 필드입니다.',
      error: 'UNEXPECTED_FILE_FIELD'
    });
  }

  // 기본 에러 응답
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return res.status(err.status || 500).json({
    success: false,
    message: err.message || '서버 내부 오류가 발생했습니다.',
    ...(isDevelopment && { stack: err.stack }),
    ...(isDevelopment && { error: err.name })
  });
};

/**
 * 404 에러 핸들러
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
export const notFoundHandler = (req, res, next) => {
  const error = new Error(`경로를 찾을 수 없습니다: ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

/**
 * 비동기 에러 래퍼
 * @param {function} fn - 비동기 함수
 * @returns {function} Express 미들웨어 함수
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
