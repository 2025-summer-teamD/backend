const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const characterController = require('../controllers/characterController');

/**
 * @swagger
 * /characters/existing:
 *   post:
 *     summary: 캐릭터(페르소나) 생성
 *     description: name, image_url, is_public을 받아 Persona를 생성합니다. (로그인 필요)
 *     tags:
 *       - Characters
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       201:
 *         description: 생성 성공 (응답 바디 없음)
 *       401:
 *         description: 인증 필요/실패
 */
router.post('/existing', authMiddleware, characterController.createCharacter);

module.exports = router; 