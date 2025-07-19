//import authMiddleware from '../middlewares/_index.js'; // 토큰 불러오기
//import chatController from '../controllers/_index.js';

//const { requireAuth } = authMiddleware;
//const { deleteLikedCharacter } = chatController;

//const router = express.Router();

// 임시로 채팅방 목록을 저장할 배열
//const chatRooms = []; // [{ room_id, character_id, user_id }]

// // ✅ 새로운 캐릭터와 채팅방 생성
// /**
//  * @swagger
//  * /chat/rooms:
//  *   post:
//  *     summary: 새로운 캐릭터와의 채팅방 생성
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               character_id:
//  *                 type: string
//  *                 example: abc123
//  *     responses:
//  *       201:
//  *         description: 채팅방 생성 성공
//  */
// router.post('/rooms', requireAuth, async (req, res) => {
//   const { character_id } = req.body;

//   if (!character_id) {
//     return res.status(400).json({ error: '캐릭터 ID가 필요합니다.' });
//   }

//   const room_id = `room-${Date.now()}`;
//   // 채팅방 정보를 메모리에 저장
//   chatRooms.push({ room_id, character_id, user_id: req.user.username });

//   console.log(`캐릭터 ${character_id} 와의 채팅방 생성: ${room_id}`);

//   res.status(201).json({
//     room_id,
//     character_id,
//     message: '새로운 채팅방이 생성되었습니다.',
//   });
// });


/**
 * @swagger
 * /chat/liked/{characterId}:
 *   delete:
 *     summary: 찜한(좋아요한) 캐릭터 삭제 (내 목록에서만 삭제)
 *     description: 내가 찜한 캐릭터를 내 목록에서만 삭제합니다. 커뮤니티에는 영향이 없습니다.
 *     tags:
 *       - Chat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: characterId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 삭제할 캐릭터의 persona id
 *     responses:
 *       200:
 *         description: 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 찜한 캐릭터가 내 목록에서 성공적으로 삭제되었습니다.
 *                 data:
 *                   type: object
 *       401:
 *         description: 인증 실패 또는 권한 없음
 *       404:
 *         description: 존재하지 않거나 이미 삭제된 찜 관계
 */
//router.delete('/liked/:characterId', requireAuth, deleteLikedCharacter);

//export default router;
