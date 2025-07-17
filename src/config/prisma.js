// PrismaClient는 앱 전체에서 하나만 생성해서 재사용하는 것이 좋습니다.
import { PrismaClient } from '@prisma/client';

// prisma 클라이언트 인스턴스를 생성하고 'prisma'라는 이름으로 내보냅니다.
export const prisma = new PrismaClient();