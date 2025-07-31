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
    const { name, imageUrl, isPublic, prompt, description, creatorName } = personaData;

    // 사용자 정보 가져오기
    const user = await prismaConfig.prisma.user.findUnique({
      where: { clerkId: userId }
    });

    // Sanitize string inputs
    const sanitizedData = {
      name: name.trim(),
      imageUrl: imageUrl.trim(),
      isPublic: isPublic,
      introduction: description ? description.trim() : null,
      prompt: {
        tone: prompt.tone.trim(),
        personality: prompt.personality.trim(),
        tag: prompt.tag.trim()
      },
      clerkId: userId,
      creatorName: creatorName || user?.name || user?.firstName || user?.username || userId
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
  const { name, isPublic, creatorName } = initialData;

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
  let imageUrl;
  try {
          // aiGeneratedDetails = await gemini25.generatePersonaDetailsWithGemini(promptForGemini);
          aiGeneratedDetails = await gemini25.generateCharacterWithPerplexity(name);
          console.log('AI가 생성한 캐릭터 정보:', aiGeneratedDetails);
          // const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
          // const GOOGLE_CX = process.env.GOOGLE_CX;
          // imageUrl = await gemini25.getGoogleImages(name + ' 사진', GOOGLE_API_KEY, GOOGLE_CX);
          // aiGeneratedDetails.prompt.imageUrl = aiGeneratedDetails.prompt.imageUrl[0]?.url || '';
          // console.log(imageUrl);
          aiGeneratedDetails.data.imageUrl = "ffffff";

  } catch (error) {
    console.log('AI 생성 실패, 기본값 사용:', error.message);
    // AI 생성 실패 시 기본값 사용
    aiGeneratedDetails = {
      description: `${name}에 대한 상세한 소개입니다.`,
      prompt: {
        tone: "친근하고 자연스러운 말투",
        personality: "친절함, 호기심, 적극성",
        tag: "친근함,호기심,적극성",
        imageUrl: []
      }
    };
  }

  // 3. 사용자가 입력한 정보와 AI가 생성한 정보를 결합
  const fullPersonaData = {
    clerkId: userId,
    name,
    imageUrl: imageUrl ? imageUrl[0]?.url : "imageUrl", // 이미지 URL이 배열인 경우 첫 번째 요소 사용
    isPublic: isPublic,
    introduction: aiGeneratedDetails.description, // AI가 생성
    prompt: aiGeneratedDetails.prompt,          // AI가 생성
    creatorName: creatorName || user?.name || user?.firstName || user?.username || userId
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
const getPersonas = async (userId, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', keyword = '') => {
  console.log('🔍 getPersonas service - 시작:', { userId, page, limit, sortBy, sortOrder, keyword });

  try {
    const offset = (page - 1) * limit;
    
    // where 조건 분리
    const where = {
      isPublic: true,
      isDeleted: false,
      ...(userId && { clerkId: { not: userId } }),
      ...(keyword && {
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { introduction: { contains: keyword, mode: 'insensitive' } }
        ]
      })
    };

    // 공개된 페르소나 조회
    const personas = await prismaConfig.prisma.persona.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: offset,
      take: limit
    });

    // 각 페르소나에 대해 liked 상태 확인
    const personasWithLikedStatus = personas.map(persona => ({
      ...persona,
      liked: persona.isLiked && persona.likedByUserId === userId
    }));

    // 전체 개수 조회
    const totalCount = await prismaConfig.prisma.persona.count({ where });

    console.log('🔍 getPersonas service - 결과:', { 
      count: personasWithLikedStatus.length, 
      totalCount,
      page,
      limit 
    });

    return {
      personas: personasWithLikedStatus,
      totalCount,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit)
    };
  } catch (error) {
    console.error('❌ getPersonas service - 오류:', error);
    throw error;
  }
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
const getPersonaDetails = async (personaId, userId) => {
  console.log('🔍 getPersonaDetails service - 시작:', { personaId, userId });

  try {
    const persona = await prismaConfig.prisma.persona.findUnique({
      where: { id: personaId, isDeleted: false },
      include: { user: true }
    });

    if (!persona) {
      throw new Error('존재하지 않는 페르소나입니다.');
    }

    // liked 상태 확인
    const liked = persona.isLiked && persona.likedByUserId === userId;

    const result = {
      ...persona,
      liked: liked,
      creatorName: persona.creatorName || persona.user?.name || persona.user?.firstName || persona.user?.clerkId || '알 수 없음'
    };

    console.log('🔍 getPersonaDetails service - 결과:', { personaId, liked });
    return result;
  } catch (error) {
    console.error('❌ getPersonaDetails service - 오류:', error);
    throw error;
  }
};

