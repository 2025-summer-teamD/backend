const express = require('express');
const router = express.Router();

// 더미 데이터
const personas = [
  {
    id: 1,
    user_id: 5,
    name: '인기 페르소나',
    image_url: 'https://example.com/image1.png',
    introduction: '모두에게 사랑받는 페르소나입니다.',
    prompt: {
      tone: '말투입니다',
      personality: '성격입니다',
      tag: '#태그',
    },
    uses_count: 1502,
    likes: 352,
    liked: false,
    is_public: false,
  },
  // ...다른 캐릭터
];

/**
 * @swagger
 * /my/characters/{character_id}:
 *   get:
 *     summary: 내 캐릭터 상세 조회
 *     description: character_id로 내 캐릭터의 상세 정보를 조회합니다.
 *     parameters:
 *       - in: path
 *         name: character_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 캐릭터 ID
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 character_id:
 *                   type: integer
 *                 user_id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 image_url:
 *                   type: string
 *                 introduction:
 *                   type: string
 *                 prompt:
 *                   type: object
 *                   properties:
 *                     tone:
 *                       type: string
 *                     personality:
 *                       type: string
 *                     tag:
 *                       type: string
 *                 uses_count:
 *                   type: integer
 *                 likes:
 *                   type: integer
 *                 liked:
 *                   type: boolean
 *                 is_public:
 *                   type: boolean
 *       404:
 *         description: 캐릭터를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 result:
 *                   type: string
 */
router.get('/:character_id', (req, res) => {
  const characterId = parseInt(req.params.character_id, 10);
  const character = personas.find((c) => c.id === characterId);

  if (!character) {
    return res.status(404).json({
      message: '해당 페르소나를 찾을 수 없습니다.',
      result: null,
    });
  }

  res.status(200).json({
    character_id: character.id,
    user_id: character.user_id,
    name: character.name,
    image_url: character.image_url,
    introduction: character.introduction,
    prompt: character.prompt,
    uses_count: character.uses_count,
    likes: character.likes,
    liked: character.liked,
    is_public: character.is_public,
  });
});

module.exports = router;