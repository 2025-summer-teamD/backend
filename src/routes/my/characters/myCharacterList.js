const express = require('express');
const router = express.Router();

const myId = 'user_1';

// 더미 Persona 데이터
const personas = [
  { id: 1, clerk_id: 'user_1', name: '내가 만든 캐릭터', image_url: '...', introduction: '...', is_deleted: false, likes: 10 },
  { id: 2, clerk_id: 'user_2', name: '남이 만든 캐릭터', image_url: '...', introduction: '...', is_deleted: false, likes: 20 },
  // ...
];

// 더미 ChatRoom 데이터 (저장/찜/친밀도 관리)
const chatRooms = [
  { id: 1, clerk_id: 'user_1', character_id: 2, likes: true, friendship: 70, is_deleted: false }, // 내가 찜한 남의 캐릭터
  { id: 2, clerk_id: 'user_1', character_id: 1, likes: false, friendship: 100, is_deleted: false }, // 내가 만든 캐릭터와의 관계
];

 /**
  * @swagger
  * /my/characters/list:
  *   get:
  *     summary: 내 캐릭터/찜한 캐릭터 목록 조회
  *     description: 내가 만든 캐릭터 또는 내가 찜한(하트 누른) 캐릭터 목록을 조회합니다.
  *     parameters:
  *       - in: query
  *         name: type
  *         schema:
  *           type: string
  *           enum: [created, liked]
  *         description: "created: 내가 만든 캐릭터, liked: 내가 찜한(하트 누른) 캐릭터"
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
  *                       introduction:
  *                         type: string
  *                       likes:
  *                         type: integer
  *                       liked:
  *                         type: boolean
  *                       intimacy:
  *                         type: integer
  *                       is_deleted:
  *                         type: boolean
  *                 page_info:
  *                   type: object
  *                   properties:
  *                     total_elements:
  *                       type: integer
  */
router.get('/list', (req, res) => {
  const { type } = req.query;
  let result = [];

  if (type === 'liked') {
    // 내가 찜한(하트 누른) 캐릭터
    const likedRooms = chatRooms.filter(room => room.clerk_id === myId && room.likes && !room.is_deleted);
    result = likedRooms.map(room => {
      const p = personas.find(p => p.id === room.character_id && !p.is_deleted);
      if (!p) return null;
      return {
        character_id: p.id,
        name: p.name,
        image_url: p.image_url,
        introduction: p.introduction,
        likes: p.likes,
        liked: true,
        intimacy: room.friendship,
        is_deleted: p.is_deleted,
      };
    }).filter(Boolean);
  } else {
    // 내가 만든 캐릭터
    result = personas
      .filter(p => p.clerk_id === myId && !p.is_deleted)
      .map(p => {
        const room = chatRooms.find(r => r.character_id === p.id && r.clerk_id === myId);
        return {
          character_id: p.id,
          name: p.name,
          image_url: p.image_url,
          introduction: p.introduction,
          likes: p.likes,
          liked: room ? room.likes : false,
          intimacy: room ? room.friendship : 0,
          is_deleted: p.is_deleted,
        };
      });
  }

  res.status(200).json({
    characters: result,
    page_info: {
      total_elements: result.length,
    },
  });
});

module.exports = router;