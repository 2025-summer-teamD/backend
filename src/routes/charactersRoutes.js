const express = require('express');
const router = express.Router();
const characterController = require('../controllers/characterController');

/**
 * @swagger
 * /characters/existing:
 *   post:
 *     summary: 캐릭터(페르소나) 생성
 *     description: clerk_id, name, image_url, is_public을 받아 Persona를 생성합니다.
 *     tags:
 *       - Characters
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clerk_id
 *               - name
 *               - image_url
 *               - is_public
 *             properties:
 *               clerk_id:
 *                 type: string
 *                 example: user_xxxxx
 *               name:
 *                 type: string
 *                 example: 아이언맨
 *               image_url:
 *                 type: string
 *                 example: https://example.com/image.png
 *               is_public:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: 생성 성공 (응답 바디 없음)
 */
router.post('/existing', characterController.createCharacter);

module.exports = router;
