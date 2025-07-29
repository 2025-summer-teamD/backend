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

// 채팅방 생성 (그룹 채팅 지원)
router.post('/rooms',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    chatController.createChatRoom);

//ai 채팅 스트리밍 (1대다 채팅용 - WebSocket 방식)
router.post('/rooms/:roomId',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    personaValidator.validateRoomIdParam,  // room_id 검증 추가!
    chatController.streamChatByRoom2);

// 1대1 채팅 전용 SSE 스트리밍
router.post('/rooms/:roomId/sse',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    personaValidator.validateRoomIdParam,
    chatController.streamChatByRoom2);

/**
 * @swagger
 * /chat/rooms/{roomId}/group-sse:
 *   post:
 *     summary: 그룹 채팅 SSE 스트리밍
 *     description: 그룹 채팅에서 메시지를 보내고 BullMQ를 통해 처리된 AI 응답을 SSE로 실시간 수신합니다.
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: roomId
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
 *               - userName
 *             properties:
 *               message:
 *                 type: string
 *                 description: 사용자가 보낸 메시지
 *                 example: "안녕하세요!"
 *               sender:
 *                 type: string
 *                 description: 메시지 보낸 사람 ID
 *                 example: "user_123"
 *               userName:
 *                 type: string
 *                 description: 사용자 이름
 *                 example: "김민정"
 *     responses:
 *       '200':
 *         description: SSE 스트림이 성공적으로 시작됨
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: |
 *                 data: {"type": "user_message", "content": "안녕하세요!", "sender": "김민정"}
 *                 
 *                 data: {"type": "ai_response", "content": "안녕하세요! 반가워요!", "aiName": "AI캐릭터"}
 *                 
 *                 data: {"type": "exp_updated", "personaId": 1, "newExp": 150, "newLevel": 2}
 *                 
 *                 data: {"type": "complete"}
 *                 
 *                 data: [DONE]
 *       '400':
 *         description: 잘못된 요청 (필수 필드 누락 또는 1대1 채팅방)
 *       '404':
 *         description: 채팅방을 찾을 수 없음
 *       '500':
 *         description: 서버 오류
 */

// 그룹 채팅 전용 SSE 스트리밍 (BullMQ 연동)
router.post('/rooms/:roomId/group-sse',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    personaValidator.validateRoomIdParam,
    chatController.streamGroupChatByRoom);

// 🎯 통합 채팅 메시지 전송 API (권장)
router.post('/rooms/:roomId/send',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    personaValidator.validateRoomIdParam,
    chatController.sendChatMessage);

// TODO: enterChatRoom 함수가 삭제되었으므로 임시로 주석 처리
// router.get('/rooms',
//     authMiddleware.clerkAuthMiddleware,
//     authMiddleware.requireAuth,
//     chatController.enterChatRoom);

// room_id로 채팅방 정보 조회 (하지만 query parameter이므로 별도 검증 필요)
router.get('/room-info',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    chatController.getRoomInfo);

// 채팅방 이름 수정
router.put('/rooms/:roomId/name',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    personaValidator.validateRoomIdParam,
    chatController.updateChatRoomName);

// 친밀도 조회 라우트 추가
router.get('/friendships',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    chatController.getAllFriendships);

router.get('/friendships/:personaId',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    chatController.getCharacterFriendship);

// SSE 스트리밍 라우트 (GET)
router.get('/stream/:roomId',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    personaValidator.validateRoomIdParam,
    chatController.streamChatByRoom);

// multer 설정: uploads 폴더에 저장, 파일 크기 제한(5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB 제한
});

// 채팅 이미지 업로드 라우트
router.post('/upload-image', upload.single('image'), uploadImage);

router.get('/tts/:roomId/:chatLogId',
    authMiddleware.clerkAuthMiddleware,
    authMiddleware.requireAuth,
    personaValidator.validateTTSParam,
    chatController.getTts);

export default router;
