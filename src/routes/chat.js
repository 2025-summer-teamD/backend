const express = require('express');
const router = express.Router();

// ✅ 새로운 캐릭터와 채팅방 생성
/**
 * @swagger
 * /chat/rooms:
 *   post:
 *     summary: 새로운 캐릭터와의 채팅방 생성
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               character_id:
 *                 type: string
 *                 example: abc123
 *     responses:
 *       201:
 *         description: 채팅방 생성 성공
 */
router.post('/rooms', async (req, res) => {
    const { character_id } = req.body;
  
    if (!character_id) {
      return res.status(400).json({ error: '캐릭터 ID가 필요합니다.' });
    }
  
    const room_id = `room-${Date.now()}`;
  
    console.log(`캐릭터 ${character_id} 와의 채팅방 생성: ${room_id}`);
  
    res.status(201).json({
      room_id,
      character_id,
      message: '새로운 채팅방이 생성되었습니다.',
    });
  });
  

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
