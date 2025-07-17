const express = require('express');
const { createCustomPersona } = require('../controllers/personaController.js');
const { requireAuth } = require('../middlewares/authMiddleware.js');
const { validateCreatePersona } = require('../middlewares/personaValidator.js');

const router = express.Router();

// 테스트용 배열과 id 카운터 추가
const testPersonas = [];
let testPersonaId = 1;

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
router.post('/existing', (req, res) => {
    const { name, image_url, is_public, clerk_id } = req.body;
    if (!name || !image_url || typeof is_public !== 'boolean' || !clerk_id) {
      return res.status(400).json({ message: '필수 값이 누락되었습니다.' });
    }
    const persona = {
      id: testPersonaId++,
      name,
      image_url,
      is_public,
      clerk_id,
      createdAt: new Date().toISOString(),
    };
    testPersonas.push(persona);
    res.status(201).json({ message: '테스트용 캐릭터가 생성되었습니다.', persona });
  });

router.post(
    '/personas/custom', 
    requireAuth,             // 1. 로그인 했는지 확인
    validateCreatePersona,   // 2. 요청 데이터가 유효한지 확인
    createCustomPersona      // 3. 모든 검사를 통과하면 컨트롤러 실행
  );
  
module.exports = router;