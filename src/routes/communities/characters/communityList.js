const express = require('express');
const router = express.Router();

// 더미 캐릭터 데이터
const characters = [
  {
    character_id: 1,
    name: '인기 페르소나',
    image_url: 'https://example.com/image1.png',
    introduction: '소개입니다',
    uses_count: 1502,
    likes: 2023,
    liked: false,
  },
  {
    character_id: 2,
    name: '차분한 페르소나',
    image_url: 'https://example.com/image2.png',
    introduction: '차분한 소개입니다',
    uses_count: 800,
    likes: 3453,
    liked: false,
  },
  {
    character_id: 3,
    name: '밝은 페르소나',
    image_url: 'https://example.com/image3.png',
    introduction: '밝고 긍정적인 소개입니다',
    uses_count: 1200,
    likes: 1500,
    liked: true,
  },
];

/**
 * @swagger
 * /communities/characters/list:
 *   get:
 *     summary: 커뮤니티 캐릭터 목록 조회
 *     description: 커뮤니티 캐릭터 목록을 조회합니다. 쿼리 파라미터로 키워드 검색과 정렬(인기순, 조회수순)이 가능합니다.
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 캐릭터 이름 또는 소개에 포함된 키워드
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [likes, uses_count]
 *         description: "정렬 기준 (likes: 인기순, uses_count: 조회수순)"
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
 *                       uses_count:
 *                         type: integer
 *                       likes:
 *                         type: integer
 *                       liked:
 *                         type: boolean
 *                 page_info:
 *                   type: object
 *                   properties:
 *                     total_elements:
 *                       type: integer
 */

router.get('/list', (req, res) => {
  let result = [...characters];
  const { keyword, sort } = req.query;

  // 키워드 검색
  if (keyword) {
    const lowerKeyword = keyword.toLowerCase();
    result = result.filter(
      c => c.name.toLowerCase().includes(lowerKeyword) ||
           c.introduction.toLowerCase().includes(lowerKeyword)
    );
  }

  // 정렬
  if (sort === 'likes') {
    result.sort((a, b) => b.likes - a.likes);
  } else if (sort === 'uses_count') {
    result.sort((a, b) => b.uses_count - a.uses_count);
  }

  res.status(200).json({
    characters: result,
    page_info: {
      total_elements: result.length,
    },
  });
});

module.exports = router;
