import { Router } from 'express';
import { getUserProfile } from '../controllers/userController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { getMyPersonaList, getMyPersonaDetails } from '../controllers/personaController.js'; // persona 컨트롤러에서 가져옴
import { validateMyPersonaList, validateIdParam } from '../middlewares/personaValidator.js';
import { getMyChats } from '../controllers/chatController.js';
import { validatePagination } from '../middlewares/paginationValidator.js';

const router = express.Router();

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
// 나의 페르소나 목록 조회 (GET /api//my/characters?type=liked)
router.get(
  '/my/characters',
  requireAuth,            // 1. 로그인 필수
  validateMyPersonaList,  // 2. 쿼리 파라미터 유효성 검사
  getMyPersonaList        // 3. 컨트롤러 실행
);

/**
 * @swagger
 * /my/characters/{character_id}:
 *   get:
 *     summary: 내 케릭터 상세 조회
 *     description: character_id로 내 케릭터의 상세 정보를 조회합니다.
 *     security:
 *       - bearerAuth: []
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
// 나의 특정 페르소나 상세 조회 (GET /api/my/personas/:character_id)
// ★★★ requireAuth 미들웨어가 필수입니다! ★★★
router.get('/my/characters/:character_id',
  requireAuth, 
  validateIdParam, 
  getMyPersonaDetails
);

/**
 * @swagger
 * /my/chat-characters:
 *   get:
 *     summary: 내가 대화한 캐릭터 목록 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: pageSize
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 한 페이지당 항목 수
 *     responses:
 *       200:
 *         description: 내가 대화한 캐릭터 목록 반환
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 pageSize:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       character_id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       lastMessage:
 *                         type: string
 *                       lastMessageAt:
 *                         type: string
 *                         format: date-time
 *                       ...: # 실제 반환 필드에 맞게 추가
 *       401:
 *         description: 인증 필요
 */
// 나의 채팅 목록 조회 (GET /api/my/chat-characters?page=1&size=10)
router.get(
  '/my/chat-characters',
  requireAuth,        // 1. 로그인 필수
  validatePagination, // 2. 페이지네이션 쿼리 검증 및 준비
  getMyChats          // 3. 컨트롤러 실행
);

export default router;