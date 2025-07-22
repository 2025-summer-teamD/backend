import express from 'express';
// 개별 import 방식으로 변경
import personaController from '../controllers/personaController.js';
import personaValidator from '../middlewares/personaValidator.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import uploadMiddleware from '../middlewares/uploadMiddleware.js';
import ensureUserInDB from '../middlewares/ensureUserInDB.js';

const router = express.Router();


/** 
 * @swagger
 * /characters/custom:
 *   post:
 *     summary: 사용자 정의 캐릭터(페르소나) 생성 (테스트용)
 *     description: name, image_url, is_public, prompt, description을 받아 Persona를 임시 배열에 저장합니다.
 *     tags:
 *       - create character
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - image_url
 *               - is_public
 *               - prompt
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *                 example: 캐릭터 이름
 *               image_url:
 *                 type: string
 *                 example: https://example.com/image.png
 *               is_public:
 *                 type: boolean
 *                 example: true
 *               prompt:
 *                 type: object
 *                 properties:
 *                   tone:
 *                     type: string
 *                     example: 말투입니다
 *                   personality:
 *                     type: string
 *                     example: 성격입니다
 *                   tag:
 *                     type: string
 *                     example: "#태그"
 *               description:
 *                 type: string
 *                 example: 추가설명입니다
 *     responses:
 *       201:
 *         description: 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 사용자 정의 캐릭터가 생성되었습니다.
 *                 persona:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: 캐릭터 이름
 *                     image_url:
 *                       type: string
 *                       example: https://example.com/image.png
 *                     is_public:
 *                       type: boolean
 *                       example: true
 *                     prompt:
 *                       type: object
 *                       properties:
 *                         tone:
 *                           type: string
 *                           example: 말투입니다
 *                         personality:
 *                           type: string
 *                           example: 성격입니다
 *                         tag:
 *                           type: string
 *                           example: "#태그"
 *                     description:
 *                       type: string
 *                       example: 추가설명입니다
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-07-16T14:10:00.000Z
 */
router.post(
  '/custom',
  authMiddleware.clerkAuthMiddleware, // 0. Clerk 인증 미들웨어
  authMiddleware.requireAuth,             // 1. 로그인 했는지 확인
  ensureUserInDB,      // 2. users 테이블에 clerkId 자동 등록
  uploadMiddleware.upload.single('image'), // 3. 이미지 업로드 처리
  personaValidator.validateCreatePersona,   // 4. 요청 데이터가 유효한지 확인
  personaController.createCustomPersona      // 5. 모든 검사를 통과하면 컨트롤러 실행
);


/**
 * @swagger
 * /characters/existing:
 *   post:
 *     summary: clerk_id 포함 테스트용 캐릭터 생성
 *     description: name, image_url, is_public, clerk_id를 받아 테스트 배열에 저장합니다.
 *     tags:
 *       - create character
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - image_url
 *               - is_public
 *               - clerk_id
 *             properties:
 *               name:
 *                 type: string
 *                 example: 아이언맨
 *               image_url:
 *                 type: string
 *                 example: https://example.com/image.png
 *               is_public:
 *                 type: boolean
 *                 example: true
 *               clerk_id:
 *                 type: string
 *                 example: user_123456
 *     responses:
 *       201:
 *         description: 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 테스트용 캐릭터가 생성되었습니다.
 *                 persona:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: 아이언맨
 *                     image_url:
 *                       type: string
 *                       example: https://example.com/image.png
 *                     is_public:
 *                       type: boolean
 *                       example: true
 *                     clerk_id:
 *                       type: string
 *                       example: user_123456
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-07-16T14:10:00.000Z
 */
router.post(  // AI를 사용하여 나의 페르소나 생성 (POST /api/my/characters/existing)
  '/existing',
  authMiddleware.clerkAuthMiddleware, // 0. Clerk 인증 미들웨어
  authMiddleware.requireAuth,         // 1. 로그인 필수
  ensureUserInDB,      // 2. users 테이블에 clerkId 자동 등록
  uploadMiddleware.upload.single('image'), // 3. 이미지 업로드 처리
  personaValidator.validateAiCreatePersona, // 4. 요청 데이터 유효성 검사
  personaController.createAiPersona // 5. 컨트롤러 실행
);

/**
 * @swagger
 * /characters/{characterId}/like:
 *   post:
 *     summary: 페르소나 좋아요 토글
 *     description: 특정 페르소나에 대한 좋아요를 추가하거나 취소합니다.
 *     tags:
 *       - like
 *     parameters:
 *       - in: path
 *         name: characterId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 페르소나 ID
 *     responses:
 *       200:
 *         description: 좋아요 토글 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 좋아요를 추가했습니다.
 *                 data:
 *                   type: object
 *                   properties:
 *                     isLiked:
 *                       type: boolean
 *                       example: true
 *                     likesCount:
 *                       type: integer
 *                       example: 5
 *       404:
 *         description: 페르소나를 찾을 수 없음
 */
router.post(
  '/:characterId/like',
  authMiddleware.clerkAuthMiddleware,
  authMiddleware.requireAuth,
  ensureUserInDB,
  personaController.toggleLike
);

/**
 * @swagger
 * /characters/{characterId}/view:
 *   post:
 *     summary: 페르소나 조회수 증가
 *     description: 특정 페르소나의 조회수를 1 증가시킵니다.
 *     tags:
 *       - view
 *     parameters:
 *       - in: path
 *         name: characterId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 페르소나 ID
 *     responses:
 *       200:
 *         description: 조회수 증가 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 조회수가 증가되었습니다.
 *                 data:
 *                   type: object
 *                   properties:
 *                     viewCount:
 *                       type: integer
 *                       example: 10
 *       404:
 *         description: 페르소나를 찾을 수 없음
 */
router.post(
  '/:characterId/view',
  authMiddleware.clerkAuthMiddleware,
  authMiddleware.requireAuth,
  ensureUserInDB,
  personaController.incrementViewCount
);

/**
 * @swagger
 * /characters/{characterId}:
 *   get:
 *     summary: 페르소나 상세 조회
 *     description: 특정 페르소나의 상세 정보를 조회합니다.
 *     tags:
 *       - get character
 *     parameters:
 *       - in: path
 *         name: characterId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 페르소나 ID
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 페르소나 상세 조회 성공
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: 캐릭터 이름
 *                     image_url:
 *                       type: string
 *                       example: https://example.com/image.png
 *                     is_public:
 *                       type: boolean
 *                       example: true
 *                     prompt:
 *                       type: object
 *                       properties:
 *                         tone:
 *                           type: string
 *                           example: 말투입니다
 *                         personality:
 *                           type: string
 *                           example: 성격입니다
 *                         tag:
 *                           type: string
 *                           example: "#태그"
 *                     description:
 *                       type: string
 *                       example: 추가설명입니다
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-07-16T14:10:00.000Z
 *       404:
 *         description: 페르소나를 찾을 수 없음
 */
router.get(
  '/:characterId',
  authMiddleware.clerkAuthMiddleware,
  authMiddleware.requireAuth,
  ensureUserInDB,
  personaController.getMyPersonaDetails
);


export default router;
