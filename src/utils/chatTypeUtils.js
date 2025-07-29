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
  // ChatRoomParticipant를 통해 1대1 채팅인지 확인
  const participants = await prismaConfig.prisma.chatRoomParticipant.findMany({
    where: {
      chatroomId: parseInt(roomId, 10),
      personaId: { not: null } // AI 참가자가 있는 경우만
    },
    include: {
      persona: true
    }
  });

  // 1대1 채팅: AI 참가자가 1명이고, personaId가 있는 경우
  return participants.length === 1 && participants[0].personaId !== null;
}; 