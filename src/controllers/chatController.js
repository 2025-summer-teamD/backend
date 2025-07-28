/**
 * 채팅 컨트롤러
 *
 * 사용 위치:
 * - chatRoutes.js에서 라우터 연결
 *
 * 기능:
 * - 채팅방 관리
 * - AI 채팅 응답 생성
 * - SSE 스트리밍 처리
 * - 채팅 기록 저장
 */

import chatService from '../services/chatService.js';
import prismaConfig from '../config/prisma.js';
import responseHandler from '../utils/responseHandler.js';
import logger from '../utils/logger.js';
import errorHandler from '../middlewares/errorHandler.js';

/**
 * 채팅 EXP 계산 함수
 * 기본 1점 + 70자 이상이면 +1점 + 이모티콘 하나당 0.1점
 */
const calculateExp = (message) => {
  // 메시지 전송 시 해당 AI와의 친밀도 1씩 증가
  return 1;
};

// 레벨 계산 함수 (프론트엔드와 동일한 로직 - 10레벨 시스템)
const getLevel = (exp) => {
  // 10레벨 시스템: 각 레벨업에 필요한 경험치가 1씩 증가
  // 1레벨: 0exp, 2레벨: 1exp, 3레벨: 3exp, 4레벨: 6exp, 5레벨: 10exp
  // 6레벨: 15exp, 7레벨: 21exp, 8레벨: 28exp, 9레벨: 36exp, 10레벨: 45exp
  if (exp >= 45) return 10;
  if (exp >= 36) return 9;
  if (exp >= 28) return 8;
  if (exp >= 21) return 7;
  if (exp >= 15) return 6;
  if (exp >= 10) return 5;
  if (exp >= 6) return 4;
  if (exp >= 3) return 3;
  if (exp >= 1) return 2;
  return 1; // exp가 0일 때 레벨 1
};

/**
 * 1대1 채팅방인지 확인하는 함수
 * @param {number} roomId - 채팅방 ID
 * @returns {Promise<boolean>} 1대1 채팅방 여부
 */
