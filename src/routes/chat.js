const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware'); // 토큰 불러오기

// 임시로 채팅방 목록을 저장할 배열
const chatRooms = []; // [{ room_id, character_id, user_id }]

// ✅ 새로운 캐릭터와 채팅방 생성
/**
 * @swagger
 * /chat/rooms:
 *   post:
 *     summary: 새로운 캐릭터와의 채팅방 생성
 *     security:
 *       - bearerAuth: []
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
router.post('/rooms', verifyToken, async (req, res) => {
  const { character_id } = req.body;

  if (!character_id) {
    return res.status(400).json({ error: '캐릭터 ID가 필요합니다.' });
  }

  const room_id = `room-${Date.now()}`;
  // 채팅방 정보를 메모리에 저장
  chatRooms.push({ room_id, character_id, user_id: req.user.username });

  console.log(`캐릭터 ${character_id} 와의 채팅방 생성: ${room_id}`);

  res.status(201).json({
    room_id,
    character_id,
    message: '새로운 채팅방이 생성되었습니다.',
  });
});

/**
 * @swagger
 * /chat/rooms:
 *   get:
 *     summary: 대화한 캐릭터의 채팅방 입장
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: character_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 캐릭터 ID
 *     responses:
 *       200:
 *         description: 채팅방 정보 반환
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 room_id:
 *                   type: string
 *                 character_id:
 *                   type: string
 *       404:
 *         description: 채팅방 없음
 */
router.get('/rooms', verifyToken, (req, res) => {
  const { character_id } = req.query;
  const user_id = req.user.username;
  if (!character_id) {
    return res.status(400).json({ error: 'character_id 쿼리 파라미터가 필요합니다.' });
  }
  const room = chatRooms.find(
    (room) => room.character_id === character_id && room.user_id === user_id
  );
  if (!room) {
    return res.status(404).json({ error: '채팅방이 존재하지 않습니다.' });
  }
  res.status(200).json(room);
});

// ✅ 기존 채팅방에 메시지 전송
/**
 * @swagger
 * /chat/rooms/{room_id}:
 *   post:
 *     summary: 특정 채팅방에 메시지 전송
 *     security:
 *       - bearerAuth: []
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
router.post('/rooms/:room_id', verifyToken, async (req, res) => {
  const { room_id } = req.params;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: '메시지를 입력해주세요.' });
  }

  console.log(`room ${room_id} 에 메시지: ${message}`);

  res.status(201).json({
    room_id,
    message,
    sender: req.user?.username || 'minjeong',
    timestamp: new Date(),
  });
});

module.exports = router;
