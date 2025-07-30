/**
 * 비즈니스 로직 헬퍼 함수들
 */

import { calculateExp } from './expCalculator.js';
import { sendSSEExpUpdate, sendFriendshipUpdateEvent } from './chatHelpers.js';
import logger from './logger.js';

/**
 * 친밀도 업데이트 전체 처리 공통 함수
 */
export const handleCompleteFriendshipUpdate = async (req, res, {
  userId,
  personaId,
  personaName,
  userMessage,
  roomId
}) => {
  try {
    const { default: chatService } = await import('../services/chatService.js');
    
    // 경험치 계산
    const expIncrease = calculateExp(userMessage);
    
    // 친밀도 증가
    const friendshipResult = await chatService.increaseFriendship(userId, personaId, expIncrease);
    
    if (friendshipResult) {
      // SSE로 친밀도 업데이트 전송
      if (res) {
        sendSSEExpUpdate(res, {
          personaId,
          personaName,
          newExp: friendshipResult.exp,
          newLevel: friendshipResult.friendship,
          expIncrease,
          userId
        });
      }
      
      // WebSocket 이벤트 전송
      sendFriendshipUpdateEvent(req, {
        roomId,
        personaId,
        personaName,
        newExp: friendshipResult.exp,
        newLevel: friendshipResult.friendship,
        expIncrease,
        userId
      });
    }
    
    return friendshipResult;
  } catch (error) {
    logger.logError('친밀도 업데이트 실패', error, { userId, personaId, roomId });
    throw error;
  }
};

/**
 * 단체 채팅 친밀도 업데이트 처리 공통 함수
 */
export const handleGroupChatFriendshipUpdates = async (req, {
  userId,
  message,
  roomId,
  aiResponses
}) => {
  try {
    const { default: chatService } = await import('../services/chatService.js');
    
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
        newExp,
        newLevel,
        expIncrease,
        userId
      });
    }
  } catch (error) {
    logger.logError('단체 채팅 친밀도 업데이트 실패', error, { userId, roomId });
    throw error;
  }
};

/**
 * AI 응답 생성 및 저장 공통 함수
 */
export const generateAndSaveAiResponse = async ({
  userMessage,
  personaInfo,
  chatHistory,
  isFirstMessage,
  userName,
  roomId
}) => {
  try {
    const { default: chatService } = await import('../services/chatService.js');
    const { saveChatMessage } = await import('./chatHelpers.js');
    
    console.log('🤖 AI 응답 생성 시작');
    
    // AI 응답 생성
    const aiResponseText = await chatService.generateAiChatResponseOneOnOne(
      userMessage,
      personaInfo,
      chatHistory,
      isFirstMessage,
      userName
    );
    
    // AI 응답 저장
    const savedMessage = await saveChatMessage({
      roomId,
      text: aiResponseText,
      senderType: 'ai',
      senderId: personaInfo.id
    });
    
    console.log('✅ AI 응답 생성 및 저장 완료');
    
    return {
      content: aiResponseText,
      savedMessage
    };
  } catch (error) {
    logger.logError('AI 응답 생성 및 저장 실패', error, { roomId, personaId: personaInfo.id });
    throw error;
  }
};

/**
 * 그룹 채팅 AI 응답 생성 및 저장 공통 함수
 */
export const generateAndSaveGroupAiResponses = async ({
  message,
  allPersonas,
  chatHistory,
  isFirstMessage,
  roomId,
  userName = '사용자'
}) => {
  try {
    const { default: chatService } = await import('../services/chatService.js');
    const { saveChatMessage } = await import('./chatHelpers.js');
    
    console.log('💬 단체 채팅 AI 응답 생성 시작');

    // 모든 AI 응답 생성
    const aiResponses = await chatService.generateAiChatResponseGroup(
      message,
      allPersonas,
      chatHistory,
      isFirstMessage,
      userName
    );

    console.log('✅ 단체 채팅 AI 응답 생성 완료:', aiResponses.length, '개의 응답');

    // 각 AI 응답을 DB에 저장
    for (const response of aiResponses) {
      await saveChatMessage({
        roomId,
        text: response.content,
        senderType: 'ai',
        senderId: response.personaId
      });
    }
    
    return aiResponses;
  } catch (error) {
    logger.logError('그룹 AI 응답 생성 및 저장 실패', error, { roomId });
    throw error;
  }
}; 