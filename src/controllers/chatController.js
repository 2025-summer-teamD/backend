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
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import redisClient from '../config/redisClient.js'; // BullMQ 및 Redis Pub/Sub을 위한 클라이언트
import { addAiChatJob } from '../services/queueService.js';
import { warnOnce } from '@prisma/client/runtime/library';
import {
  setupSSEHeaders,
  saveChatMessage,
  sendSSEError,
  sendSSEUserMessage,
  sendSSEComplete,
  sendSSEExpUpdate,
  createClientCloseHandler,
  validateChatInput,
  getChatRoomWithParticipants,
  findAiParticipants,
  generateChatHistory,
  isFirstMessage as checkIsFirstMessage,
  parseAndValidateRoomId,
  validateAndProcessParticipants,
  sendFriendshipUpdateEvent,
  validateChatRoomParticipant,
  sendSSETimeout,
  sendSSEMessageSaved,
  sendSSETextChunk,
  sendSSECompleteSignal,
  sendSSEErrorAndClose
} from '../utils/chatHelpers.js';
import { calculateExp, getLevel } from '../utils/expCalculator.js';
import {
  logSuccess,
  logError,
  logInfo,
  logProgress,
  logComplete,
  logUserActivity,
  logErrorWithContext
} from '../utils/loggingHelpers.js';
import {
  setupRedisSubscription,
  cleanupRedisSubscription,
  parseRedisMessage,
  setupRedisTimeout
} from '../utils/redisHelpers.js';
import {
  handleCompleteFriendshipUpdate,
  handleGroupChatFriendshipUpdates,
  generateAndSaveAiResponse,
  generateAndSaveGroupAiResponses
} from '../utils/businessLogicHelpers.js';
import { createRedisMessageHandler } from '../utils/redisMessageHandlers.js';
import {
  validateCompleteChat,
  validateChatRoomAndAI,
  validateChatRoomType
} from '../utils/chatValidationHelpers.js';
import {
  createAndProcessGroupChatJob,
  setupGroupChatTimeout
} from '../utils/queueHelpers.js';
import { isOneOnOneChat } from '../utils/chatTypeUtils.js';
import { saveAndSendUserMessage } from '../utils/messageProcessingHelpers.js';
import { 
  processCompleteFriendshipUpdate,
  processGroupChatFriendshipUpdates 
} from '../utils/friendshipProcessingHelpers.js';
import { setupCompleteRedisSubscription } from '../utils/redisFlowHelpers.js';
import { 
  processOneOnOneAiResponse,
  processGroupAiResponses 
} from '../utils/aiResponseHelpers.js';

