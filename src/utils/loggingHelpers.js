/**
 * 로깅 헬퍼 함수들
 */

import logger from './logger.js';

/**
 * 성공 로그 공통 함수
 */
export const logSuccess = (message, data = null) => {
  if (data) {
    console.log(`✅ ${message}`, data);
  } else {
    console.log(`✅ ${message}`);
  }
};

/**
 * 에러 로그 공통 함수
 */
export const logError = (message, data = null) => {
  if (data) {
    console.log(`❌ ${message}:`, data);
  } else {
    console.log(`❌ ${message}`);
  }
};

/**
 * 정보 로그 공통 함수
 */
export const logInfo = (message, data = null) => {
  if (data) {
    console.log(`🔍 ${message}:`, data);
  } else {
    console.log(`🔍 ${message}`);
  }
};

/**
 * 진행중 로그 공통 함수
 */
export const logProgress = (message, data = null) => {
  if (data) {
    console.log(`🔄 ${message}:`, data);
  } else {
    console.log(`🔄 ${message}`);
  }
};

/**
 * 완료 로그 공통 함수
 */
export const logComplete = (message, data = null) => {
  if (data) {
    console.log(`🎉 ${message}:`, data);
  } else {
    console.log(`🎉 ${message}`);
  }
};

/**
 * 사용자 활동 로깅 공통 함수들
 */
export const logUserActivity = {
  chatMessageSaved: (sender, data) => {
    logger.logUserActivity('CHAT_MESSAGE_SAVED', sender, data);
  },
  
  aiChatMessageSaved: (data) => {
    logger.logUserActivity('AI_CHAT_MESSAGE_SAVED', 'AI', data);
  },
  
  groupChatMessageSaved: (sender, data) => {
    logger.logUserActivity('GROUP_CHAT_MESSAGE_SAVED', sender, data);
  },
  
  groupChatJobQueued: (userId, data) => {
    logger.logUserActivity('GROUP_CHAT_JOB_QUEUED', userId, data);
  },
  
  chatDisconnect: (userId, data) => {
    logger.logUserActivity('CHAT_DISCONNECT', userId, data);
  },
  
  groupChatDisconnect: (userId, data) => {
    logger.logUserActivity('GROUP_CHAT_DISCONNECT', userId, data);
  },
  
  deleteChatRoom: (userId, data) => {
    logger.logUserActivity('DELETE_CHAT_ROOM', userId, data);
  }
};

/**
 * 에러 로깅 공통 함수들
 */
export const logErrorWithContext = {
  userMessageSaveFailed: (error, context) => {
    logger.logError('사용자 메시지 저장 실패', error, context);
  },
  
  aiMessageSaveFailed: (error, context) => {
    logger.logError('AI 메시지 저장 실패', error, context);
  },
  
  aiResponseGenerationFailed: (error, context) => {
    logger.logError('AI 응답 생성 중 오류 발생', error, context);
  },
  
  groupChatUserMessageSaveFailed: (error, context) => {
    logger.logError('그룹 채팅 사용자 메시지 저장 실패', error, context);
  },
  
  groupChatQueueFailed: (error, context) => {
    logger.logError('그룹 채팅 큐 작업 추가 실패', error, context);
  },
  
  redisSetupFailed: (error, context) => {
    logger.logError('Redis Pub/Sub 설정 실패', error, context);
  },
  
  redisParseFailed: (error, context) => {
    logger.logError('Redis Pub/Sub 메시지 파싱 실패', error, context);
  },
  
  chatFlowError: (error, context, flowType) => {
    logger.logError(`${flowType} 채팅 플로우 에러`, error, context);
  }
}; 