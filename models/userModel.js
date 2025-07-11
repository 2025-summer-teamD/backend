const prisma = require('../config/db');

exports.getUsers = async () => {
  return await prisma.user.findMany();
};