const isOneOnOneChat = async (roomId) => {
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

/**
 * 1대1 채팅 전용 SSE 스트리밍 응답 생성
 * 
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const streamChatByRoom2 = async (req, res, next) => {
  let roomId = null;
  let personaInfo = null;
  let userMessage = null;

  // 클라이언트 연결 종료 이벤트 처리 함수
  const handleClientClose = () => {
    logger.logUserActivity('CHAT_DISCONNECT', req.auth?.userId, { roomId: roomId });
    if (!res.writableEnded) {
      res.end();
    }
  };

  req.on('close', handleClientClose);

  try {
    // 1. 요청 데이터 파싱
    const { message: userMessage, sender, userName } = req.body;
    const roomId = req.params.roomId;
    const userId = req.auth.userId;

    // 입력 검증
    if (!userMessage || !sender || !userName) {
      return responseHandler.sendBadRequest(res, 'message, sender, userName 필드가 모두 필요합니다.');
    }

    // 1대1 채팅방인지 확인
    const isOneOnOne = await isOneOnOneChat(roomId);
    if (!isOneOnOne) {
      return responseHandler.sendBadRequest(res, '이 채팅방은 1대다 채팅방입니다. 1대1 채팅방에서만 SSE를 사용할 수 있습니다.');
    }

    // 실제 채팅방 정보를 데이터베이스에서 조회
    
    // 1. 사용자가 참여한 채팅방인지 확인
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
            },
            ChatLogs: {
              where: { isDeleted: false },
              orderBy: { time: 'desc' },
              take: 10,
              select: { text: true, senderType: true, senderId: true, time: true }
            }
          }
        }
      }
    });

    if (!participant || !participant.chatRoom) {
      return responseHandler.sendNotFound(res, `채팅방 ID ${roomId}를 찾을 수 없습니다.`);
    }

    // AI 참여자 찾기
    const aiParticipant = participant.chatRoom.participants.find(p => p.personaId && p.persona);
    if (!aiParticipant || !aiParticipant.persona) {
      return responseHandler.sendNotFound(res, '1대1 채팅방에서 AI를 찾을 수 없습니다.');
    }

    const chatRoom = participant.chatRoom;
    personaInfo = {
      id: aiParticipant.persona.id,
      name: aiParticipant.persona.name,
      personality: aiParticipant.persona.introduction || '친근하고 도움이 되는 성격',
      tone: '친근하고 자연스러운 말투',
      prompt: aiParticipant.persona.prompt
    };

    // 실제 대화 기록을 문자열로 변환
    let chatHistory = '';
    if (chatRoom.ChatLogs.length > 0) {
      chatHistory = chatRoom.ChatLogs
        .reverse()
        .map(log => `${log.senderType === 'user' ? '사용자' : personaInfo.name}: ${log.text}`)
        .join('\n');
    } else {
      chatHistory = '아직 대화 기록이 없습니다.';
    }

    // 첫 번째 메시지인지 확인 (사용자 메시지가 1개 이하인 경우)
    const userMessageCount = chatRoom.ChatLogs.filter(log => log.senderType === 'user').length;
    const aiMessageCount = chatRoom.ChatLogs.filter(log => log.senderType === 'ai').length;
    const isFirstMessage = userMessageCount <= 1 && aiMessageCount === 0;

    // 1. 먼저 사용자 메시지를 즉시 DB에 저장
    try {
      await prismaConfig.prisma.chatLog.create({
        data: {
          chatroomId: parseInt(roomId, 10),
          text: userMessage,
          type: 'text',
          senderType: 'user',
          senderId: String(userId),
          time: new Date()
        }
      });
      logger.logUserActivity('CHAT_MESSAGE_SAVED', sender, {
        roomId: roomId,
        personaName: personaInfo.name,
        messageLength: userMessage.length
      });
    } catch (dbError) {
      logger.logError('사용자 메시지 저장 실패', dbError, { roomId: roomId });
      return responseHandler.sendServerError(res, '메시지 저장에 실패했습니다.');
    }

    // 2. SSE 헤더 설정
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // 3. AI 응답 스트리밍 생성 및 전송
    let fullResponseText = "";
    try {
      // 1대1 채팅에서는 최적화된 함수 사용
      const aiResponseText = await chatService.generateAiChatResponseOneOnOne(
        userMessage,
        personaInfo,
        chatHistory,
        isFirstMessage,
        userName // 사용자 이름 전달
      );

      // 응답을 한 번에 전송 (스트리밍 대신)
      fullResponseText = aiResponseText;
      res.write(`data: ${JSON.stringify({ type: 'text_chunk', content: aiResponseText })}\n\n`);
      
    } catch (aiError) {
      logger.logError('AI 응답 생성 중 오류 발생', aiError, { roomId: roomId });
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI 응답 생성 중 오류가 발생했습니다.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // 4. 스트림 완료 후, AI 응답 전체를 DB에 저장
    try {
      await prismaConfig.prisma.chatLog.create({
        data: {
          chatroomId: parseInt(roomId, 10),
          text: fullResponseText,
          type: 'text',
          senderType: 'ai',
          senderId: String(personaInfo.id),
          time: new Date()
        }
      });
      
      // AI 메시지 전송 시 친밀도 증가
      const expIncrease = Math.max(1, Math.floor(fullResponseText.length / 10));
      console.log(`🎯 친밀도 증가 시도: userId=${userId}, personaId=${personaInfo.id}, expIncrease=${expIncrease}`);
      let friendshipResult = null;
      try {
        friendshipResult = await chatService.increaseFriendship(userId, personaInfo.id, expIncrease);
        console.log(`✅ 친밀도 증가 결과:`, friendshipResult);
      } catch (error) {
        console.error(`❌ 친밀도 증가 실패:`, error);
      }
      
      // WebSocket을 통해 친밀도 업데이트 이벤트 전송
      const io = req.app.getIo ? req.app.getIo() : null;
      if (io && friendshipResult) {
        console.log(`🔔 1대1 채팅 expUpdated 이벤트 전송:`, {
          roomId,
          personaId: personaInfo.id,
          personaName: personaInfo.name,
          newExp: friendshipResult.exp,
          newLevel: friendshipResult.friendship,
          expIncrease,
          userId
        });
        io.to(`room-${roomId}`).emit('expUpdated', {
          roomId,
          personaId: personaInfo.id,
          personaName: personaInfo.name,
          newExp: friendshipResult.exp,
          newLevel: friendshipResult.friendship,
          expIncrease,
          userId
        });
      }
      
      logger.logUserActivity('AI_CHAT_MESSAGE_SAVED', 'AI', {
        roomId: roomId,
        personaName: personaInfo.name,
        messageLength: fullResponseText.length
      });
    } catch (dbError) {
      logger.logError('AI 메시지 저장 실패', dbError, { roomId: roomId });
      // 저장 실패해도 클라이언트에는 이미 응답을 보냈으므로 에러 로그만 남김
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    logger.logError('스트리밍 채팅 에러', error, { roomId: req.params.roomId });
    if (!res.headersSent) {
      next(error);
    } else {
      res.end();
    }
  }
};


/**
 * 내가 참여한 채팅방 목록을 조회합니다.
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const getMyChats = errorHandler.asyncHandler(async (req, res) => {
  const userId = req.auth.userId;
  const pagination = req.pagination;

  const result = await chatService.getMyChatList(userId, pagination);

  return responseHandler.sendSuccess(res, 200, '채팅방 목록을 성공적으로 조회했습니다.', result.chatList, {
    page: pagination.page,
    size: pagination.size,
    totalElements: result.totalElements,
    totalPages: result.totalPages
  });
});


/**
 * 여러 캐릭터/유저로 단체 채팅방 생성 (처음부터)
 * @route POST /chat/rooms/create-multi
 * @body { participantIds: string[] } (userId, personaId 등)
 */
const createMultiChatRoom = errorHandler.asyncHandler(async (req, res) => {
  const { participantIds } = req.body;
  const { userId } = req.auth;
  
  console.log('createMultiChatRoom - participantIds:', participantIds);
  console.log('createMultiChatRoom - userId:', userId);
  
  if (!Array.isArray(participantIds) || participantIds.length < 1) {
    console.log('createMultiChatRoom - validation failed: participantIds is not array or empty');
    return responseHandler.sendBadRequest(res, '참가자 배열이 1명 이상 필요합니다.');
  }
  
  // 현재 사용자도 참가자로 추가
  const allParticipantIds = [userId, ...participantIds];
  console.log('createMultiChatRoom - allParticipantIds:', allParticipantIds);
  
  // 이미 동일한 참가자 조합의 방이 있으면 반환, 없으면 새로 생성
  const result = await chatService.createMultiChatRoom(allParticipantIds);
  console.log('createMultiChatRoom - result:', result);
  return responseHandler.sendSuccess(res, 201, '단체 채팅방이 생성되었습니다.', result);
});

/**
 * 채팅방 생성 (그룹 채팅 지원)
 * @route POST /chat/rooms
 * @body { participantIds: number[] } (personaId 배열) 또는 { personaId: number } (1대1 채팅)
 */
const createChatRoom = errorHandler.asyncHandler(async (req, res) => {
  const { participantIds, personaId } = req.body;
  const { userId } = req.auth;
  
  console.log('createChatRoom - participantIds:', participantIds);
  console.log('createChatRoom - personaId:', personaId);
  console.log('createChatRoom - userId:', userId);
  
  // 1대1 채팅인 경우 (personaId가 있는 경우)
  if (personaId) {
    console.log('createChatRoom - 1대1 채팅 생성');
    const result = await chatService.createOneOnOneChatRoom(userId, personaId);
    console.log('createChatRoom - 1대1 채팅 결과:', result);
    return responseHandler.sendSuccess(res, 201, '1대1 채팅방이 생성되었습니다.', result);
  }
  
  // 단체 채팅인 경우 (participantIds가 있는 경우)
  if (!Array.isArray(participantIds) || participantIds.length < 1) {
    console.log('createChatRoom - validation failed: participantIds is not array or empty');
    return responseHandler.sendBadRequest(res, '참가자 배열이 1명 이상 필요합니다.');
  }
  
  // 현재 사용자도 참가자로 추가
  const allParticipantIds = [userId, ...participantIds];
  console.log('createChatRoom - allParticipantIds:', allParticipantIds);
  
  // 이미 동일한 참가자 조합의 방이 있으면 반환, 없으면 새로 생성
  const result = await chatService.createMultiChatRoom(allParticipantIds);
  console.log('createChatRoom - result:', result);
  
  // 새로 생성된 채팅방인 경우 프론트엔드에서 자동 인사 처리
  if (result.isNewRoom) {
    console.log('🎉 새로운 채팅방 생성됨 - 프론트엔드에서 자동 인사 처리 예정');
  }
  
  return responseHandler.sendSuccess(res, 201, '채팅방이 생성되었습니다.', result);
});


/**
 * 채팅방 삭제
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const deleteChatRoom = errorHandler.asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const userId = req.auth.userId;

  await chatService.deleteChatRoom(roomId, userId);

  logger.logUserActivity('DELETE_CHAT_ROOM', userId, {
    roomId: roomId
  });

  return responseHandler.sendSuccess(res, 200, '채팅방이 성공적으로 삭제되었습니다.');
});

/**
 * room_id로 채팅방 정보 조회 (GET /api/chat/room-info?room_id=...)
 */
const getRoomInfo = errorHandler.asyncHandler(async (req, res) => {
  const { roomId } = req.query;
  const { userId } = req.auth;

  if (!roomId) {
    return responseHandler.sendBadRequest(res, 'roomId 쿼리 파라미터가 필요합니다.');
  }
  const parsedRoomId = parseInt(roomId);
      if (isNaN(parsedRoomId)) {
      return responseHandler.sendBadRequest(res, 'roomId는 숫자여야 합니다.');
    }

  // 내가 참여한 방인지 확인
  const participant = await prismaConfig.prisma.chatRoomParticipant.findFirst({
    where: { chatroomId: parsedRoomId, clerkId: userId },
  });
  if (!participant) {
    return responseHandler.sendNotFound(res, '해당 채팅방에 참여하고 있지 않습니다.');
  }

  // 채팅방 정보 및 대표 persona 정보
  const chatRoom = await prismaConfig.prisma.chatRoom.findUnique({
    where: { id: parsedRoomId },
    include: {
      participants: { include: { persona: true } },
    },
  });
  if (!chatRoom) {
    return responseHandler.sendNotFound(res, '채팅방을 찾을 수 없습니다.');
  }
  const personaParticipant = chatRoom.participants.find(p => p.personaId);
  const persona = personaParticipant?.persona;
  // 멀티방 구조: 모든 AI(페르소나)별 exp(친밀도) 반환
  const aiParticipants = chatRoom.participants.filter(p => p.personaId && p.persona);
  // 참여자 정보 가공 (새로운 친밀도 시스템 사용)
  const participants = await Promise.all(chatRoom.participants.map(async (p) => {
    // Persona에서 직접 exp와 friendship 조회
    const persona = await prismaConfig.prisma.persona.findFirst({
      where: {
        id: p.personaId,
        clerkId: userId,
        isDeleted: false
      },
      select: {
        exp: true,
        friendship: true,
        name: true,
        imageUrl: true,
        introduction: true
      }
    });
    
    const exp = persona ? persona.exp : 0;
    const friendshipLevel = persona ? persona.friendship : 1;
    
    return {
      personaId: p.persona.id,
      clerkId: userId,
      name: p.persona.name,
      imageUrl: p.persona.imageUrl,
      exp,
      friendship: friendshipLevel,
      personality: p.persona.personality,
      tone: p.persona.tone,
      introduction: p.persona.introduction
    };
  }));

  // 채팅 기록 조회
  const chatHistory = await prismaConfig.prisma.chatLog.findMany({
    where: {
      chatroomId: parsedRoomId,
      isDeleted: false
    },
    orderBy: {
      time: 'asc'
    },
    select: {
      id: true,
      text: true,
      senderType: true,
      senderId: true,
      time: true,
      type: true
    }
  });

  // 1대1 채팅 여부 확인
  const isOneOnOne = await isOneOnOneChat(parsedRoomId);

  return responseHandler.sendSuccess(res, 200, '채팅방 정보를 조회했습니다.', {
    roomId: chatRoom.id,
    character: persona ? {
      id: persona.id,
      name: persona.name,
      introduction: persona.introduction,
      imageUrl: persona.imageUrl
    } : null,
    participants,
    chatHistory,
    isOneOnOne // 1대1 채팅 여부 추가
  });
});

/**
 * 채팅방 이름 수정
 * @route PUT /chat/rooms/:roomId/name
 */
const updateChatRoomName = errorHandler.asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { name } = req.body;
  const { userId } = req.auth;

  if (!name || !name.trim()) {
    return responseHandler.sendBadRequest(res, '채팅방 이름은 필수입니다.');
  }

  try {
    // 채팅방에 참여하고 있는지 확인
    const participant = await prismaConfig.prisma.chatRoomParticipant.findFirst({
      where: {
        chatroomId: parseInt(roomId, 10),
        clerkId: userId
      }
    });

    if (!participant) {
      return responseHandler.sendNotFound(res, '해당 채팅방에 참여하고 있지 않습니다.');
    }

    // 채팅방 이름 업데이트
    await prismaConfig.prisma.chatRoom.update({
      where: { id: parseInt(roomId, 10) },
      data: { name: name.trim() }
    });

    return responseHandler.sendSuccess(res, 200, '채팅방 이름이 성공적으로 수정되었습니다.', { name: name.trim() });

  } catch (error) {
    console.error('채팅방 이름 수정 실패:', error);
    return responseHandler.sendBadRequest(res, '채팅방 이름 수정에 실패했습니다.');
  }
});