/**
 * 나의 페르소나 목록을 조회합니다.
 * @param {string} userId - 조회할 사용자의 Clerk ID
 * @param {string} type - 조회할 타입 ('created' 또는 'liked')
 * @returns {Promise<Array<object>>} 가공된 페르소나 목록
 */
const getMyPersonas = async (userId, type = 'created') => {
  console.log('🔍 getMyPersonas service - 시작:', { userId, type });

  try {
    let personas;

    if (type === 'liked') {
      // 찜한 페르소나 조회 - isLiked가 true이고 likedByUserId가 현재 사용자인 것들
      personas = await prismaConfig.prisma.persona.findMany({
        where: {
          isLiked: true,
          likedByUserId: userId,
          isDeleted: false,
          clerkId: { not: userId } // 본인이 만든 페르소나는 제외
        },
        orderBy: { createdAt: 'desc' }
      });
      console.log('🔍 getMyPersonas service - 찜한 페르소나 조회 결과:', personas.length);
    } else {
      // 내가 만든 페르소나 조회
      personas = await prismaConfig.prisma.persona.findMany({
        where: {
          clerkId: userId,
          isDeleted: false
        },
        orderBy: { createdAt: 'desc' }
      });
      console.log('🔍 getMyPersonas service - 내가 만든 페르소나 조회 결과:', personas.length);
    }

    // 각 페르소나에 대해 liked 상태 추가
    const personasWithLikedStatus = personas.map(persona => ({
      ...persona,
      liked: type === 'liked' ? true : false // 찜한 목록에서는 항상 true, 만든 목록에서는 항상 false
    }));

    console.log('🔍 getMyPersonas service - 최종 결과:', personasWithLikedStatus.length);
    return personasWithLikedStatus;
  } catch (error) {
    console.error('❌ getMyPersonas service - 오류:', error);
    throw error;
  }
};

/**
 * 페르소나 수정 (본인만 가능)
 * @param {number} personaId - 수정할 페르소나 ID
 * @param {string} userId - 요청자 Clerk ID
 * @param {object} updateData - { introduction, personality, tone, tag } 중 일부
 * @returns {Promise<object>} 수정된 페르소나 객체
 */
const updatePersona = async (personaId, updateData, userId) => {
  console.log('🔍 updatePersona service - 시작:', { personaId, updateData, userId });

  try {
    // 1. 페르소나 존재 확인 및 권한 확인
    const existingPersona = await prismaConfig.prisma.persona.findUnique({
      where: { id: personaId, isDeleted: false }
    });

    if (!existingPersona) {
      throw new Error('존재하지 않는 페르소나입니다.');
    }

    if (existingPersona.clerkId !== userId) {
      throw new Error('페르소나를 수정할 권한이 없습니다.');
    }

    // 2. 페르소나 업데이트
    const updatedPersona = await prismaConfig.prisma.persona.update({
      where: { id: personaId },
      data: updateData
    });

    // 3. liked 상태 확인
    const liked = updatedPersona.isLiked && updatedPersona.likedByUserId === userId;

    const result = {
      ...updatedPersona,
      liked: liked
    };

    console.log('🔍 updatePersona service - 결과:', { personaId, liked });
    return result;
  } catch (error) {
    console.error('❌ updatePersona service - 오류:', error);
    throw error;
  }
};

/**
 * 페르소나 소프트 삭제 (본인만 가능)
 * @param {number} personaId - 삭제할 페르소나 ID
 * @param {string} userId - 요청자 Clerk ID
 * @returns {Promise<object>} 삭제된 페르소나 객체
 */
const deletePersona = async (personaId, userId) => {
  console.log('🔍 deletePersona service - 시작:', { personaId, userId });

  try {
    // 1. 페르소나 존재 확인 및 권한 확인
    const existingPersona = await prismaConfig.prisma.persona.findUnique({
      where: { id: personaId, isDeleted: false }
    });

    if (!existingPersona) {
      throw new Error('존재하지 않는 페르소나입니다.');
    }

    if (existingPersona.clerkId !== userId) {
      throw new Error('페르소나를 삭제할 권한이 없습니다.');
    }

    // 2. 소프트 삭제 (isDeleted = true)
    await prismaConfig.prisma.persona.update({
      where: { id: personaId },
      data: { 
        isDeleted: true,
        isLiked: false,
        likedByUserId: null
      }
    });

    console.log('🔍 deletePersona service - 완료:', { personaId });
    return { success: true };
  } catch (error) {
    console.error('❌ deletePersona service - 오류:', error);
    throw error;
  }
};

