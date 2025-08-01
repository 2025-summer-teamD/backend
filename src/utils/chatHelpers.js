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
        id: messageData.id || undefined, // id가 없으면 자동 생성
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
export const sendSSEAIResponse = (res, { id, content, aiName, aiId, personaId }) => {
  res.write(`data: ${JSON.stringify({
    type: 'ai_response',
    id,
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
 * SSE 타임아웃 응답 공통 함수
 */
export const sendSSETimeout = (res, message = 'AI 응답 대기 시간이 초과되었습니다.') => {
  res.write(`data: ${JSON.stringify({ type: 'timeout', message })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
};

/**
 * SSE 메시지 저장 확인 전송 공통 함수
 */
export const sendSSEMessageSaved = (res, chatLogId) => {
  res.write(`data: ${JSON.stringify({
    type: 'message_saved',
    chatLogId
  })}\n\n`);
};

/**
 * SSE 텍스트 청크 전송 공통 함수
 */
export const sendSSETextChunk = (res, content) => {
  res.write(`data: ${JSON.stringify({ type: 'text_chunk', content })}\n\n`);
};

/**
 * SSE 완료 신호만 전송 (연결 종료 안함)
 */
export const sendSSECompleteSignal = (res) => {
  res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
  res.write('data: [DONE]\n\n');
};

/**
 * SSE 에러 전송 후 연결 종료 공통 함수
 */
export const sendSSEErrorAndClose = (res, message) => {
  res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
};

/**
 * 채팅방에 해당 유저/AI가 참가자인지 확인

 */
export const validateChatRoomParticipant = async (roomId, userIdOrPersonaId) => {
  const participant = await prismaConfig.prisma.chatRoomParticipant.findFirst({
    where: {
      chatRoomId: parseInt(roomId, 10),
      OR: [
        { userId: userIdOrPersonaId },
        { personaId: typeof userIdOrPersonaId === 'number' ? userIdOrPersonaId : undefined }
      ]
    }
  });
  if (!participant) {
    throw new Error(`채팅방 ID ${roomId}에 참가자가 아닙니다.`);
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

/**
 * 채팅 입력 검증 공통 함수
 */
export const validateChatInput = ({ message, sender, userName }) => {
  if (!message || !sender || !userName) {
    return { isValid: false, error: 'message, sender, userName 필드가 모두 필요합니다.' };
  }
  return { isValid: true };
};

/**
 * 채팅방 정보 조회 공통 함수 (새로운 스키마 적용)
 */
export const getChatRoomWithParticipants = async (roomId, options = {}) => {
  const { includeChatLogs = false, chatLogLimit = 20 } = options;

  const includeConfig = {
    participants: {
      include: {
        persona: true,
        user: true
      }
    }
  };

  if (includeChatLogs) {
    includeConfig.ChatLogs = {
      where: { isDeleted: false },
      orderBy: { time: 'desc' },
      take: chatLogLimit,
      select: { text: true, senderType: true, senderId: true, time: true }
    };
  }

  return await prismaConfig.prisma.chatRoom.findUnique({
    where: { id: parseInt(roomId, 10) },
    include: includeConfig
  });
};

/**
 * AI 참여자 찾기 공통 함수 (ChatRoomParticipant 기반)
 */
export const findAiParticipants = (chatRoom, excludeUserId = null) => {
  console.log('🔍 findAiParticipants 호출:', {
    hasChatRoom: !!chatRoom,
    hasParticipants: !!chatRoom?.participants,
    participantsCount: chatRoom?.participants?.length || 0,
    excludeUserId
  });

  if (!chatRoom || !chatRoom.participants) {
    console.log('❌ 채팅방 또는 참여자 정보 없음');
    return [];
  }

  // AI 참가자들 찾기
  const aiParticipants = chatRoom.participants.filter(p => p.persona);
  console.log('🔍 AI 참여자 필터링 결과:', {
    totalParticipants: chatRoom.participants.length,
    aiParticipantsCount: aiParticipants.length,
    aiParticipants: aiParticipants.map(p => ({
      participantId: p.id,
      personaId: p.personaId,
      personaName: p.persona?.name,
      personaClerkId: p.persona?.clerkId
    }))
  });

  // excludeUserId가 있는 경우 해당 유저가 소유한 AI는 제외
  if (excludeUserId) {
    const filteredParticipants = aiParticipants.filter(p => p.persona.clerkId !== excludeUserId);
    console.log('🔍 excludeUserId 필터링 결과:', {
      excludeUserId,
      beforeFilterCount: aiParticipants.length,
      afterFilterCount: filteredParticipants.length
    });
    // 모든 필드를 포함한 AI 참여자 정보 반환
    return filteredParticipants.map(p => ({
      ...p.persona,
      personality: p.persona.personality || p.persona.introduction || '친근하고 도움이 되는 성격',
      tone: p.persona.tone || '친근하고 자연스러운 말투',
      introduction: p.persona.introduction || '친근한 AI',
      prompt: p.persona.prompt || '자연스러운 대화',
      imageUrl: p.persona.imageUrl || null
    }));
  }

  // 모든 필드를 포함한 AI 참여자 정보 반환
  return aiParticipants.map(p => ({
    ...p.persona,
    personality: p.persona.personality || p.persona.introduction || '친근하고 도움이 되는 성격',
    tone: p.persona.tone || '친근하고 자연스러운 말투',
    introduction: p.persona.introduction || '친근한 AI',
    prompt: p.persona.prompt || '자연스러운 대화',
    imageUrl: p.persona.imageUrl || null
  }));

};

/**
 * 채팅 히스토리 생성 공통 함수
 */
export const generateChatHistory = (chatLogs, personaName = null) => {
  if (!chatLogs || chatLogs.length === 0) {
    return '아직 대화 기록이 없습니다.';
  }

  return chatLogs
    .reverse()
    .map(log => {
      const senderName = log.senderType === 'user' ? '사용자' : (personaName || `AI(${log.senderId})`);
      return `${senderName}: ${log.text}`;
    })
    .join('\n');
};

/**
 * 첫 번째 메시지 확인 공통 함수
 */
export const isFirstMessage = (chatLogs) => {
  const userMessageCount = chatLogs.filter(log => log.senderType === 'user').length;
  const aiMessageCount = chatLogs.filter(log => log.senderType === 'ai').length;
  return userMessageCount <= 1 && aiMessageCount === 0;
};

/**
 * 친밀도 업데이트 및 WebSocket 이벤트 전송 공통 함수
 */
export const handleFriendshipUpdate = async (req, res, { userId, personaId, personaName, userMessage, roomId, calculateExpFn }) => {
  try {
    const { default: chatService } = await import('../services/chatService.js');

    const expIncrease = calculateExpFn(userMessage);
    const friendshipResult = await chatService.increaseFriendship(userId, personaId, expIncrease);

    if (friendshipResult) {
      // SSE로 친밀도 업데이트 전송
      if (res) {
        sendSSEExpUpdate(res, {
          personaId,
          personaName,
          newExp: friendshipResult.exp,
          newLevel: friendshipResult.friendship,
          expIncrease,
          userId
        });
      }

      // WebSocket 이벤트 전송
      const io = req.app.getIo ? req.app.getIo() : null;
      if (io) {
        io.to(`room-${roomId}`).emit('expUpdated', {
          roomId,
          personaId,
          personaName,
          newExp: friendshipResult.exp,
          newLevel: friendshipResult.friendship,
          expIncrease,
          userId
        });
      }
    }

    return friendshipResult;
  } catch (error) {
    logger.logError('친밀도 업데이트 실패', error, { userId, personaId, roomId });
    throw error;
  }
};

/**
 * roomId 파싱 및 검증 공통 함수
 */
export const parseAndValidateRoomId = (roomId) => {
  if (!roomId) {
    return { isValid: false, error: 'roomId가 필요합니다.' };
  }

  const parsedRoomId = parseInt(roomId, 10);
  if (isNaN(parsedRoomId)) {
    return { isValid: false, error: 'roomId는 숫자여야 합니다.' };
  }

  return { isValid: true, roomId: parsedRoomId };
};

/**
 * 참가자 배열 검증 및 처리 공통 함수 (새로운 스키마에 맞게 수정)
 */
export const validateAndProcessParticipants = (participantIds, userId) => {
  if (!Array.isArray(participantIds) || participantIds.length < 1) {
    return { isValid: false, error: '참가자 배열이 1명 이상 필요합니다.' };
  }

  // participantIds는 personaId 배열이므로 userId는 포함하지 않음
  const allParticipantIds = participantIds;
  return { isValid: true, allParticipantIds };
};

/**
 * WebSocket을 통한 친밀도 업데이트 이벤트 전송 공통 함수
 */
export const sendFriendshipUpdateEvent = (req, { roomId, personaId, personaName, newExp, newLevel, expIncrease, userId }) => {
  const io = req.app.getIo ? req.app.getIo() : null;
  if (io) {
    console.log(`🔔 친밀도 업데이트 expUpdated 이벤트 전송:`, {
      roomId,
      personaId,
      personaName,
      newExp,
      newLevel,
      expIncrease,
      userId
    });
    io.to(`room-${roomId}`).emit('expUpdated', {
      roomId,
      personaId,
      personaName,
      newExp,
      newLevel,
      expIncrease,
      userId
    });
  }
};

