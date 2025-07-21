// 현재는 메모리 내 배열을 사용하지만, 나중에 Prisma 같은 DB로 쉽게 교체 가능
import prismaConfig from '../config/prisma.js';
// 개별 import 방식으로 변경
import gemini25 from '../vertexai/gemini25.js';

/**
 * 새로운 페르소나를 생성하고 데이터베이스에 저장합니다.
 * @param {object} personaData - 컨트롤러에서 전달받은 페르소나 데이터
 * @param {string} userId - 이 페르소나를 생성한 사용자의 Clerk ID
 * @returns {Promise<object>} 생성된 페르소나 객체
 */
const createPersona = async (personaData, userId) => {
  try {
    const { name, image_url, is_public, prompt, description, creator_name } = personaData;

    // 사용자 정보 가져오기
    const user = await prismaConfig.prisma.user.findUnique({
      where: { clerkId: userId }
    });

    // Sanitize string inputs
    const sanitizedData = {
      name: name.trim(),
      imageUrl: image_url.trim(),
      isPublic: is_public,
      introduction: description ? description.trim() : null,
      prompt: {
        tone: prompt.tone.trim(),
        personality: prompt.personality.trim(),
        tag: prompt.tag.trim()
      },
      clerkId: userId,
      creatorName: creator_name || user?.name || user?.firstName || user?.username || userId
    };
    
    // DB에 저장하는 로직 (Prisma 예시)
    // 여기서 prompt는 JSON 타입으로 DB에 저장될 수 있습니다.
    const newPersona = await prismaConfig.prisma.persona.create({
      data: sanitizedData
    });

    return newPersona;
    } catch (error) {
      // Log the error for debugging
      console.error('Error creating persona:', error);
      throw new Error('페르소나 생성 중 오류가 발생했습니다.');
    }
};

/**
 * AI(Gemini)를 사용하여 페르소나를 생성합니다.
 * @param {object} initialData - 사용자가 입력한 초기 데이터 { name, image_url, is_public, short_bio }
 * @param {string} userId - 생성자 Clerk ID
 * @returns {Promise<object>} 완전히 생성된 페르소나 객체
 */
const createPersonaWithAI = async (initialData, userId) => {
  const { name, image_url, is_public, creator_name } = initialData;

  // 사용자 정보 가져오기
  const user = await prismaConfig.prisma.user.findUnique({
    where: { clerkId: userId }
  });

  // 1. Gemini에 보낼 프롬프트 생성 (JSON 형식으로 응답하도록 지시)
  const promptForGemini = `
    다음은 새로운 페르소나 캐릭터에 대한 정보입니다:
    - 이름: ${name}

    이 정보를 바탕으로, 아래 JSON 형식에 맞춰 캐릭터의 상세 설정을 한국어로 생성해주세요:
    {
      "description": "캐릭터에 대한 상세하고 매력적인 소개 (3-4문장)",
      "prompt": {
        "tone": "캐릭터의 대표적인 말투 (예: 차분하고 논리적인, 활기차고 친근한)",
        "personality": "캐릭터의 핵심 성격 키워드 3가지 (쉼표로 구분)",
        "tag": "캐릭터를 대표하는 해시태그 3가지 (쉼표로 구분, # 제외)"
      }
    }
  `;

  // 2. LLM 서비스 호출하여 상세 정보 생성
  let aiGeneratedDetails;
  try {
          aiGeneratedDetails = await gemini25.generatePersonaDetailsWithGemini(promptForGemini);
  } catch (error) {
    console.log('AI 생성 실패, 기본값 사용:', error.message);
    // AI 생성 실패 시 기본값 사용
    aiGeneratedDetails = {
      description: `${name}에 대한 상세한 소개입니다.`,
      prompt: {
        tone: "친근하고 자연스러운 말투",
        personality: "친절함, 호기심, 적극성",
        tag: "친근함,호기심,적극성"
      }
    };
  }

  // 3. 사용자가 입력한 정보와 AI가 생성한 정보를 결합
  const fullPersonaData = {
    clerkId: userId,
    name,
    imageUrl: image_url,
    isPublic: is_public,
    introduction: aiGeneratedDetails.description, // AI가 생성
    prompt: aiGeneratedDetails.prompt,          // AI가 생성
    creatorName: creator_name || user?.name || user?.firstName || user?.username || userId
  };

  // 4. 완성된 데이터를 DB에 저장
  const newPersona = await prismaConfig.prisma.persona.create({
    data: fullPersonaData,
  });

  return newPersona;
};

