import { prisma } from '../config/prisma.js';

// Clerk 인증 미들웨어 다음에 실행
const ensureUserInDB = async (req, res, next) => {
  try {
    const { userId, user } = req.auth; // Clerk 미들웨어가 req.auth에 userId와 user 정보를 넣어줌
    if (!userId) return res.status(401).json({ error: '인증 필요' });

    // Clerk에서 제공하는 사용자 정보
    const userData = {
      clerkId: userId,
      name: user?.fullName || user?.firstName || null,
      email: user?.emailAddresses?.[0]?.emailAddress || null,
      firstName: user?.firstName || null,
      lastName: user?.lastName || null,
      createdAt: new Date(),
      isDeleted: false,
    };

    await prisma.user.upsert({
      where: { clerkId: userId },
      update: {
        // 기존 사용자 정보 업데이트 (Clerk 정보가 변경되었을 수 있음)
        name: userData.name,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        updatedAt: new Date(),
      },
      create: userData,
    });

    next();
  } catch (err) {
    console.error('사용자 DB 저장 에러:', err);
    next(err);
  }
};

export default ensureUserInDB; 