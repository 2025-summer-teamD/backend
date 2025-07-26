import express from 'express';
// 개별 import 방식으로 변경
import personaController from '../controllers/personaController.js';
import personaValidator from '../middlewares/personaValidator.js';

const router = express.Router();

/**
 * @swagger
 * /communities/characters:
 *   get:
 *     tags:
 *       - community
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
 *                       characterId:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       imageUrl:
 *                         type: string
 *                       introduction:
 *                         type: string
 *                       usesCount:
 *                         type: integer
 *                       likes:
 *                         type: integer
 *                       liked:
 *                         type: boolean
 *                 pageInfo:
 *                   type: object
 *                   properties:
 *                     totalElements:
 *                       type: integer
 */

router.get(// 페르소나 목록 조회 라우트 (GET /communities/characters)
    '/characters',
    personaValidator.validateGetPersonas, // 1. 쿼리 파라미터가 유효한지 확인
    personaController.getPersonaList       // 2. 컨트롤러 실행
);


/**
 * @swagger
 * /communities/characters/{characterId}:
 *   get:
 *     tags:
 *       - community
 *     summary: 커뮤니티 캐릭터 상세 조회
 *     description: characterId로 커뮤니티 캐릭터의 상세 정보를 조회합니다.
 *     parameters:
 *       - in: path
 *         name: characterId
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
 *                 characterId:
 *                   type: integer
 *                 userId:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 imageUrl:
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
 *                 usesCount:
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
// 페르소나 상세 조회 (GET /communities/characters/:characterId)
router.get(
    '/characters/:characterId',
    
    personaValidator.validateIdParam,              // 1. ID가 유효한 숫자인지 확인
    personaController.getCommunityPersonaDetails    // 2. 컨트롤러 실행
);

export default router;
