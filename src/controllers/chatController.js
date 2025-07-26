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

// 레벨 계산 함수 (프론트엔드와 동일한 로직)
const getLevel = (exp) => {
  if (exp >= 20) return 5;
  if (exp >= 15) return 4;
  if (exp >= 10) return 3;
  if (exp >= 5) return 2;
  if (exp >= 1) return 1;
  return 0;
};

/**
 * 스트리밍 채팅 응답 생성
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
      const aiResponses = [];
      for (const aiP of aiParticipants) {
        const persona = aiP.persona
          ? { ...aiP.persona, ...(aiP.persona.prompt || {}) }
          : null;
        
        // 다른 AI들의 정보 수집 (현재 AI 제외)
        const otherParticipants = aiParticipants
          .filter(p => p.persona && p.persona.id !== persona.id)
          .map(p => ({ persona: p.persona }));
        
        console.log(`🤖 AI ${persona.name} (ID: ${persona.id}) 응답 생성 시작`);
        console.log(`📋 다른 AI들:`, otherParticipants.map(p => ({
          id: p.persona.id,
          name: p.persona.name,
          personality: p.persona.personality,
          tone: p.persona.tone
        })));
        console.log(`🎭 현재 AI 성격: ${persona.personality}, 말투: ${persona.tone}`);
        
        // 각 AI의 고유한 프롬프트 정보 사용
        const aiResponseText = await chatService.generateAiChatResponse(
          message,
          persona, // 각 AI의 고유한 persona 정보
          recentLogs.reverse().map(log => `${log.senderType === 'user' ? '사용자' : (log.senderType === 'ai' ? `AI(${log.senderId})` : '기타')}: ${log.text}`).join('\n'),
          otherParticipants // 다른 AI들의 정보 전달
        );
        
        console.log(`💬 AI ${persona.name} 응답: ${aiResponseText.substring(0, 100)}...`);
        
        // DB 저장
        await prismaConfig.prisma.chatLog.create({
          data: {
            chatroomId: parseInt(roomId, 10),
            text: aiResponseText,
            type: 'text',
            senderType: 'ai',
            senderId: String(persona.id),
            time: new Date()
          }
        });
        
        // 3. 해당 AI와의 친밀도 증가
        const expIncrease = calculateExp(message);
        console.log(`🔍 EXP 업데이트 시도: roomId=${roomId}, clerkId=${userId}, personaId=${persona.id}, expIncrease=${expIncrease}`);
        
        // 현재 exp 값 먼저 조회
        const currentExpData = await prismaConfig.prisma.chatRoomParticipant.findFirst({
          where: {
            chatroomId: parseInt(roomId, 10),
            clerkId: userId,
            personaId: persona.id
          },
          select: { exp: true }
        });
        
        const currentExp = currentExpData?.exp || 0;
        const newExp = currentExp + expIncrease;
        const newLevel = getLevel(newExp);
        
        const updateResult = await prismaConfig.prisma.chatRoomParticipant.updateMany({
          where: {
            chatroomId: parseInt(roomId, 10),
            clerkId: userId,
            personaId: persona.id
          },
          data: {
            exp: newExp,
            friendship: newLevel
          }
        });
        
        console.log(`✅ AI ${persona.name} 친밀도 ${expIncrease} 증가. 업데이트된 레코드 수: ${updateResult.count}`);
        console.log(`📊 AI ${persona.name} 현재 EXP: ${newExp}, 레벨: ${newLevel}`);
        
        // 소켓으로 EXP 업데이트 정보 전송
        if (io) {
          io.to(`room-${roomId}`).emit('expUpdated', {
            roomId,
            personaId: persona.id,
            personaName: persona.name,
            newExp: newExp,
            newLevel: newLevel,
            expIncrease,
            userId
          });
        }
        
        aiResponses.push({ content: aiResponseText, aiName: persona.name, aiId: persona.id });
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
 * @body { participantIds: number[] } (personaId 배열)
 */
