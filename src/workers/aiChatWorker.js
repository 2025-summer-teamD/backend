/**
 * AI 채팅 처리 워커
 * 
 * 기능:
 * - 큐에서 AI 채팅 처리 작업 수행
 * - Vertex AI 호출 및 응답 생성
 * - 결과 DB 저장 및 실시간 전송
 * - 친밀도 시스템 업데이트
 */

import { Worker } from 'bullmq';
import { aiChatQueue } from '../services/queueService.js';
import chatService from '../services/chatService.js';
import prismaConfig from '../config/prisma.js';
import logger from '../utils/logger.js';
import redisClient from '../config/redisClient.js';
import { AiResponseCache } from '../services/cacheService.js';

// Redis 연결 설정
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0,
};

/**
 * WebSocket 서버로 메시지 전송
 * (Redis Pub/Sub을 통해 WebSocket 서버에 전달)
 */
const sendToWebSocket = async (roomId, messageData) => {
  try {
    await redisClient.publish('websocket-message', JSON.stringify({
      roomId,
      ...messageData,
    }));
    
    logger.logInfo('WebSocket으로 메시지 전송', {
      roomId,
      messageType: messageData.type || 'message',
    });
  } catch (error) {
    logger.logError('WebSocket 메시지 전송 실패', error, { roomId });
  }
};

/**
 * SSE로 그룹 채팅 응답 전송
 * (Redis Pub/Sub을 통해 SSE 클라이언트에 전달)
 */
const sendToSSE = async (responseChannel, messageData) => {
  try {
    await redisClient.publish(responseChannel, JSON.stringify(messageData));
    
    logger.logInfo('SSE로 메시지 전송', {
      responseChannel,
      messageType: messageData.type || 'message',
    });
  } catch (error) {
    logger.logError('SSE 메시지 전송 실패', error, { responseChannel });
  }
};

/**
 * 사용자 온라인 상태 확인
 */
const isUserOnline = async (userId, roomId) => {
  try {
    // Redis에서 사용자 온라인 상태 확인
    const onlineKey = `user:${userId}:online`;
    const roomKey = `room:${roomId}:users`;
    
    const [isOnline, isInRoom] = await Promise.all([
      redisClient.exists(onlineKey),
      redisClient.sIsMember(roomKey, userId),
    ]);
    
    return isOnline && isInRoom;
  } catch (error) {
    logger.logError('사용자 온라인 상태 확인 실패', error, { userId, roomId });
    return false;
  }
};

/**
 * AI 채팅 처리 작업 함수
 */
