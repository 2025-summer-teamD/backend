// 페르소나 생성 요청의 body를 검증하는 미들웨어
const validateCreatePersona = (req, res, next) => {
  let { name, imageUrl, isPublic, description } = req.body;
  let { prompt } = req.body;
  if (typeof isPublic === 'string') {
    isPublic = isPublic === 'true';
    req.body.isPublic = isPublic;
  }
  const hasImageFile = !!req.file;
  if (typeof prompt === 'string') {
    try {
      prompt = JSON.parse(prompt);
      req.body.prompt = prompt;
    } catch (err) {
      return res.status(400).json({ error: 'prompt가 유효한 JSON 형식이 아닙니다.' });
    }
  }
  // 필수 값만 간단히 체크
  if (!name?.trim() || typeof isPublic !== 'boolean' || !prompt || !description?.trim()) {
    return res.status(400).json({ error: '필수 값이 누락되었습니다. (name, isPublic, prompt, description)' });
  }
  // 이미지: 파일이 없으면 imageUrl만 체크
  if (!hasImageFile && (!imageUrl || !imageUrl.trim())) {
    return res.status(400).json({ error: '이미지 파일 또는 imageUrl이 필요합니다.' });
  }
  // prompt 객체 필드만 체크
  if (typeof prompt !== 'object' || prompt === null ||
      typeof prompt.tone !== 'string' ||
      typeof prompt.personality !== 'string' ||
      typeof prompt.tag !== 'string') {
    return res.status(400).json({ error: 'prompt의 각 필드(tone, personality, tag)는 문자열이어야 합니다.' });
  }
  next();
};

// 페르소나 목록 조회 요청의 쿼리를 검증하는 미들웨어
const validateGetPersonas = (req, res, next) => {
  const { sort } = req.query;

  if (sort && !['likes', 'usesCount', 'createdAt'].includes(sort)) {
    return res.status(400).json({
      error: "잘못된 정렬 값입니다. 'likes', 'usesCount', 'createdAt' 중 하나를 사용해주세요.",
    });
  }

  next();
};

// 경로 파라미터 ID가 유효한 숫자인지 검증하는 미들웨어
const validateIdParam = (req, res, next) => {
  const id = parseInt(req.params.characterId, 10);

  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: '유효하지 않은 캐릭터 ID입니다. ID는 양의 정수여야 합니다.' });
  }

  next();
};


// roomId 파라미터 검증 미들웨어 (chat 전용)
const validateRoomIdParam = (req, res, next) => {
  const roomId = parseInt(req.params.roomId, 10);

  if (isNaN(roomId) || roomId <= 0) {
    return res.status(400).json({ error: '유효하지 않은 roomId입니다. ID는 양의 정수여야 합니다.' });
  }

  // 검증된 roomId를 req에 저장 (컨트롤러에서 재검증 불필요)
  req.validatedRoomId = roomId;
  next();
};

// '나의 페르소나 목록' 조회 요청의 쿼리를 검증하는 미들웨어

const validateMyPersonaList = (req, res, next) => {
  const { type } = req.query;

  if (type && !['liked', 'created'].includes(type)) {
    return res.status(400).json({
      error: "잘못된 type 값입니다. 'liked', 'created' 중 하나를 사용하거나 생략해주세요.",
    });
  }

  next();
};

// AI 기반 페르소나 생성 요청의 body를 검증하는 미들웨어
const validateAiCreatePersona = (req, res, next) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '캐릭터 이름(name)은 필수입니다.' });
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
