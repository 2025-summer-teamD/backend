/**
 * Redis 전체 플로우 통합 헬퍼 함수들
 */

import redisClient from '../config/redisClient.js';
import { createRedisMessageHandler } from './redisMessageHandlers.js';
import { logSuccess, logError, logErrorWithContext, logProgress } from './loggingHelpers.js';
import { sendSSEErrorAndClose } from './chatHelpers.js';
import logger from './logger.js';

/**
 * Redis Pub/Sub 완전 설정 (연결 + 구독 + 타임아웃)
 */
export const setupCompleteRedisSubscription = async ({
  responseChannel,
  res,
  roomId,
  userId,
  timeoutMs = 30000
}) => {
  let pubSubClient = null;
  
  try {
    // 1. Redis 클라이언트 연결
    pubSubClient = redisClient.duplicate();
    await pubSubClient.connect();
    logSuccess('Redis Pub/Sub 클라이언트 연결 완료');
    
    // 2. 메시지 핸들러 생성 및 구독 설정
    const messageHandler = createRedisMessageHandler(res, responseChannel, pubSubClient);
    await pubSubClient.subscribe(responseChannel, messageHandler);
    logSuccess('Redis 구독 설정 완료', { responseChannel });
    
    // 3. 타임아웃 설정
    const timeout = setTimeout(() => {
      if (!res.writableEnded) {
        logProgress('그룹 채팅 SSE 타임아웃');
        logger.logWarn('그룹 채팅 SSE 타임아웃', { roomId, userId });
        res.write(`data: ${JSON.stringify({ type: 'timeout', message: 'AI 응답 대기 시간이 초과되었습니다.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        if (pubSubClient) {
          pubSubClient.unsubscribe(responseChannel);
          pubSubClient.disconnect();
        }
        res.end();
      }
    }, timeoutMs);
    
    return { 
      success: true, 
      pubSubClient, 
      timeout,
      cleanup: () => cleanupRedisSubscription(pubSubClient, responseChannel, timeout)
    };
    
  } catch (redisError) {
    logError('Redis Pub/Sub 설정 실패', redisError);
    logErrorWithContext.redisSetupFailed(redisError, { roomId });
    sendSSEErrorAndClose(res, 'Redis 연결에 실패했습니다.');
    return { success: false, error: redisError };
  }
};

/**
 * Redis 구독 정리 (구독 해제 + 연결 종료 + 타임아웃 정리)
 */
const cleanupRedisSubscription = async (pubSubClient, responseChannel, timeout) => {
  try {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    if (pubSubClient) {
      if (responseChannel) {
        await pubSubClient.unsubscribe(responseChannel);
      }
      await pubSubClient.disconnect();
    }
    
    logSuccess('Redis 구독 정리 완료');
  } catch (error) {
    logError('Redis 정리 중 오류', error);
  }
}; 