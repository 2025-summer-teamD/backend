/**
 * 로깅 유틸리티 (ELK Stack 연동)
 * 
 * 사용 위치:
 * - 모든 서비스와 컨트롤러에서 로깅 시
 * 
 * 기능:
 * - 구조화된 로깅
 * - 로그 레벨 관리
 * - 에러 로깅
 * - API 요청/응답 로깅
 * - 성능 모니터링
 * - ELK Stack으로 로그 전송
 */

import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

/**
 * 로그 레벨
 */
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

/**
 * 현재 로그 레벨 (환경변수에서 가져오거나 기본값 사용)
 */
const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

// Winston 로거 설정
const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'express-app' },
  transports: [
    // 콘솔 출력
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // 파일 출력
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
    
    // Elasticsearch로 전송 (환경변수가 설정된 경우에만)
    ...(process.env.ELASTICSEARCH_URL ? [
      new ElasticsearchTransport({
        level: 'info',
        clientOpts: {
          node: process.env.ELASTICSEARCH_URL,
          index: 'logs',
          type: 'log'
        },
        indexPrefix: 'logs'
      })
    ] : [])
  ]
});

/**
 * 로그 메시지 생성
 * @param {string} level - 로그 레벨
 * @param {string} message - 로그 메시지
 * @param {object} data - 추가 데이터
 * @returns {object} 구조화된 로그 객체
 */
const createLogMessage = (level, message, data = {}) => {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  };
};

/**
 * 로그 출력
 * @param {string} level - 로그 레벨
 * @param {string} message - 로그 메시지
 * @param {object} data - 추가 데이터
 */
const log = (level, message, data = {}) => {
  const logLevel = LOG_LEVELS[level];
  if (logLevel <= CURRENT_LOG_LEVEL) {
    const logMessage = createLogMessage(level, message, data);
    console.log(JSON.stringify(logMessage));
    
    // Winston 로거에도 전송 (level 필드를 명시적으로 추가)
    const winstonLevel = level.toLowerCase();
    if (winstonLogger.levels[winstonLevel] !== undefined) {
      winstonLogger.log(winstonLevel, message, { ...data, level: winstonLevel });
    }
  }
};

/**
 * 에러 로그
 * @param {string} message - 에러 메시지
 * @param {Error} error - 에러 객체
 * @param {object} context - 추가 컨텍스트
 */
const logError = (message, error = null, context = {}) => {
  log('ERROR', message, {
    error: error?.message,
    stack: error?.stack,
    ...context
  });
};

/**
 * 경고 로그
 * @param {string} message - 경고 메시지
 * @param {object} data - 추가 데이터
 */
const logWarn = (message, data = {}) => {
  log('WARN', message, data);
};

/**
 * 정보 로그
 * @param {string} message - 정보 메시지
 * @param {object} data - 추가 데이터
 */
const logInfo = (message, data = {}) => {
  log('INFO', message, data);
};

/**
 * 디버그 로그
 * @param {string} message - 디버그 메시지
 * @param {object} data - 추가 데이터
 */
const logDebug = (message, data = {}) => {
  log('DEBUG', message, data);
};

/**
 * API 요청 로그
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const logRequest = (req, res, next) => {
  const startTime = Date.now();
  
  // 응답 완료 후 로깅
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logInfo('API Request', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.auth?.userId
    });
  });
  
  next();
};

/**
 * 데이터베이스 쿼리 로그
 * @param {string} operation - 데이터베이스 작업 (SELECT, INSERT, UPDATE, DELETE)
 * @param {string} table - 테이블명
 * @param {object} data - 쿼리 데이터
 * @param {number} duration - 실행 시간 (ms)
 */
const logDatabaseQuery = (operation, table, data = {}, duration = 0) => {
  logDebug('Database Query', {
    operation,
    table,
    data,
    duration: `${duration}ms`
  });
};

/**
 * 성능 로그
 * @param {string} operation - 작업명
 * @param {number} duration - 실행 시간 (ms)
 * @param {object} context - 추가 컨텍스트
 */
const logPerformance = (operation, duration, context = {}) => {
  const level = duration > 1000 ? 'WARN' : 'DEBUG';
  log(level, 'Performance', {
    operation,
    duration: `${duration}ms`,
    ...context
  });
};

/**
 * 사용자 활동 로그
 * @param {string} action - 사용자 액션
 * @param {string} userId - 사용자 ID
 * @param {object} data - 추가 데이터
 */
const logUserActivity = (action, userId, data = {}) => {
  logInfo('User Activity', {
    action,
    userId,
    ...data
  });
};

export default {
  logError,
  logWarn,
  logInfo,
  logDebug,
  logRequest,
  logDatabaseQuery,
  logPerformance,
  logUserActivity
}; 