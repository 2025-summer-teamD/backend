/**
 * BullMQ 기반 큐 서비스
 * 
 * 기능:
 * - AI 채팅 응답 처리 큐
 * - 큐 모니터링 및 관리
 */

import { Queue } from 'bullmq';
import redisClient from '../config/redisClient.js';
import logger from '../utils/logger.js';

// Redis 연결 설정 (BullMQ용)
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
};

// AI 채팅 처리 큐
export const aiChatQueue = new Queue('ai-chat-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100, // 완료된 작업 100개까지 보관
    removeOnFail: 50,      // 실패한 작업 50개까지 보관
    attempts: 3,           // 최대 3번 재시도
    backoff: {
      type: 'exponential',
      delay: 2000,         // 2초부터 시작하여 지수적으로 증가
    },
  },
});

// 푸시 알림 기능 제거됨

/**
 * AI 채팅 응답 처리 작업을 큐에 추가
 * 
 * @param {object} jobData - 작업 데이터
 * @param {string} jobData.roomId - 채팅방 ID
 * @param {string} jobData.message - 사용자 메시지
 * @param {string} jobData.userId - 사용자 ID
 * @param {string} jobData.userName - 사용자 이름
 * @param {Array} jobData.aiParticipants - AI 참여자 목록
 * @param {string} jobData.chatHistory - 채팅 기록
 * @param {boolean} jobData.isFirstMessage - 첫 메시지 여부
 * @param {boolean} jobData.isOneOnOne - 1대1 채팅 여부
 * @returns {Promise<Job>} 생성된 작업
 */
export const addAiChatJob = async (jobData) => {
  try {
    console.log('🟢 [QUEUE] AI 채팅 작업 큐 추가 시작:', {
      roomId: jobData.roomId,
      userId: jobData.senderId,
      userName: jobData.userName,
      isGroupChat: jobData.isGroupChat,
      responseChannel: jobData.responseChannel,
      messageLength: jobData.message?.length
    });

    const job = await aiChatQueue.add('process-ai-response', jobData, {
      priority: jobData.isOneOnOne ? 1 : 5, // 1대1 채팅이 우선순위 높음
      delay: 0, // 즉시 처리
    });

    console.log('✅ [QUEUE] AI 채팅 작업 큐 추가 성공:', {
      jobId: job.id,
      roomId: jobData.roomId,
      userId: jobData.senderId,
      isOneOnOne: jobData.isOneOnOne,
      priority: jobData.isOneOnOne ? 1 : 5,
      queueName: 'ai-chat-processing'
    });

    logger.logInfo('AI 채팅 작업 큐에 추가됨', {
      jobId: job.id,
      roomId: jobData.roomId,
      userId: jobData.userId,
      isOneOnOne: jobData.isOneOnOne,
    });

    return job;
  } catch (error) {
    console.error('❌ [QUEUE] AI 채팅 작업 큐 추가 실패:', {
      error: error.message,
      roomId: jobData.roomId,
      userId: jobData.senderId,
    });
    logger.logError('AI 채팅 작업 큐 추가 실패', error, jobData);
    throw error;
  }
};

/**
 * 푸시 알림 작업을 큐에 추가
 * 
 * @param {object} jobData - 알림 데이터
 * @param {string} jobData.userId - 수신자 사용자 ID
 * @param {string} jobData.title - 알림 제목
 * @param {string} jobData.body - 알림 내용
 * @param {object} jobData.data - 추가 데이터
 * @param {string} jobData.roomId - 채팅방 ID
 * @returns {Promise<Job>} 생성된 작업
 */

/**
 * 사용자의 대기 중인 AI 채팅 작업 취소
 * (사용자가 온라인으로 돌아왔을 때 사용)
 * 
 * @param {string} roomId - 채팅방 ID
 * @param {string} userId - 사용자 ID
 */
export const cancelPendingAiJobs = async (roomId, userId) => {
  try {
    const waitingJobs = await aiChatQueue.getWaiting();
    const cancelPromises = waitingJobs
      .filter(job => 
        job.data.roomId === roomId && 
        job.data.userId === userId
      )
      .map(job => job.remove());

    await Promise.all(cancelPromises);
    
    logger.logInfo('대기 중인 AI 작업 취소됨', {
      roomId,
      userId,
      canceledCount: cancelPromises.length,
    });
  } catch (error) {
    logger.logError('AI 작업 취소 실패', error, { roomId, userId });
  }
};

/**
 * 큐 상태 조회
 * 
 * @returns {Promise<object>} 큐 상태 정보
 */
export const getQueueStats = async () => {
  try {
    const aiChatStats = await aiChatQueue.getJobCounts('waiting', 'active', 'completed', 'failed');

    return {
      aiChat: aiChatStats,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.logError('큐 상태 조회 실패', error);
    throw error;
  }
};

/**
 * 큐 정리 (완료/실패한 작업 제거)
 */
export const cleanQueues = async () => {
  try {
    await Promise.all([
      aiChatQueue.clean(24 * 60 * 60 * 1000, 0, 'completed'), // 24시간 이상 된 완료 작업
      aiChatQueue.clean(24 * 60 * 60 * 1000, 0, 'failed'),    // 24시간 이상 된 실패 작업
    ]);

    logger.logInfo('AI 채팅 큐 정리 완료');
  } catch (error) {
    logger.logError('큐 정리 실패', error);
  }
};

// 큐 이벤트 리스너 설정
aiChatQueue.on('completed', (job) => {
  console.log('🎉 [QUEUE] AI 채팅 작업 완료:', {
    jobId: job.id,
    roomId: job.data.roomId,
    userId: job.data.senderId,
    duration: job.finishedOn - job.processedOn,
    timestamp: new Date().toISOString()
  });
  
  logger.logInfo('AI 채팅 작업 완료', {
    jobId: job.id,
    roomId: job.data.roomId,
    duration: job.finishedOn - job.processedOn,
  });
});

aiChatQueue.on('failed', (job, err) => {
  console.error('❌ [QUEUE] AI 채팅 작업 실패:', {
    jobId: job.id,
    roomId: job.data.roomId,
    userId: job.data.senderId,
    attempts: job.attemptsMade,
    error: err.message,
    timestamp: new Date().toISOString()
  });
  
  logger.logError('AI 채팅 작업 실패', err, {
    jobId: job.id,
    roomId: job.data.roomId,
    attempts: job.attemptsMade,
  });
});

aiChatQueue.on('waiting', (job) => {
  console.log('⏳ [QUEUE] AI 채팅 작업 대기열 추가:', {
    jobId: job.id,
    roomId: job.data.roomId,
    userId: job.data.senderId,
    timestamp: new Date().toISOString()
  });
});

aiChatQueue.on('active', (job) => {
  console.log('🚀 [QUEUE] AI 채팅 작업 처리 시작:', {
    jobId: job.id,
    roomId: job.data.roomId,
    userId: job.data.senderId,
    timestamp: new Date().toISOString()
  });
});

aiChatQueue.on('stalled', (jobId) => {
  console.warn('⚠️ [QUEUE] AI 채팅 작업 지연됨:', {
    jobId,
    timestamp: new Date().toISOString()
  });
});

aiChatQueue.on('error', (err) => {
  console.error('💥 [QUEUE] AI 채팅 큐 에러:', {
    error: err.message,
    timestamp: new Date().toISOString()
  });
});

// 푸시 알림 큐 이벤트 리스너 제거됨

export default {
  aiChatQueue,
  addAiChatJob,
  cancelPendingAiJobs,
  getQueueStats,
  cleanQueues,
}; 