/**
 * 채팅방 타입 관련 유틸리티 함수들
 */

import prismaConfig from '../config/prisma.js';

/**
 * 1대1 채팅방인지 확인하는 함수 (ChatRoomParticipant 기반)
 * @param {number} roomId - 채팅방 ID
 * @returns {Promise<boolean>} 1대1 채팅방 여부
 */
export const isOneOnOneChat = async (roomId) => {
  try {
    console.log('🔍 isOneOnOneChat - 시작:', { roomId });
    
    // ChatRoom을 통해 1대1 채팅인지 확인
    const chatRoom = await prismaConfig.prisma.chatRoom.findUnique({
      where: {
        id: parseInt(roomId, 10),
        isDeleted: false
      },
      include: {
        participants: {
          include: {
            persona: true,
            user: true
          }
        }
      }
    });

    if (!chatRoom) {
      console.log('🔍 isOneOnOneChat - 채팅방을 찾을 수 없음:', { roomId });
      return false;
    }

    // AI 참가자 수 확인
    const aiParticipants = chatRoom.participants.filter(p => p.persona);
    const userParticipants = chatRoom.participants.filter(p => p.user);

    console.log('🔍 isOneOnOneChat - 참여자 분석:', {
      roomId,
      totalParticipants: chatRoom.participants.length,
      aiParticipantsCount: aiParticipants.length,
      userParticipantsCount: userParticipants.length
    });

    // 1대1 채팅: AI 1명, 유저 1명인 경우
    const isOneOnOne = aiParticipants.length === 1 && userParticipants.length === 1;
    console.log('🔍 isOneOnOneChat - 결과:', { roomId, isOneOnOne });
    
    return isOneOnOne;
  } catch (error) {
    console.error('🚨 isOneOnOneChat - 에러 발생:', error);
    console.error('🚨 isOneOnOneChat - 에러 스택:', error.stack);
    return false; // 에러 발생 시 false 반환
  }
}; 