const { createCustomPersonaService } = require('../services/personaService');

function createCustomPersona(req, res) {
  const { name, image_url, is_public, prompt, description } = req.body;
  if (!name || !image_url || typeof is_public !== 'boolean' || !prompt || !description) {
    return res.status(400).json({ message: '필수 값이 누락되었습니다.' });
  }
  if (
    typeof prompt.tone !== 'string' ||
    typeof prompt.personality !== 'string' ||
    typeof prompt.tag !== 'string'
  ) {
    return res.status(400).json({ message: 'prompt의 각 필드는 문자열이어야 합니다.' });
  }
  const persona = createCustomPersonaService({ name, image_url, is_public, prompt, description });
  res.status(201).json({ message: '사용자 정의 캐릭터가 생성되었습니다.', persona });
}

module.exports = { createCustomPersona };
