import { prisma } from '../config/prisma.js';

/**
 * 특정 사용자의 채팅 목록을 페이지네이션하여 조회합니다.
 * @param {string} userId - 현재 로그인한 사용자의 Clerk ID
 * @param {object} pagination - 페이지네이션 옵션 { skip, take, page, size }
 * @returns {Promise<object>} { chatList, totalElements, totalPages }
 */
export const getMyChatList = async (userId, pagination) => {
  const { skip, take, page, size } = pagination;

  // 1. 내가 참여하고 삭제되지 않은 채팅방의 총 개수를 먼저 구한다.
  const totalElements = await prisma.chatRoom.count({
    where: {
      creatorId: userId,
      isDeleted: false,
    },
  });

  if (totalElements === 0) {
    return { chatList: [], totalElements: 0, totalPages: 0 };
  }
  
  // 2. 실제 데이터 조회: 관계된 데이터를 한 번의 쿼리로 가져온다.
  const chatRooms = await prisma.chatRoom.findMany({
    where: {
      creatorId: userId,
      isDeleted: false,
    },
    // 최신 채팅이 위로 오도록 정렬 (LastMessage의 생성 시간 기준)
    orderBy: {
      updatedAt: 'desc', // 채팅방 업데이트 시간을 기준으로 정렬하는 것이 더 효율적일 수 있음
    },
    skip: skip,
    take: take,
    include: {
      // ChatRoom에 연결된 Persona 정보 포함
      persona: {
        select: { // 페르소나에서 필요한 필드만 선택
          id: true,
          name: true,
          imageUrl: true,
        },
      },
      // ChatRoom에 연결된 모든 ChatLog 중 '마지막 1개'만 가져오기
      chatLogs: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1, 
        select: {
          text: true,
          createdAt: true,
        },
      },
    },
  });

  // 3. DB에서 가져온 데이터를 최종 API 응답 형태로 가공
  const chatList = chatRooms.map(room => {
    const lastChat = room.chatLogs.length > 0 ? room.chatLogs[0] : null;
    return {
      character_id: room.persona.id,
      name: room.persona.name,
      image_url: room.persona.imageUrl,
      last_chat: lastChat ? lastChat.text : null,
      time: lastChat ? lastChat.createdAt.toISOString() : null, // 실제 시간 데이터 사용
    };
  });

  const totalPages = Math.ceil(totalElements / size);

  return { chatList, totalElements, totalPages };
};