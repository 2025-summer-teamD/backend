/**
 * Redis 통합 캐시 서비스
 * 
 * 기능:
 * - AI 응답 캐시
 * - 사용자 데이터 캐시
 * - 캐시 키 관리
 * - TTL 관리
 */

import redisClient from '../config/redisClient.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

/**
 * 메시지 해시 생성 (AI 응답 캐시 키용)
 * SHA-256 사용으로 보안성 향상 (캐시 키 생성용이므로 암호학적 보안은 불필요하지만 정적 분석 도구 경고 해결)
 */
const generateMessageHash = (message, context = '') => {
  const content = `${message}:${context}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
};

/**
 * AI 응답 캐시 관리
 */
export class AiResponseCache {
  /**
   * AI 응답 캐시 키 생성
   * @param {number} characterId - 캐릭터 ID
   * @param {string} message - 사용자 메시지
   * @param {string} context - 대화 맥락 (선택사항)
   * @returns {string} 캐시 키
   */
  static generateCacheKey(characterId, message, context = '') {
    const messageHash = generateMessageHash(message, context);
    return `ai-response:${characterId}:${messageHash}`;
  }

  /**
   * AI 응답 캐시에서 조회
   * @param {number} characterId - 캐릭터 ID
   * @param {string} message - 사용자 메시지
   * @param {string} context - 대화 맥락
   * @returns {Promise<object|null>} 캐시된 응답 또는 null
   */
  static async get(characterId, message, context = '') {
    try {
      const cacheKey = this.generateCacheKey(characterId, message, context);
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        logger.logInfo('AI 응답 캐시 HIT', { 
          characterId, 
          cacheKey,
          messagePreview: message.substring(0, 50) + '...'
        });
        return parsedData;
      }
      
      logger.logInfo('AI 응답 캐시 MISS', { 
        characterId, 
        cacheKey,
        messagePreview: message.substring(0, 50) + '...'
      });
      return null;
    } catch (error) {
      logger.logError('AI 응답 캐시 조회 실패', error, { characterId, message });
      return null;
    }
  }

  /**
   * AI 응답을 캐시에 저장
   * @param {number} characterId - 캐릭터 ID
   * @param {string} message - 사용자 메시지
   * @param {string} aiResponse - AI 응답
   * @param {string} context - 대화 맥락
   * @param {number} ttl - TTL (초, 기본: 1시간)
   * @returns {Promise<boolean>} 저장 성공 여부
   */
  static async set(characterId, message, aiResponse, context = '', ttl = 3600) {
    try {
      const cacheKey = this.generateCacheKey(characterId, message, context);
      const cacheData = {
        response: aiResponse,
        characterId,
        message,
        context,
        timestamp: new Date().toISOString(),
        cached: true
      };
      
      await redisClient.setEx(cacheKey, ttl, JSON.stringify(cacheData));
      
      logger.logInfo('AI 응답 캐시 저장', { 
        characterId, 
        cacheKey, 
        ttl,
        responseLength: aiResponse.length
      });
      return true;
    } catch (error) {
      logger.logError('AI 응답 캐시 저장 실패', error, { characterId, message });
      return false;
    }
  }

  /**
   * 특정 캐릭터의 모든 AI 응답 캐시 삭제
   * @param {number} characterId - 캐릭터 ID
   * @returns {Promise<number>} 삭제된 키 개수
   */
  static async clearCharacterCache(characterId) {
    try {
      const pattern = `ai-response:${characterId}:*`;
      const keys = await redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.logInfo('캐릭터 AI 응답 캐시 삭제', { characterId, deletedKeys: keys.length });
      }
      
      return keys.length;
    } catch (error) {
      logger.logError('캐릭터 AI 응답 캐시 삭제 실패', error, { characterId });
      return 0;
    }
  }
}

/**
 * 사용자 데이터 캐시 관리
 */
export class UserDataCache {
  /**
   * 사용자 캐릭터 목록 캐시 조회
   * @param {string} userId - 사용자 ID
   * @param {string} type - 타입 (created, liked 등)
   * @returns {Promise<object|null>} 캐시된 데이터 또는 null
   */
  static async getUserCharacters(userId, type) {
    try {
      const cacheKey = `user:${userId}:characters:${type}`;
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        logger.logInfo('사용자 캐릭터 캐시 HIT', { userId, type, cacheKey });
        return JSON.parse(cachedData);
      }
      
      logger.logInfo('사용자 캐릭터 캐시 MISS', { userId, type, cacheKey });
      return null;
    } catch (error) {
      logger.logError('사용자 캐릭터 캐시 조회 실패', error, { userId, type });
      return null;
    }
  }

  /**
   * 사용자 캐릭터 목록 캐시 저장
   * @param {string} userId - 사용자 ID
   * @param {string} type - 타입
   * @param {object} data - 저장할 데이터
   * @param {number} ttl - TTL (초, 기본: 10분)
   * @returns {Promise<boolean>} 저장 성공 여부
   */
  static async setUserCharacters(userId, type, data, ttl = 600) {
    try {
      const cacheKey = `user:${userId}:characters:${type}`;
      await redisClient.setEx(cacheKey, ttl, JSON.stringify(data));
      
      logger.logInfo('사용자 캐릭터 캐시 저장', { userId, type, cacheKey, ttl });
      return true;
    } catch (error) {
      logger.logError('사용자 캐릭터 캐시 저장 실패', error, { userId, type });
      return false;
    }
  }

  /**
   * 사용자 관련 캐시 무효화
   * @param {string} userId - 사용자 ID
   * @param {string} pattern - 패턴 (선택사항)
   * @returns {Promise<number>} 삭제된 키 개수
   */
  static async invalidateUserCache(userId, pattern = '*') {
    try {
      const cachePattern = `user:${userId}:${pattern}`;
      const keys = await redisClient.keys(cachePattern);
      
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.logInfo('사용자 캐시 무효화', { userId, pattern, deletedKeys: keys.length });
      }
      
      return keys.length;
    } catch (error) {
      logger.logError('사용자 캐시 무효화 실패', error, { userId, pattern });
      return 0;
    }
  }
}

/**
 * 캐시 통계 및 관리
 */
export class CacheManager {
  /**
   * Redis 메모리 사용량 조회
   * @returns {Promise<object>} 메모리 정보
   */
  static async getMemoryInfo() {
    try {
      const info = await redisClient.memory('usage');
      return {
        used: info,
        formatted: `${(info / 1024 / 1024).toFixed(2)} MB`
      };
    } catch (error) {
      logger.logError('Redis 메모리 정보 조회 실패', error);
      return null;
    }
  }

  /**
   * 만료된 캐시 정리
   * @returns {Promise<object>} 정리 결과
   */
  static async cleanup() {
    try {
      const patterns = [
        'ai-response:*',
        'user:*:characters:*'
      ];
      
      let totalDeleted = 0;
      
      for (const pattern of patterns) {
        const keys = await redisClient.keys(pattern);
        for (const key of keys) {
          const ttl = await redisClient.ttl(key);
          if (ttl === -1) { // TTL이 설정되지 않은 키
            await redisClient.expire(key, 3600); // 1시간 TTL 설정
          }
        }
      }
      
      logger.logInfo('캐시 정리 완료', { totalDeleted });
      return { success: true, deleted: totalDeleted };
    } catch (error) {
      logger.logError('캐시 정리 실패', error);
      return { success: false, error: error.message };
    }
  }
}

export default {
  AiResponseCache,
  UserDataCache,
  CacheManager,
}; 