/**
 * 1대다 채팅용 스트리밍 채팅 응답 생성 (기존 WebSocket 방식)
 * 
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
// 멀티 참여자/AI 구조에 맞게 streamChatByRoom을 POST(메시지 전송)와 GET(SSE 수신)으로 분리
const streamChatByRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.auth;
    if (req.method === 'POST') {
      // 메시지 전송: message, sender, timestamp 필요
      const { message, sender, timestamp } = req.body;
      if (!message || !sender || !timestamp) {
        return responseHandler.sendBadRequest(res, 'message, sender, timestamp 필드가 모두 필요합니다.');
      }
      // 내가 참여한 방인지 확인
      const participant = await prismaConfig.prisma.chatRoomParticipant.findFirst({
        where: { chatroomId: parseInt(roomId, 10), clerkId: userId },
      });
      if (!participant) {
        return responseHandler.sendNotFound(res, '해당 채팅방에 참여하고 있지 않습니다.');
      }
      // 채팅방 정보 및 모든 참여자(AI 포함) 조회
      const chatRoom = await prismaConfig.prisma.chatRoom.findUnique({
        where: { id: parseInt(roomId, 10) },
        include: { 
          participants: { 
            include: { persona: true } // persona 정보도 함께 가져오기
          } 
        },
      });
      
      // 모든 AI(페르소나) 참여자 목록 - personaId가 있는 참여자들만 필터링하고 중복 제거
      const aiParticipants = chatRoom.participants
        .filter(p => p.personaId && p.persona)
        .filter((p, idx, arr) => 
          arr.findIndex(x => x.personaId === p.personaId) === idx
        );
      
      console.log(`📋 채팅방 ${roomId}의 AI 참여자들:`, aiParticipants.map(p => ({
        id: p.persona.id,
        name: p.persona.name,
        personality: p.persona.personality,
        tone: p.persona.tone
      })));
      
      // 최근 10개 메시지 조회
      const recentLogs = await prismaConfig.prisma.chatLog.findMany({
        where: { chatroomId: chatRoom.id, isDeleted: false },
        orderBy: { time: 'desc' },
        take: 10,
        select: { text: true, senderType: true, senderId: true, time: true }
      });
      
      // 대화 기록을 문자열로 변환
      const chatHistory = recentLogs
        .reverse()
        .map(log => `${log.senderType === 'user' ? '사용자' : `AI(${log.senderId})`}: ${log.text}`)
        .join('\n');
      
      // 첫 번째 메시지인지 확인 (사용자 메시지가 1개 이하인 경우)
      const userMessageCount = recentLogs.filter(log => log.senderType === 'user').length;
      const isFirstMessage = userMessageCount <= 1;
      
      // 1. 사용자 메시지 저장
      await prismaConfig.prisma.chatLog.create({
        data: {
          chatroomId: parseInt(roomId, 10),
          text: message,
          type: 'text',
          senderType: 'user',
          senderId: userId,
          time: new Date(timestamp)
        }
      });
      
      // 2. 모든 AI(페르소나)마다 한 번씩 응답 생성/저장
      // 단체 채팅: 모든 AI가 동시에 응답
      console.log('💬 단체 채팅 AI 응답 생성 시작');
      
      // 모든 AI 정보 수집
      const allPersonas = aiParticipants.map(p => p.persona);
      
      // 새로운 최적화된 단체 채팅 함수 사용
      const aiResponses = await chatService.generateAiChatResponseGroup(
        message,
        allPersonas,
        chatHistory,
        isFirstMessage
      );
      
      console.log('✅ 단체 채팅 AI 응답 생성 완료:', aiResponses.length, '개의 응답');
      
      // 각 AI 응답을 DB에 저장하고 친밀도 증가
      for (const response of aiResponses) {
        // AI 응답을 DB에 저장
        await prismaConfig.prisma.chatLog.create({
          data: {
            chatroomId: parseInt(roomId, 10),
            text: response.content,
            type: 'text',
            senderType: 'ai',
            senderId: response.personaId,
            time: new Date(),
            isDeleted: false,
          }
        });
        
        // 새로운 친밀도 시스템으로 증가
        const expIncrease = calculateExp(response.content);
        console.log(`🔍 ${response.personaName} 친밀도 증가 시도: 경험치 +${expIncrease}`);
        await chatService.increaseFriendship(userId, response.personaId, expIncrease);
        
        // 현재 친밀도 정보 조회
        const friendship = await chatService.getFriendship(userId, response.personaId);
        const newExp = friendship.exp;
        const newLevel = friendship.friendship;
         
        console.log(`✅ AI ${response.personaName} 친밀도 ${expIncrease} 증가. 총 경험치: ${newExp}, 레벨: ${newLevel}`);
         
        // 소켓으로 친밀도 업데이트 정보 전송
        const io = req.app.get && req.app.get('io') ? req.app.get('io') : null;
        if (io) {
          console.log(`🔔 expUpdated 이벤트 전송:`, {
            roomId,
            personaId: response.personaId,
            personaName: response.personaName,
            newExp: newExp,
            newLevel: newLevel,
            expIncrease,
            userId
          });
          io.to(`room-${roomId}`).emit('expUpdated', {
            roomId,
            personaId: response.personaId,
            personaName: response.personaName,
            newExp: newExp,
            newLevel: newLevel,
            expIncrease,
            userId
          });
        }
      }
      return responseHandler.sendSuccess(res, 200, 'AI 응답 생성 완료', aiResponses);
    } else if (req.method === 'GET') {
      // SSE: 이미 저장된 AI 응답만 스트리밍(또는 필요시 최근 메시지 스트림)
      // (실제 멀티 구조에서는 소켓 기반 실시간 push가 더 적합)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      // 최근 10개 AI 메시지만 스트리밍 예시
      const aiLogs = await prismaConfig.prisma.chatLog.findMany({
        where: { chatroomId: parseInt(roomId, 10), senderType: 'ai', isDeleted: false },
        orderBy: { time: 'desc' },
        take: 10,
        select: { text: true, senderId: true, time: true }
      });
      for (const log of aiLogs.reverse()) {
        res.write(`data: ${JSON.stringify({ content: log.text, aiId: log.senderId, time: log.time })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    logger.logError('streamChatByRoom 에러', error, { roomId: req.params.roomId });
    if (!res.headersSent) {
      next(error);
    } else {
      res.end();
    }
  }
  req.on('close', () => {
    logger.logUserActivity('CHAT_DISCONNECT', req.auth?.userId, { roomId: req.params.roomId });
    res.end();
  });
};

/**
 * 사용자의 특정 캐릭터 친밀도 조회
 */
