// 현재는 메모리 내 배열을 사용하지만, 나중에 Prisma 같은 DB로 쉽게 교체 가능
import { prisma } from '../config/prisma.js'; 

/**
 * 새로운 페르소나를 생성하고 데이터베이스에 저장합니다.
 * @param {object} personaData - 컨트롤러에서 전달받은 페르소나 데이터
 * @param {string} userId - 이 페르소나를 생성한 사용자의 Clerk ID
 * @returns {Promise<object>} 생성된 페르소나 객체
 */
export const createPersona = async (personaData, userId) => {
  try {
    const { name, image_url, is_public, prompt, description } = personaData;

    // Sanitize string inputs
    const sanitizedData = {
      name: name.trim(),
      imageUrl: image_url.trim(),
      isPublic: is_public,
      description: description.trim(),
      prompt: {
        tone: prompt.tone.trim(),
        personality: prompt.personality.trim(),
        tag: prompt.tag.trim()
      },
      creatorId: userId
    };
    // DB에 저장하는 로직 (Prisma 예시)
    // 여기서 prompt는 JSON 타입으로 DB에 저장될 수 있습니다.
    const newPersona = await prisma.persona.create({
      data: sanitizedData
    });
    
    return newPersona;
    } catch (error) {
      // Log the error for debugging
      console.error('Error creating persona:', error);
      throw new Error('페르소나 생성 중 오류가 발생했습니다.');
    }
};

/**
 * 필터링 및 정렬 조건에 따라 페르소나 목록을 조회합니다.
 * @param {object} options - 조회 옵션 객체
 * @param {string} [options.keyword] - 검색 키워드
 * @param {string} [options.sort] - 정렬 기준 ('likes', 'uses_count', 'createdAt')
 * @returns {Promise<{personas: Array<object>, total: number}>} 페르소나 목록과 총 개수
 */
export const getPersonas = async (options = {}) => {
  const { keyword, sort } = options;

  // 1. Prisma 쿼리 조건 객체 생성
  const where = {};
  if (keyword) {
    // 키워드가 있으면 name 또는 description 필드에서 대소문자 구분 없이 검색
    where.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { description: { contains: keyword, mode: 'insensitive' } }, // introduction 대신 description 사용
    ];
  }

  // 2. Prisma 정렬 조건 객체 생성
  const orderBy = {};
  if (sort === 'likes') {
    orderBy.likes = 'desc'; // 내림차순
  } else if (sort === 'uses_count') {
    orderBy.usesCount = 'desc'; // DB 필드명은 camelCase로
  } else {
    // 기본 정렬은 최신순
    orderBy.createdAt = 'desc';
  }

  // 3. DB에서 데이터 조회
  const personas = await prisma.persona.findMany({
    where,   // 검색 조건 적용
    orderBy, // 정렬 조건 적용
    // TODO: 페이지네이션(Pagination) 로직 추가 (skip, take)
  });

  // 4. 전체 개수 조회 (페이지네이션을 위해)
  const total = await prisma.persona.count({ where });

  return { personas, total };
};

/**
 * ID로 특정 페르소나의 상세 정보를 조회합니다.
 * @param {number} id - 조회할 페르소나의 ID
 * @returns {Promise<object|null>} 조회된 페르소나 객체 또는 찾지 못한 경우 null
 */
export const getPersonaById = async (id) => {
  const persona = await prisma.persona.findUnique({
    where: {
      id: id, // DB 스키마의 id 필드와 매핑
    },
    // (선택) 관련 데이터를 함께 로드하고 싶을 때 사용
    // include: {
    //   creator: true, // 생성자 정보
    // }
  });

  return persona; // 찾으면 객체, 못 찾으면 null 반환
};

/**
 * 특정 사용자의 페르소나 목록을 조회합니다. (만든 것 또는 좋아요 한 것)
 * @param {string} userId - 현재 로그인한 사용자의 Clerk ID
 * @param {string} type - 조회할 타입 ('created' 또는 'liked')
 * @returns {Promise<Array<object>>} 가공된 페르소나 목록
 */
export const getMyPersonas = async (userId, type = 'created') => {
  if (type === 'liked') {
    // --- 내가 좋아요 한 페르소나 조회 로직 ---
    
    // 1. 내가 좋아요 한 ChatRoom을 먼저 찾는다.
    const likedChatRooms = await prisma.chatRoom.findMany({
      where: {
        creatorId: userId,  // ChatRoom 생성자 ID가 내 ID이고
        liked: true,        // liked가 true이며
        persona: {          // 연결된 페르소나가
          isDeleted: false, // 삭제되지 않은 경우
        }
      },
      include: {
        persona: true, // 관련된 페르소나 정보를 함께 가져온다 (Join)
      }
    });

    // 2. 결과를 최종 응답 형태로 가공한다.
    return likedChatRooms.map(room => ({
      character_id: room.persona.id,
      name: room.persona.name,
      image_url: room.persona.imageUrl,
      introduction: room.persona.description,
      likes: room.persona.likes,
      liked: true, // 이 목록은 항상 true
      intimacy: room.intimacy, // friendship 대신 intimacy로 가정
      is_deleted: room.persona.isDeleted,
    }));

  } else {
    // --- 내가 만든 페르소나 조회 로직 ('created') ---

    // 1. 내가 만든 페르소나를 모두 찾는다.
    const myCreatedPersonas = await prisma.persona.findMany({
      where: {
        creatorId: userId,    // 페르소나 생성자 ID가 내 ID이고
        isDeleted: false,     // 삭제되지 않은 경우
      },
      include: {
        // 이 페르소나와 '나' 사이의 채팅방 정보를 함께 가져온다.
        chatRooms: {
          where: {
            creatorId: userId,
          }
        }
      }
    });

    // 2. 결과를 최종 응답 형태로 가공한다.
    return myCreatedPersonas.map(p => {
      // 나와의 채팅방은 유일하거나 없어야 한다.
      const myRoom = p.chatRooms.length > 0 ? p.chatRooms[0] : null;
      
      return {
        character_id: p.id,
        name: p.name,
        image_url: p.imageUrl,
        introduction: p.description,
        likes: p.likes,
        liked: myRoom ? myRoom.liked : false,
        intimacy: myRoom ? myRoom.intimacy : 0,
        is_deleted: p.isDeleted,
      };
    });
  }
};