const processAiChatJob = async (job) => {
  const { 
    roomId, 
    message, 
    senderId, 
    userName,
    isGroupChat = false,
    responseChannel = null
  } = job.data;

  // senderId를 userId로 사용
  const userId = senderId;

  console.log('🟢 [WORKER] AI 채팅 작업 처리 시작:', {
    jobId: job.id,
    roomId,
    userId,
    userName,
    isGroupChat,
    responseChannel,
    messagePreview: message.substring(0, 50) + '...',
    timestamp: new Date().toISOString()
  });

  logger.logInfo('AI 채팅 작업 처리 시작', {
    jobId: job.id,
    roomId,
    userId,
    message: message.substring(0, 50) + '...',
  });

  // 1. 채팅방 정보 및 AI 참여자 조회
  console.log('🔍 [WORKER] 채팅방 정보 조회 중...', { roomId });
  
  const chatRoom = await prismaConfig.prisma.chatRoom.findUnique({
    where: { id: parseInt(roomId, 10) },
    include: { persona: true },
  });

  if (!chatRoom) {
    console.error('❌ [WORKER] 채팅방을 찾을 수 없음:', { roomId });
    throw new Error(`채팅방 ${roomId}를 찾을 수 없습니다.`);
  }

  // 새로운 스키마: ChatRoom이 직접 persona를 가짐
  const aiParticipants = chatRoom.persona ? [{
    personaId: chatRoom.personaId,
    persona: chatRoom.persona
  }] : [];
  const isOneOnOne = aiParticipants.length === 1;

  console.log('✅ [WORKER] AI 참여자 조회 완료:', {
    aiParticipantsCount: aiParticipants.length,
    isOneOnOne,
    aiParticipants: aiParticipants.map(p => ({ id: p.persona.id, name: p.persona.name }))
  });

  logger.logInfo('AI 참여자 조회 완료', {
    aiParticipantsCount: aiParticipants.length,
    isOneOnOne,
    aiParticipants: aiParticipants.map(p => ({ id: p.persona.id, name: p.persona.name }))
  });

  // 2. 최근 채팅 기록 조회
  console.log('📝 [WORKER] 채팅 기록 조회 중...', { roomId });
  
  const recentLogs = await prismaConfig.prisma.chatLog.findMany({
    where: { chatroomId: chatRoom.id, isDeleted: false },
    orderBy: { time: 'desc' },
    take: 10,
    select: { text: true, senderType: true, senderId: true, time: true }
  });

  // 3. 대화 기록을 문자열로 변환
  const chatHistory = recentLogs
    .reverse()
    .map(log => {
      if (log.senderType === 'user') {
        return `${userName || '사용자'}: ${log.text}`;
      } else {
        const aiParticipant = aiParticipants.find(p => p.persona.id === parseInt(log.senderId));
        const aiName = aiParticipant ? aiParticipant.persona.name : `AI(${log.senderId})`;
        return `${aiName}: ${log.text}`;
      }
    })
    .join('\n');

  // 4. 첫 번째 메시지인지 확인
  const userMessageCount = recentLogs.filter(log => log.senderType === 'user').length;
  const aiMessageCount = recentLogs.filter(log => log.senderType === 'ai').length;
  const isFirstMessage = userMessageCount <= 1 && aiMessageCount === 0;

  console.log('📊 [WORKER] 채팅 기록 분석 완료:', {
    totalLogs: recentLogs.length,
    userMessageCount,
    aiMessageCount,
    isFirstMessage,
    chatHistoryLength: chatHistory.length
  });

  logger.logInfo('채팅 기록 분석 완료', {
    totalLogs: recentLogs.length,
    userMessageCount,
    aiMessageCount,
    isFirstMessage,
    chatHistoryLength: chatHistory.length
  });

  try {
    // 1. 사용자 온라인 상태 확인
    console.log('👤 [WORKER] 사용자 온라인 상태 확인 중...', { userId, roomId });
    
    const userOnline = await isUserOnline(userId, roomId);
    
    console.log('✅ [WORKER] 사용자 온라인 상태 확인 완료:', { userId, roomId, userOnline });
    
    logger.logInfo('사용자 온라인 상태', { userId, roomId, userOnline });

    // 2. AI 응답 생성 (캐시 우선 확인)
    console.log('🤖 [WORKER] AI 응답 생성 시작...', {
      isOneOnOne,
      aiParticipantsCount: aiParticipants.length,
      isFirstMessage
    });
    
    let aiResponses;
    if (isOneOnOne) {
      // 1대1 채팅: 단일 AI 응답
      const participant = aiParticipants[0];
      const persona = participant.persona; // 실제 persona 객체
      
      console.log('🔍 [WORKER] 1대1 채팅 - 캐시 확인 중...', { personaId: persona.id });
      
      // 캐시에서 AI 응답 확인
      const cachedResponse = await AiResponseCache.get(
        persona.id, 
        message, 
        chatHistory.substring(0, 200) // 맥락 요약
      );
      
      let response;
      if (cachedResponse) {
        response = cachedResponse.response;
        console.log('💾 [WORKER] AI 응답 캐시 히트:', { personaId: persona.id });
        logger.logInfo('AI 응답 캐시 사용됨', {
          personaId: persona.id,
          cached: true
        });
      } else {
        // 캐시 미스 - AI API 호출
        console.log('🔗 [WORKER] 캐시 미스 - AI API 호출 중...', { personaId: persona.id });
        
        response = await chatService.generateAiChatResponse(
          message,
          persona,
          chatHistory,
          [], // otherParticipants: 1대1 채팅에서는 빈 배열
          userName
        );
        
        console.log('✅ [WORKER] AI API 호출 완료:', { personaId: persona.id, responseLength: response.length });
        
        // 응답을 캐시에 저장
        await AiResponseCache.set(
          persona.id,
          message,
          response,
          chatHistory.substring(0, 200),
          3600 // 1시간 TTL
        );
        
        console.log('💾 [WORKER] AI 응답 캐시 저장 완료:', { personaId: persona.id });
      }
      
      aiResponses = [{
        content: response,
        personaId: persona.id,
        personaName: persona.name,
      }];
    } else {
      // 그룹 채팅: 다중 AI 응답 (각각 캐시 확인)
      console.log('👥 [WORKER] 그룹 채팅 - 다중 AI 응답 생성 중...', { participantCount: aiParticipants.length });
      
      const responsePromises = aiParticipants.map(async (participant) => {
        const persona = participant.persona; // 실제 persona 객체
        console.log(`🔍 [WORKER] 그룹 - AI ${persona.id} 캐시 확인 중...`);
        
        // 각 캐릭터별로 캐시 확인
        const cachedResponse = await AiResponseCache.get(
          persona.id,
          message,
          chatHistory.substring(0, 200)
        );
        
        let response;
        if (cachedResponse) {
          response = cachedResponse.response;
          console.log(`💾 [WORKER] 그룹 - AI ${persona.id} 캐시 히트`);
          logger.logInfo('AI 응답 캐시 사용됨 (그룹)', {
            personaId: persona.id,
            cached: true
          });
        } else {
          // 개별 AI 응답 생성
          console.log(`🔗 [WORKER] 그룹 - AI ${persona.id} API 호출 중...`);
          
          // 현재 AI를 제외한 다른 참여자들의 persona 정보
          const otherParticipants = aiParticipants
            .filter(p => p.persona.id !== persona.id)
            .map(p => p.persona);
          
          response = await chatService.generateAiChatResponse(
            message,
            persona,
            chatHistory,
            otherParticipants, // 다른 AI 참여자들의 persona
            userName
          );
          
          console.log(`✅ [WORKER] 그룹 - AI ${persona.id} API 호출 완료:`, { responseLength: response.length });
          
          // 캐시에 저장
          await AiResponseCache.set(
            persona.id,
            message,
            response,
            chatHistory.substring(0, 200),
            3600
          );
          
          console.log(`💾 [WORKER] 그룹 - AI ${persona.id} 캐시 저장 완료`);
        }
        
        return {
          content: response,
          personaId: persona.id,
          personaName: persona.name,
        };
      });
      
      aiResponses = await Promise.all(responsePromises);
    }

    console.log('🎉 [WORKER] AI 응답 생성 완료:', {
      jobId: job.id,
      roomId,
      responseCount: aiResponses.length,
      responseLengths: aiResponses.map(r => r.content.length)
    });

    logger.logInfo('AI 응답 생성 완료', {
      jobId: job.id,
      roomId,
      responseCount: aiResponses.length,
    });

    // 3. 응답을 DB에 저장하고 실시간 전송
    console.log('💾 [WORKER] DB 저장 및 실시간 전송 시작...', { responseCount: aiResponses.length });
    const saveAndSendPromises = aiResponses.map(async (response, index) => {
      console.log(`💾 [WORKER] AI 응답 ${index + 1}/${aiResponses.length} DB 저장 시작:`, { 
        personaId: response.personaId,
        personaName: response.personaName,
        responseLength: response.content.length
      });
      
      // 3-1. DB 저장
      const savedMessage = await prismaConfig.prisma.chatLog.create({
        data: {
          chatroomId: parseInt(roomId, 10),
          text: response.content,
          type: 'text',
          senderType: 'ai',
          senderId: String(response.personaId),
          time: new Date(),
        },
      });

      console.log(`✅ [WORKER] AI 응답 ${index + 1} DB 저장 완료:`, { 
        chatLogId: savedMessage.id,
        personaId: response.personaId
      });

      // 3-2. 결과를 Redis에 임시 저장 (오프라인 사용자용)
      const cacheKey = `ai-response:${roomId}:${userId}:${Date.now()}-${index}`;
      const messageData = {
        message: response.content,
        senderType: 'ai',
        senderId: String(response.personaId),
        aiName: response.personaName,
        aiId: String(response.personaId),
        timestamp: new Date().toISOString(),
      };
      
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(messageData));

      console.log(`💾 [WORKER] AI 응답 ${index + 1} Redis 캐시 저장 완료:`, { cacheKey });

      // 3-3. 실시간 전송 (그룹 채팅 SSE vs WebSocket 방식 구분)
      // SSE 연결이 있으면 항상 전송 (온라인 체크 제거)
      console.log(`📡 [WORKER] AI 응답 ${index + 1} 실시간 전송 시작:`, { 
        isGroupChat, 
        responseChannel: responseChannel || 'N/A'
      });
      
      if (isGroupChat && responseChannel) {
        // 그룹 채팅 SSE 방식: Redis Pub/Sub으로 SSE 클라이언트에 전송
        console.log(`📤 [WORKER] SSE 전송 중:`, { responseChannel, personaId: response.personaId });
        
        const sseMessage = {
          type: 'ai_response',
          content: response.content,
          aiName: response.personaName,
          aiId: String(response.personaId),
          personaId: response.personaId,
          timestamp: new Date().toISOString(),
        };
        
        console.log(`🔥 [WORKER] SSE 메시지 전송 시도:`, { 
          responseChannel, 
          messageType: sseMessage.type,
          contentLength: sseMessage.content.length,
          aiName: sseMessage.aiName
        });
        
        await sendToSSE(responseChannel, sseMessage);
        
        console.log(`✅ [WORKER] SSE 메시지 전송 완료:`, { responseChannel, personaId: response.personaId });
      } else {
        // 기존 WebSocket 방식 (1대1 채팅이나 기존 그룹 채팅)
        console.log(`📤 [WORKER] WebSocket 전송 중:`, { roomId, personaId: response.personaId });
        
        await sendToWebSocket(roomId, {
          type: 'ai_response',
          content: response.content,
          aiName: response.personaName,
          aiId: String(response.personaId),
          personaId: response.personaId,
          timestamp: new Date().toISOString(),
        });
        
        console.log(`✅ [WORKER] WebSocket 전송 완료:`, { roomId, personaId: response.personaId });
      }

      return savedMessage;
    });

    await Promise.all(saveAndSendPromises);

    console.log('🎯 [WORKER] 모든 AI 응답 저장/전송 완료 - 친밀도 업데이트 시작...', { 
      responseCount: aiResponses.length 
    });

    // 4. 친밀도 업데이트
    const friendshipPromises = aiResponses.map(async (response) => {
      try {
        console.log(`💖 [WORKER] 친밀도 업데이트 시작:`, { 
          personaId: response.personaId,
          personaName: response.personaName 
        });
        
        const expIncrease = Math.max(1, Math.floor(response.content.length / 10));
        
        const aiCharacter = await prismaConfig.prisma.persona.findUnique({
          where: { id: response.personaId },
          select: { clerkId: true, name: true },
        });

        if (aiCharacter) {
          console.log(`🔍 [WORKER] AI 캐릭터 정보 조회 완료:`, { 
            personaId: response.personaId,
            clerkId: aiCharacter.clerkId,
            expIncrease
          });
          
          const friendshipResult = await chatService.increaseFriendship(
            aiCharacter.clerkId,
            response.personaId,
            expIncrease
          );

          console.log(`✅ [WORKER] 친밀도 업데이트 완료:`, { 
            personaId: response.personaId,
            newExp: friendshipResult?.exp,
            newLevel: friendshipResult?.friendship,
            expIncrease
          });

          if (friendshipResult && userOnline) {
            console.log(`📤 [WORKER] 친밀도 업데이트 실시간 전송 시작:`, { 
              personaId: response.personaId 
            });
            
            const expUpdateData = {
              type: 'exp_updated',
              roomId,
              personaId: response.personaId,
              personaName: response.personaName,
              newExp: friendshipResult.exp,
              newLevel: friendshipResult.friendship,
              expIncrease,
              userId: aiCharacter.clerkId,
            };

            if (isGroupChat && responseChannel) {
              // 그룹 채팅 SSE 방식: Redis Pub/Sub으로 SSE 클라이언트에 전송
              console.log(`📤 [WORKER] 친밀도 SSE 전송 중:`, { 
                responseChannel, 
                personaId: response.personaId 
              });
              
              await sendToSSE(responseChannel, expUpdateData);
              
              console.log(`✅ [WORKER] 친밀도 SSE 전송 완료:`, { 
                responseChannel, 
                personaId: response.personaId 
              });
            } else {
              // 기존 WebSocket 방식
              console.log(`📤 [WORKER] 친밀도 WebSocket 전송 중:`, { 
                roomId, 
                personaId: response.personaId 
              });
              
              await sendToWebSocket(roomId, {
                type: 'expUpdated',
                ...expUpdateData,
              });
              
              console.log(`✅ [WORKER] 친밀도 WebSocket 전송 완료:`, { 
                roomId, 
                personaId: response.personaId 
              });
            }
          }
        } else {
          console.warn(`⚠️ [WORKER] AI 캐릭터를 찾을 수 없음:`, { personaId: response.personaId });
        }
      } catch (error) {
        console.error(`❌ [WORKER] 친밀도 업데이트 실패:`, { 
          personaId: response.personaId,
          error: error.message 
        });
        
        logger.logError('친밀도 업데이트 실패', error, {
          personaId: response.personaId,
        });
      }
    });

    await Promise.all(friendshipPromises);

    console.log('💖 [WORKER] 모든 친밀도 업데이트 완료');

    // 4. 그룹 채팅 SSE의 경우 완료 신호 전송
    if (isGroupChat && responseChannel && userOnline) {
      console.log('🏁 [WORKER] 그룹 채팅 완료 신호 전송 중...', { responseChannel });
      
      await sendToSSE(responseChannel, {
        type: 'complete',
        message: '모든 AI 응답이 완료되었습니다.',
        timestamp: new Date().toISOString(),
      });
      
      console.log('✅ [WORKER] 그룹 채팅 완료 신호 전송 완료', { responseChannel });
    }

    console.log('🎉 [WORKER] AI 채팅 작업 모든 처리 완료:', {
      jobId: job.id,
      roomId,
      userId,
      processedResponses: aiResponses.length,
      isGroupChat,
      responseChannel,
      userOnline,
      timestamp: new Date().toISOString()
    });

    logger.logInfo('AI 채팅 작업 완료', {
      jobId: job.id,
      roomId,
      userId,
      processedResponses: aiResponses.length,
      isGroupChat,
      responseChannel,
    });

    return {
      success: true,
      responsesCount: aiResponses.length,
      userOnline,
      isGroupChat,
    };

  } catch (error) {
    logger.logError('AI 채팅 작업 처리 실패', error, {
      jobId: job.id,
      roomId,
      userId,
    });
    throw error;
  }
};