const elevenlabs = new ElevenLabsClient({

  apiKey: process.env.XI_API_KEY,

});



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
    logUserActivity.chatDisconnect(req.auth?.userId, { roomId: roomId });
    if (!res.writableEnded) {
      res.end();
    }
  };

  req.on('close', handleClientClose);

  try {
    // 1. 요청 데이터 파싱
    const { message, sender, userName } = req.body;
    roomId = req.params.roomId;  // 외부 변수에 할당
    userMessage = message;       // 외부 변수에 할당
    const userId = req.auth.userId;

    // 입력 검증
    const inputValidation = validateChatInput({ message: userMessage, sender, userName });
    if (!inputValidation.isValid) {
      return responseHandler.sendBadRequest(res, inputValidation.error);
    }

    // 🎯 채팅방 타입 자동 감지 (1대1 + 그룹 모두 지원)
    const isOneOnOne = await isOneOnOneChat(roomId);
    logInfo(`채팅방 타입: ${isOneOnOne ? '1대1' : '그룹'} 채팅`);
    
    // 🔄 그룹 채팅인 경우 기존 그룹 채팅 로직으로 위임
    if (!isOneOnOne) {
      logInfo('📡 그룹 채팅 → streamGroupChatByRoom 호출');
      return await streamGroupChatByRoom(req, res, next);
    }

    // 실제 채팅방 정보를 데이터베이스에서 조회

    // 1. 참여자 권한 확인 및 채팅방 정보 조회
    try {
      await validateChatRoomParticipant(roomId, userId);
    } catch (error) {
      return responseHandler.sendNotFound(res, error.message);
    }

    const chatRoom = await getChatRoomWithParticipants(roomId, { includeChatLogs: true, chatLogLimit: 10 });
    if (!chatRoom) {
      return responseHandler.sendNotFound(res, `채팅방 ID ${roomId}를 찾을 수 없습니다.`);
    }

    // AI 참여자 찾기
    const aiParticipants = findAiParticipants(chatRoom.participants, userId);
    if (aiParticipants.length === 0) {
      return responseHandler.sendNotFound(res, '1대1 채팅방에서 AI를 찾을 수 없습니다.');
    }

    const aiParticipant = aiParticipants[0];
    personaInfo = {
      id: aiParticipant.persona.id,
      name: aiParticipant.persona.name,
      personality: aiParticipant.persona.introduction || '친근하고 도움이 되는 성격',
      tone: '친근하고 자연스러운 말투',
      prompt: aiParticipant.persona.prompt
    };

    // 실제 대화 기록을 문자열로 변환
    const chatHistory = generateChatHistory(chatRoom.ChatLogs, personaInfo.name);

    // 첫 번째 메시지인지 확인
    const isFirstMessage = checkIsFirstMessage(chatRoom.ChatLogs);
    let savedChatLogId = null;
    // 1. 먼저 사용자 메시지를 즉시 DB에 저장
    try {
      await saveChatMessage({
        roomId,
        text: userMessage,
        senderType: 'user',
        senderId: userId
      });
      logUserActivity.chatMessageSaved(sender, {
        roomId: roomId,
        personaName: personaInfo.name,
        messageLength: userMessage.length
      });
    } catch (dbError) {
      logger.logError('사용자 메시지 저장 실패', dbError, { roomId });
      return responseHandler.sendServerError(res, '메시지 저장에 실패했습니다.');
    }

    // 2. SSE 헤더 설정
    setupSSEHeaders(res);
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
      sendSSETextChunk(res, aiResponseText);

    } catch (aiError) {
      logError('AI 응답 생성 실패', aiError);
      logger.logError('AI 응답 생성 중 오류 발생', aiError, { roomId: roomId });
      sendSSEErrorAndClose(res, 'AI 응답 생성 중 오류가 발생했습니다.');
      return;
    }

    // 4. 스트림 완료 후, AI 응답 전체를 DB에 저장
    try {
      const chatRog = await saveChatMessage({
        roomId,
        text: fullResponseText,
        senderType: 'ai',
        senderId: personaInfo.id
      });
      savedChatLogId = chatRog.id;
      // AI 메시지 전송 시 친밀도 증가
      const expIncrease = calculateExp(userMessage);
      const friendshipResult = await chatService.increaseFriendship(userId, personaInfo.id, expIncrease);
      sendSSEMessageSaved(res, savedChatLogId);
      console.log(savedChatLogId, "qqqqqqqqqqqqqqqqqqqqqqqqqqqqQQQQQQQQQQQQQQQ");
      // WebSocket을 통해 친밀도 업데이트 이벤트 전송
      if (friendshipResult) {
        sendFriendshipUpdateEvent(req, {
          roomId,
          personaId: personaInfo.id,
          personaName: personaInfo.name,
          newExp: friendshipResult.exp,
          newLevel: friendshipResult.friendship,
          expIncrease,
          userId
        });
      }

      logUserActivity.aiChatMessageSaved({
        roomId: roomId,
        personaName: personaInfo.name,
        messageLength: fullResponseText.length
      });
    } catch (dbError) {
      logError('AI 메시지 저장 실패', dbError);
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

  // 참가자 배열 검증 및 처리
  const validation = validateAndProcessParticipants(participantIds, userId);
  if (!validation.isValid) {
    console.log('createMultiChatRoom - validation failed:', validation.error);
    return responseHandler.sendBadRequest(res, validation.error);
  }

  console.log('createMultiChatRoom - allParticipantIds:', validation.allParticipantIds);

  // 이미 동일한 참가자 조합의 방이 있으면 반환, 없으면 새로 생성
  const result = await chatService.createMultiChatRoom(validation.allParticipantIds);
  console.log('createMultiChatRoom - result:', result);
  return responseHandler.sendSuccess(res, 201, '단체 채팅방이 생성되었습니다.', result);
});

/**
 * 채팅방 생성 (그룹 채팅 지원)
 * @route POST /chat/rooms
 * @body { participantIds: number[] } (personaId 배열) 또는 { personaId: number } (1대1 채팅)
 * @body { isPublic: boolean } (공개 여부, 기본값: true)
 */
