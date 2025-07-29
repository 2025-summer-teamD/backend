/**
 * 메시지 처리 통합 헬퍼 함수들
 */

import { saveChatMessage, sendSSEUserMessage, sendSSEError } from './chatHelpers.js';
import { logSuccess, logError, logUserActivity, logErrorWithContext } from './loggingHelpers.js';

/**
 * 사용자 메시지 저장 + 로깅 + SSE 전송 통합 함수
 */
export const saveAndSendUserMessage = async ({
  roomId,
  message,
  userName,
  userId,
  sender,
  res,
  isGroupChat = false,
  aiParticipantsCount = 0
}) => {
  try {
    // 1. 메시지 저장
    const savedMessage = await saveChatMessage({
      roomId,
      text: message,
      senderType: 'user',
      senderId: userId
    });
    
    logSuccess('사용자 메시지 DB 저장 완료');
    
    // 2. 활동 로깅
    if (isGroupChat) {
      logUserActivity.groupChatMessageSaved(sender, {
        roomId: roomId,
        messageLength: message.length,
        aiParticipantsCount
      });
    } else {
      logUserActivity.chatMessageSaved(sender, {
        roomId: roomId,
        messageLength: message.length
      });
    }
    
    // 3. SSE 전송 (있는 경우)
    if (res) {
      sendSSEUserMessage(res, { message, userName, userId });
      logSuccess('사용자 메시지 SSE 전송 완료');
    }
    
    return { success: true, savedMessage };
    
  } catch (error) {
    logError('사용자 메시지 저장 실패', error);
    
    if (isGroupChat) {
      logErrorWithContext.groupChatUserMessageSaveFailed(error, { roomId });
    } else {
      logErrorWithContext.userMessageSaveFailed(error, { roomId });
    }
    
    if (res) {
      sendSSEError(res, '메시지 저장에 실패했습니다.');
    }
    
    return { success: false, error };
  }
};

/**
 * AI 메시지 저장 + 로깅 통합 함수
 */
export const saveAiMessage = async ({
  roomId,
  message,
  senderId,
  personaName
}) => {
  try {
    const savedMessage = await saveChatMessage({
      roomId,
      text: message,
      senderType: 'ai',
      senderId
    });
    
    logSuccess('AI 응답 DB 저장 완료');
    
    logUserActivity.aiChatMessageSaved({
      roomId: roomId,
      personaName,
      messageLength: message.length
    });
    
    return { success: true, savedMessage };
    
  } catch (error) {
    logError('AI 메시지 저장 실패', error);
    logErrorWithContext.aiMessageSaveFailed(error, { roomId, personaName });
    return { success: false, error };
  }
}; 