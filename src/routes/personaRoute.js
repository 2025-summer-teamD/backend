import express from 'express';
import { createCustomPersona, updatePersona, deletePersona } from '../controllers/personaController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { validateCreatePersona } from '../middlewares/personaValidator.js';

const router = express.Router();


/**
 * @swagger
 * /personas/custom:
 *   post:
 *     summary: 사용자 정의 캐릭터(페르소나) 생성 (테스트용)
 *     description: name, image_url, is_public, prompt, description을 받아 Persona를 임시 배열에 저장합니다.
 *     tags:
 *       - Personas
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
  '/characters/custom', 
  requireAuth,             // 1. 로그인 했는지 확인
  validateCreatePersona,   // 2. 요청 데이터가 유효한지 확인
  createCustomPersona      // 3. 모든 검사를 통과하면 컨트롤러 실행
);


/**
 * @swagger
 * /personas/existing:
 *   post:
 *     summary: clerk_id 포함 테스트용 캐릭터 생성
 *     description: name, image_url, is_public, clerk_id를 받아 테스트 배열에 저장합니다.
 *     tags:
 *       - Personas
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

// AI를 사용하여 나의 페르소나 생성 (POST /api/my/personas/ai-generate)
router.post(
  '/characters/existing',
  requireAuth,
  validateAiCreatePersona,
  createAiPersona
);

/**
 * @swagger
 * /personas/characters/{id}:
 *   patch:
 *     summary: 페르소나 정보 수정 (본인만 가능)
 *     description: introduction, personality, tone, tag 중 일부만 부분 수정할 수 있습니다. 본인 소유 페르소나만 수정 가능.
 *     tags:
 *       - Personas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 수정할 페르소나의 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               introduction:
 *                 type: string
 *                 example: "새로운 소개 텍스트"
 *               personality:
 *                 type: string
 *                 example: "툴툴대고 화가 많음"
 *               tone:
 *                 type: string
 *                 example: "아빠같은 말투"
 *               tag:
 *                 type: string
 *                 example: "화남,툴툴댐"
 *     responses:
 *       200:
 *         description: 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 페르소나가 성공적으로 수정되었습니다.
 *                 data:
 *                   $ref: '#/components/schemas/Persona'
 *       401:
 *         description: 인증 실패 또는 권한 없음
 *       404:
 *         description: 존재하지 않거나 권한 없는 페르소나
 */
router.patch(
  '/characters/:id',
  requireAuth,
  updatePersona
);

/**
 * @swagger
 * /personas/characters/{id}:
 *   delete:
 *     summary: 페르소나 소프트 삭제 (본인만 가능)
 *     description: 본인 소유 페르소나만 삭제 가능. 실제로는 isDeleted만 true로 변경됩니다.
 *     tags:
 *       - Personas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 삭제할 페르소나의 ID
 *     responses:
 *       200:
 *         description: 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 페르소나가 성공적으로 삭제되었습니다.
 *                 data:
 *                   $ref: '#/components/schemas/Persona'
 *       401:
 *         description: 인증 실패 또는 권한 없음
 *       404:
 *         description: 존재하지 않거나 권한 없는 페르소나
 */
router.delete(
  '/characters/:id',
  requireAuth,
  deletePersona
);

export default router;