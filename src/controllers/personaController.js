/**
 * 페르소나 컨트롤러
 *
 * 사용 위치:
 * - personaRoute.js에서 라우터 연결
 *
 * 기능:
 * - 페르소나 CRUD 작업 처리
 * - 사용자 인증 및 권한 검증
 * - 파일 업로드 처리
 * - 표준화된 응답 생성
 */

import PersonaService from '../services/personaService.js';
import responseHandler from '../utils/responseHandler.js';
import logger from '../utils/logger.js';
import errorHandler from '../middlewares/errorHandler.js';
import prismaConfig from '../config/prisma.js';
import { uploadToGCS } from '../utils/uploadToGCS.js';


/**
 * 사용자 정의 페르소나를 생성하는 요청을 처리하는 컨트롤러
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const createCustomPersona = async (req, res, next) => {
  let imageUrl;
  try {
    const { userId } = req.auth;
    const file = req.file;
    imageUrl = req.body.imageUrl || '';
    if (file) {
      imageUrl = await uploadToGCS(file);
      req.body.imageUrl = imageUrl;
    }
    const personaData = {
      ...req.body,
      imageUrl: imageUrl
    };
    const newPersona = await PersonaService.createPersona(personaData, userId);


    // 5. 사용자 활동 로깅
    logger.logUserActivity('CREATE_PERSONA', userId, {
      personaId: newPersona.id,
      personaName: newPersona.name
    });

    // 6. 성공 응답 생성
    res.status(201).json({
      message: '사용자 정의 페르소나를 성공적으로 생성했습니다.',
      data: newPersona,
    });

  } catch (error) {
    next(error);
  }
};

/**
 * AI를 사용하여 페르소나를 생성하는 컨트롤러
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const createAiPersona = errorHandler.asyncHandler(async (req, res) => {
  const { userId } = req.auth;

  // 이미지 업로드 처리
  let imageUrl = req.body.imageUrl || '';
  if (req.file) {
    imageUrl = `/api/uploads/${req.file.filename}`;
  }

  // 페르소나 데이터 준비
  const initialData = {
    ...req.body,
    imageUrl: imageUrl
  };

  // 서비스 호출
  const newPersona = await PersonaService.createPersonaWithAI(initialData, userId);

  // 사용자 활동 로깅
  logger.logUserActivity('CREATE_AI_PERSONA', userId, {
    personaId: newPersona.characterId,
    personaName: newPersona.name
  });

  return responseHandler.sendSuccess(res, 201, 'AI를 통해 페르소나를 성공적으로 생성했습니다.', newPersona);
});


async function isValidImageUrl(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      timeout: 5000 // 5초 타임아웃
    });

    // 상태코드가 200번대이고 content-type이 이미지인지 확인
    const contentType = response.headers.get('content-type');
    return response.ok && contentType && contentType.startsWith('image/');
  } catch (error) {
    return false;
  }
}


/**
 * AI를 사용하여 캐릭터 정보를 미리보기로만 생성 (DB 저장 X)
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const previewAiPersona = errorHandler.asyncHandler(async (req, res) => {
  const { name } = req.body;
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
        "tag": "캐릭터를 대표하는 해시태그 3가지 (쉼표로 구분, # 제외)",
        "imageUrl": ""
      }
    }
  `;
  let aiGeneratedDetails;
  let imageUrls;
  try {
    // aiGeneratedDetails = await import('../vertexai/gemini25.js').then(m => m.default.generatePersonaDetailsWithGemini(promptForGemini));
    aiGeneratedDetails = await import('../vertexai/gemini25.js').then(m => m.default.generateCharacterWithPerplexity(name));
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const GOOGLE_CX = process.env.GOOGLE_CX;
    // console.log('AI가 생성한 캐릭터 정보:', GOOGLE_API_KEY, GOOGLE_CX);
    imageUrls = await import('../vertexai/gemini25.js').then(m => m.default.getGoogleImages(name, GOOGLE_API_KEY, GOOGLE_CX));
    // console.log('AI가 생성한 캐릭터 정보:', userId, GOOGLE_API_KEY, GOOGLE_CX, imageUrls);
    // aiGeneratedDetails.prompt.imageUrl = aiGeneratedDetails.prompt.imageUrl[0]?.url || '';
    // aiGeneratedDetails.data.imageUrl = "ffffff";
    aiGeneratedDetails.prompt.imageUrl = [];
    for (const imageUrl of imageUrls) {
      if (await isValidImageUrl(imageUrl.url)) {
        aiGeneratedDetails.prompt.imageUrl.push(imageUrl.url);
      }
    }
    // aiGeneratedDetails.prompt.imageUrl = imageUrls[1]?.url || '';
    console.log('AI가 생성한 캐릭터 정보:', aiGeneratedDetails);

  } catch (error) {
    aiGeneratedDetails = {
      description: error.message + ' (AI가 캐릭터 정보를 생성하는 데 실패했습니다.)',
    };
      // 2. AI가 생성한 정보만 반환 (DB 저장 X)
    return responseHandler.sendSuccess(res, 500, 'AI로 생성된 캐릭터 정보 미리보기', {
      aiGeneratedDetails
    });
  }
  // 2. AI가 생성한 정보만 반환 (DB 저장 X)
  return responseHandler.sendSuccess(res, 200, 'AI로 생성된 캐릭터 정보 미리보기', {
    name,
    ...aiGeneratedDetails
  });
});

/**
 * 커뮤니티 페르소나 목록을 조회하는 컨트롤러
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const getPersonaList = errorHandler.asyncHandler(async (req, res) => {
  // 요청의 쿼리 파라미터를 서비스에 전달할 옵션 객체로 만듦
  const options = {
    keyword: req.query.keyword,
    sort: req.query.sort,
    currentUserId: req.auth ? req.auth.userId : null,
  };

  // 서비스 호출
  const { personas, total } = await PersonaService.getPersonas(options);

  return responseHandler.sendSuccess(res, 200, '페르소나 목록을 성공적으로 조회했습니다.', personas, {
    totalElements: total
  });
});

/**
 * [공개] 커뮤니티 페르소나 상세 정보를 조회하는 컨트롤러
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const getCommunityPersonaDetails = errorHandler.asyncHandler(async (req, res) => {
  const personaId = parseInt(req.params.characterId, 10);
  const currentUserId = req.auth ? req.auth.userId : null;

  const persona = await PersonaService.getPersonaDetails({
    personaId,
    currentUserId,
  });

  if (!persona) {
    return responseHandler.sendNotFound(res, '해당 페르소나를 찾을 수 없습니다.');
  }

  return responseHandler.sendSuccess(res, 200, '페르소나 정보를 조회했습니다.', persona);
});

/**
 * 나의 페르소나 목록(만든 것/좋아요 한 것)을 조회하는 컨트롤러
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const getMyPersonaList = errorHandler.asyncHandler(async (req, res) => {
  const { userId } = req.auth;
  const { type } = req.query;

  const personas = await PersonaService.getMyPersonas(userId, type);

  return responseHandler.sendSuccess(res, 200, '나의 페르소나 목록을 조회했습니다.', personas, {
    totalElements: personas.length
  });
});

/**
 * [인증 필수] 나의 페르소나 상세 정보를 조회하는 컨트롤러
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const getMyPersonaDetails = errorHandler.asyncHandler(async (req, res) => {
  const personaId = parseInt(req.params.characterId, 10);
  const { userId } = req.auth;

  // 새로운 친밀도 시스템에서 exp 조회
  const friendship = await prismaConfig.prisma.userCharacterFriendship.findUnique({
    where: {
      clerkId_personaId: {
        clerkId: userId,
        personaId: personaId
      }
    },
    select: { exp: true, friendship: true }
  });
  
  let exp = 0;
  let friendshipLevel = 1;
  if (friendship) {
    exp = friendship.exp;
    friendshipLevel = friendship.friendship;
  }
  const persona = await PersonaService.getPersonaDetails({
    personaId,
    ownerId: userId,
    currentUserId: userId,
  });

  if (!persona) {
    return responseHandler.sendNotFound(res, '해당 페르소나를 찾을 수 없거나 조회 권한이 없습니다.');
  }
  persona.exp = exp;

  return responseHandler.sendSuccess(res, 200, '나의 페르소나 정보를 조회했습니다.', persona);
});


/**
 * [PATCH] 페르소나 수정 (본인만 가능)
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const updatePersona = errorHandler.asyncHandler(async (req, res) => {
  const { userId } = req.auth;
  const personaId = parseInt(req.params.characterId, 10);
  const { introduction, personality, tone, tag } = req.body;
  const updateData = { introduction, personality, tone, tag };

  const updated = await PersonaService.updatePersona(personaId, userId, updateData);

  // 사용자 활동 로깅
  logger.logUserActivity('UPDATE_PERSONA', userId, {
    personaId,
    updateFields: Object.keys(updateData)
  });

  return responseHandler.sendSuccess(res, 200, '페르소나가 성공적으로 수정되었습니다.', updated);
});

/**
 * [DELETE] 페르소나 소프트 삭제 (본인만 가능)
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const deletePersona = errorHandler.asyncHandler(async (req, res) => {
  const { userId } = req.auth;
  const personaId = parseInt(req.params.characterId, 10);

  await PersonaService.deletePersona(personaId, userId);

  // 사용자 활동 로깅
  logger.logUserActivity('DELETE_PERSONA', userId, {
    personaId
  });

  return responseHandler.sendSuccess(res, 200, '페르소나가 성공적으로 삭제되었습니다.');
});

/**
 * 페르소나 좋아요 토글
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const toggleLike = errorHandler.asyncHandler(async (req, res) => {
  const { userId } = req.auth;
  const personaId = parseInt(req.params.characterId, 10);

  const result = await PersonaService.toggleLike(personaId, userId);

  // 사용자 활동 로깅
  logger.logUserActivity('TOGGLE_LIKE', userId, {
    personaId,
    action: result.liked ? 'LIKE' : 'UNLIKE'
  });

  return responseHandler.sendSuccess(res, 200, result.liked ? '페르소나를 좋아요했습니다.' : '페르소나 좋아요를 취소했습니다.', result);
});

/**
 * 조회수 증가
 *
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const incrementViewCount = errorHandler.asyncHandler(async (req, res) => {
  const personaId = parseInt(req.params.characterId, 10);

  await PersonaService.incrementViewCount(personaId);

  return responseHandler.sendSuccess(res, 200, '조회수가 증가되었습니다.');
});

export default {
  createCustomPersona,
  createAiPersona,
  previewAiPersona,
  getPersonaList,
  getCommunityPersonaDetails,
  getMyPersonaList,
  getMyPersonaDetails,
  updatePersona,
  deletePersona,
  toggleLike,
  incrementViewCount,
};
