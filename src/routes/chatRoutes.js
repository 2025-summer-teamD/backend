import express from 'express';
import chatController from '../controllers/chatController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import personaValidator from '../middlewares/personaValidator.js';
import multer from 'multer';
import { uploadImage } from '../controllers/uploadController.js';

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
router.post('/rooms/:roomId',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    personaValidator.validateRoomIdParam,  // room_id 검증 추가!
    chatController.streamChatByRoom);

/**
 * @swagger
 * /chat/rooms:
 *   post:
 *     summary: 새로운 채팅방 생성
 *     description: 캐릭터당 채팅방은 하나만 생성됩니다. 이미 존재하는 경우 기존 방을 반환합니다.
 *     tags: [Chat]
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
 *                 type: integer
 *                 description: 채팅할 캐릭터 ID
 *                 example: 102
 *     responses:
 *       201:
 *         description: 채팅방 생성 성공
 *       200:
 *         description: 이미 존재하는 채팅방 반환
 *       400:
 *         description: 요청 형식 오류 또는 캐릭터 ID 누락
 *       500:
 *         description: 서버 내부 오류
 */
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

// room_id로 채팅방 정보 조회 (하지만 query parameter이므로 별도 검증 필요)
router.get('/room-info', 
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    chatController.getRoomInfo);

// multer 설정: uploads 폴더에 저장
const upload = multer({ dest: 'uploads/' });

// 채팅 이미지 업로드 라우트
router.post('/upload-image', upload.single('image'), uploadImage);

export default router; 