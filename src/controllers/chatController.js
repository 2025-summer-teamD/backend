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
  let exp = 1;
  if (message.length >= 70) exp += 1;
  const emojiRegex = /[\p{Emoji}]/gu;
  const emojiMatches = message.match(emojiRegex);
  if (emojiMatches) {
    exp += emojiMatches.length * 0.1;
  }
  return exp;
};

/**
 * 스트리밍 채팅 응답 생성
 * 
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const streamChatByRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { message, sender, timestamp } = req.body;

    // 디버깅: roomId 값 확인
    console.log('🔍 DEBUG: roomId 값 확인');
    console.log('- req.params:', req.params);
    console.log('- roomId 원본값:', roomId);
    console.log('- roomId 타입:', typeof roomId);
    console.log('- parseInt 결과:', parseInt(roomId, 10));
    console.log('- isNaN 체크:', isNaN(parseInt(roomId, 10)));

    // 입력 검증
    if (!message || !sender || !timestamp) {
      return responseHandler.sendBadRequest(res, 'message, sender, timestamp 필드가 모두 필요합니다.');
    }

    // 실제 채팅방 정보를 데이터베이스에서 조회 (사용자별 필터링)
    const { userId } = req.auth; // 인증된 사용자 ID 가져오기
    
    const chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
      where: { 
        id: parseInt(roomId, 10),
        clerkId: userId, // 🔒 사용자별 접근 권한 확인!
        isDeleted: false
      },
      include: {
        persona: {
          select: {
            id: true,
            name: true,
            introduction: true,
            prompt: true
          }
        },
        ChatLogs: {
          where: { isDeleted: false },
          orderBy: { time: 'desc' },
          take: 10, // 최근 10개 대화 기록
          select: {
            text: true,
            speaker: true,
            time: true
          }
        }
      }
    });

    if (!chatRoom) {
      return responseHandler.sendNotFound(res, `채팅방 ID ${roomId}를 찾을 수 없습니다.`);
    }

    const personaInfo = {
      id: chatRoom.persona.id,
      name: chatRoom.persona.name,
      personality: chatRoom.persona.introduction || '친근하고 도움이 되는 성격',
      tone: '친근하고 자연스러운 말투',
      prompt: chatRoom.persona.prompt
    };

    // 실제 대화 기록을 문자열로 변환
    let chatHistory = '';
    if (chatRoom.ChatLogs.length > 0) {
      chatHistory = chatRoom.ChatLogs
        .reverse() // 오래된 순서로 정렬
        .map(log => `${log.speaker === 'user' ? '사용자' : personaInfo.name}: ${log.text}`)
        .join('\n');
    } else {
      chatHistory = '아직 대화 기록이 없습니다.';
    }

    // --- 1. 먼저 사용자 메시지를 즉시 DB에 저장 ---
    try {
      await prismaConfig.prisma.chatLog.create({
        data: {
          chatroomId: parseInt(roomId, 10),
          text: message,
          type: 'text',
          speaker: 'user',
          time: new Date(timestamp)
        }
      });
      
      logger.logUserActivity('CHAT_MESSAGE_SAVED', sender, {
        roomId: roomId,
        personaName: personaInfo.name,
        messageLength: message.length
      });
    } catch (dbError) {
      logger.logError('사용자 메시지 저장 실패', dbError, { roomId: roomId });
      return responseHandler.sendServerError(res, '메시지 저장에 실패했습니다.');
    }

    // --- 2. SSE 헤더 설정 ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // --- 3. AI 응답 생성 ---
    const fullResponseText = await chatService.generateAiChatResponse(
      message,
      personaInfo,
      chatHistory
    );

    // --- 4. AI 응답만 별도로 DB에 저장 ---
    try {
      await prismaConfig.prisma.chatLog.create({
        data: {
          chatroomId: parseInt(roomId, 10),
          text: fullResponseText,
          type: 'text',
          speaker: 'ai',
          time: new Date()
        }
      });

      // EXP 계산 및 반영
      const expToAdd = calculateExp(message);
      await prismaConfig.prisma.chatRoom.update({
        where: { id: parseInt(roomId, 10) },
        data: { exp: { increment: expToAdd } }
      });

    } catch (dbError) {
      logger.logError('AI 응답 저장 실패', dbError, { roomId: roomId });
      // AI 응답 저장 실패해도 SSE는 계속 진행
    }

    // --- 생성된 전체 응답을 SSE로 전송 ---
    res.write(`data: ${JSON.stringify({ content: fullResponseText })}\n\n`);
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

  // 클라이언트 연결 종료 이벤트 처리
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
 * 채팅방 입장
 * 
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const enterChatRoom = errorHandler.asyncHandler(async (req, res) => {
  const { characterId } = req.query;
  const { userId } = req.auth; // 인증된 사용자 ID 가져오기
  
  if (!characterId) {
    return responseHandler.sendBadRequest(res, 'characterId 쿼리 파라미터가 필요합니다.');
  }

  const parsedCharacterId = parseInt(characterId);
  if (isNaN(parsedCharacterId)) {
    return responseHandler.sendBadRequest(res, 'characterId는 숫자여야 합니다.');
  }

  // 1. 먼저 사용자별 채팅방 조회 (보안 중요!)
  const chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
    where: {
      characterId: parsedCharacterId,
      clerkId: userId, // 🔒 사용자별 필터링 추가!
      isDeleted: false
    },
    include: {
      persona: {
        select: {
          id: true,
          name: true,
          introduction: true,
          imageUrl: true
        }
      }
    }
  });

  if (!chatRoom) {
    return responseHandler.sendNotFound(res, '해당 캐릭터의 채팅방을 찾을 수 없습니다.');
  }

  // 2. 해당 채팅방의 대화기록만 별도로 조회 (SQL: SELECT * FROM "ChatLog" WHERE "chatroomId" = chatRoom.id ORDER BY "time")
  const chatHistory = await prismaConfig.prisma.chatLog.findMany({
    where: {
      chatroomId: chatRoom.id,  // 명시적으로 chatroomId로 필터링
      isDeleted: false
    },
    orderBy: { time: 'asc' },   // 시간순 정렬
    select: {
      id: true,
      text: true,
      speaker: true,
      time: true
    }
  });

  logger.logUserActivity('ENTER_CHAT_ROOM', req.auth?.userId, {
    roomId: chatRoom.id,
    characterId: parsedCharacterId,
    characterName: chatRoom.persona.name,
    previousMessageCount: chatHistory.length
  });

  return responseHandler.sendSuccess(res, 200, '채팅방에 입장했습니다.', {
    roomId: chatRoom.id,
    character: chatRoom.persona,
    chatHistory: chatHistory // 해당 채팅방의 대화기록만
  });
});




/**
 * 새로운 채팅방 생성
 * 
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const createChatRoom = errorHandler.asyncHandler(async (req, res) => {
  const { characterId } = req.body;
  const userId = req.auth.userId;

  if (!characterId) {
    return responseHandler.sendBadRequest(res, 'character_id가 필요합니다.');
  }

  const result = await chatService.createChatRoom(characterId, userId);

  logger.logUserActivity('CREATE_CHAT_ROOM', userId, {
    roomId: result.id,
    characterId: characterId
  });

  return responseHandler.sendSuccess(res, 201, '채팅방이 성공적으로 생성되었습니다.', result);
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
  const { userId } = req.auth; // 인증된 사용자 ID 가져오기
  
  if (!roomId) {
    return responseHandler.sendBadRequest(res, 'room_id 쿼리 파라미터가 필요합니다.');
  }
  const parsedRoomId = parseInt(roomId);
  if (isNaN(parsedRoomId)) {
    return responseHandler.sendBadRequest(res, 'room_id는 숫자여야 합니다.');
  }
  
  // 🔒 사용자별 채팅방 정보 조회 (보안 중요!)
  const chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
    where: {
      id: parsedRoomId,
      clerkId: userId, // 🔒 사용자별 필터링 추가!
      isDeleted: false
    },
    include: {
      persona: {
        select: {
          id: true,
          name: true,
          introduction: true,
          imageUrl: true
        }
      }
    }
  });
  if (!chatRoom) {
    return responseHandler.sendNotFound(res, '해당 채팅방을 찾을 수 없습니다.');
  }
  return responseHandler.sendSuccess(res, 200, '채팅방 정보를 조회했습니다.', {
    roomId: chatRoom.id,
    character: chatRoom.persona
  });
});

export default {
  streamChatByRoom,
  getMyChats,
  enterChatRoom,
  createChatRoom,
  deleteChatRoom,
  getRoomInfo,
};
