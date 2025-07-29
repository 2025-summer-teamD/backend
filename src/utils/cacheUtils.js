/**
 * 캐시 관리 유틸리티
 * 
 * 기능:
 * - 캐릭터 생성/수정 시 관련 캐시 무효화
 * - 사용자 행동에 따른 캐시 정리
 */

import { UserDataCache, AiResponseCache } from '../services/cacheService.js';
import logger from './logger.js';

/**
 * 캐릭터 생성 시 사용자 캐시 무효화
 * @param {string} userId - 사용자 ID
 */
export const invalidateUserCharacterCache = async (userId) => {
  try {
    const deletedCount = await UserDataCache.invalidateUserCache(userId, 'characters:*');
    logger.logInfo('사용자 캐릭터 캐시 무효화', { userId, deletedCount });
    return deletedCount;
  } catch (error) {
    logger.logError('사용자 캐릭터 캐시 무효화 실패', error, { userId });
    return 0;
  }
};

/**
 * 캐릭터 수정 시 AI 응답 캐시 무효화
 * @param {number} characterId - 캐릭터 ID
 */
export const invalidateCharacterAiCache = async (characterId) => {
  try {
    const deletedCount = await AiResponseCache.clearCharacterCache(characterId);
    logger.logInfo('캐릭터 AI 응답 캐시 무효화', { characterId, deletedCount });
    return deletedCount;
  } catch (error) {
    logger.logError('캐릭터 AI 응답 캐시 무효화 실패', error, { characterId });
    return 0;
  }
};

/**
 * 캐릭터 생성/수정 시 전체 관련 캐시 무효화
 * @param {string} userId - 사용자 ID  
 * @param {number} characterId - 캐릭터 ID (수정 시)
 */
export const invalidateCharacterRelatedCache = async (userId, characterId = null) => {
  const promises = [
    invalidateUserCharacterCache(userId)
  ];
  
  if (characterId) {
    promises.push(invalidateCharacterAiCache(characterId));
  }
  
  const results = await Promise.all(promises);
  const totalDeleted = results.reduce((sum, count) => sum + count, 0);
  
  logger.logInfo('캐릭터 관련 캐시 전체 무효화 완료', {
    userId,
    characterId,
    totalDeleted
  });
  
  return totalDeleted;
};

export default {
  invalidateUserCharacterCache,
  invalidateCharacterAiCache, 
  invalidateCharacterRelatedCache,
}; 