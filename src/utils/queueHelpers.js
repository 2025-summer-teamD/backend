/**
 * BullMQ 작업 처리 헬퍼 함수들
 */

import { addAiChatJob } from '../services/queueService.js';
import { logSuccess, logProgress, logUserActivity, logError, logErrorWithContext } from './loggingHelpers.js';
import { sendSSEErrorAndClose } from './chatHelpers.js';
import logger from './logger.js';

/**
 * 그룹 채팅 BullMQ 작업 생성 및 처리 공통 함수
 */
export const createAndProcessGroupChatJob = async ({
  roomId,
  message,
  senderId,
  userName,
  userId,
  res
}) => {
  const responseChannel = `group-chat-response:${roomId}:${userId}:${Date.now()}`;
  const jobData = {
    roomId,
    message,
    senderId: userId,
    userName,
    isGroupChat: true,
    responseChannel
  };
  
  logProgress('BullMQ 작업 추가 준비', { responseChannel });
  
  try {
    const job = await addAiChatJob(jobData);
    logSuccess('BullMQ 작업 추가 완료', { jobId: job.id });
    
    logUserActivity.groupChatJobQueued(userId, {
      roomId: roomId,
      jobId: job.id,
      responseChannel: responseChannel
    });
    
    return { success: true, responseChannel, jobId: job.id };
    
  } catch (queueError) {
    logError('BullMQ 작업 추가 실패', queueError);
    logErrorWithContext.groupChatQueueFailed(queueError, { roomId: roomId });
    if (res) {
      sendSSEErrorAndClose(res, 'AI 응답 처리 중 오류가 발생했습니다.');
    }
    return { success: false, error: queueError };
  }
};

/**
 * Redis 타임아웃 설정 공통 함수
 */
export const setupGroupChatTimeout = (res, pubSubClient, responseChannel, roomId, userId, timeoutMs = 30000) => {
  return setTimeout(() => {
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
  }, timeoutMs);
}; 