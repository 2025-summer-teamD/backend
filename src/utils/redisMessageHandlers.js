/**
 * Redis 메시지 처리 헬퍼 함수들
 */

import { logSuccess, logError } from './loggingHelpers.js';
import logger from './logger.js';

/**
 * 통합 Redis 메시지 핸들러 생성 함수
 */
export const createRedisMessageHandler = (res, responseChannel, pubSubClient) => {
  return (message) => {
    try {
      const responseData = JSON.parse(message);
      logSuccess('Redis 메시지 수신', { 
        type: responseData.type,
        responseChannel: responseChannel,
        aiName: responseData.aiName,
        contentLength: responseData.content?.length
      });
      
      if (responseData.type === 'ai_response') {
        handleAiResponseMessage(res, responseData);
      } else if (responseData.type === 'exp_updated') {
        handleExpUpdateMessage(res, responseData);
      } else if (responseData.type === 'complete') {
        handleCompleteMessage(res, responseChannel, pubSubClient);
      }
    } catch (error) {
      logError('Redis 메시지 파싱 실패', error);
      logger.logError('Redis Pub/Sub 메시지 파싱 실패', error, { 
        responseChannel: responseChannel 
      });
    }
  };
};

/**
 * AI 응답 메시지 처리
 */
const handleAiResponseMessage = (res, responseData) => {
  logSuccess('클라이언트로 AI 응답 전송', {
    aiName: responseData.aiName,
    aiId: responseData.aiId,
    personaId: responseData.personaId
  });
  
  res.write(`data: ${JSON.stringify({
    type: 'ai_response',
    content: responseData.content,
    aiName: responseData.aiName,
    aiId: responseData.aiId,
    personaId: responseData.personaId,
    aiProfileImageUrl: responseData.aiProfileImageUrl || null, // AI 프로필 이미지 URL을 명확히 구분
    timestamp: responseData.timestamp
  })}\n\n`);
};

/**
 * 친밀도 업데이트 메시지 처리
 */
const handleExpUpdateMessage = (res, responseData) => {
  res.write(`data: ${JSON.stringify({
    type: 'exp_updated',
    personaId: responseData.personaId,
    personaName: responseData.personaName,
    newExp: responseData.newExp,
    newLevel: responseData.newLevel,
    expIncrease: responseData.expIncrease,
    userId: responseData.userId
  })}\n\n`);
};

/**
 * 완료 메시지 처리
 */
const handleCompleteMessage = (res, responseChannel, pubSubClient) => {
  res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
  res.write('data: [DONE]\n\n');
  pubSubClient.unsubscribe(responseChannel);
  pubSubClient.disconnect();
  res.end();
  logSuccess('그룹 채팅 플로우 완료');
}; 