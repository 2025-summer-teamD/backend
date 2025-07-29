/**
 * Redis 관련 헬퍼 함수들
 */

import redisClient from '../config/redisClient.js';
import logger from './logger.js';

/**
 * Redis Pub/Sub 클라이언트 설정 및 구독 공통 함수
 */
export const setupRedisSubscription = async (responseChannel, messageHandler) => {
  try {
    const pubSubClient = redisClient.duplicate();
    await pubSubClient.connect();
    
    console.log('✅ Redis Pub/Sub 클라이언트 연결 완료');
    
    await pubSubClient.subscribe(responseChannel, messageHandler);
    console.log('✅ Redis 구독 설정 완료:', { responseChannel });
    
    return pubSubClient;
  } catch (error) {
    console.error('❌ Redis Pub/Sub 설정 실패:', error);
    logger.logError('Redis Pub/Sub 설정 실패', error, { responseChannel });
    throw error;
  }
};

/**
 * Redis 구독 해제 및 연결 종료 공통 함수
 */
export const cleanupRedisSubscription = async (pubSubClient, responseChannel) => {
  if (pubSubClient) {
    try {
      if (responseChannel) {
        await pubSubClient.unsubscribe(responseChannel);
      }
      await pubSubClient.disconnect();
    } catch (error) {
      console.error('❌ Redis 정리 중 오류:', error);
    }
  }
};

/**
 * Redis 메시지 파싱 공통 함수
 */
export const parseRedisMessage = (message, responseChannel) => {
  try {
    const responseData = JSON.parse(message);
    console.log('📨 Redis 메시지 수신:', { 
      type: responseData.type,
      responseChannel: responseChannel,
      aiName: responseData.aiName,
      contentLength: responseData.content?.length
    });
    return responseData;
  } catch (error) {
    console.error('❌ Redis 메시지 파싱 실패:', error);
    logger.logError('Redis Pub/Sub 메시지 파싱 실패', error, { 
      responseChannel: responseChannel 
    });
    throw error;
  }
};

/**
 * Redis 타임아웃 설정 공통 함수
 */
export const setupRedisTimeout = (res, pubSubClient, responseChannel, timeoutMs = 30000) => {
  return setTimeout(() => {
    if (!res.writableEnded) {
      console.log('⏰ 그룹 채팅 SSE 타임아웃');
      logger.logWarn('그룹 채팅 SSE 타임아웃', { responseChannel });
      
      res.write(`data: ${JSON.stringify({ type: 'timeout', message: 'AI 응답 대기 시간이 초과되었습니다.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      
      cleanupRedisSubscription(pubSubClient, responseChannel);
      res.end();
    }
  }, timeoutMs);
}; 