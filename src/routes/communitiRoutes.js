import { Router } from 'express';
import { getPersonaList } from '../controllers/personaController.js';
import { validateGetPersonas } from '../middlewares/personaValidator.js';

const router = Router();


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

// 페르소나 목록 조회 라우트
// GET /api/personas
router.get(
    '/communities/characters', 
    validateGetPersonas, // 1. 쿼리 파라미터가 유효한지 확인
    getPersonaList       // 2. 컨트롤러 실행
);

export default router;