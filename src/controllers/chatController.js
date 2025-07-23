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
 * 스트리밍 채팅 응답 생성
 * 
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const streamChatByRoom = async (req, res, next) => {
  try {
    const { room_id } = req.params;
    const { message, sender, timestamp } = req.body;

    // 디버깅: room_id 값 확인
    console.log('🔍 DEBUG: room_id 값 확인');
    console.log('- req.params:', req.params);
    console.log('- room_id 원본값:', room_id);
    console.log('- room_id 타입:', typeof room_id);
    console.log('- parseInt 결과:', parseInt(room_id, 10));
    console.log('- isNaN 체크:', isNaN(parseInt(room_id, 10)));

    // 입력 검증
    if (!message || !sender || !timestamp) {
      return responseHandler.sendBadRequest(res, 'message, sender, timestamp 필드가 모두 필요합니다.');
    }

    // 실제 채팅방 정보를 데이터베이스에서 조회
    const chatRoom = await prismaConfig.prisma.chatRoom.findUnique({
      where: { 
        id: parseInt(room_id, 10),
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
      return responseHandler.sendNotFound(res, `채팅방 ID ${req.params.room_id}를 찾을 수 없습니다.`);
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

    logger.logUserActivity('CHAT_MESSAGE', sender, {
      roomId: req.params.room_id,
      personaName: personaInfo.name,
      messageLength: message.length
    });

    // --- SSE 헤더 설정 ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // --- AI 응답 생성 ---
    const fullResponseText = await chatService.generateAiChatResponse(
      message,
      personaInfo,
      chatHistory
    );

    // --- 사용자 메시지와 AI 응답을 데이터베이스에 저장 ---
    try {
      // 사용자 메시지 저장
      await prismaConfig.prisma.chatLog.create({
        data: {
          chatroomId: parseInt(room_id, 10), // 검증된 숫자 사용
          text: message,
          type: 'text',
          speaker: 'user',
          time: new Date(timestamp)
        }
      });

      // AI 응답 저장
      await prismaConfig.prisma.chatLog.create({
        data: {
          chatroomId: parseInt(room_id, 10), // 검증된 숫자 사용
          text: fullResponseText,
          type: 'text',
          speaker: 'ai',
          time: new Date()
        }
      });
    } catch (dbError) {
      logger.logError('채팅 기록 저장 실패', dbError, { roomId: req.params.room_id });
      // 저장 실패해도 SSE 응답은 계속 진행
    }

    // --- 생성된 전체 응답을 SSE로 전송 ---
    res.write(`data: ${JSON.stringify({ content: fullResponseText })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    logger.logError('스트리밍 채팅 에러', error, { roomId: req.params.room_id });
    if (!res.headersSent) {
      next(error);
    } else {
      res.end();
    }
  }

  // 클라이언트 연결 종료 이벤트 처리
  req.on('close', () => {
    logger.logUserActivity('CHAT_DISCONNECT', req.auth?.userId, { roomId: req.params.room_id });
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
  const { character_id } = req.query;
  
  if (!character_id) {
    return responseHandler.sendBadRequest(res, 'character_id 쿼리 파라미터가 필요합니다.');
  }

  const parsedCharacterId = parseInt(character_id);
  if (isNaN(parsedCharacterId)) {
    return responseHandler.sendBadRequest(res, 'character_id는 숫자여야 합니다.');
  }

  // 1. 먼저 채팅방 조회
  const chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
    where: {
      characterId: parsedCharacterId,
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
    room_id: chatRoom.id,
    character: chatRoom.persona,
    chat_history: chatHistory // 해당 채팅방의 대화기록만
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
  const { character_id } = req.body;
  const userId = req.auth.userId;

  if (!character_id) {
    return responseHandler.sendBadRequest(res, 'character_id가 필요합니다.');
  }

  const result = await chatService.createChatRoom(character_id, userId);

  logger.logUserActivity('CREATE_CHAT_ROOM', userId, {
    roomId: result.id,
    characterId: character_id
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
  const { room_id } = req.params;
  const userId = req.auth.userId;

  await chatService.deleteChatRoom(room_id, userId);

  logger.logUserActivity('DELETE_CHAT_ROOM', userId, {
    roomId: room_id
  });

  return responseHandler.sendSuccess(res, 200, '채팅방이 성공적으로 삭제되었습니다.');
});

/**
 * room_id로 채팅방 정보 조회 (GET /api/chat/room-info?room_id=...)
 */
const getRoomInfo = errorHandler.asyncHandler(async (req, res) => {
  const { room_id } = req.query;
  
  // room_id 파라미터 검증
  if (!room_id) {
    return responseHandler.sendBadRequest(res, 'room_id 쿼리 파라미터가 필요합니다.');
  }
  
  // room_id를 숫자로 변환 및 검증
  const parsedRoomId = parseInt(room_id, 10);
  if (isNaN(parsedRoomId) || parsedRoomId <= 0) {
    return responseHandler.sendBadRequest(res, '유효하지 않은 room_id입니다. 양의 정수여야 합니다.');
  }
  
  const chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
    where: {
      id: parsedRoomId,
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
    room_id: chatRoom.id,
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
