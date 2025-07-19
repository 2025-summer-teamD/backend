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

/**
 * 사용자 정의 페르소나를 생성하는 요청을 처리하는 컨트롤러
 * 
 * @param {object} req - Express request 객체
 * @param {object} res - Express response 객체
 * @param {function} next - Express next 함수
 */
const createCustomPersona = errorHandler.asyncHandler(async (req, res) => {
  const { userId } = req.auth;
  
  // 이미지 업로드 처리
  let imageUrl = req.body.image_url || '';
  if (req.file) {
    imageUrl = `/api/uploads/${req.file.filename}`;
  }

  // 페르소나 데이터 준비
  const personaData = {
    ...req.body,
    image_url: imageUrl
  };

  // 서비스 호출
  const newPersona = await PersonaService.createPersona(personaData, userId);

  // 사용자 활동 로깅
  logger.logUserActivity('CREATE_PERSONA', userId, {
    personaId: newPersona.character_id,
    personaName: newPersona.name
  });

  return responseHandler.sendSuccess(res, 201, '사용자 정의 페르소나를 성공적으로 생성했습니다.', newPersona);
});

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
  let imageUrl = req.body.image_url || '';
  if (req.file) {
    imageUrl = `/api/uploads/${req.file.filename}`;
  }

  // 페르소나 데이터 준비
  const initialData = {
    ...req.body,
    image_url: imageUrl
  };

  // 서비스 호출
  const newPersona = await PersonaService.createPersonaWithAI(initialData, userId);

  // 사용자 활동 로깅
  logger.logUserActivity('CREATE_AI_PERSONA', userId, {
    personaId: newPersona.character_id,
    personaName: newPersona.name
  });

  return responseHandler.sendSuccess(res, 201, 'AI를 통해 페르소나를 성공적으로 생성했습니다.', newPersona);
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
    total_elements: total
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
  const personaId = parseInt(req.params.character_id, 10);
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
    total_elements: personas.length
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
  const personaId = parseInt(req.params.character_id, 10);
  const { userId } = req.auth;

  const persona = await PersonaService.getPersonaDetails({
    personaId,
    ownerId: userId,
    currentUserId: userId,
  });

  if (!persona) {
    return responseHandler.sendNotFound(res, '해당 페르소나를 찾을 수 없거나 조회 권한이 없습니다.');
  }

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
  const personaId = parseInt(req.params.character_id, 10);
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
  const personaId = parseInt(req.params.character_id, 10);
  
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
  const personaId = parseInt(req.params.character_id, 10);
  
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
  const personaId = parseInt(req.params.character_id, 10);
  
  await PersonaService.incrementViewCount(personaId);

  return responseHandler.sendSuccess(res, 200, '조회수가 증가되었습니다.');
});

export default {
  createCustomPersona,
  createAiPersona,
  getPersonaList,
  getCommunityPersonaDetails,
  getMyPersonaList,
  getMyPersonaDetails,
  updatePersona,
  deletePersona,
  toggleLike,
  incrementViewCount
};
