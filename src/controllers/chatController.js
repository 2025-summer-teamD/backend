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

      // --- exp 초과 시 영상 생성 보상 로직 ---
      // (예시: personaInfo와 message를 활용해 프롬프트 옵션 구성)
      const videoReward = await chatService.checkAndGenerateVideoReward(
        parseInt(roomId, 10),
        {
          subject: `${personaInfo.name}와의 대화`,
          style: '밝고 따뜻한 애니메이션',
          mood: '즐겁고 에너지 넘치게',
          action: `사용자와 AI가 대화를 나누는 장면. 최근 메시지: ${message}`,
          duration: '10초',
          language: '한국어'
        }
      );
      if (videoReward && videoReward.gcsUrl) {
        // ChatLog에 영상 기록 저장
        await prismaConfig.prisma.chatLog.create({
          data: {
            chatroomId: parseInt(roomId, 10),
            text: videoReward.gcsUrl,
            type: 'video',
            speaker: 'ai',
            time: new Date()
          }
        });
        // SSE로 영상 URL 전송 (프론트엔드가 type을 기준으로 분기 처리함)
        res.write(`data: ${JSON.stringify({ type: 'video_url', url: videoReward.gcsUrl })}\n\n`);
      }

    } catch (dbError) {
      logger.logError('AI 응답 저장 실패', dbError, { roomId: roomId });
      // AI 응답 저장 실패해도 SSE는 계속 진행
    }

    // 생성된 전체 텍스트 응답 전송 (프론트엔드에서는 type === 'text_chunk'로 처리)
    res.write(`data: ${JSON.stringify({ type: 'text_chunk', content: fullResponseText })}\n\n`);
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
 * 스트리밍 채팅 응답 생성 (한 글자씩 스트리밍 지원)
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const streamChatByRoom2 = async (req, res, next) => {
  let roomId = null; // 에러 로깅을 위해 상위 스코프에 선언
  let personaInfo = null; // 로깅 및 비디오 보상에 사용하기 위해 상위 스코프에 선언
  let userMessage = null; // 비디오 보상 로직에 사용하기 위해 상위 스코프에 선언

  // 클라이언트 연결 종료 이벤트 처리 함수
  const handleClientClose = () => {
    logger.logUserActivity('CHAT_DISCONNECT', req.auth?.userId, { roomId: roomId });
    if (!res.writableEnded) { // res.end()가 이미 호출되지 않은 경우에만
        res.end();
    }
  };

  req.on('close', handleClientClose); // 연결 종료 이벤트 리스너 등록

  try {
    roomId = req.params.roomId;
    userMessage = req.body.message; // 사용자 메시지를 상위 스코프에 저장
    const { sender, timestamp } = req.body;

    // 입력 검증
    if (!userMessage || !sender || !timestamp) {
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

    personaInfo = {
      id: chatRoom.persona.id,
      name: chatRoom.persona.name,
      personality: chatRoom.persona.introduction || '친근하고 도움이 되는 성격',
      tone: chatRoom.persona.tone || '친근한 톤',
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
          text: userMessage,
          type: 'text',
          speaker: 'user',
          time: new Date(timestamp)
        }
      });

      logger.logUserActivity('CHAT_MESSAGE_SAVED', sender, {
        roomId: roomId,
        personaName: personaInfo.name,
        messageLength: userMessage.length
      });
    } catch (dbError) {
      logger.logError('사용자 메시지 저장 실패', dbError, { roomId: roomId });
      // 메시지 저장 실패 시 스트림 시작 전에 에러 응답
      return responseHandler.sendServerError(res, '메시지 저장에 실패했습니다.');
    }

    // --- 2. SSE 헤더 설정 ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // 헤더 즉시 전송

    // --- 3. AI 응답 스트리밍 생성 및 전송 ---
    let fullResponseText = ""; // ⭐ 전체 응답을 모으기 위한 변수

    try {
      // ⭐ chatService에서 스트림을 반환
      const aiResponseStream = chatService.generateAiChatResponseStream(
        userMessage,
        personaInfo,
        chatHistory
      );

      for await (const chunk of aiResponseStream) {
        if (chunk) {
          fullResponseText += chunk; // 전체 응답 모으기
          // ⭐ 각 토큰(청크)을 SSE 이벤트로 즉시 전송
          // 클라이언트에서 type을 보고 구분할 수 있도록 합니다.
          await new Promise(resolve => setTimeout(resolve, 1000));
          res.write(`data: ${JSON.stringify({ type: 'text_chunk', content: chunk })}\n\n`);
        }
      }
    } catch (aiError) {
      logger.logError('AI 응답 스트리밍 중 오류 발생', aiError, { roomId: roomId });
      // AI 스트리밍 중 에러 발생 시, 에러 메시지를 SSE로 전송 후 스트림 종료
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI 응답 생성 중 오류가 발생했습니다.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return; // 에러 발생 시 더 이상 진행하지 않음
    }

    // --- 4. 스트림 완료 후, AI 응답 전체를 DB에 저장 ---
    try {
      await prismaConfig.prisma.chatLog.create({
        data: {
          chatroomId: parseInt(roomId, 10),
          text: fullResponseText, // ⭐ 모아진 전체 응답 저장
          type: 'text',
          speaker: 'ai',
          time: new Date()
        }
      });

      // EXP 계산 및 반영
      const expToAdd = calculateExp(userMessage); // calculateExp 함수는 별도로 정의되어야 함
      await prismaConfig.prisma.chatRoom.update({
        where: { id: parseInt(roomId, 10) },
        data: { exp: { increment: expToAdd } }
      });

      // --- exp 초과 시 영상 생성 보상 로직 ---
      const videoReward = await chatService.checkAndGenerateVideoReward(
        parseInt(roomId, 10),
        {
          subject: `${personaInfo.name}와의 대화`,
          style: '밝고 따뜻한 애니메이션',
          mood: '즐겁고 에너지 넘치게',
          action: `사용자와 AI가 대화를 나누는 장면. 최근 메시지: ${userMessage}`, // userMessage 사용
          duration: '10초',
          language: '한국어'
        }
      );
      if (videoReward && videoReward.gcsUrl) {
        // ChatLog에 영상 기록 저장
        await prismaConfig.prisma.chatLog.create({
          data: {
            chatroomId: parseInt(roomId, 10),
            text: videoReward.gcsUrl,
            type: 'video',
            speaker: 'ai',
            time: new Date()
          }
        });
        // ⭐ SSE로 영상 URL 전송 (type을 'video_url' 등으로 명확히 구분)
        res.write(`data: ${JSON.stringify({ type: 'video_url', url: videoReward.gcsUrl })}\n\n`);
      }

    } catch (dbError) {
      logger.logError('AI 응답 또는 보상 저장 실패', dbError, { roomId: roomId });
      // DB 저장 실패는 스트림 종료 후 발생하므로 클라이언트에게는 이미 응답이 전송되었을 수 있음.
      // 별도의 에러 로깅 또는 관리자 알림 필요.
    }

    // 모든 작업 완료 후 스트림 종료 알림
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    logger.logError('스트리밍 채팅 에러 (초기 검증 또는 예상치 못한 오류)', error, { roomId: roomId });
    // 이미 헤더가 전송된 경우 next(error) 호출 불가
    if (!res.headersSent) {
      next(error); // 아직 헤더가 전송되지 않았다면 다음 미들웨어로 에러 전달
    } else {
      // 이미 스트림이 시작된 후 발생한 치명적인 에러
      res.write(`data: ${JSON.stringify({ type: 'error', message: '서버 내부 오류가 발생했습니다.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } finally {
    // 요청 처리 완료 또는 에러 발생 시 close 이벤트 리스너 제거
    req.off('close', handleClientClose);
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
    character: {
      id: chatRoom.persona.id,
      name: chatRoom.persona.name,
      introduction: chatRoom.persona.introduction,
      imageUrl: chatRoom.persona.imageUrl,
      exp: chatRoom.exp, // exp 추가
      friendship: chatRoom.friendship // friendship 추가
    }
  });
});

export default {
  streamChatByRoom,
  streamChatByRoom2,
  getMyChats,
  enterChatRoom,
  createChatRoom,
  deleteChatRoom,
  getRoomInfo,
};
