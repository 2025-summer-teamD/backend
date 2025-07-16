const express = require('express');
const router = express.Router();
const { createCustomPersona } = require('../controllers/personaController');

/**
 * @swagger
 * /characters/custom:
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
router.post('/characters/custom', createCustomPersona);

module.exports = router;