/**
 * 필터링 및 정렬 조건에 따라 페르소나 목록을 조회합니다.
 * @param {object} options - 조회 옵션 객체
 * @param {string} [options.keyword] - 검색 키워드
 * @param {string} [options.sort] - 정렬 기준 ('likes', 'uses_count', 'createdAt')
 * @param {string} [options.currentUserId] - 현재 사용자 ID (좋아요 상태 확인용)
 * @returns {Promise<{personas: Array<object>, total: number}>} 페르소나 목록과 총 개수
 */
const getPersonas = async (options = {}) => {
  const { keyword, sort, currentUserId } = options;

  // 1. Prisma 쿼리 조건 객체 생성
  const where = {
    isPublic: true,
    isDeleted: false  // 삭제되지 않은 캐릭터만 조회
  };
  if (keyword) {
    // 키워드가 있으면 name 또는 introduction 필드에서 대소문자 구분 없이 검색
    where.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { introduction: { contains: keyword, mode: 'insensitive' } },
    ];
  }

  // 2. Prisma 정렬 조건 객체 생성
  const orderBy = {};
  if (sort === 'likes') {
    orderBy.likesCount = 'desc'; // DB 필드명은 likesCount
  } else if (sort === 'view_count' || sort === 'uses_count') {
    orderBy.usesCount = 'desc'; // DB 필드명은 camelCase로
  } else {
    // 기본 정렬은 최신순
    orderBy.createdAt = 'desc';
  }

  // 3. DB에서 데이터 조회
  const personas = await prismaConfig.prisma.persona.findMany({
    where,   // 검색 조건 적용
    orderBy, // 정렬 조건 적용
    include: {
      user: true, // Users 테이블과 조인
    },
    // TODO: 페이지네이션(Pagination) 로직 추가 (skip, take)
  });

  // 4. 전체 개수 조회 (페이지네이션을 위해)
  const total = await prismaConfig.prisma.persona.count({ where });

  // 5. 프론트엔드에서 기대하는 형식으로 변환
  const formattedPersonas = await Promise.all(personas.map(async (persona) => {
    // 현재 사용자의 좋아요 상태 확인
    let liked = false;
    if (currentUserId) {
      const chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
        where: {
          clerkId: currentUserId,
          characterId: persona.id,
          likes: true,
        },
      });
      liked = !!chatRoom;
    }

    const creatorName = persona.creatorName || persona.user?.name || persona.user?.firstName || persona.user?.clerkId || '알 수 없음';

    // creator_name 디버깅
    console.log(`Character ${persona.name} (${persona.id}) creator info:`, {
      personaCreatorName: persona.creatorName,
      user: persona.user,
      finalCreatorName: creatorName
    });

    return {
      id: persona.id,
      name: persona.name,
      image_url: persona.imageUrl,
      introduction: persona.introduction,
      prompt: persona.prompt,
      creator_name: creatorName,
      uses_count: persona.usesCount,
      likes: persona.likesCount,
      is_public: persona.isPublic,
      liked: liked,
    };
  }));

  return { personas: formattedPersonas, total };
};

/**
 * ID로 페르소나의 상세 정보를 조회합니다.
 * 소유권 검증 및 '좋아요' 상태 계산을 선택적으로 수행합니다.
 * @param {object} options - 조회 옵션
 * @param {number} options.personaId - 조회할 페르소나의 ID (필수)
 * @param {string} [options.ownerId] - 소유권을 검증할 사용자 ID. 제공되면 이 사용자의 페르소나만 찾음.
 * @param {string} [options.currentUserId] - '좋아요' 상태를 계산할 현재 사용자 ID.
 * @returns {Promise<object|null>} 조회된 페르소나 객체 또는 null
 */
