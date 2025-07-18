import { prisma } from '../config/prisma.js';

// Clerk 인증 미들웨어 다음에 실행
const ensureUserInDB = async (req, res, next) => {
  try {
    const { userId } = req.auth; // Clerk 미들웨어가 req.auth에 userId를 넣어줌
    if (!userId) return res.status(401).json({ error: '인증 필요' });

    await prisma.user.upsert({
      where: { clerkId: userId },
      update: {}, // 이미 있으면 아무것도 안 함
      create: {
        clerkId: userId,
        createdAt: new Date(),
        isDeleted: false,
      },
    });

    next();
  } catch (err) {
    next(err);
  }
};

export default ensureUserInDB; 