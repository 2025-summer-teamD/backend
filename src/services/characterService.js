const prisma = require('../config/prisma');

async function createPersona({ name, image_url, is_public }) {
  return prisma.persona.create({
    data: { name, image_url, is_public }
  });
}

module.exports = { createPersona }; 