/**
 * 페르소나 좋아요 토글 (장바구니에 담기/제거)
 * @param {number} personaId - 페르소나 ID
 * @param {string} userId - 사용자 Clerk ID
 * @returns {Promise<object>} { isLiked, likesCount }
 */
const toggleLike = async (personaId, userId) => {
  console.log('🔍 toggleLike service - 시작:', { personaId, userId });

  // 1. 페르소나 존재 확인
  const persona = await prismaConfig.prisma.persona.findUnique({
    where: { id: personaId, isDeleted: false },
  });
  if (!persona) {
    throw new Error('존재하지 않는 페르소나입니다.');
  }

  console.log('🔍 toggleLike service - 페르소나 확인:', { personaId: persona.id, personaClerkId: persona.clerkId, userId });
  console.log('🔍 toggleLike service - 본인 체크:', {
    isOwnPersona: persona.clerkId === userId,
    personaClerkId: persona.clerkId,
    userId: userId,
    clerkIdType: typeof persona.clerkId,
    userIdType: typeof userId,
    clerkIdLength: persona.clerkId?.length,
    userIdLength: userId?.length
  });

  // 2. 본인 페르소나 좋아요 방지
  if (persona.clerkId === userId) {
    console.log('🔍 toggleLike service - 본인 페르소나 좋아요 시도 차단');
    throw new Error('자신이 만든 페르소나는 좋아요할 수 없습니다.');
  }

  // 3. 현재 좋아요 상태 확인
  const isCurrentlyLiked = persona.isLiked && persona.likedByUserId === userId;
  console.log('🔍 toggleLike service - 현재 좋아요 상태:', {
    isCurrentlyLiked,
    personaIsLiked: persona.isLiked,
    personaLikedByUserId: persona.likedByUserId,
    currentUserId: userId
  });

  let isLiked = false;
  let newLikesCount = 0;

  if (isCurrentlyLiked) {
    // 좋아요 취소
    newLikesCount = Math.max(0, persona.likesCount - 1);
    await prismaConfig.prisma.persona.update({
      where: { id: personaId },
      data: {
        isLiked: false,
        likedByUserId: null,
        likesCount: newLikesCount
      }
    });
    isLiked = false;
    console.log('🔍 toggleLike service - 좋아요 취소');
  } else {
    // 좋아요 추가
    newLikesCount = persona.likesCount + 1;
    await prismaConfig.prisma.persona.update({
      where: { id: personaId },
      data: {
        isLiked: true,
        likedByUserId: userId,
        likesCount: newLikesCount
      }
    });
    isLiked = true;
    console.log('🔍 toggleLike service - 좋아요 추가');
  }

  const result = {
    isLiked: isLiked,
    likesCount: newLikesCount,
  };

  console.log('🔍 toggleLike service - 최종 결과:', result);

  return result;
};

/**
 * 특정 사용자가 특정 페르소나를 좋아요했는지 확인
 * @param {number} personaId - 페르소나 ID
 * @param {string} userId - 사용자 ID
 * @returns {Promise<object>} { isLiked }
 */
const checkIfLiked = async (personaId, userId) => {
  console.log('🔍 checkIfLiked service - 시작:', { personaId, userId });

  try {
    const persona = await prismaConfig.prisma.persona.findUnique({
      where: { id: personaId, isDeleted: false }
    });

    if (!persona) {
      throw new Error('존재하지 않는 페르소나입니다.');
    }

    const isLiked = persona.isLiked && persona.likedByUserId === userId;

    console.log('🔍 checkIfLiked service - 결과:', { personaId, isLiked });
    return { isLiked };
  } catch (error) {
    console.error('❌ checkIfLiked service - 오류:', error);
    throw error;
  }
};

/**
 * 페르소나 조회수 증가
 * @param {number} personaId - 페르소나 ID
 * @returns {Promise<object>} { usesCount }
 */
const incrementViewCount = async (personaId) => {
  console.log('🔍 incrementViewCount service - 시작:', { personaId });

  try {
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

    console.log('🔍 incrementViewCount service - 완료:', { personaId, usesCount: updated.usesCount });
    return {
      usesCount: updated.usesCount,
    };
  } catch (error) {
    console.error('❌ incrementViewCount service - 오류:', error);
    throw error;
  }
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
  checkIfLiked,
  incrementViewCount,
};

export default personaService;