const getPersonaDetails = async (options) => {
  const { personaId, ownerId, currentUserId } = options;

  console.log('getMyPersonaDetails 호출:', { personaId, ownerId, currentUserId });

  // 1. 조회 조건(where)을 동적으로 구성
  const whereCondition = {
    id: personaId,
  };

  // 'ownerId'가 제공되면, 소유권 검증 조건을 추가
  if (ownerId) {
    whereCondition.clerkId = ownerId;
  }

  console.log('조회 조건:', whereCondition);

  const persona = await prismaConfig.prisma.persona.findUnique({
    where: whereCondition,
    include: {
      user: true, // Users 테이블과 조인
    },
  });

  console.log('데이터베이스에서 가져온 원본 데이터:', {
    id: persona?.id,
    introduction: persona?.introduction,
    prompt: persona?.prompt
  });

  if (!persona || persona.isDeleted) {
    return null;
  }

  // 2. 'liked' 상태를 계산
  let liked = false;
  if (currentUserId) { // 'currentUserId'가 제공된 경우에만 '좋아요' 상태를 확인
    const chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
      where: {
        clerkId: currentUserId,
        characterId: personaId,
      },
    });
    liked = chatRoom ? chatRoom.likes : false;
  }

  // 3. 최종 응답 객체 조립
  console.log('페르소나 상세 정보:', {
    id: persona.id,
    clerkId: persona.clerkId,
    user: persona.user,
    creator_name: persona.user?.name || persona.user?.firstName || persona.user?.clerkId || '알 수 없음',
    introduction: persona.introduction,
    prompt: persona.prompt
  });
  
  return {
    id: persona.id,
    user_id: persona.clerkId,
    creator_name: persona.creatorName || persona.user?.name || persona.user?.firstName || persona.user?.clerkId || '알 수 없음',
    name: persona.name,
    image_url: persona.imageUrl,
    introduction: persona.introduction,
    prompt: persona.prompt,
    uses_count: persona.usesCount,
    likes: persona.likesCount,
    is_public: persona.isPublic,
    liked: liked,
  };
};

/**
 * 특정 사용자의 페르소나 목록을 조회합니다. (만든 것 또는 좋아요 한 것)
 * @param {string} userId - 현재 로그인한 사용자의 Clerk ID
 * @param {string} type - 조회할 타입 ('created' 또는 'liked')
 * @returns {Promise<Array<object>>} 가공된 페르소나 목록
 */
const getMyPersonas = async (userId, type = 'created') => {
  if (type === 'liked') {
    // --- 내가 좋아요 한 페르소나 조회 로직 ---

    // 1. 내가 좋아요 한 ChatRoom을 먼저 찾는다.
    const likedChatRooms = await prismaConfig.prisma.chatRoom.findMany({
      where: {
        clerkId: userId,  // ChatRoom 생성자 ID가 내 ID이고
        likes: true,      // likes가 true이며
        persona: {        // 연결된 페르소나가
          isDeleted: false, // 삭제되지 않은 경우
        }
      },
      include: {
        persona: true, // 관련된 페르소나 정보를 함께 가져온다 (Join)
      }
    });

    // 2. 결과를 최종 응답 형태로 가공한다.
    return likedChatRooms.map(room => ({
      id: room.persona.id,
      name: room.persona.name,
      image_url: room.persona.imageUrl,
      introduction: room.persona.introduction,
      prompt: room.persona.prompt,
      creator_name: room.persona.creatorName || room.persona.user?.name || room.persona.user?.firstName || room.persona.user?.clerkId || '알 수 없음',
      uses_count: room.persona.usesCount, // 조회수 추가
      likes: room.persona.likesCount,
      liked: true, // 이 목록은 항상 true
      intimacy: room.friendship, // friendship 필드 사용
      is_deleted: room.persona.isDeleted,
    }));

  } else {
    // --- 내가 만든 페르소나 조회 로직 ('created') ---

    // 1. 내가 만든 페르소나를 모두 찾는다.
    const myCreatedPersonas = await prismaConfig.prisma.persona.findMany({
      where: {
        clerkId: userId,    // 페르소나 생성자 ID가 내 ID이고
        isDeleted: false,   // 삭제되지 않은 경우
      },
      include: {
        user: true, // Users 테이블과 조인
        // 이 페르소나와 '나' 사이의 채팅방 정보를 함께 가져온다.
        chatRooms: {
          where: {
            clerkId: userId,
          }
        }
      }
    });

    // 2. 결과를 최종 응답 형태로 가공한다.
    return myCreatedPersonas.map(p => {
      // 나와의 채팅방은 유일하거나 없어야 한다.
      const myRoom = p.chatRooms.length > 0 ? p.chatRooms[0] : null;

      return {
        id: p.id,
        name: p.name,
        image_url: p.imageUrl,
        introduction: p.introduction,
        prompt: p.prompt,
        creator_name: p.creatorName || p.user?.name || p.user?.firstName || p.user?.clerkId || '알 수 없음',
        uses_count: p.usesCount, // 조회수 추가
        likes: p.likesCount,
        liked: myRoom ? myRoom.likes : false,
        intimacy: myRoom ? myRoom.friendship : 0,
        is_deleted: p.isDeleted,
      };
    });
  }
};

