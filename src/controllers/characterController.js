const characterService = require('../services/characterService');

async function createCharacter(req, res, next) {
  try {
    const { name, image_url, is_public } = req.body;
    await characterService.createPersona({ name, image_url, is_public });
    res.status(201).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { createCharacter }; 