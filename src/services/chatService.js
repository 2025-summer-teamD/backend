import prismaConfig from '../config/prisma.js';
import gemini25 from '../vertexai/gemini25.js';

/**
 * 특정 사용자의 채팅 목록을 페이지네이션하여 조회합니다.
 * @param {string} userId - 현재 로그인한 사용자의 Clerk ID
 * @param {object} pagination - 페이지네이션 옵션 { skip, take, page, size }
 * @returns {Promise<object>} { chatList, totalElements, totalPages }
 */
const getMyChatList = async (userId, pagination) => {
  const { skip, take, page, size } = pagination;

  // 1. 내가 참여하고 삭제되지 않은 채팅방의 총 개수를 먼저 구한다.
  const totalElements = await prismaConfig.prisma.chatRoom.count({
    where: {
      clerkId: userId,
      isDeleted: false,
    },
  });

  if (totalElements === 0) {
    return { chatList: [], totalElements: 0, totalPages: 0 };
  }
  
  // 2. 실제 데이터 조회: 관계된 데이터를 한 번의 쿼리로 가져온다.
  const chatRooms = await prismaConfig.prisma.chatRoom.findMany({
    where: {
      clerkId: userId,
      isDeleted: false,
    },
    // 최신 채팅이 위로 오도록 정렬 (LastMessage의 생성 시간 기준)
    orderBy: {
      updatedAt: 'desc', // 채팅방 업데이트 시간을 기준으로 정렬하는 것이 더 효율적일 수 있음
    },
    skip: skip,
    take: take,
    include: {
      // ChatRoom에 연결된 Persona 정보 포함
      persona: {
        select: { // 페르소나에서 필요한 필드만 선택
          id: true,
          name: true,
          imageUrl: true,
        },
      },
      // ChatRoom에 연결된 모든 ChatLog 중 '마지막 1개'만 가져오기
      ChatLogs: {
        orderBy: {
          time: 'desc',
        },
        take: 1, 
        select: {
          text: true,
          time: true,
        },
      },
    },
  });

  // 3. DB에서 가져온 데이터를 최종 API 응답 형태로 가공
  const chatList = chatRooms.map(room => {
    const lastChat = room.ChatLogs.length > 0 ? room.ChatLogs[0] : null;
    return {
      room_id: room.id,
      character_id: room.persona.id,
      name: room.persona.name,
      image_url: room.persona.imageUrl,
      last_chat: lastChat ? lastChat.text : null,
      time: lastChat ? lastChat.time.toISOString() : null, // 실제 시간 데이터 사용
    };
  });

  const totalPages = Math.ceil(totalElements / size);

  return { chatList, totalElements, totalPages };
};

/**
 * 내가 찜한(좋아요한) 캐릭터 삭제 (내 목록에서만 삭제)
 * @param {string} userId - 현재 로그인한 사용자의 Clerk ID
 * @param {number} characterId - 찜한 캐릭터의 persona id
 * @returns {Promise<object>} 삭제된 ChatRoom 객체
 */
const deleteLikedCharacter = async (userId, characterId) => {
  // 1. ChatRoom에서 해당 관계 찾기
  const chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
    where: {
      clerkId: userId,
      characterId: characterId,
      isDeleted: false,
    },
  });
  if (!chatRoom) {
    throw new Error('해당 캐릭터와의 찜(좋아요) 관계가 없거나 이미 삭제되었습니다.');
  }
  // 2. isDeleted true로 변경
  const deleted = await prismaConfig.prisma.chatRoom.update({
    where: { id: chatRoom.id },
    data: { isDeleted: true },
  });
  return deleted;
};

const createChatRoom = async (characterId, userId) => {
  // 1. 기존 채팅방 있는지 확인
  let chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
    where: {
      clerkId: userId,
      characterId: parseInt(characterId, 10),
      isDeleted: false,
    },
  });

  // 2. 없으면 새로 생성
  if (!chatRoom) {
    chatRoom = await prismaConfig.prisma.chatRoom.create({
      data: {
        clerkId: userId,
        characterId: parseInt(characterId, 10),
      },
    });
  }

  return chatRoom;
};


/**
 * AI 캐릭터의 응답을 생성합니다. (DB 연동 없음)
 * 이 함수는 페르소나 정보와 대화 기록을 직접 받아 순수하게 AI 응답만 생성합니다.
 * @param {string} userMessage - 사용자가 보낸 메시지
 * @param {object} personaInfo - 페르소나 정보 { name, personality, tone }
 * @param {string} chatHistory - 이전 대화 기록 (문자열)
 * @returns {Promise<string>} AI가 생성한 응답 메시지
 */
const generateAiChatResponse = async (
  userMessage,
  personaInfo,
  chatHistory,
) => {
  // 1. Gemini AI에 보낼 프롬프트 구성
  const prompt = `
당신은 "${personaInfo.name}"이라는 이름의 AI 캐릭터입니다. 아래 설정에 맞춰서 사용자와 대화해주세요.
- 당신의 성격: ${personaInfo.personality}
- 당신의 말투: ${personaInfo.tone}

---
[최근 대화 기록]
${chatHistory}
---

사용자: ${userMessage}
${personaInfo.name}:`;

  // 2. Gemini AI를 호출하여 응답 생성
  const aiResponseText = await gemini25.generateText(prompt.trim()) || '죄송해요, 지금은 답변을 드릴 수 없어요.';

  // 3. 생성된 AI 응답 텍스트 반환
  return aiResponseText;
};

const chatService = {
  getMyChatList,
  deleteLikedCharacter,
  generateAiChatResponse,
  createChatRoom, // 추가!
};

export default chatService;


