const prisma = require('../config/prisma');

async function createPersona({ clerk_id, name, image_url, is_public }) {
  return prisma.persona.create({
    data: { clerk_id, name, image_url, is_public }
  });
}

module.exports = { createPersona };
