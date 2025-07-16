const express = require('express');
const router = express.Router();

// 테스트용 임시 저장소 (메모리 배열)
const personas = [];
let nextId = 1;

/**
 * @swagger
 * /api/personas/existing:
 *   post:
 *     summary: 실제 캐릭터(페르소나) 생성 (테스트용)
 *     description: DB 대신 임시 배열에 persona를 저장합니다.
 *     tags:
 *       - Personas
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
 *                 example: user_12345
 *               name:
 *                 type: string
 *                 example: 테스트 캐릭터
 *               image_url:
 *                 type: string
 *                 example: https://example.com/image.png
 *               is_public:
 *                 type: boolean
 *                 example: true
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
 *                   example: 캐릭터가 생성되었습니다.
 *                 persona:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     clerk_id:
 *                       type: string
 *                       example: user_12345
 *                     name:
 *                       type: string
 *                       example: 테스트 캐릭터
 *                     image_url:
 *                       type: string
 *                       example: https://example.com/image.png
 *                     is_public:
 *                       type: boolean
 *                       example: true
 */
router.post('/existing', (req, res) => {
  const { clerk_id, name, image_url, is_public } = req.body;
  if (!clerk_id || !name || !image_url || typeof is_public !== 'boolean') {
    return res.status(400).json({ message: '필수 값이 누락되었습니다.' });
  }
  const persona = {
    id: nextId++,
    clerk_id,
    name,
    image_url,
    is_public,
    createdAt: new Date().toISOString(),
  };
  personas.push(persona);
  res.status(201).json({ message: '캐릭터가 생성되었습니다.', persona });
});

module.exports = router;
