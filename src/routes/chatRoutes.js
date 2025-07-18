import express from 'express';
import { chatController } from '../controllers/chatController.js';

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
router.post('/rooms/:room_id', chatController.streamChatByRoom);

export default router; 