/**
 * 페르소나 수정 (본인만 가능)
 * @param {number} personaId - 수정할 페르소나 ID
 * @param {string} userId - 요청자 Clerk ID
 * @param {object} updateData - { introduction, personality, tone, tag } 중 일부
 * @returns {Promise<object>} 수정된 페르소나 객체
 */
const updatePersona = async (personaId, userId, updateData) => {
  console.log('updatePersona 호출:', { personaId, userId, updateData });
  
  // 1. 본인 소유 페르소나인지 확인
  const persona = await prismaConfig.prisma.persona.findUnique({
    where: { id: personaId },
  });
  
  console.log('수정 전 원본 데이터:', {
    id: persona?.id,
    introduction: persona?.introduction,
    prompt: persona?.prompt
  });
  
  if (!persona || persona.clerkId !== userId || persona.isDeleted) {
    throw new Error('수정 권한이 없거나 존재하지 않는 페르소나입니다.');
  }

  // 2. 업데이트할 필드 준비
  const updateFields = {};
  if (updateData.introduction !== undefined) {
    updateFields.introduction = updateData.introduction;
  }
  if (
    updateData.personality !== undefined ||
    updateData.tone !== undefined ||
    updateData.tag !== undefined
  ) {
    // 기존 prompt를 불러와서 병합
    const prevPrompt = persona.prompt || {};
    updateFields.prompt = {
      ...prevPrompt,
      ...(updateData.personality !== undefined ? { personality: updateData.personality } : {}),
      ...(updateData.tone !== undefined ? { tone: updateData.tone } : {}),
      ...(updateData.tag !== undefined ? { tag: updateData.tag } : {}),
    };
  }

  console.log('업데이트할 필드:', updateFields);

  // 3. DB 업데이트
  const updated = await prismaConfig.prisma.persona.update({
    where: { id: personaId },
    data: updateFields,
    include: {
      user: true, // Users 테이블과 조인
    },
  });

  console.log('수정된 페르소나 데이터:', {
    id: updated.id,
    introduction: updated.introduction,
    prompt: updated.prompt
  });

  // 4. getPersonaDetails와 동일한 구조로 반환
  const chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
    where: {
      clerkId: userId,
      characterId: personaId,
    },
  });

  return {
    id: updated.id,
    user_id: updated.clerkId,
    creator_name: updated.creatorName || updated.user?.name || updated.user?.firstName || updated.user?.clerkId || '알 수 없음',
    name: updated.name,
    image_url: updated.imageUrl,
    introduction: updated.introduction,
    prompt: updated.prompt,
    uses_count: updated.usesCount,
    likes: updated.likesCount,
    is_public: updated.isPublic,
    liked: chatRoom ? chatRoom.likes : false,
  };
};

