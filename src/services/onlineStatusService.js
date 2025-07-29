/**
 * 온라인 상태 관리 서비스
 * 
 * 기능:
 * - 사용자 온라인/오프라인 상태 추적
 * - 채팅방 참여 상태 관리
 * - Redis를 통한 실시간 상태 동기화
 */

import redisClient from '../config/redisClient.js';
import logger from '../utils/logger.js';

/**
 * 사용자를 온라인 상태로 설정
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} socketId - WebSocket 소켓 ID
 */
export const setUserOnline = async (userId, socketId) => {
  try {
    const onlineKey = `user:${userId}:online`;
    const socketKey = `socket:${socketId}:user`;
    const userSocketsKey = `user:${userId}:sockets`;

    await Promise.all([
      // 사용자 온라인 상태 설정 (5분 TTL)
      redisClient.setEx(onlineKey, 300, socketId),
      
      // 소켓 → 사용자 매핑
      redisClient.setEx(socketKey, 300, userId),
      
      // 사용자의 소켓 목록에 추가
      redisClient.sAdd(userSocketsKey, socketId),
      redisClient.expire(userSocketsKey, 300),
    ]);

    logger.logInfo('사용자 온라인 상태 설정', { userId, socketId });
  } catch (error) {
    logger.logError('사용자 온라인 상태 설정 실패', error, { userId, socketId });
  }
};

/**
 * 사용자를 오프라인 상태로 설정
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} socketId - WebSocket 소켓 ID
 */
export const setUserOffline = async (userId, socketId) => {
  try {
    const onlineKey = `user:${userId}:online`;
    const socketKey = `socket:${socketId}:user`;
    const userSocketsKey = `user:${userId}:sockets`;

    await Promise.all([
      // 소켓 관련 키 삭제
      redisClient.del(socketKey),
      redisClient.sRem(userSocketsKey, socketId),
    ]);

    // 사용자의 다른 소켓이 있는지 확인
    const remainingSockets = await redisClient.scard(userSocketsKey);
    
    if (remainingSockets === 0) {
      // 모든 소켓이 종료되면 온라인 상태 삭제
      await redisClient.del(onlineKey);
      await redisClient.del(userSocketsKey);
      
      logger.logInfo('사용자 오프라인 상태 설정 (완전히 오프라인)', { userId, socketId });
    } else {
      logger.logInfo('사용자 소켓 하나 종료 (다른 소켓 존재)', { 
        userId, 
        socketId, 
        remainingSockets 
      });
    }
  } catch (error) {
    logger.logError('사용자 오프라인 상태 설정 실패', error, { userId, socketId });
  }
};

/**
 * 사용자를 채팅방에 입장시킴
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} roomId - 채팅방 ID
 */
export const joinRoom = async (userId, roomId) => {
  try {
    const roomKey = `room:${roomId}:users`;
    const userRoomsKey = `user:${userId}:rooms`;

    await Promise.all([
      // 채팅방 참여자 목록에 추가
      redisClient.sAdd(roomKey, userId),
      
      // 사용자의 참여 방 목록에 추가
      redisClient.sAdd(userRoomsKey, roomId),
      redisClient.expire(userRoomsKey, 300),
    ]);

    logger.logInfo('사용자 채팅방 입장', { userId, roomId });
  } catch (error) {
    logger.logError('사용자 채팅방 입장 실패', error, { userId, roomId });
  }
};

/**
 * 사용자를 채팅방에서 퇴장시킴
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} roomId - 채팅방 ID
 */
export const leaveRoom = async (userId, roomId) => {
  try {
    const roomKey = `room:${roomId}:users`;
    const userRoomsKey = `user:${userId}:rooms`;

    await Promise.all([
      // 채팅방 참여자 목록에서 제거
      redisClient.sRem(roomKey, userId),
      
      // 사용자의 참여 방 목록에서 제거
      redisClient.sRem(userRoomsKey, roomId),
    ]);

    logger.logInfo('사용자 채팅방 퇴장', { userId, roomId });
  } catch (error) {
    logger.logError('사용자 채팅방 퇴장 실패', error, { userId, roomId });
  }
};

/**
 * 사용자가 온라인인지 확인
 * 
 * @param {string} userId - 사용자 ID
 * @returns {Promise<boolean>} 온라인 여부
 */
export const isUserOnline = async (userId) => {
  try {
    const onlineKey = `user:${userId}:online`;
    const exists = await redisClient.exists(onlineKey);
    return exists === 1;
  } catch (error) {
    logger.logError('사용자 온라인 상태 확인 실패', error, { userId });
    return false;
  }
};

/**
 * 사용자가 특정 채팅방에 있는지 확인
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} roomId - 채팅방 ID
 * @returns {Promise<boolean>} 참여 여부
 */
export const isUserInRoom = async (userId, roomId) => {
  try {
    const roomKey = `room:${roomId}:users`;
    const isMember = await redisClient.sIsMember(roomKey, userId);
    return isMember === 1;
  } catch (error) {
    logger.logError('사용자 채팅방 참여 상태 확인 실패', error, { userId, roomId });
    return false;
  }
};

/**
 * 채팅방의 온라인 사용자 목록 조회
 * 
 * @param {string} roomId - 채팅방 ID
 * @returns {Promise<string[]>} 온라인 사용자 ID 배열
 */
export const getOnlineUsersInRoom = async (roomId) => {
  try {
    const roomKey = `room:${roomId}:users`;
    const allUsers = await redisClient.sMembers(roomKey);
    
    if (allUsers.length === 0) {
      return [];
    }

    // 각 사용자의 온라인 상태 확인
    const onlineChecks = allUsers.map(userId => 
      redisClient.exists(`user:${userId}:online`)
    );
    
    const results = await Promise.all(onlineChecks);
    
    return allUsers.filter((userId, index) => results[index] === 1);
  } catch (error) {
    logger.logError('채팅방 온라인 사용자 조회 실패', error, { roomId });
    return [];
  }
};

/**
 * 오프라인 사용자들에게 푸시 알림 전송
 * 
 * @param {string} roomId - 채팅방 ID
 * @param {string} senderName - 발신자 이름
 * @param {string} message - 메시지 내용
 * @param {string} roomName - 채팅방 이름 (선택사항)
 */

/**
 * 사용자의 미처리 메시지 조회 (Redis 캐시에서)
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} roomId - 채팅방 ID
 * @returns {Promise<Array>} 미처리 메시지 배열
 */
export const getPendingMessagesForUser = async (userId, roomId) => {
  try {
    const pattern = `ai-response:${roomId}:${userId}:*`;
    const keys = await redisClient.keys(pattern);
    
    if (keys.length === 0) {
      return [];
    }

    const messages = await redisClient.mget(keys);
    const parsedMessages = messages
      .filter(msg => msg !== null)
      .map(msg => JSON.parse(msg))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // 처리된 메시지는 삭제
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }

    logger.logInfo('사용자 미처리 메시지 조회', {
      userId,
      roomId,
      messagesCount: parsedMessages.length,
    });

    return parsedMessages;
  } catch (error) {
    logger.logError('미처리 메시지 조회 실패', error, { userId, roomId });
    return [];
  }
};

export default {
  setUserOnline,
  setUserOffline,
  joinRoom,
  leaveRoom,
  isUserOnline,
  isUserInRoom,
  getOnlineUsersInRoom,
  getPendingMessagesForUser,
}; 