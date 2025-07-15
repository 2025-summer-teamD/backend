const { PrismaClient } = require('@prisma/client');

// PrismaClient는 앱 전체에서 하나만 생성해서 재사용하는 것이 좋습니다.
const prisma = new PrismaClient();

module.exports = prisma;
