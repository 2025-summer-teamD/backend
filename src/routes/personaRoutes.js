const express = require('express');
const router = express.Router();
const personaController = require('../controllers/personaController');

/**
 * @swagger
 * /api/personas/existing:
 *   post:
 *     summary: 캐릭터 생성
 *     tags: [Persona]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               image_url:
 *                 type: string
 *               clerk_id:
 *                 type: string
 *               is_public:
 *                 type: boolean
 *             required:
 *               - name
 *               - image_url
 *               - clerk_id
 *               - is_public
 *     responses:
 *       201:
 *         description: 캐릭터 생성 성공
 *       400:
 *         description: 캐릭터 생성 실패
 */
router.post('/existing', personaController.createPersona);

module.exports = router;
