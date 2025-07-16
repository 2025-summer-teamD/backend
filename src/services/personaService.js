// 현재는 메모리 내 배열을 사용하지만, 나중에 Prisma 같은 DB로 쉽게 교체 가능
import { prisma } from '../config/prisma.js'; 

/**
 * 새로운 페르소나를 생성하고 데이터베이스에 저장합니다.
 * @param {object} personaData - 컨트롤러에서 전달받은 페르소나 데이터
 * @param {string} userId - 이 페르소나를 생성한 사용자의 Clerk ID
 * @returns {Promise<object>} 생성된 페르소나 객체
 */
export const createPersona = async (personaData, userId) => {
  const { name, image_url, is_public, prompt, description } = personaData;

  // DB에 저장하는 로직 (Prisma 예시)
  // 여기서 prompt는 JSON 타입으로 DB에 저장될 수 있습니다.
  const newPersona = await prisma.persona.create({
    data: {
      name,
      imageUrl: image_url, // DB 스키마 필드명에 맞게 매핑 (camelCase)
      isPublic: is_public,
      description,
      prompt, // prompt 객체 그대로 저장 (DB가 JSON 타입을 지원할 경우)
      creatorId: userId, // 페르소나를 생성한 사용자 ID 연결
    }
  });

  return newPersona;
};