const getCharacterFriendship = async (req, res, next) => {
  try {
    const { personaId } = req.params;
    const { userId } = req.auth;

    const friendship = await chatService.getFriendship(userId, parseInt(personaId, 10));
    
    return responseHandler.sendSuccess(res, 200, '친밀도 조회 성공', friendship);
  } catch (error) {
    logger.logError('친밀도 조회 실패', error, { personaId: req.params.personaId });
    return responseHandler.sendServerError(res, '친밀도 조회에 실패했습니다.');
  }
};

/**
 * 사용자의 모든 캐릭터 친밀도 조회
 */
const getAllFriendships = async (req, res, next) => {
  try {
    const { userId } = req.auth;

    const friendships = await chatService.getUserFriendships(userId);
    
    return responseHandler.sendSuccess(res, 200, '친밀도 목록 조회 성공', friendships);
  } catch (error) {
    logger.logError('친밀도 목록 조회 실패', error);
    return responseHandler.sendServerError(res, '친밀도 목록 조회에 실패했습니다.');
  }
};

/**
 * 채팅방의 영상 목록을 조회합니다.
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const getChatRoomVideos = async (req, res, next) => {
  try {
    const roomId = parseInt(req.params.roomId, 10);
    const userId = req.auth.userId;
    const { page = 1, size = 20 } = req.query;

    // 페이지네이션 계산
    const skip = (parseInt(page, 10) - 1) * parseInt(size, 10);
    const take = parseInt(size, 10);

    // 사용자가 해당 채팅방에 참여하고 있는지 확인
    const participant = await prismaConfig.prisma.chatRoomParticipant.findFirst({
      where: {
        chatroomId: roomId,
        clerkId: userId,
      },
    });

    if (!participant) {
      return responseHandler.sendForbidden(res, '해당 채팅방에 접근할 권한이 없습니다.');
    }

    const result = await chatService.getChatRoomVideos(roomId, { skip, take });

    responseHandler.sendSuccess(res, 200, '채팅방 영상 목록 조회 성공', result);
  } catch (error) {
    next(error);
  }
};

/**
 * 특정 영상의 상세 정보를 조회합니다.
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const getVideoDetails = async (req, res, next) => {
  try {
    const videoId = parseInt(req.params.videoId, 10);
    const userId = req.auth.userId;

    const video = await chatService.getVideoDetails(videoId);

    // 사용자가 해당 채팅방에 참여하고 있는지 확인
    const participant = await prismaConfig.prisma.chatRoomParticipant.findFirst({
      where: {
        chatroomId: video.chatroomId,
        clerkId: userId,
      },
    });

    if (!participant) {
      return responseHandler.sendForbidden(res, '해당 영상에 접근할 권한이 없습니다.');
    }

    responseHandler.sendSuccess(res, 200, '영상 상세 정보 조회 성공', { video });
  } catch (error) {
    next(error);
  }
};

/**
 * 사용자가 참여한 모든 채팅방의 영상 목록을 조회합니다.
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const getUserVideos = async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const { page = 1, size = 20 } = req.query;

    // 페이지네이션 계산
    const skip = (parseInt(page, 10) - 1) * parseInt(size, 10);
    const take = parseInt(size, 10);

    const result = await chatService.getUserVideos(userId, { skip, take });

    responseHandler.sendSuccess(res, 200, '사용자 영상 목록 조회 성공', result);
  } catch (error) {
    next(error);
  }
};

/**
 * 채팅방의 캐릭터 이미지와 최근 채팅을 활용해서 비디오를 생성합니다.
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const generateChatRoomVideo = async (req, res, next) => {
  try {
    const roomId = parseInt(req.params.roomId, 10);
    const userId = req.auth.userId;

    // 사용자가 해당 채팅방에 참여하고 있는지 확인
    const participant = await prismaConfig.prisma.chatRoomParticipant.findFirst({
      where: {
        chatroomId: roomId,
        clerkId: userId,
      },
    });

    if (!participant) {
      return responseHandler.sendForbidden(res, '해당 채팅방에 접근할 권한이 없습니다.');
    }

    console.log(`🎬 채팅방 비디오 생성 요청: 채팅방 ${roomId}, 사용자 ${userId}`);

    // 비디오 생성 실행
    const videoResult = await chatService.generateChatRoomVideo(roomId, userId);

    if (!videoResult) {
      return responseHandler.sendBadRequest(res, '비디오 생성에 실패했습니다. 채팅방에 AI 캐릭터가 있는지 확인해주세요.');
    }

    responseHandler.sendSuccess(res, 200, '채팅방 비디오 생성 성공', { video: videoResult });
  } catch (error) {
    next(error);
  }
};

export default {
  streamChatByRoom,
  streamChatByRoom2,
  getMyChats,
  createMultiChatRoom,
  createChatRoom,
  deleteChatRoom,
  getRoomInfo,
  updateChatRoomName,
  getCharacterFriendship,
  getAllFriendships,
  getChatRoomVideos,
  getVideoDetails,
  getUserVideos,
  generateChatRoomVideo,
};
