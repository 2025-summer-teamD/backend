const express = require('express');
const router = express.Router();

// 더미 데이터 - users 테이블 (2개)
const users = [
  {
    clerk_id: 'user_2abc123def456',
    created_at: '2024-01-15T09:30:00.000Z',
    updated_at: '2024-01-20T14:22:00.000Z',
    is_deleted: false
  },
  {
    clerk_id: 'user_3xyz789ghi012',
    created_at: '2024-01-18T11:45:00.000Z',
    updated_at: '2024-01-25T16:33:00.000Z',
    is_deleted: false
  }
];

// 더미 데이터 - Persona 테이블 (3개)
const personas = [
  {
    id: 1,
    clerk_id: 'user_2abc123def456',
    name: '친근한 상담사',
    image_url: 'https://example.com/counselor.png',
    is_public: true,
    introduction: '따뜻하고 친근한 마음으로 상담해드립니다.',
    prompt: {
      tone: '친근하고 따뜻한 말투',
      personality: '공감능력이 뛰어나고 인내심이 강함',
      tag: '#상담 #친근 #따뜻함'
    },
    uses_count: 1250,
    likes_count: 320,
    created_at: '2024-01-15T10:00:00.000Z',
    updated_at: '2024-01-25T15:30:00.000Z',
    is_deleted: false
  },
  {
    id: 2,
    clerk_id: 'user_3xyz789ghi012',
    name: '학습 도우미',
    image_url: 'https://example.com/tutor.png',
    is_public: true,
    introduction: '공부가 재미있어지도록 도와드립니다!',
    prompt: {
      tone: '밝고 격려하는 말투',
      personality: '지식이 풍부하고 인내심이 많음',
      tag: '#교육 #학습 #격려'
    },
    uses_count: 890,
    likes_count: 156,
    created_at: '2024-01-18T12:00:00.000Z',
    updated_at: '2024-01-24T09:15:00.000Z',
    is_deleted: false
  },
  {
    id: 3,
    clerk_id: 'user_2abc123def456',
    name: '유머러스한 친구',
    image_url: 'https://example.com/funny-friend.png',
    is_public: true,
    introduction: '재미있는 이야기로 하루를 밝게 만들어드려요!',
    prompt: {
      tone: '유머러스하고 장난스러운 말투',
      personality: '밝고 긍정적이며 재치있음',
      tag: '#유머 #재미 #친구'
    },
    uses_count: 650,
    likes_count: 203,
    created_at: '2024-01-20T14:30:00.000Z',
    updated_at: '2024-01-26T11:20:00.000Z',
    is_deleted: false
  }
];

// 더미 데이터 - ChatRoom 테이블 (3개)
const chatRooms = [
  {
    id: 1,
    clerk_id: 'user_2abc123def456',
    character_id: 1,
    friendship: 5,
    exp: 120,
    likes: true,
    created_at: '2024-01-15T11:00:00.000Z',
    updated_at: '2024-01-25T16:45:00.000Z',
    is_deleted: false
  },
  {
    id: 2,
    clerk_id: 'user_2abc123def456',
    character_id: 2,
    friendship: 3,
    exp: 75,
    likes: false,
    created_at: '2024-01-18T13:30:00.000Z',
    updated_at: '2024-01-24T10:20:00.000Z',
    is_deleted: false
  },
  {
    id: 3,
    clerk_id: 'user_3xyz789ghi012',
    character_id: 3,
    friendship: 4,
    exp: 95,
    likes: true,
    created_at: '2024-01-20T15:00:00.000Z',
    updated_at: '2024-01-26T12:30:00.000Z',
    is_deleted: false
  }
];

// 더미 데이터 - ChatLog 테이블 (각 채팅방별 마지막 메시지)
const chatLogs = [
  {
    id: 1,
    chatroom_id: 1,
    text: '오늘 하루도 수고했어요! 내일은 더 좋은 일이 있을 거예요.',
    type: 'text',
    speaker: 'ai',
    time: '2024-01-25T16:45:00.000Z',
    is_deleted: false
  },
  {
    id: 2,
    chatroom_id: 2,
    text: '수학 문제 푸는 방법을 알려주세요.',
    type: 'text',
    speaker: 'user',
    time: '2024-01-24T10:20:00.000Z',
    is_deleted: false
  },
  {
    id: 3,
    chatroom_id: 3,
    text: '하하하! 그 농담 정말 재미있네요! 😄',
    type: 'text',
    speaker: 'ai',
    time: '2024-01-26T12:30:00.000Z',
    is_deleted: false
  }
];

/**
 * @swagger
 * /my/chat-characters:
 *   get:
 *     summary: 대화한 캐릭터 목록 조회
 *     description: 현재 사용자가 대화한 적이 있는 캐릭터들의 목록을 조회합니다
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *           default: user_2abc123def456
 *         description: 사용자 ID (테스트용)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: 한 페이지당 개수
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 characters:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       character_id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       image_url:
 *                         type: string
 *                       last_chat:
 *                         type: string
 *                       time:
 *                         type: string
 *                 page_info:
 *                   type: object
 *                   properties:
 *                     current_page:
 *                       type: integer
 *                     total_pages:
 *                       type: integer
 *                     total_elements:
 *                       type: integer
 *             example:
 *               characters:
 *                 - character_id: 1
 *                   name: "친근한 상담사"
 *                   image_url: "https://example.com/counselor.png"
 *                   last_chat: "오늘 하루도 수고했어요! 내일은 더 좋은 일이 있을 거예요."
 *                   time: "오후 3:45"
 *                 - character_id: 2
 *                   name: "학습 도우미"
 *                   image_url: "https://example.com/tutor.png"
 *                   last_chat: "수학 문제 푸는 방법을 알려주세요."
 *                   time: "오후 3:45"
 *               page_info:
 *                 current_page: 1
 *                 total_pages: 1
 *                 total_elements: 2
 *       
 *       400:
*         description: 잘못된 요청 파라미터
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 message:
*                   type: string
*             example:
*               message: "페이지 번호는 1 이상이어야 합니다."

 *       404:
 *         description: 채팅한 캐릭터가 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 result:
 *                   type: string
 *             example:
 *               message: "채팅한 캐릭터가 없습니다."
 *               result: null
 *       500:
 *         description: 서버 내부 오류
 */
router.get('/', (req, res) => {
  const { user_id = 'user_2abc123def456', page = 1, size = 10 } = req.query;
  

  // 해당 사용자의 채팅방 찾기
  const userChatRooms = chatRooms.filter(room => room.clerk_id === user_id && !room.is_deleted);
  
  if (userChatRooms.length === 0) {
    return res.status(404).json({
      message: "채팅한 캐릭터가 없습니다.",
      result: null,
    });
  }

  // 채팅 캐릭터 목록 생성
  const chatCharacters = userChatRooms.map(room => {
    const persona = personas.find(p => p.id === room.character_id);
    const lastChat = chatLogs.find(log => log.chatroom_id === room.id);
    
    return {
      character_id: persona.id,
      name: persona.name,
      image_url: persona.image_url,
      last_chat: lastChat ? lastChat.text : null,
      time: lastChat ? "오후 3:45" : null,
    };
  });

  // 페이지네이션
  const totalElements = chatCharacters.length;
  const totalPages = Math.ceil(totalElements / size);
  
  res.status(200).json({
    characters: chatCharacters,
    page_info: {
      current_page: parseInt(page),
      total_pages: totalPages,
      total_elements: totalElements,
    },
  });
});

module.exports = router; 