const createChatRoom = errorHandler.asyncHandler(async (req, res) => {
  const { participantIds, personaId, isPublic = true } = req.body;
  const { userId } = req.auth;

  console.log('createChatRoom - participantIds:', participantIds);
  console.log('createChatRoom - personaId:', personaId);
  console.log('createChatRoom - isPublic:', isPublic);
  console.log('createChatRoom - userId:', userId);

  // 1대1 채팅인 경우 (personaId가 있는 경우)
  if (personaId) {
    console.log('createChatRoom - 1대1 채팅 생성');
    const result = await chatService.createOneOnOneChatRoom(userId, personaId, isPublic);
    console.log('createChatRoom - 1대1 채팅 결과:', result);
    return responseHandler.sendSuccess(res, 201, '1대1 채팅방이 생성되었습니다.', result);
  }

  // 단체 채팅인 경우 (participantIds가 있는 경우)
  // 참가자 배열 검증 및 처리
  const validation = validateAndProcessParticipants(participantIds, userId);
  if (!validation.isValid) {
    console.log('createChatRoom - validation failed:', validation.error);
    return responseHandler.sendBadRequest(res, validation.error);
  }

  console.log('createChatRoom - allParticipantIds:', validation.allParticipantIds);

  // 이미 동일한 참가자 조합의 방이 있으면 반환, 없으면 새로 생성
  const result = await chatService.createMultiChatRoom(validation.allParticipantIds, isPublic);
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

  logUserActivity.deleteChatRoom(userId, {
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

  // roomId 검증
  const validation = parseAndValidateRoomId(roomId);
  if (!validation.isValid) {
    return responseHandler.sendBadRequest(res, validation.error);
  }
  const parsedRoomId = validation.roomId;

  // 참여자 권한 확인
  try {
    await validateChatRoomParticipant(parsedRoomId, userId);
  } catch (error) {
    return responseHandler.sendNotFound(res, error.message);
  }

  // 채팅방 정보 조회
  const chatRoom = await getChatRoomWithParticipants(parsedRoomId);
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
    try {
      await validateChatRoomParticipant(roomId, userId);
    } catch (error) {
      return responseHandler.sendNotFound(res, error.message);
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
      const inputValidation = validateChatInput({ message, sender, userName: sender });
      if (!inputValidation.isValid || !timestamp) {
        return responseHandler.sendBadRequest(res, 'message, sender, timestamp 필드가 모두 필요합니다.');
      }
      // 내가 참여한 방인지 확인
      try {
        await validateChatRoomParticipant(roomId, userId);
      } catch (error) {
        return responseHandler.sendNotFound(res, error.message);
      }
      // 채팅방 정보 및 모든 참여자(AI 포함) 조회
      const chatRoom = await getChatRoomWithParticipants(roomId);

      // 모든 AI(페르소나) 참여자 목록
      const aiParticipants = findAiParticipants(chatRoom.participants)
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
      const chatHistory = generateChatHistory(recentLogs);

      // 첫 번째 메시지인지 확인 (사용자 메시지가 1개 이하인 경우)
      const isFirstMessage = checkIsFirstMessage(recentLogs);

      // 1. 사용자 메시지 저장
      await saveChatMessage({
        roomId,
        text: message,
        senderType: 'user',
        senderId: userId,
        time: new Date(timestamp)
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

      // 각 AI 응답을 DB에 저장
      for (const response of aiResponses) {
        // AI 응답을 DB에 저장
        await saveChatMessage({
          roomId,
          text: response.content,
          senderType: 'ai',
          senderId: response.personaId
        });
      }

      // 단체 채팅에서는 모든 AI에게 각각 친밀도 증가
      const expIncrease = calculateExp(message);
      console.log(`🔍 단체 채팅 경험치 계산: 메시지 "${message}" -> +${expIncrease}점`);

      for (const response of aiResponses) {
        console.log(`🔍 단체 채팅 ${response.personaName} 친밀도 증가 시도: 경험치 +${expIncrease}`);
        await chatService.increaseFriendship(userId, response.personaId, expIncrease);

        // 현재 친밀도 정보 조회
        const friendship = await chatService.getFriendship(userId, response.personaId);
        const newExp = friendship.exp;
        const newLevel = friendship.friendship;

        console.log(`✅ 단체 채팅 AI ${response.personaName} 친밀도 ${expIncrease} 증가. 총 경험치: ${newExp}, 레벨: ${newLevel}`);

        // 소켓으로 친밀도 업데이트 정보 전송
        sendFriendshipUpdateEvent(req, {
          roomId,
          personaId: response.personaId,
          personaName: response.personaName,
          newExp: newExp,
          newLevel: newLevel,
          expIncrease,
          userId
        });
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
    logUserActivity.chatDisconnect(req.auth?.userId, { roomId: req.params.roomId });
    res.end();
  });
};

/**
 * 그룹 채팅용 SSE 스트리밍 응답 생성 (BullMQ + Redis Pub/Sub 연동)
 * 
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const streamGroupChatByRoom = async (req, res, next) => {
  let roomId = null;
  let userId = null;
  let userMessage = null;
  let pubSubClient = null;

  // 클라이언트 연결 종료 이벤트 처리 함수
  const handleClientClose = () => {
    logUserActivity.groupChatDisconnect(userId, { roomId: roomId });
    if (pubSubClient) {
      pubSubClient.disconnect();
    }
    if (!res.writableEnded) {
      res.end();
    }
  };

  req.on('close', handleClientClose);

  try {
    // 1. 요청 데이터 파싱
    const { message, sender, userName } = req.body;
    roomId = req.params.roomId;
    userId = req.auth.userId;
    userMessage = message;

    logProgress('그룹 채팅 SSE 요청 수신', { roomId, userId, messageLength: message?.length });

    // 2. 완전한 채팅 검증 (입력, 인증, 권한)
    const chatValidation = await validateCompleteChat({ 
      message, sender, userName, roomId, userId, res 
    });
    if (!chatValidation.isValid) return;

    // 3. 채팅방 타입 검증
    const typeValidation = await validateChatRoomType({ 
      roomId, expectedType: 'group', res 
    });
    if (!typeValidation.isValid) return;

    // 4. 채팅방 정보 및 AI 참여자 검증
    const roomValidation = await validateChatRoomAndAI({ 
      roomId, userId, isGroupChat: true, res 
    });
    if (!roomValidation.isValid) return;

    const { chatRoom, aiParticipants } = roomValidation;

    // 4. 사용자 메시지를 즉시 DB에 저장
    try {
      await saveChatMessage({
        roomId,
        text: message,
        senderType: 'user',
        senderId: userId
      });
      logSuccess('사용자 메시지 DB 저장 완료');
      
      logUserActivity.groupChatMessageSaved(sender, {
        roomId: roomId,
        messageLength: message.length,
        aiParticipantsCount: aiParticipants.length
      });
    } catch (dbError) {
      logError('사용자 메시지 저장 실패', dbError);
      logErrorWithContext.groupChatUserMessageSaveFailed(dbError, { roomId: roomId });
      sendSSEError(res, '메시지 저장에 실패했습니다.');
      return;
    }

    // 5. SSE 헤더 설정
    setupSSEHeaders(res);
    console.log('✅ SSE 헤더 설정 완료');

    // 6. 즉시 사용자 메시지 전송
    res.write(`data: ${JSON.stringify({ 
      type: 'user_message', 
      content: message,
      sender: userName,
      senderId: userId,
      timestamp: new Date().toISOString()
    })}\n\n`);

    console.log('✅ 사용자 메시지 SSE 전송 완료');

    // 7. BullMQ에 AI 처리 작업 추가
    const queueResult = await createAndProcessGroupChatJob({
      roomId, message, senderId: userId, userName, userId, res
    });
    if (!queueResult.success) return;

    const { responseChannel } = queueResult;

    // 6. Redis Pub/Sub으로 AI 응답 대기
    try {
      pubSubClient = redisClient.duplicate();
      await pubSubClient.connect();
      logSuccess('Redis Pub/Sub 클라이언트 연결 완료');
      
      // 구독 설정
      const messageHandler = createRedisMessageHandler(res, responseChannel, pubSubClient);
      await pubSubClient.subscribe(responseChannel, messageHandler);

      logSuccess('Redis 구독 설정 완료', { responseChannel });
      
      // 타임아웃 설정 (30초)
      setTimeout(() => {
        if (!res.writableEnded) {
          logProgress('그룹 채팅 SSE 타임아웃');
          logger.logWarn('그룹 채팅 SSE 타임아웃', { roomId: roomId, userId: userId });
          res.write(`data: ${JSON.stringify({ type: 'timeout', message: 'AI 응답 대기 시간이 초과되었습니다.' })}\n\n`);
          res.write('data: [DONE]\n\n');
          if (pubSubClient) {
            pubSubClient.unsubscribe(responseChannel);
            pubSubClient.disconnect();
          }
          res.end();
        }
      }, 30000);
      
    } catch (redisError) {
      logError('Redis Pub/Sub 설정 실패', redisError);
      logErrorWithContext.redisSetupFailed(redisError, { roomId: roomId });
      sendSSEErrorAndClose(res, 'Redis 연결에 실패했습니다.');
      return;
    }
    
  } catch (error) {
    logError('그룹 채팅 SSE 전체 에러', error);
    logErrorWithContext.chatFlowError(error, { roomId: req.params.roomId }, '그룹 채팅 SSE 스트리밍');
    if (!res.headersSent) {
      next(error);
    } else {
      if (pubSubClient) {
        pubSubClient.disconnect();
      }
      res.end();
    }
  }
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
 * AI 채팅을 TTS로 변경
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const getTts = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { roomId, chatLogId } = req.params;

    console.log('DEBUG: In getTts - roomId:', roomId);
    console.log('DEBUG: In getTts - chatLogId:', chatLogId);
    console.log('DEBUG: In getTts - typeof chatLogId:', typeof chatLogId);

    const chatLog = await chatService.getChatLog(chatLogId);

    if (!chatLog) {
      return res.status(404).json({ error: '해당 chatLogId를 찾을 수 없습니다.' });
    }

    // if (chatLog.senderType !== 'ai') {
    //   return res.status(403).json({ error: 'TTS는 AI가 보낸 메시지에 대해서만 요청할 수 있습니다.' });
    // }

    const textToConvert = chatLog.text;

    if (!textToConvert || textToConvert.trim().length === 0) {
        return res.status(400).json({ error: 'TTS 변환할 텍스트가 비어있거나 유효하지 않습니다.' });
    }

    const manVoice = 'zQzvQBubVkDWYuqJYMFn'; // Eleven Labs에서 제공하는 남성 음성 ID
    const womanVoice = '8jHHF8rMqMlg8if2mOUe'; // Eleven Labs에서 제공하는 여성 음성 ID

    const persona = await prismaConfig.prisma.persona.findFirst({
      where: {
        id: parseInt(chatLog.senderId, 10),
        isDeleted: false
      },
      select: {
        name: true,
        prompt: true,
      }
    });

    console.log('DEBUG: persona:', persona?.prompt.tag);
    let voiceId = womanVoice; // 기본적으로 여성 음성 사용
    if (persona.prompt.tag.includes('남성')) {
      voiceId = manVoice; // 남성 태그가 포함된 경우 남성 음성 사용
    }
    // 6. Eleven Labs API 호출하여 TTS 스트림 받기 (웹 표준 ReadableStream)
    const elevenLabsResponseStream = await elevenlabs.textToSpeech.convert(voiceId, {
      outputFormat: "mp3_44100_128", // MP3 형식임을 명시
      text: textToConvert,
      modelId: "eleven_flash_v2_5"
    });

    // **핵심 변경 부분:**
    // 웹 표준 ReadableStream을 Node.js Buffer로 변환합니다.
    // 이는 `stream.Readable.from()` 또는 `new Response(stream).arrayBuffer()` 등을 사용할 수 있습니다.
    // 가장 간단한 방법은 `Response` 객체를 사용하여 `arrayBuffer()`로 변환하는 것입니다.
    let ttsAudioBuffer;
    if (elevenLabsResponseStream instanceof ReadableStream) {
        // 웹 표준 ReadableStream을 ArrayBuffer로 변환
        const response = new Response(elevenLabsResponseStream);
        const arrayBuffer = await response.arrayBuffer();
        ttsAudioBuffer = Buffer.from(arrayBuffer); // ArrayBuffer를 Node.js Buffer로 변환
    } else if (Buffer.isBuffer(elevenLabsResponseStream)) {
        // 혹시 모를 경우를 대비하여 이미 Buffer인 경우 처리
        ttsAudioBuffer = elevenLabsResponseStream;
    } else {
        // 예상치 못한 반환값인 경우
        console.error('CRITICAL ERROR: Eleven Labs API가 예상된 ReadableStream 또는 Buffer를 반환하지 않았습니다. 실제 반환값:', elevenLabsResponseStream);
        return res.status(500).json({ error: '음성 데이터를 생성하는 데 실패했습니다. (API 반환 타입 문제)' });
    }

    // 변환된 ttsAudioBuffer가 유효한지 확인
    if (!ttsAudioBuffer || !Buffer.isBuffer(ttsAudioBuffer) || ttsAudioBuffer.length === 0) {
        console.error('ERROR: Eleven Labs API 응답을 유효한 오디오 버퍼로 변환하지 못했습니다. 실제 버퍼:', ttsAudioBuffer);
        return res.status(500).json({ error: '음성 데이터를 생성하는 데 실패했습니다. (버퍼 변환 문제)' });
    }

    // 7. TTS 오디오 Buffer를 클라이언트로 응답 (단일 파일 전송 방식)
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg', // MP3 MIME 타입 지정
      'Content-Length': ttsAudioBuffer.length, // 버퍼의 실제 길이 지정
      'Cache-Control': 'no-cache', // 캐싱 방지 (필요에 따라 설정)
    });

    res.end(ttsAudioBuffer); // 버퍼 데이터를 직접 응답으로 전송

    console.log(`TTS for chatLogId ${chatLogId} successfully sent as MP3.`);

  } catch (error) {
    console.error('TTS 변환 중 치명적인 오류 발생:', error);
    if (!res.headersSent) {
        res.status(500).json({ error: '음성 생성에 실패했습니다.' });
    } else {
        console.warn('TTS 응답 도중 에러가 발생했으나, 이미 헤더가 전송되었습니다.');
        res.end();
    }
  }
};

/**
 * 🎯 통합 채팅 메시지 전송 API
 * - 1대1과 그룹 채팅을 자동으로 구분하여 처리
 * - 모든 응답은 SSE로 통일
 * - 내부적으로 기존 로직 재사용
 */
const sendChatMessage = async (req, res, next) => {
  const { roomId } = req.params;
  const { message, sender, userName } = req.body;
  const userId = req.auth?.userId;
  
  // 디버그 로그
  console.log('🎯 통합 채팅 API 호출:', { 
    roomId, 
    userId, 
    messageLength: message?.length,
    hasAuth: !!req.auth 
  });
  
  try {
    // 1. 기본 검증
    const inputValidation = validateChatInput({ message, sender, userName });
    if (!inputValidation.isValid) {
      console.log('❌ 입력 검증 실패:', { 
        message: !!message, 
        sender: !!sender, 
        userName: !!userName 
      });
      return responseHandler.sendBadRequest(res, inputValidation.error);
    }
    
    if (!userId) {
      logError('사용자 인증 실패');
      return responseHandler.sendUnauthorized(res, '사용자 인증이 필요합니다.');
    }
    
    // 2. 채팅방 타입 자동 감지
    logProgress('채팅방 타입 확인 중...');
    const isOneOnOne = await isOneOnOneChat(roomId);
    
    logSuccess(`채팅방 타입 확인 완료: ${isOneOnOne ? '1대1' : '그룹'} 채팅`);
    
    // 3. 공통 SSE 헤더 설정
    setupSSEHeaders(res);
    logSuccess('SSE 헤더 설정 완료');
    
    // 4. 타입에 따른 내부 처리 분기
    if (isOneOnOne) {
      logProgress('1대1 채팅 플로우 시작');
      await handleOneOnOneChatFlow(req, res, next);
    } else {
      logProgress('그룹 채팅 플로우 시작');
      await handleGroupChatFlow(req, res, next);
    }
    
  } catch (error) {
    logError('통합 채팅 API 에러', error);
    logger.logError('통합 채팅 메시지 처리 실패', error, { 
      roomId, 
      userId, 
      messageLength: message?.length 
    });
    
    // SSE 헤더가 이미 전송된 경우 에러 메시지만 전송
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        message: '채팅 처리 중 오류가 발생했습니다.' 
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      return next(error);
    }
  }
};

/**
 * 🔧 1대1 채팅 플로우 처리 (기존 streamChatByRoom2 로직 활용)
 */
const handleOneOnOneChatFlow = async (req, res, next) => {
  const { roomId } = req.params;
  const { message: userMessage, sender, userName } = req.body;
  const userId = req.auth.userId;
  
  let personaInfo = null;
  
  try {
    console.log('🔄 1대1 채팅 처리 시작:', { roomId, userId, messageLength: userMessage?.length });
    
    // 1. 채팅방 정보 및 AI 캐릭터 조회
    const chatRoom = await getChatRoomWithParticipants(roomId, { includeChatLogs: true });
    
    if (!chatRoom) {
      sendSSEError(res, '채팅방을 찾을 수 없습니다.');
      return;
    }
    
    // AI 참여자 찾기
    const aiParticipants = findAiParticipants(chatRoom.participants, userId);
    if (aiParticipants.length === 0) {
      sendSSEError(res, 'AI 캐릭터를 찾을 수 없습니다.');
      return;
    }
    
    personaInfo = aiParticipants[0].persona;
    console.log('✅ AI 캐릭터 정보 조회 완료:', { personaName: personaInfo.name });
    
    // 2. 채팅 히스토리 생성
    const chatHistory = generateChatHistory(chatRoom.ChatLogs, personaInfo.name);
    
    // 첫 번째 메시지인지 확인
    const isFirstMessage = checkIsFirstMessage(chatRoom.ChatLogs);
    
    // 3. 사용자 메시지를 DB에 저장
    try {
      await saveChatMessage({
        roomId,
        text: userMessage,
        senderType: 'user',
        senderId: userId
      });
      logSuccess('사용자 메시지 DB 저장 완료');
    } catch (dbError) {
      logError('사용자 메시지 저장 실패', dbError);
      sendSSEError(res, '메시지 저장에 실패했습니다.');
      return;
    }
    
    // 4. 사용자 메시지 즉시 전송
    sendSSEUserMessage(res, { message: userMessage, userName, userId });
    logSuccess('사용자 메시지 SSE 전송 완료');
    
    // 5. AI 응답 생성 및 전송
    let fullResponseText = "";
    try {
      console.log('🤖 AI 응답 생성 시작');
      const aiResponseText = await chatService.generateAiChatResponseOneOnOne(
        userMessage,
        personaInfo,
        chatHistory,
        isFirstMessage,
        userName
      );
      
      fullResponseText = aiResponseText;
      sendSSETextChunk(res, aiResponseText);
      logSuccess('AI 응답 SSE 전송 완료');
      
    } catch (aiError) {
      console.error('❌ AI 응답 생성 실패:', aiError);
      logger.logError('AI 응답 생성 중 오류 발생', aiError, { roomId: roomId });
      sendSSEError(res, 'AI 응답 생성 중 오류가 발생했습니다.');
      return;
    }
    
    // 6. AI 응답을 DB에 저장
    try {
      await saveChatMessage({
        roomId,
        text: fullResponseText,
        senderType: 'ai',
        senderId: personaInfo.id
      });
      console.log('✅ AI 응답 DB 저장 완료');
      
      // 7. 친밀도 업데이트
      const expIncrease = calculateExp(userMessage);
      const friendshipResult = await chatService.increaseFriendship(userId, personaInfo.id, expIncrease);
      
      // 친밀도 업데이트를 SSE로 전송
      if (friendshipResult) {
        sendSSEExpUpdate(res, {
          personaId: personaInfo.id,
          personaName: personaInfo.name,
          newExp: friendshipResult.exp,
          newLevel: friendshipResult.friendship,
          expIncrease,
          userId
        });
        console.log('✅ 친밀도 업데이트 SSE 전송 완료');
      }
      
    } catch (dbError) {
      logError('AI 메시지 저장 실패', dbError);
      logger.logError('AI 메시지 저장 실패', dbError, { roomId: roomId });
      sendSSEError(res, 'AI 응답 저장에 실패했습니다.');
      return;
    }
    
    // 8. 완료 신호 전송
    sendSSEComplete(res);
    console.log('✅ 1대1 채팅 플로우 완료');
    
  } catch (error) {
    logError('1대1 채팅 플로우 에러', error);
    logger.logError('1대1 채팅 플로우 에러', error, { roomId, userId });
    res.write(`data: ${JSON.stringify({ type: 'error', message: '1대1 채팅 처리 중 오류가 발생했습니다.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
};

/**
 * 🔧 그룹 채팅 플로우 처리 (기존 streamGroupChatByRoom 로직 활용)
 */
const handleGroupChatFlow = async (req, res, next) => {
  const { roomId } = req.params;
  const { message, sender, userName } = req.body;
  const userId = req.auth.userId;
  
  let pubSubClient = null;
  
  // 클라이언트 연결 종료 처리
  const handleClientClose = () => {
    logInfo('그룹 채팅 클라이언트 연결 종료');
    if (pubSubClient) {
      pubSubClient.disconnect();
    }
    if (!res.writableEnded) {
      res.end();
    }
  };
  
  req.on('close', handleClientClose);
  res.on('close', handleClientClose);
  
  try {
    logProgress('그룹 채팅 처리 시작', { roomId, userId, messageLength: message?.length });
    
    // 1. 완전한 채팅 검증 (입력, 인증, 권한)
    const chatValidation = await validateCompleteChat({ 
      message, sender, userName, roomId, userId, res 
    });
    if (!chatValidation.isValid) return;

    // 2. 채팅방 정보 및 AI 참여자 검증  
    const roomValidation = await validateChatRoomAndAI({ 
      roomId, userId, isGroupChat: true, res 
    });
    if (!roomValidation.isValid) return;

    const { chatRoom, aiParticipants } = roomValidation;
    
    // 3. 사용자 메시지를 DB에 저장
    try {
      await saveChatMessage({
        roomId,
        text: message,
        senderType: 'user',
        senderId: userId
      });
      logSuccess('사용자 메시지 DB 저장 완료');
      
      logUserActivity.groupChatMessageSaved(sender, {
        roomId: roomId,
        messageLength: message.length,
        aiParticipantsCount: aiParticipants.length
      });
    } catch (dbError) {
      logError('사용자 메시지 저장 실패', dbError);
      logErrorWithContext.groupChatUserMessageSaveFailed(dbError, { roomId: roomId });
      sendSSEError(res, '메시지 저장에 실패했습니다.');
      return;
    }
    
    // 4. 사용자 메시지 즉시 전송
    sendSSEUserMessage(res, { message, userName, userId });
    logSuccess('사용자 메시지 SSE 전송 완료');
    
    // 5. BullMQ에 AI 처리 작업 추가
    const queueResult = await createAndProcessGroupChatJob({
      roomId, message, senderId: userId, userName, userId, res
    });
    if (!queueResult.success) return;

    const { responseChannel } = queueResult;

    // 6. Redis Pub/Sub으로 AI 응답 대기
    try {
      pubSubClient = redisClient.duplicate();
      await pubSubClient.connect();
      logSuccess('Redis Pub/Sub 클라이언트 연결 완료');
      
      // 구독 설정
      const messageHandler = createRedisMessageHandler(res, responseChannel, pubSubClient);
      await pubSubClient.subscribe(responseChannel, messageHandler);

      logSuccess('Redis 구독 설정 완료', { responseChannel });
      
      // 타임아웃 설정 (30초)
      setTimeout(() => {
        if (!res.writableEnded) {
          logProgress('그룹 채팅 SSE 타임아웃');
          logger.logWarn('그룹 채팅 SSE 타임아웃', { roomId: roomId, userId: userId });
          res.write(`data: ${JSON.stringify({ type: 'timeout', message: 'AI 응답 대기 시간이 초과되었습니다.' })}\n\n`);
          res.write('data: [DONE]\n\n');
          if (pubSubClient) {
            pubSubClient.unsubscribe(responseChannel);
            pubSubClient.disconnect();
          }
          res.end();
        }
      }, 30000);
      
    } catch (redisError) {
      logError('Redis Pub/Sub 설정 실패', redisError);
      logErrorWithContext.redisSetupFailed(redisError, { roomId: roomId });
      sendSSEErrorAndClose(res, 'Redis 연결에 실패했습니다.');
      return;
    }
    
  } catch (error) {
    logError('그룹 채팅 플로우 에러', error);
    logger.logError('그룹 채팅 플로우 에러', error, { roomId, userId });
    res.write(`data: ${JSON.stringify({ type: 'error', message: '그룹 채팅 처리 중 오류가 발생했습니다.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    if (pubSubClient) {
      pubSubClient.disconnect();
    }
    res.end();
  }
};

/**
 * 채팅방 공개 설정 변경
 * @route PUT /chat/rooms/:roomId/public
 */
const updateChatRoomPublic = errorHandler.asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { isPublic } = req.body;
  const { userId } = req.auth;

  if (typeof isPublic !== 'boolean') {
    return responseHandler.sendBadRequest(res, 'isPublic은 boolean 값이어야 합니다.');
  }

  // 내가 참여한 방인지 확인
  try {
    await validateChatRoomParticipant(roomId, userId);
  } catch (error) {
    return responseHandler.sendNotFound(res, error.message);
  }

  // 채팅방 공개 설정 업데이트
  const updatedRoom = await prismaConfig.prisma.chatRoom.update({
    where: { id: parseInt(roomId) },
    data: { isPublic: isPublic }
  });

  return responseHandler.sendSuccess(res, 200, '채팅방 공개 설정이 성공적으로 변경되었습니다.', {
    roomId: updatedRoom.id,
    isPublic: updatedRoom.isPublic
  });
});

/**
 * 공개 채팅방 목록 조회
 * @route GET /chat/public-rooms
 */
const getPublicChatRooms = errorHandler.asyncHandler(async (req, res) => {
  const { userId } = req.auth;
  
  try {
    // 공개된 채팅방만 조회
    const publicRooms = await prismaConfig.prisma.chatRoom.findMany({
      where: {
        isPublic: true,
        isDeleted: false,
      },
      include: {
        participants: {
          include: {
            persona: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // 최대 50개까지만 조회
    });

    // 응답 데이터 가공
    const formattedRooms = publicRooms.map(room => ({
      id: room.id,
      name: room.name,
      isPublic: room.isPublic,
      createdAt: room.createdAt,
      participants: room.participants.map(p => ({
        personaId: p.personaId,
        persona: p.persona ? {
          id: p.persona.id,
          name: p.persona.name,
          imageUrl: p.persona.imageUrl
        } : null
      }))
    }));

    return responseHandler.sendSuccess(res, 200, '공개 채팅방 목록을 성공적으로 조회했습니다.', formattedRooms);
  } catch (error) {
    console.error('공개 채팅방 조회 실패:', error);
    return responseHandler.sendInternalServerError(res, '공개 채팅방 조회에 실패했습니다.');
  }
});

export default {
  streamChatByRoom,
  streamChatByRoom2,
  getMyChats,
  createMultiChatRoom,
  createChatRoom,
  deleteChatRoom,
  getRoomInfo,
  updateChatRoomName,
  updateChatRoomPublic,
  getCharacterFriendship,
  getAllFriendships,
  getTts,
  streamGroupChatByRoom,
  sendChatMessage,
  getPublicChatRooms
};
