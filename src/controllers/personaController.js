import * as PersonaService from '../services/personaService.js';

/**
 * 사용자 정의 페르소나를 생성하는 요청을 처리하는 컨트롤러
 */
export const createCustomPersona = async (req, res, next) => {
  try {
    // 1. 누가 요청했는지 확인 (requireAuth 미들웨어 덕분에 가능)
    const { userId } = req.auth; 
    
    // 2. 서비스 호출: 실제 생성 작업은 서비스에 위임
    //    요청 body 전체를 서비스에 전달
    const newPersona = await PersonaService.createPersona(req.body, userId);

    // 3. 성공 응답 생성
    res.status(201).json({ 
      message: '사용자 정의 페르소나를 성공적으로 생성했습니다.',
      data: newPersona,
    });
  } catch (error) {
    // 서비스에서 발생한 에러는 중앙 에러 핸들러로 전달
    next(error);
  }
};

/**
 * AI를 사용하여 페르소나를 생성하는 컨트롤러
 */
export const createAiPersona = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const initialData = req.body;

    // 서비스 호출
    const newPersona = await PersonaService.createPersonaWithAI(initialData, userId);
    
    res.status(201).json({
      message: 'AI를 통해 페르소나를 성공적으로 생성했습니다.',
      data: newPersona,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 페르소나 목록을 조회하는 컨트롤러
 */
export const getPersonaList = async (req, res, next) => {
  try {
    // 1. 요청의 쿼리 파라미터를 서비스에 전달할 옵션 객체로 만듦
    const options = {
      keyword: req.query.keyword,
      sort: req.query.sort,
    };

    // 2. 서비스 호출: 실제 조회, 필터링, 정렬은 서비스가 알아서 처리
    const { personas, total } = await PersonaService.getPersonas(options);

    // 3. 성공 응답 생성
    res.status(200).json({
      data: personas,
      page_info: {
        total_elements: total,
        // TODO: total_pages, page, size 등 추가 가능
      },
    });
  } catch (error) {
    next(error); // 서비스 에러는 중앙 핸들러로
  }
};

/**
 * [공개] 커뮤니티 페르소나 상세 정보를 조회하는 컨트롤러
 */
export const getCommunityPersonaDetails = async (req, res, next) => {
  try {
    const personaId = parseInt(req.params.character_id, 10);
    // 로그인 여부에 따라 '좋아요' 상태를 보여주기 위해 userId를 선택적으로 넘김
    const currentUserId = req.auth ? req.auth.userId : null;

    const persona = await PersonaService.getPersonaDetails({
      personaId,
      currentUserId, // 소유권 검증 없이, '좋아요' 상태 계산만 위임
      // ownerId는 전달하지 않음
    });

    if (!persona) {
      return res.status(404).json({ message: '해당 페르소나를 찾을 수 없습니다.' });
    }
    res.status(200).json({ message: '페르소나 정보를 조회했습니다.', data: persona });
  } catch (error) {
    next(error);
  }
};


/**
 * 나의 페르소나 목록(만든 것/좋아요 한 것)을 조회하는 컨트롤러
 */
export const getMyPersonaList = async (req, res, next) => {
  try {
    // requireAuth 미들웨어가 userId를 보장
    const { userId } = req.auth;
    const { type } = req.query; // validator가 유효성 보장

    // 서비스 호출: 모든 복잡한 로직은 서비스가 처리
    const personas = await PersonaService.getMyPersonas(userId, type);

    res.status(200).json({
      data: personas,
      page_info: {
        total_elements: personas.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * [인증 필수] 나의 페르소나 상세 정보를 조회하는 컨트롤러
 */
export const getMyPersonaDetails = async (req, res, next) => {
  try {
    const personaId = parseInt(req.params.character_id, 10);
    const { userId } = req.auth; // requireAuth 미들웨어 덕분에 항상 존재

    const persona = await PersonaService.getPersonaDetails({
      personaId,
      ownerId: userId,       // ★★★ 소유권 검증을 위해 자신의 ID를 ownerId로 전달
      currentUserId: userId, // '좋아요' 상태 계산을 위해 자신의 ID를 전달
    });

    if (!persona) {
      // 내 것이 아니거나, 존재하지 않는 경우
      return res.status(404).json({ message: '해당 페르소나를 찾을 수 없거나 조회 권한이 없습니다.' });
    }
    res.status(200).json({ message: '나의 페르소나 정보를 조회했습니다.', data: persona });
  } catch (error) {
    next(error);
  }
};

/**
 * [PATCH] 페르소나 수정 (본인만 가능)
 */
export const updatePersona = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const personaId = parseInt(req.params.id, 10);
    const { introduction, personality, tone, tag } = req.body;
    const updateData = { introduction, personality, tone, tag };
    const updated = await PersonaService.updatePersona(personaId, userId, updateData);
    res.status(200).json({ message: '페르소나가 성공적으로 수정되었습니다.', data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * [DELETE] 페르소나 소프트 삭제 (본인만 가능)
 */
export const deletePersona = async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const personaId = parseInt(req.params.id, 10);
    const deleted = await PersonaService.deletePersona(personaId, userId);
    res.status(200).json({ message: '페르소나가 성공적으로 삭제되었습니다.', data: deleted });
  } catch (error) {
    next(error);
  }
};