/**
 * AI 응답 처리 통합 헬퍼 함수들
 */

import { sendSSETextChunk, sendSSEErrorAndClose } from './chatHelpers.js';
import { logSuccess, logError, logProgress } from './loggingHelpers.js';
import { saveAiMessage } from './messageProcessingHelpers.js';
import { processCompleteFriendshipUpdate } from './friendshipProcessingHelpers.js';

/**
 * 1대1 채팅 AI 응답 완전 처리 (생성 + 전송 + 저장 + 친밀도)
 */
export const processOneOnOneAiResponse = async (req, res, {
  userMessage,
  personaInfo,
  chatHistory,
  isFirstMessage,
  userName,
  roomId,
  userId
}) => {
  try {
    const { default: chatService } = await import('../services/chatService.js');
    
    // 1. AI 응답 생성
    logProgress('AI 응답 생성 시작');
    const aiResponseText = await chatService.generateAiChatResponseOneOnOne(
      userMessage,
      personaInfo,
      chatHistory,
      isFirstMessage,
      userName
    );
    
    // 2. SSE로 응답 전송
    sendSSETextChunk(res, aiResponseText);
    logSuccess('AI 응답 SSE 전송 완료');
    
    // 3. AI 응답 저장
    const saveResult = await saveAiMessage({
      roomId,
      message: aiResponseText,
      senderId: personaInfo.id,
      personaName: personaInfo.name
    });
    
    if (!saveResult.success) {
      logError('AI 메시지 저장 실패, 계속 진행', saveResult.error);
    }
    
    // 4. 친밀도 업데이트
    await processCompleteFriendshipUpdate(req, res, {
      userId,
      personaId: personaInfo.id,
      personaName: personaInfo.name,
      userMessage,
      roomId
    });
    
    return { success: true, content: aiResponseText, savedMessage: saveResult.savedMessage };
    
  } catch (error) {
    logError('AI 응답 생성 실패', error);
    sendSSEErrorAndClose(res, 'AI 응답 생성 중 오류가 발생했습니다.');
    return { success: false, error };
  }
};

/**
 * 그룹 채팅 AI 응답 처리 (생성 + 저장만, SSE는 Redis로)
 */
export const processGroupAiResponses = async ({
  message,
  allPersonas,
  chatHistory,
  isFirstMessage,
  roomId
}) => {
  try {
    const { default: chatService } = await import('../services/chatService.js');
    
    logProgress('단체 채팅 AI 응답 생성 시작');

    // 1. 모든 AI 응답 생성
    const aiResponses = await chatService.generateAiChatResponseGroup(
      message,
      allPersonas,
      chatHistory,
      isFirstMessage
    );

    logSuccess('단체 채팅 AI 응답 생성 완료', { responseCount: aiResponses.length });

    // 2. 각 AI 응답을 DB에 저장
    for (const response of aiResponses) {
      const saveResult = await saveAiMessage({
        roomId,
        message: response.content,
        senderId: response.personaId,
        personaName: response.personaName
      });
      
      if (!saveResult.success) {
        logError(`AI ${response.personaName} 메시지 저장 실패`, saveResult.error);
      }
    }
    
    return { success: true, aiResponses };
    
  } catch (error) {
    logError('그룹 AI 응답 생성 및 저장 실패', error);
    return { success: false, error };
  }
}; 