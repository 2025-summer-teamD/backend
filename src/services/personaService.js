const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createPersona = async ({ name, image_url, clerk_id, is_public }) => {
  return await prisma.persona.create({
    data: {
      name,
      image_url,
      clerk_id,
      is_public,
    },
  });
};
