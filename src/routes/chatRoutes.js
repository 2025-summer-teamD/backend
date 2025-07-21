import express from 'express';
import chatController from '../controllers/chatController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /chat/rooms/{room_id}:
 *   post:
 *     summary: AI 채팅 스트리밍
 *     description: 사용자가 메시지를 보내면 AI가 SSE 방식으로 실시간 응답을 스트리밍합니다.
 *     tags: [Chat]
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
 *             required:
 *               - message
 *               - sender
 *               - timestamp
 *             properties:
 *               message:
 *                 type: string
 *                 description: 사용자가 보낸 메시지
 *                 example: "안녕!"
 *               sender:
 *                 type: string
 *                 description: 메시지 보낸 사람
 *                 example: "minjeong"
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: 메시지 전송 시간
 *                 example: "2025-07-16T08:38:16.028Z"
 *     responses:
 *       '200':
 *         description: SSE 스트림이 성공적으로 시작됨
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: |
 *                 data: {"content": "안녕하세요! 반가워요!"}
 *                 
 *                 data: [DONE]
 *       '400':
 *         description: 잘못된 요청 (필수 필드 누락)
 *       '404':
 *         description: 채팅방을 찾을 수 없음
 *       '500':
 *         description: 서버 오류
 */

//ai 채팅 스트리밍 
router.post('/rooms/:room_id',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth, 
    chatController.streamChatByRoom);


    
// 새로운 캐릭터와의 대화 요청(채팅방 생성)
router.post('/rooms',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    chatController.createChatRoom);

//채팅방 입장

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
 *         description: 입장 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 room_id:
 *                   type: string
 *                   example: "chat-7891"
 *                 user_id:
 *                   type: integer
 *                   example: 15
 *                 persona_id:
 *                   type: integer
 *                   example: 101
 *                 created_at:
 *                   type: string
 *                   example: "2025-07-01T14:10:00Z"
 *                 count:
 *                   type: integer
 *                   example: 47
 *                 friendship:
 *                   type: integer
 *                   example: 82
 *                 exp:
 *                   type: integer
 *                   example: 430
 *       401:
 *         description: 입장 실패
 */

router.get('/rooms', 
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    chatController.enterChatRoom);

// room_id로 채팅방 정보 조회
router.get('/room-info', 
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    chatController.getRoomInfo);

export default router; 