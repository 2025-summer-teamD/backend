const express = require('express');
const router = express.Router();

// ✅ 기존 채팅방에 메시지 전송
/**
 * @swagger
 * /chat/rooms/{room_id}:
 *   post:
 *     summary: 특정 채팅방에 메시지 전송
 *     parameters:
 *       - in: path
 *         name: room_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 채팅방 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: 안녕하세요!
 *     responses:
 *       201:
 *         description: 메시지 전송 성공
 */
router.post('/rooms/:room_id', async (req, res) => {
  const { room_id } = req.params;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: '메시지를 입력해주세요.' });
  }

  console.log(`room ${room_id} 에 메시지: ${message}`);

  res.status(201).json({
    room_id,
    message,
    sender: 'minjeong',
    timestamp: new Date(),
  });
});

module.exports = router;
