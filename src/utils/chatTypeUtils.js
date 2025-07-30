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
  // ChatRoom을 통해 1대1 채팅인지 확인
  const chatRoom = await prismaConfig.prisma.chatRoom.findUnique({
    where: {
      id: parseInt(roomId, 10),
      isDeleted: false
    },
    include: {
      persona: true
    }
  });

  // 1대1 채팅: personaId가 있는 경우 (AI 참가자가 있는 경우)
  return chatRoom && chatRoom.personaId !== null;
}; 