/**
 * 페르소나 소프트 삭제 (본인만 가능)
 * @param {number} personaId - 삭제할 페르소나 ID
 * @param {string} userId - 요청자 Clerk ID
 * @returns {Promise<object>} 삭제된 페르소나 객체
 */
const deletePersona = async (personaId, userId) => {
  // 1. 본인 소유 페르소나인지 확인
  const persona = await prismaConfig.prisma.persona.findUnique({
    where: { id: personaId },
  });
  if (!persona || persona.clerkId !== userId || persona.isDeleted) {
    throw new Error('삭제 권한이 없거나 존재하지 않는 페르소나입니다.');
  }
  // 2. isDeleted true로 변경 (페르소나)
  const deleted = await prismaConfig.prisma.persona.update({
    where: { id: personaId },
    data: { isDeleted: true },
  });
  // 3. 연관된 chatRoom도 모두 isDeleted 처리
  await prismaConfig.prisma.chatRoom.updateMany({
    where: { characterId: personaId, isDeleted: false },
    data: { isDeleted: true },
  });
  return deleted;
};

/**
 * 페르소나 좋아요 토글
 * @param {number} personaId - 페르소나 ID
 * @param {string} userId - 사용자 Clerk ID
 * @returns {Promise<object>} { isLiked, likesCount }
 */
const toggleLike = async (personaId, userId) => {
  // 1. 페르소나 존재 확인
  const persona = await prismaConfig.prisma.persona.findUnique({
    where: { id: personaId, isDeleted: false },
  });
  
  if (!persona) {
    throw new Error('존재하지 않는 페르소나입니다.');
  }

  // 2. 본인 페르소나 좋아요 방지
  if (persona.clerkId === userId) {
    throw new Error('자신이 만든 페르소나는 좋아요할 수 없습니다.');
  }

  // 3. 기존 ChatRoom 확인 또는 생성
  let chatRoom = await prismaConfig.prisma.chatRoom.findFirst({
    where: {
      clerkId: userId,
      characterId: personaId,
    },
  });

  if (!chatRoom) {
    // ChatRoom이 없으면 생성
    chatRoom = await prismaConfig.prisma.chatRoom.create({
      data: {
        clerkId: userId,
        characterId: personaId,
        likes: true,
        friendship: 0,
      },
    });
  } else {
    // ChatRoom이 있으면 좋아요 상태 토글
    chatRoom = await prismaConfig.prisma.chatRoom.update({
      where: { id: chatRoom.id },
      data: { likes: !chatRoom.likes },
    });
  }

  // 4. 페르소나의 총 좋아요 수 업데이트
  const totalLikes = await prismaConfig.prisma.chatRoom.count({
    where: {
      characterId: personaId,
      likes: true,
    },
  });

  await prismaConfig.prisma.persona.update({
    where: { id: personaId },
    data: { likesCount: totalLikes },
  });

  return {
    isLiked: chatRoom.likes,
    likesCount: totalLikes,
  };
};

/**
 * 페르소나 조회수 증가
 * @param {number} personaId - 페르소나 ID
 * @returns {Promise<object>} { viewCount }
 */
const incrementViewCount = async (personaId) => {
  // 1. 페르소나 존재 확인
  const persona = await prismaConfig.prisma.persona.findUnique({
    where: { id: personaId, isDeleted: false },
  });
  
  if (!persona) {
    throw new Error('존재하지 않는 페르소나입니다.');
  }

  // 2. 조회수 증가
  const updated = await prismaConfig.prisma.persona.update({
    where: { id: personaId },
    data: {
      usesCount: {
        increment: 1,
      },
    },
  });

  return {
    viewCount: updated.usesCount,
  };
};

const personaService = {
  deletePersona,
  updatePersona,
  getMyPersonas,
  getPersonaDetails,
  getPersonas,
  createPersonaWithAI,
  createPersona,
  toggleLike,
  incrementViewCount,
};

export default personaService;
