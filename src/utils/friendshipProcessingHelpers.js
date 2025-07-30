/**
 * 친밀도 처리 통합 헬퍼 함수들
 */

import { calculateExp } from './expCalculator.js';
import { sendSSEExpUpdate, sendFriendshipUpdateEvent } from './chatHelpers.js';
import { logSuccess, logError } from './loggingHelpers.js';

/**
 * 완전한 친밀도 업데이트 플로우 (SSE + WebSocket)
 */
export const processCompleteFriendshipUpdate = async (req, res, {
  userId,
  personaId,
  personaName,
  userMessage,
  roomId
}) => {
  try {
    const { default: chatService } = await import('../services/chatService.js');
    
    // 1. 경험치 계산
    const expIncrease = calculateExp(userMessage);
    
    // 2. 친밀도 증가
    const friendshipResult = await chatService.increaseFriendship(userId, personaId, expIncrease);
    
    if (friendshipResult) {
      // 3. SSE로 친밀도 업데이트 전송 (있는 경우)
      if (res) {
        sendSSEExpUpdate(res, {
          personaId,
          personaName,
          newExp: friendshipResult.exp,
          newLevel: friendshipResult.friendship,
          expIncrease,
          userId
        });
        logSuccess('친밀도 업데이트 SSE 전송 완료');
      }
      
      // 4. WebSocket 이벤트 전송
      sendFriendshipUpdateEvent(req, {
        roomId,
        personaId,
        personaName,
        newExp: friendshipResult.exp,
        newLevel: friendshipResult.friendship,
        expIncrease,
        userId
      });
      
      logSuccess(`친밀도 업데이트 완료: ${personaName} +${expIncrease} (총: ${friendshipResult.exp}, 레벨: ${friendshipResult.friendship})`);
    }
    
    return friendshipResult;
    
  } catch (error) {
    logError('친밀도 업데이트 실패', error);
    throw error;
  }
};

/**
 * 단체 채팅 다중 친밀도 업데이트 플로우
 */
export const processGroupChatFriendshipUpdates = async (req, {
  userId,
  message,
  roomId,
  aiResponses
}) => {
  try {
    const { default: chatService } = await import('../services/chatService.js');
    
    const expIncrease = calculateExp(message);
    logSuccess(`단체 채팅 경험치 계산: 메시지 "${message}" -> +${expIncrease}점`);

    const results = [];
    
    for (const response of aiResponses) {
      logSuccess(`단체 채팅 ${response.personaName} 친밀도 증가 시도: 경험치 +${expIncrease}`);
      
      // 친밀도 증가
      await chatService.increaseFriendship(userId, response.personaId, expIncrease);

      // 현재 친밀도 정보 조회
      const friendship = await chatService.getFriendship(userId, response.personaId);
      const newExp = friendship.exp;
      const newLevel = friendship.friendship;

      logSuccess(`단체 채팅 AI ${response.personaName} 친밀도 ${expIncrease} 증가. 총 경험치: ${newExp}, 레벨: ${newLevel}`);

      // WebSocket으로 친밀도 업데이트 정보 전송
      sendFriendshipUpdateEvent(req, {
        roomId,
        personaId: response.personaId,
        personaName: response.personaName,
        newExp,
        newLevel,
        expIncrease,
        userId
      });
      
      results.push({
        personaId: response.personaId,
        personaName: response.personaName,
        newExp,
        newLevel,
        expIncrease
      });
    }
    
    return results;
    
  } catch (error) {
    logError('단체 채팅 친밀도 업데이트 실패', error);
    throw error;
  }
}; 