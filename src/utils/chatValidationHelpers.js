/**
 * 채팅 검증 헬퍼 함수들
 */

import { logError, logSuccess } from './loggingHelpers.js';
import { 
  validateChatInput, 
  validateChatRoomParticipant, 
  getChatRoomWithParticipants, 
  findAiParticipants 
} from './chatHelpers.js';
import responseHandler from './responseHandler.js';

/**
 * 완전한 채팅 입력 검증 및 채팅방 검증 공통 함수
 */
export const validateCompleteChat = async ({ 
  message, 
  sender, 
  userName, 
  roomId, 
  userId, 
  res 
}) => {
  // 1. 입력 검증
  const inputValidation = validateChatInput({ message, sender, userName });
  if (!inputValidation.isValid) {
    logError('입력 검증 실패', { message: !!message, sender: !!sender, userName: !!userName });
    if (res) responseHandler.sendBadRequest(res, inputValidation.error);
    return { isValid: false, error: inputValidation.error };
  }

  // 2. 사용자 인증 확인
  if (!userId) {
    logError('사용자 인증 실패');
    if (res) responseHandler.sendUnauthorized(res, '사용자 인증이 필요합니다.');
    return { isValid: false, error: '사용자 인증이 필요합니다.' };
  }

  // 3. 채팅방 참여 권한 확인
  try {
    await validateChatRoomParticipant(roomId, userId);
  } catch (error) {
    logError('채팅방 참여 권한 없음', { roomId, userId });
    if (res) responseHandler.sendNotFound(res, error.message);
    return { isValid: false, error: error.message };
  }

  return { isValid: true };
};

/**
 * 채팅방 정보 조회 및 AI 참여자 검증 공통 함수
 */
export const validateChatRoomAndAI = async ({ roomId, userId, isGroupChat = false, res }) => {
  // 1. 채팅방 정보 조회
  const chatRoom = await getChatRoomWithParticipants(roomId, { includeChatLogs: !isGroupChat });
  if (!chatRoom) {
    logError('채팅방 없음', { roomId });
    if (res) responseHandler.sendNotFound(res, `채팅방 ID ${roomId}를 찾을 수 없습니다.`);
    return { isValid: false, error: '채팅방을 찾을 수 없습니다.' };
  }

  // 2. AI 참여자 확인
  const aiParticipants = findAiParticipants(chatRoom.participants, userId);
  if (aiParticipants.length === 0) {
    const errorMsg = isGroupChat 
      ? '이 채팅방에는 AI 참여자가 없습니다.' 
      : 'AI 캐릭터를 찾을 수 없습니다.';
    logError('AI 참여자 없음', { roomId });
    if (res) responseHandler.sendBadRequest(res, errorMsg);
    return { isValid: false, error: errorMsg };
  }

  logSuccess(`${isGroupChat ? '그룹' : '1대1'} 채팅방 검증 완료`, { 
    roomId, 
    aiParticipantsCount: aiParticipants.length 
  });

  return { 
    isValid: true, 
    chatRoom, 
    aiParticipants 
  };
};

/**
 * 채팅방 타입 검증 공통 함수
 */
export const validateChatRoomType = async ({ roomId, expectedType, res }) => {
  const { isOneOnOneChat } = await import('./chatTypeUtils.js');
  const isOneOnOne = await isOneOnOneChat(roomId);
  
  if (expectedType === 'oneOnOne' && !isOneOnOne) {
    logError('1대1 채팅방에서 그룹 SSE 호출', { roomId });
    if (res) responseHandler.sendBadRequest(res, '이 채팅방은 그룹 채팅방입니다. 1대1 채팅 전용 엔드포인트입니다.');
    return { isValid: false, error: '채팅방 타입이 맞지 않습니다.' };
  }
  
  if (expectedType === 'group' && isOneOnOne) {
    logError('그룹 채팅방에서 1대1 SSE 호출', { roomId });
    if (res) responseHandler.sendBadRequest(res, '이 채팅방은 1대1 채팅방입니다. 그룹 채팅 전용 엔드포인트입니다.');
    return { isValid: false, error: '채팅방 타입이 맞지 않습니다.' };
  }

  return { isValid: true, isOneOnOne };
}; 