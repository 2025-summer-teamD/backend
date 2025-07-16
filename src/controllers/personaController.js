const personaService = require('../services/personaService');

exports.createPersona = async (req, res) => {
  const { name, image_url, clerk_id, is_public } = req.body;

  try {
    await personaService.createPersona({ name, image_url, clerk_id, is_public });
    return res.status(201).json({ message: '캐릭터 생성 성공' });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ message: '캐릭터 생성 실패' });
  }
};
