import prismaConfig from '../config/prisma.js';
import gemini25 from '../vertexai/gemini25.js';
import veo3 from '../vertexai/veo3.js';
import { uploadImageToGCS } from './gcsService.js';
import axios from 'axios';

/**
 * 페르소나 정보에서 성격, 말투, 특징을 추출하는 함수
 * @param {object} personaInfo - 페르소나 정보
 * @returns {object} { personality, tone, characteristics }
 */
const extractPersonaDetails = async (personaInfo) => {
  try {
    // prompt 필드가 있고 JSON 형태라면 파싱
    if (personaInfo.prompt && typeof personaInfo.prompt === 'object') {
      return {
        personality: personaInfo.prompt.personality || '친근하고 활발한',
        tone: personaInfo.prompt.tone || '친근하고 자연스러운',
        characteristics: personaInfo.prompt.tag || '친근함,활발함,자연스러움,긍정적'
      };
    }
    
    // prompt가 문자열이거나 없으면 AI로 분석
    const promptText = `
다음 캐릭터의 성격, 말투, 특징을 분석해주세요:

이름: ${personaInfo.name}
소개: ${personaInfo.introduction || ''}

다음 JSON 형식으로 응답해주세요:
{
  "personality": "성격을 자세히 설명",
  "tone": "말투나 유행어",
  "characteristics": "특징을 쉼표로 구분"
}
`;

    const details = await gemini25.generatePersonaDetailsWithGemini(promptText);
    return {
      personality: details.personality || '친근하고 활발한',
      tone: details.tone || '친근하고 자연스러운',
      characteristics: details.characteristics || '친근함,활발함,자연스러움,긍정적'
    };
  } catch (error) {
    console.error('페르소나 상세 정보 추출 실패:', error);
    return {
      personality: '친근하고 활발한',
      tone: '친근하고 자연스러운',
      characteristics: '친근함,활발함,자연스러움,긍정적'
    };
  }
};

/**
 * 특정 사용자의 채팅 목록을 페이지네이션하여 조회합니다.
 * @param {string} userId - 현재 로그인한 사용자의 Clerk ID
 * @param {object} pagination - 페이지네이션 옵션 { skip, take, page, size }
 * @returns {Promise<object>} { chatList, totalElements, totalPages }
 */
