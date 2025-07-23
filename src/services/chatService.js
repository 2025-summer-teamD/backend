import prismaConfig from '../config/prisma.js';
import gemini25 from '../vertexai/gemini25.js';
import veo3 from '../vertexai/veo3.js';
import { Storage } from '@google-cloud/storage';
import { uploadImageToGCS } from './gcsService.js';
import axios from 'axios';

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
      roomId: room.id,
      characterId: room.persona.id,
      name: room.persona.name,
      imageUrl: room.persona.imageUrl,
      lastChat: lastChat ? lastChat.text : null,
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
  // 1. 기존 채팅방 있는지 확인 (캐릭터 정보 포함)
  let chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
    where: {
      clerkId: userId,
      characterId: parseInt(characterId, 10),
      isDeleted: false,
    },
    include: {
      persona: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          introduction: true,
          prompt: true,
          creatorName: true,
          usesCount: true,
          likesCount: true,
        }
      }
    }
  });

  // 2. 없으면 새로 생성
  if (!chatRoom) {
    chatRoom = await prismaConfig.prisma.chatRoom.create({
      data: {
        clerkId: userId,
        characterId: parseInt(characterId, 10),
      },
      include: {
        persona: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            introduction: true,
            prompt: true,
            creatorName: true,
            usesCount: true,
            likesCount: true,
          }
        }
      }
    });
  }

  // 3. 반환 데이터 형식 맞추기
  return {
    id: chatRoom.id,
    clerkId: chatRoom.clerkId,
    characterId: chatRoom.characterId,
    character: chatRoom.persona, // 캐릭터 정보 포함!
    exp: chatRoom.exp,
    friendship: chatRoom.friendship,
    likes: chatRoom.likes,
    isDeleted: chatRoom.isDeleted,
    createdAt: chatRoom.createdAt,
    updatedAt: chatRoom.updatedAt,
  };
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

  // 2. Google AI 호출 (타임아웃 에러 처리 포함)
  let aiResponseText;
  try {
    console.log('🤖 Google AI 호출 시도...');
    aiResponseText = await gemini25.generateText(prompt.trim());
    console.log('✅ Google AI 응답 성공');
  } catch (error) {
    console.error('❌ Google AI 호출 실패:', error.message);
    console.log('🔄 폴백 응답 사용');
    aiResponseText = `안녕하세요! 저는 ${personaInfo.name}입니다. 현재 AI 서버가 일시적으로 불안정해요. 잠시 후 다시 시도해주세요! 😊`;
  }
  
  // 응답이 없으면 기본 메시지
  if (!aiResponseText || aiResponseText.trim() === '') {
    aiResponseText = `안녕하세요! 저는 ${personaInfo.name}입니다. 어떤 이야기를 나누고 싶으신가요? 😊`;
  }

  // 3. 생성된 AI 응답 텍스트 반환
  return aiResponseText;
};

/**
 * 채팅방 삭제 (소프트 삭제)
 * @param {number} roomId - 삭제할 채팅방 ID
 * @param {string} userId - 요청자 Clerk ID (권한 확인용)
 * @returns {Promise<object>} 삭제된 채팅방 객체
 */
const deleteChatRoom = async (roomId, userId) => {
  // 1. 본인 소유 채팅방인지 확인
  const chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
    where: { 
      id: parseInt(roomId, 10),
      clerkId: userId,  // 🔒 사용자별 권한 확인!
      isDeleted: false 
    },
  });
  
  if (!chatRoom) {
    throw new Error('삭제 권한이 없거나 존재하지 않는 채팅방입니다.');
  }
  
  // 2. 채팅방을 소프트 삭제
  const deleted = await prismaConfig.prisma.chatRoom.update({
    where: { id: chatRoom.id },
    data: { isDeleted: true },
  });
  
  // 3. 관련 채팅 로그도 소프트 삭제
  await prismaConfig.prisma.chatLog.updateMany({
    where: { chatroomId: chatRoom.id },
    data: { isDeleted: true },
  });
  
  return deleted;
};
/**
 * Veo3 프롬프트 템플릿 생성 함수
 */
function makeVeo3Prompt({ subject, style, mood, action, duration, language = '한국어' }) {
  return `
${language}로 아래 조건에 맞는 짧은 영상을 만들어 주세요.

- 주제: ${subject}
- 스타일: ${style}
- 분위기: ${mood}
- 주요 동작/이벤트: ${action}
- 영상 길이: 약 ${duration}

영상은 시각적으로 매력적이고, ${subject}의 특징이 잘 드러나게 해주세요.
`;
}

/**
 * Veo3를 이용해 비디오 생성 요청을 보냅니다.
 * @param {object} options - 프롬프트 옵션 { subject, style, mood, action, duration, language }
 * @returns {Promise<object>} 생성된 비디오 정보
 */
const generateVideoWithVeo3 = async (options) => {
  try {
    const prompt = makeVeo3Prompt(options);
    const videoResult = await veo3.generateVideo(prompt);
    return videoResult;
  } catch (error) {
    throw new Error(error.message || 'Veo3 비디오 생성 중 오류가 발생했습니다.');
  }
};

/**
 * 비디오 파일을 GCS에 업로드합니다.
 * @param {object} videoReward - veo3에서 반환된 비디오 정보 (url, base64, blob 등)
 * @returns {Promise<string>} 업로드된 GCS URL
 */
async function uploadVideoToGCS(videoReward) {
  // 1. videoReward가 URL을 포함하는 경우 (예: videoReward.url)
  if (videoReward.url) {
    // URL에서 파일 다운로드
    const response = await axios.get(videoReward.url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    const file = {
      originalname: `veo3-video-${Date.now()}.mp4`,
      mimetype: 'video/mp4',
      buffer,
    };
    return await uploadImageToGCS(file);
  }
  // 2. base64 등 다른 형태라면 (예시)
  if (videoReward.base64) {
    const buffer = Buffer.from(videoReward.base64, 'base64');
    const file = {
      originalname: `veo3-video-${Date.now()}.mp4`,
      mimetype: 'video/mp4',
      buffer,
    };
    return await uploadImageToGCS(file);
  }
  throw new Error('지원하지 않는 비디오 반환 형식입니다.');
}

/**
 * 채팅방 exp가 일정 횟수를 넘으면 영상 생성 보상을 제공
 * @param {number} chatRoomId - 채팅방 ID
 * @param {object} veoPromptOptions - Veo3 프롬프트 옵션 { subject, style, mood, action, duration, language }
 * @returns {Promise<object|null>} 생성된 비디오 정보 또는 null
 */
const checkAndGenerateVideoReward = async (chatRoomId, veoPromptOptions) => {
  // 1. 채팅방 exp 조회
  const chatRoom = await prismaConfig.prisma.chatRoom.findUnique({
    where: { id: chatRoomId },
    select: { exp: true }
  });
  if (!chatRoom) throw new Error('존재하지 않는 채팅방입니다.');

  // 2. exp가 일정 횟수 초과면 영상 생성
  if (chatRoom.exp > 1) {
    const videoReward = await generateVideoWithVeo3(veoPromptOptions);
    // GCS 업로드
    const gcsUrl = await uploadVideoToGCS(videoReward);
    return { gcsUrl };
  }
  // 3. 조건 미달 시 null 반환
  return null;
};


const chatService = {
  getMyChatList,
  deleteLikedCharacter,
  generateAiChatResponse,
  createChatRoom,
  deleteChatRoom, 
  generateVideoWithVeo3,
  checkAndGenerateVideoReward,
};

export default chatService;


