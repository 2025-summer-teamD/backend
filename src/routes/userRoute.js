import { Router } from 'express';
import { getUserProfile } from '../controllers/userController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { getMyPersonaList } from '../controllers/personaController.js'; // persona 컨트롤러에서 가져옴
import { validateMyPersonaList } from '../middlewares/personaValidator.js';

const router = Router();

// /api/users/profile 경로에 대한 GET 요청을 처리합니다.
// 요청이 오면, 먼저 requireAuth 미들웨어를 실행하여 인증 여부를 확인합니다.
// 인증이 성공하면, getUserProfile 컨트롤러 함수가 실행됩니다.
router.get('/profile', requireAuth, getUserProfile);

/**
  * @swagger
  * /my/characters:
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
  *                 data:
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
// 나의 페르소나 목록 조회 (GET /api/users/me/personas?type=liked)
router.get(
    '/my/characters',
    requireAuth,            // 1. 로그인 필수
    validateMyPersonaList,  // 2. 쿼리 파라미터 유효성 검사
    getMyPersonaList        // 3. 컨트롤러 실행
);

export default router;