// AI 채팅 워커 생성
const aiChatWorker = new Worker(
  'ai-chat-processing',
  processAiChatJob,
  {
    connection: redisConnection,
    concurrency: parseInt(process.env.AI_WORKER_CONCURRENCY || '3'), // 동시 처리 작업 수
    limiter: {
      max: 10,    // 최대 10개 작업
      duration: 60000, // 1분 동안
    },
  }
);

// 워커 이벤트 리스너
aiChatWorker.on('ready', () => {
  console.log('🤖 [WORKER] AI 채팅 워커 준비 완료:', {
    concurrency: parseInt(process.env.AI_WORKER_CONCURRENCY || '3'),
    timestamp: new Date().toISOString()
  });
  logger.logInfo('AI 채팅 워커 시작됨');
});

aiChatWorker.on('active', (job) => {
  console.log('🚀 [WORKER] AI 채팅 작업 활성화:', {
    jobId: job.id,
    roomId: job.data.roomId,
    userId: job.data.senderId,
    isGroupChat: job.data.isGroupChat,
    timestamp: new Date().toISOString()
  });
  
  logger.logInfo('AI 채팅 작업 시작', {
    jobId: job.id,
    roomId: job.data.roomId,
  });
});

aiChatWorker.on('completed', (job, result) => {
  console.log('🎉 [WORKER] AI 채팅 작업 완료:', {
    jobId: job.id,
    roomId: job.data.roomId,
    userId: job.data.senderId,
    responsesCount: result?.responsesCount,
    userOnline: result?.userOnline,
    isGroupChat: result?.isGroupChat,
    duration: job.finishedOn - job.processedOn,
    timestamp: new Date().toISOString()
  });
  
  logger.logInfo('AI 채팅 작업 완료', {
    jobId: job.id,
    roomId: job.data.roomId,
    result,
  });
});

aiChatWorker.on('failed', (job, err) => {
  console.error('❌ [WORKER] AI 채팅 작업 실패:', {
    jobId: job?.id,
    roomId: job?.data?.roomId,
    userId: job?.data?.senderId,
    attempts: job?.attemptsMade,
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  
  logger.logError('AI 채팅 작업 실패', err, {
    jobId: job?.id,
    roomId: job?.data?.roomId,
  });
});

aiChatWorker.on('error', (err) => {
  console.error('💥 [WORKER] AI 채팅 워커 에러:', {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  
  logger.logError('AI 채팅 워커 에러', err);
});

aiChatWorker.on('stalled', (jobId) => {
  console.warn('⚠️ [WORKER] AI 채팅 작업 지연됨:', {
    jobId,
    timestamp: new Date().toISOString()
  });
});

export default aiChatWorker; 