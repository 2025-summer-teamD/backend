// 페르소나 생성 요청의 body를 검증하는 미들웨어
export const validateCreatePersona = (req, res, next) => {
    const { name, image_url, is_public, prompt, description } = req.body;
  
    // 1. 필수 값 존재 여부 검사, 유효하지 않으면 400 Bad Request 에러로 즉시 응답하고 체인을 중단
    if (!name || !name.trim() || !image_url || !image_url.trim() || typeof is_public !== 'boolean' || !prompt || !description || !description.trim()) { 
      return res.status(400).json({ error: '필수 값이 누락되었습니다. (name, image_url, is_public, prompt, description)' });
    }
  
    // URL format validation
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(image_url)) {
      return res.status(400).json({ error: 'image_url은 유효한 URL 형식이어야 합니다.' });
    }

    // 2. prompt 객체 내부 타입 검사
    if (typeof prompt !== 'object' || prompt === null) {
      return res.status(400).json({ error: 'prompt는 객체여야 합니다.' });
    }

    if (
      typeof prompt.tone !== 'string' ||
      typeof prompt.personality !== 'string' ||
      typeof prompt.tag !== 'string'
    ) {
      return res.status(400).json({ error: 'prompt의 각 필드(tone, personality, tag)는 문자열이어야 합니다.' });
    }
    
    // 3. 모든 검사를 통과하면 다음 미들웨어 또는 컨트롤러로 제어권을 넘김
    next();
  };