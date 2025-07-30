/**
 * 채팅방 타입 관련 유틸리티 함수들
 */

import prismaConfig from '../config/prisma.js';

/**
 * 1대1 채팅방인지 확인하는 함수
 * @param {number} roomId - 채팅방 ID
 * @returns {Promise<boolean>} 1대1 채팅방 여부
 */
export const isOneOnOneChat = async (roomId) => {
  // 현재 스키마에서는 ChatRoom이 직접 personaId를 가지므로 항상 1대1 채팅
  // ChatRoom 테이블에서 해당 roomId가 존재하는지만 확인
  const chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
    where: {
      id: parseInt(roomId, 10),
      isDeleted: false
    }
  });

  // 현재 스키마는 모든 채팅방이 1대1 채팅 (ChatRoom이 직접 personaId를 가짐)
  return !!chatRoom;
}; 