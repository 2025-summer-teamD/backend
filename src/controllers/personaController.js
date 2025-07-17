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