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
