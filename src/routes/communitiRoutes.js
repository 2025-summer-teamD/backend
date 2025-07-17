import { Router } from 'express';
import { getPersonaList, getPersonaDetails } from '../controllers/personaController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { validateGetPersonas,  validateIdParam } from '../middlewares/personaValidator.js';

const router = Router();


/**
 * @swagger
 * /communities/characters:
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

// 페르소나 목록 조회 라우트
// GET /communities/characters
router.get(
    '/communities/characters', 
    validateGetPersonas, // 1. 쿼리 파라미터가 유효한지 확인
    getPersonaList       // 2. 컨트롤러 실행
);

export default router;

/**
 * @swagger
 * /communities/characters/{character_id}:
 *   get:
 *     summary: 커뮤니티 캐릭터 상세 조회
 *     description: character_id로 커뮤니티 캐릭터의 상세 정보를 조회합니다.
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
    const character = characters.find((c) => c.character_id === characterId);
  
    if (!character) {
      return res.status(404).json({
        message: '해당 페르소나를 찾을 수 없습니다.',
        result: null,
      });
    }
  
    res.status(200).json(character);
  });
  
  
  module.exports = router;
  