const getMyChatList = async (userId, pagination) => {
  const { skip, take, size } = pagination;

  // 내가 참여중인 채팅방 id 목록
  const myRooms = await prismaConfig.prisma.chatRoomParticipant.findMany({
    where: { clerkId: userId },
    select: { chatroomId: true }
  });
  const roomIds = myRooms.map(r => r.chatroomId);

  if (roomIds.length === 0) {
    return { chatList: [], totalElements: 0, totalPages: 0 };
  }

  // 채팅방 정보 조회
  const totalElements = await prismaConfig.prisma.chatRoom.count({
    where: {
      id: { in: roomIds },
      isDeleted: false,
    },
  });

  const chatRooms = await prismaConfig.prisma.chatRoom.findMany({
    where: {
      id: { in: roomIds },
      isDeleted: false,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    skip,
    take,
    include: {
      participants: { include: { persona: true } },
      ChatLogs: {
        orderBy: { time: 'desc' },
        take: 1,
        select: { text: true, time: true },
      },
    },
  });

  // 응답 데이터 가공
  const chatList = chatRooms.map(room => {
    // 대표 persona(캐릭터) 정보 추출 (AI 참여자 중 첫 번째)
    const personaParticipant = room.participants.find(p => p.personaId && p.persona);
    const persona = personaParticipant?.persona;
    const lastChat = room.ChatLogs.length > 0 ? room.ChatLogs[0] : null;
    // 초대된 모든 AI(페르소나) 정보
    const aiParticipants = room.participants
      .filter(p => p.personaId && p.persona)
      .map(p => ({
        personaId: p.persona.id,
        name: p.persona.name,
        imageUrl: p.persona.imageUrl
      }));
    
    // AI 참여자가 없는 경우에도 채팅방을 포함하되, 기본값 설정
    const defaultName = aiParticipants.length > 0 ? aiParticipants[0].name : '채팅방';
    const defaultImageUrl = aiParticipants.length > 0 ? aiParticipants[0].imageUrl : null;
    
    return {
      roomId: room.id,
      characterId: persona?.id || null,
      name: persona?.name || defaultName,
      imageUrl: persona?.imageUrl || defaultImageUrl,
      lastChat: lastChat ? lastChat.text : null,
      time: lastChat ? lastChat.time.toISOString() : null,
      aiParticipants
    };
  });

  const totalPages = Math.ceil(totalElements / size);
  return { chatList, totalElements, totalPages };
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
  otherParticipants = []
) => {
  // 1. 내 정보 - AI로 성격, 말투, 특징 추출
  const myDetails = await extractPersonaDetails(personaInfo);
  
  const myInfo = `
[당신의 정보]
이름: ${personaInfo.name}
성격: ${myDetails.personality}
말투: ${myDetails.tone}
특징: ${myDetails.characteristics}
소개: ${personaInfo.introduction || ''}
`;

  // 2. 상대 AI 정보 (표 형태)
  const othersInfo = await Promise.all(
    otherParticipants
      .filter(p => p.persona && p.persona.id !== personaInfo.id)
      .map(async p => {
        const otherDetails = await extractPersonaDetails(p.persona);
        return `이름: ${p.persona.name} | 성격: ${otherDetails.personality} | 말투: ${otherDetails.tone} | 특징: ${otherDetails.characteristics} | 소개: ${p.persona.introduction || ''}`;
      })
  );
  
  const othersInfoText = othersInfo.join('\n');

  // 3. 프롬프트
  const prompt = `
${myInfo}
[채팅방에 함께 있는 다른 AI 정보]
${othersInfoText}

너는 위의 [당신의 정보]를 100% 반영해서, 아래 [채팅방에 함께 있는 다른 AI 정보]를 모두 인지하고 있다.

중요 규칙:
- 반드시 자신의 성격, 말투, 소개만 사용해서 대화할 것
- 상대방의 성격, 말투, 소개를 참고해서, 그에 어울리는 인사를 창의적으로 할 것
- 절대 상대방의 말투/성격을 따라하지 말고, 자신의 개성을 유지할 것
- 각 AI의 이름을 정확히 사용해서 대화할 것
- 지금 채팅방에 처음 입장했다면, 각 상대 AI에게 한 명씩 인사할 것
- 다른 AI들이 대화할 때도 그들의 이름과 특성을 인지하고 반응할 것
- 사용자가 "너희 둘이 아는사이야?" 같은 질문을 하면, 다른 AI들의 정보를 바탕으로 답변할 것
- 자신의 개성과 다른 AI들의 개성을 모두 존중하면서 자연스럽게 대화할 것

[최근 대화 기록]
${chatHistory}
---
사용자: ${userMessage}
${personaInfo.name}:`;

  // 4. Google AI 호출
  let aiResponseText;
  try {
    console.log('🤖 Google AI 호출 시도...');
    console.log('📝 프롬프트:', prompt.trim());
    aiResponseText = await gemini25.generateText(prompt.trim());
    console.log('✅ Google AI 응답 성공:', aiResponseText);
  } catch (error) {
    console.error('❌ Google AI 호출 실패:', error.message);
    aiResponseText = `안녕하세요! 저는 ${personaInfo.name}입니다. 현재 AI 서버가 일시적으로 불안정해요. 잠시 후 다시 시도해주세요! 😊`;
  }
  if (!aiResponseText || aiResponseText.trim() === '') {
    aiResponseText = `안녕하세요! 저는 ${personaInfo.name}입니다. 어떤 이야기를 나누고 싶으신가요? 😊`;
  }
  return aiResponseText;
};

/**
 * AI 캐릭터가 자동으로 인사하는 메시지를 생성합니다.
 * @param {object} personaInfo - 페르소나 정보 { name, personality, tone, introduction }
 * @param {array} otherParticipants - 다른 AI 참여자들 정보
 * @returns {Promise<string>} AI가 생성한 인사 메시지
 */
const generateAiGreeting = async (personaInfo, otherParticipants = []) => {
  // 1. 내 정보 - AI로 성격, 말투, 특징 추출
  const myDetails = await extractPersonaDetails(personaInfo);
  
  const myInfo = `
[당신의 정보]
이름: ${personaInfo.name}
성격: ${myDetails.personality}
말투: ${myDetails.tone}
특징: ${myDetails.characteristics}
소개: ${personaInfo.introduction || ''}
`;

  // 2. 상대 AI 정보
  const othersInfo = await Promise.all(
    otherParticipants
      .filter(p => p.persona && p.persona.id !== personaInfo.id)
      .map(async p => {
        const otherDetails = await extractPersonaDetails(p.persona);
        return `이름: ${p.persona.name} | 성격: ${otherDetails.personality} | 말투: ${otherDetails.tone} | 특징: ${otherDetails.characteristics} | 소개: ${p.persona.introduction || ''}`;
      })
  );
  
  const othersInfoText = othersInfo.join('\n');

  // 3. 인사 전용 프롬프트
  const greetingPrompt = `
${myInfo}
[채팅방에 함께 있는 다른 AI 정보]
${othersInfoText}

너는 위의 [당신의 정보]를 100% 반영해서, 아래 [채팅방에 함께 있는 다른 AI 정보]를 모두 인지하고 있다.

중요 규칙:
- 반드시 자신의 성격, 말투, 소개만 사용해서 인사할 것
- 상대방의 성격, 말투, 소개를 참고해서, 그에 어울리는 창의적인 인사를 할 것
- 절대 상대방의 말투/성격을 따라하지 말고, 자신의 개성을 유지할 것
- 각 AI의 이름을 정확히 사용해서 인사할 것
- 채팅방에 처음 입장한 상황이므로, 다른 AI들과 사용자에게 자연스럽게 인사할 것
- 자신의 개성과 다른 AI들의 개성을 모두 존중하면서 친근하게 인사할 것
- 짧고 자연스러운 인사말을 할 것 (2-3문장 이내)

이제 당신의 성격과 말투에 맞게 채팅방에 인사해주세요:`;

  // 4. Google AI 호출
  let aiGreetingText;
  try {
    console.log('🤖 AI 자동 인사 생성 시도...');
    console.log('📝 인사 프롬프트:', greetingPrompt.trim());
    aiGreetingText = await gemini25.generateText(greetingPrompt.trim());
    console.log('✅ AI 자동 인사 생성 성공:', aiGreetingText);
  } catch (error) {
    console.error('❌ AI 자동 인사 생성 실패:', error.message);
    aiGreetingText = `안녕하세요! 저는 ${personaInfo.name}입니다. 함께 대화할 수 있어서 기쁩니다! 😊`;
  }
  
  if (!aiGreetingText || aiGreetingText.trim() === '') {
    aiGreetingText = `안녕하세요! 저는 ${personaInfo.name}입니다. 함께 대화할 수 있어서 기쁩니다! 😊`;
  }
  
  return aiGreetingText;
};

/**
 * 채팅방 삭제 (소프트 삭제)
 * @param {number} roomId - 삭제할 채팅방 ID
 * @param {string} userId - 요청자 Clerk ID (권한 확인용)
 * @returns {Promise<object>} 삭제된 채팅방 객체
 */
const deleteChatRoom = async (roomId, userId) => {
  // 1. 본인 참여 채팅방인지 확인 (ChatRoomParticipant 기준)
  const participant = await prismaConfig.prisma.chatRoomParticipant.findFirst({
    where: {
      chatroomId: parseInt(roomId, 10),
      clerkId: userId,
    },
  });
  if (!participant) {
    throw new Error('삭제 권한이 없거나 존재하지 않는 채팅방입니다.');
  }
  // 2. 채팅방을 소프트 삭제
  const deleted = await prismaConfig.prisma.chatRoom.update({
    where: { id: parseInt(roomId, 10) },
    data: { isDeleted: true },
  });
  // 3. 관련 채팅 로그도 소프트 삭제
  await prismaConfig.prisma.chatLog.updateMany({
    where: { chatroomId: deleted.id },
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

/**
 * 여러 캐릭터/유저로 단체 채팅방 생성 (동일 참가자 조합이 있으면 반환, 없으면 새로 생성)
 * @param {string[]} participantIds - 유저/AI의 clerkId 또는 personaId 배열
 * @returns {Promise<object>} 생성/조회된 채팅방 정보
 */
const createMultiChatRoom = async (participantIds) => {
  console.log('createMultiChatRoom service - participantIds:', participantIds);
  
  // 1. 참가자 배열을 clerkId/personaId로 분리
  // participantIds는 [userId, personaId1, personaId2, ...] 형태
  const userIds = participantIds.filter(id => typeof id === 'string' && id.startsWith('user_'));
  const personaIds = participantIds.filter(id => typeof id === 'number').map(id => parseInt(id, 10));
  
  console.log('createMultiChatRoom service - userIds:', userIds);
  console.log('createMultiChatRoom service - personaIds:', personaIds);
  
  // 2. 동일 참가자 조합의 방이 있는지 확인 (모든 참가자가 포함된 방)
  const candidateRooms = await prismaConfig.prisma.chatRoom.findMany({
    where: { isDeleted: false },
    include: { participants: true }
  });
  console.log('createMultiChatRoom service - candidateRooms count:', candidateRooms.length);
  
  let foundRoom = candidateRooms.find(room => {
    // 해당 방의 모든 user-persona 조합 확인
    const roomUserPersonaPairs = room.participants.map(p => ({ clerkId: p.clerkId, personaId: p.personaId }));
    
    // 요청된 모든 user-persona 조합이 방에 있는지 확인
    const requestedPairs = [];
    for (const userId of userIds) {
      for (const personaId of personaIds) {
        requestedPairs.push({ clerkId: userId, personaId: personaId });
      }
    }
    
    // 모든 요청된 조합이 방에 있고, 방의 조합이 요청된 조합과 정확히 일치하는지 확인
    const allRequestedInRoom = requestedPairs.every(pair => 
      roomUserPersonaPairs.some(roomPair => 
        roomPair.clerkId === pair.clerkId && roomPair.personaId === pair.personaId
      )
    );
    
    const allRoomInRequested = roomUserPersonaPairs.every(roomPair => 
      requestedPairs.some(pair => 
        roomPair.clerkId === pair.clerkId && roomPair.personaId === pair.personaId
      )
    );
    
    return allRequestedInRoom && allRoomInRequested;
  });
  
  console.log('createMultiChatRoom service - foundRoom:', foundRoom ? foundRoom.id : null);
  
  let isNewRoom = false;
  if (!foundRoom) {
    // 새로 생성
    console.log('createMultiChatRoom service - creating new room');
    isNewRoom = true;
    foundRoom = await prismaConfig.prisma.chatRoom.create({ data: {}, include: { participants: true } });
    console.log('createMultiChatRoom service - created room id:', foundRoom.id);
    
    // 참가자 추가 - 유저와 AI 조합으로만 생성 (친밀도 추적용)
    for (const userId of userIds) {
      for (const personaId of personaIds) {
        await prismaConfig.prisma.chatRoomParticipant.create({ 
          data: { 
            chatroomId: foundRoom.id, 
            clerkId: userId, 
            personaId: personaId, 
            exp: 0 
          } 
        });
      }
    }
    // 다시 조회 (참가자 포함)
    foundRoom = await prismaConfig.prisma.chatRoom.findUnique({ where: { id: foundRoom.id }, include: { participants: { include: { persona: true } } } });
  } else {
    // 참가자 정보 포함해서 다시 조회
    foundRoom = await prismaConfig.prisma.chatRoom.findUnique({ where: { id: foundRoom.id }, include: { participants: { include: { persona: true } } } });
  }
  // 채팅 로그
  const chatHistory = await prismaConfig.prisma.chatLog.findMany({ where: { chatroomId: foundRoom.id, isDeleted: false }, orderBy: { time: 'asc' } });
  
  const result = {
    roomId: foundRoom.id,
    isNewRoom,
    participants: foundRoom.participants.map(p => ({
      clerkId: p.clerkId,
      personaId: p.personaId,
      persona: p.persona ? { id: p.persona.id, name: p.persona.name, imageUrl: p.persona.imageUrl } : undefined
    })),
    chatHistory
  };
  
  console.log('createMultiChatRoom service - final result:', result);
  return result;
};


const chatService = {
  getMyChatList,
  generateAiChatResponse,
  generateAiGreeting,
  deleteChatRoom, 
  makeVeo3Prompt,
  generateVideoWithVeo3,
  uploadVideoToGCS,
  checkAndGenerateVideoReward,
  createMultiChatRoom,
};

export default chatService;


