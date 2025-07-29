/**
 * 채팅 관련 공통 헬퍼 함수들
 */

import prismaConfig from '../config/prisma.js';
import logger from './logger.js';

/**
 * SSE 헤더 설정 공통 함수
 */
export const setupSSEHeaders = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
};

/**
 * 메시지 저장 공통 함수
 */
export const saveChatMessage = async (messageData) => {
  try {
    const savedMessage = await prismaConfig.prisma.chatLog.create({
      data: {
        chatroomId: parseInt(messageData.roomId, 10),
        text: messageData.text,
        type: messageData.type || 'text',
        senderType: messageData.senderType,
        senderId: String(messageData.senderId),
        time: messageData.time || new Date()
      }
    });
    
    logger.logUserActivity(`${messageData.senderType.toUpperCase()}_MESSAGE_SAVED`, messageData.senderId, {
      roomId: messageData.roomId,
      messageLength: messageData.text.length
    });
    
    return savedMessage;
  } catch (error) {
    logger.logError('메시지 저장 실패', error, { roomId: messageData.roomId });
    throw error;
  }
};

/**
 * SSE 에러 응답 전송 공통 함수
 */
export const sendSSEError = (res, message) => {
  res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
};

/**
 * SSE 사용자 메시지 전송 공통 함수
 */
export const sendSSEUserMessage = (res, { message, userName, userId }) => {
  res.write(`data: ${JSON.stringify({
    type: 'user_message',
    content: message,
    sender: userName,
    senderId: userId,
    timestamp: new Date().toISOString()
  })}\n\n`);
};

/**
 * SSE AI 응답 전송 공통 함수
 */
export const sendSSEAIResponse = (res, { content, aiName, aiId, personaId }) => {
  res.write(`data: ${JSON.stringify({
    type: 'ai_response',
    content,
    aiName,
    aiId,
    personaId,
    timestamp: new Date().toISOString()
  })}\n\n`);
};

/**
 * SSE 친밀도 업데이트 전송 공통 함수
 */
export const sendSSEExpUpdate = (res, expData) => {
  res.write(`data: ${JSON.stringify({
    type: 'exp_updated',
    ...expData
  })}\n\n`);
};

/**
 * SSE 완료 신호 전송 공통 함수
 */
export const sendSSEComplete = (res) => {
  res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
};

/**
 * 채팅방 참여자 검증 공통 함수
 */
export const validateChatRoomParticipant = async (roomId, userId) => {
  const participant = await prismaConfig.prisma.chatRoomParticipant.findFirst({
    where: {
      chatroomId: parseInt(roomId, 10),
      clerkId: userId,
    },
    include: {
      chatRoom: {
        include: {
          participants: {
            include: {
              persona: true
            }
          }
        }
      }
    }
  });

  if (!participant || !participant.chatRoom) {
    throw new Error(`채팅방 ID ${roomId}를 찾을 수 없습니다.`);
  }

  return participant;
};

/**
 * 클라이언트 연결 종료 핸들러 생성 공통 함수
 */
export const createClientCloseHandler = (res, userId, roomId, cleanup = null) => {
  return () => {
    logger.logUserActivity('CHAT_DISCONNECT', userId, { roomId });
    if (cleanup) cleanup();
    if (!res.writableEnded) {
      res.end();
    }
  };
}; 