const createChatRoom = errorHandler.asyncHandler(async (req, res) => {
  const { participantIds } = req.body;
  const { userId } = req.auth;
  
  console.log('createChatRoom - participantIds:', participantIds);
  console.log('createChatRoom - userId:', userId);
  
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
  const participants = await Promise.all(aiParticipants.map(async p => {
    let exp = 0;
    const participantExp = await prismaConfig.prisma.chatRoomParticipant.findFirst({
      where: {
        chatroomId: chatRoom.id,
        clerkId: userId,
        personaId: p.personaId
      },
      select: { exp: true }
    });
    if (participantExp && typeof participantExp.exp === 'number') {
      exp = participantExp.exp;
    }
    return {
      personaId: p.persona.id,
      clerkId: userId,
      name: p.persona.name,
      imageUrl: p.persona.imageUrl,
      exp,
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

  return responseHandler.sendSuccess(res, 200, '채팅방 정보를 조회했습니다.', {
    roomId: chatRoom.id,
    character: persona ? {
      id: persona.id,
      name: persona.name,
      introduction: persona.introduction,
      imageUrl: persona.imageUrl
    } : null,
    participants,
    chatHistory
  });
});

/**
 * AI들이 자동으로 인사하는 메시지를 생성합니다.
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
const generateAiGreetings = errorHandler.asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const userId = req.auth.userId;

  // 소켓 객체 가져오기 (express app에 io 등록되어 있다고 가정)
  const io = req.app.get && req.app.get('io') ? req.app.get('io') : null;

  console.log('🎉 AI 자동 인사 생성 요청:', { roomId, userId });

  try {
    // 1. 채팅방 정보 조회
    const chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
      where: {
        id: parseInt(roomId, 10),
        isDeleted: false,
      },
      include: {
        participants: {
          include: {
            persona: true,
          },
        },
      },
    });

    if (!chatRoom) {
      return responseHandler.sendNotFound(res, '존재하지 않는 채팅방입니다.');
    }

    // 2. AI 참여자들 필터링 (사용자 제외)
    const aiParticipants = chatRoom.participants
      .filter(p => p.persona && p.personaId)
      .map(p => ({
        personaId: p.persona.id,
        persona: p.persona,
      }));

    console.log('🤖 AI 참여자들:', aiParticipants.map(p => p.persona.name));

    if (aiParticipants.length === 0) {
      return responseHandler.sendBadRequest(res, 'AI 참여자가 없습니다.');
    }

    // 3. 각 AI가 인사 메시지 생성
    const greetingMessages = [];
    
    for (const aiParticipant of aiParticipants) {
      const otherParticipants = aiParticipants.filter(p => p.personaId !== aiParticipant.personaId);
      
      console.log(`🤖 ${aiParticipant.persona.name} 인사 생성 중...`);
      console.log('📋 다른 AI들:', otherParticipants.map(p => p.persona.name));
      
      const greetingText = await chatService.generateAiGreeting(
        aiParticipant.persona,
        otherParticipants
      );

      // 1. ChatLog에 저장
      await prismaConfig.prisma.chatLog.create({
        data: {
          chatroomId: parseInt(roomId, 10),
          senderType: 'ai',
          senderId: String(aiParticipant.personaId),
          text: greetingText,
          type: 'text',
          time: new Date(),
          isDeleted: false,
        }
      });

      // 2. AI 참여자의 EXP와 friendship 증가
      const expIncrease = calculateExp(greetingText);
      
      // 현재 EXP 값 조회
      const currentExpData = await prismaConfig.prisma.chatRoomParticipant.findFirst({
        where: {
          chatroomId: parseInt(roomId, 10),
          personaId: aiParticipant.personaId
        },
        select: { exp: true }
      });

      const currentExp = currentExpData?.exp || 0;
      const newExp = currentExp + expIncrease;
      const newLevel = getLevel(newExp);

      // EXP와 friendship 업데이트
      await prismaConfig.prisma.chatRoomParticipant.updateMany({
        where: {
          chatroomId: parseInt(roomId, 10),
          personaId: aiParticipant.personaId
        },
        data: {
          exp: newExp,
          friendship: newLevel
        }
      });

      // 3. 소켓으로 전송 (io가 있을 때만)
      if (io) {
        io.to(`room-${roomId}`).emit('receiveMessage', {
          roomId,
          message: greetingText,
          senderType: 'ai',
          aiId: aiParticipant.personaId,
          aiName: aiParticipant.persona.name,
          timestamp: new Date().toISOString(),
        });

        // EXP 업데이트 소켓 이벤트 전송
        io.to(`room-${roomId}`).emit('expUpdated', {
          roomId,
          personaId: aiParticipant.personaId,
          personaName: aiParticipant.persona.name,
          newExp: newExp,
          newLevel: newLevel,
          expIncrease,
          userId: null // AI는 userId가 없음
        });
      }

      greetingMessages.push({
        personaId: aiParticipant.personaId,
        personaName: aiParticipant.persona.name,
        message: greetingText,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ ${aiParticipant.persona.name} 인사 완료:`, greetingText.substring(0, 50) + '...');
      console.log(`📊 ${aiParticipant.persona.name} EXP 증가: ${currentExp} → ${newExp}, 레벨: ${newLevel}`);
    }

    console.log('🎉 모든 AI 인사 생성 완료:', greetingMessages.length, '개');

    return responseHandler.sendSuccess(res, 200, 'AI 인사 메시지가 생성되었습니다.', { greetings: greetingMessages });

  } catch (error) {
    console.error('❌ AI 인사 생성 실패:', error);
    return responseHandler.sendBadRequest(res, 'AI 인사 생성에 실패했습니다.');
  }
});

export default {
  streamChatByRoom,
  getMyChats,
  createMultiChatRoom,
  createChatRoom,
  deleteChatRoom,
  getRoomInfo,
  generateAiGreetings,
};
