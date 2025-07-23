// 페르소나 생성 요청의 body를 검증하는 미들웨어
const validateCreatePersona = (req, res, next) => {
  const { name, imageUrl, isPublic, prompt, description } = req.body;
  
  // 1. 필수 값 존재 여부 검사, 유효하지 않으면 400 Bad Request 에러로 즉시 응답하고 체인을 중단
  if (!name || !name.trim() || !imageUrl || !imageUrl.trim() || typeof isPublic !== 'boolean' || !prompt || !description || !description.trim()) { 
    return res.status(400).json({ error: '필수 값이 누락되었습니다. (name, imageUrl, isPublic, prompt, description)' });
  }
  
  // URL format validation - 상대 경로도 허용
  if (imageUrl.startsWith('/')) {
    // 상대 경로는 허용 (예: /api/uploads/default-character.svg)
    // 추가 검증 없이 통과
  } else {
    // 절대 URL인 경우에만 URL 형식 검증
    try {
      const parsed = new URL(imageUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch (err) {
      return res.status(400).json({ error: 'imageUrl은 유효한 URL 형식이어야 합니다.' });
    }
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

// 페르소나 목록 조회 요청의 쿼리를 검증하는 미들웨어
const validateGetPersonas = (req, res, next) => {
  const { sort } = req.query;

  // sort 파라미터가 존재하지만, 허용된 값이 아닌 경우
  if (sort && !['likes', 'usesCount', 'createdAt'].includes(sort)) { // createdAt 추가
    return res.status(400).json({ 
      error: "잘못된 정렬 값입니다. 'likes', 'usesCount', 'createdAt' 중 하나를 사용해주세요." 
    });
  }

  // 모든 검사를 통과하면 컨트롤러로 넘어감
  next();
};

// 경로 파라미터 ID가 유효한 숫자인지 검증하는 미들웨어
const validateIdParam = (req, res, next) => {
  const id = parseInt(req.params.characterId, 10);

  // isNaN(id)는 id가 숫자가 아님을 의미합니다.
  // id <= 0은 유효하지 않은 ID 값(보통 ID는 1부터 시작)임을 의미합니다.
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: '유효하지 않은 캐릭터 ID입니다. ID는 양의 정수여야 합니다.' });
  }

  // 검사를 통과하면 다음으로 넘어감
  next();
};

// room_id 파라미터 검증 미들웨어 (chat 전용)
const validateRoomIdParam = (req, res, next) => {
  const roomId = parseInt(req.params.room_id, 10);

  if (isNaN(roomId) || roomId <= 0) {
    return res.status(400).json({ error: '유효하지 않은 room_id입니다. ID는 양의 정수여야 합니다.' });
  }

  // 검증된 roomId를 req에 저장 (컨트롤러에서 재검증 불필요)
  req.validatedRoomId = roomId;
  next();
};

// '나의 페르소나 목록' 조회 요청의 쿼리를 검증하는 미들웨어
const validateMyPersonaList = (req, res, next) => {
  const { type } = req.query;

  // type 파라미터가 존재하지만, 허용된 값이 아닌 경우
  if (type && !['liked', 'created'].includes(type)) { // 'created'를 기본값으로 명시
    return res.status(400).json({ 
      error: "잘못된 type 값입니다. 'liked', 'created' 중 하나를 사용하거나 생략해주세요." 
    });
  }

  next();
};

// AI 기반 페르소나 생성 요청의 body를 검증하는 미들웨어
const validateAiCreatePersona = (req, res, next) => {
  const { name, imageUrl, isPublic } = req.body;

  // AI가 생성할 필드(description, prompt 등)는 필수가 아님
  if (!name || !imageUrl || typeof isPublic !== 'boolean') {
    return res.status(400).json({ error: '필수 값이 누락되었습니다. (name, imageUrl, isPublic)' });
  }
  next();
};

const personaValidator = {
  validateCreatePersona,
  validateGetPersonas,
  validateIdParam,
  validateRoomIdParam,
  validateMyPersonaList,
  validateAiCreatePersona,
};

export default personaValidator;
