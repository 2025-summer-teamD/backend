

/**
 * @swagger
 * /my/chat-characters:
 *   get:
 *     summary: 대화한 캐릭터 목록 조회
 *     description: 현재 사용자가 대화한 적이 있는 캐릭터들의 목록을 조회합니다
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *           default: test_user_123
 *         description: 사용자 ID (테스트용)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: 한 페이지당 개수
 *     responses:
 *       200:
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     characters:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           character_id:
 *                             type: integer
 *                             example: 1
 *                           name:
 *                             type: string
 *                             example: "친절한 심리상담사"
 *                           image_url:
 *                             type: string
 *                             example: "https://.../image.png"
 *                           last_chat:
 *                             type: string
 *                             example: "고마워 ㅎㅎ"
 *                           time:
 *                             type: string
 *                             example: "오후 3:45"
 *                     page_info:
 *                       type: object
 *                       properties:
 *                         current_page:
 *                           type: integer
 *                           example: 1
 *                         total_pages:
 *                           type: integer
 *                           example: 1
 *                         total_elements:
 *                           type: integer
 *                           example: 5
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "검색 결과가 없습니다."
 *       500:
 *         description: 서버 내부 오류
 */


// 대화한 캐릭터 목록 조회 API
app.get('/my/chat-characters', async (req, res) => {
  try {
    // 테스트용 사용자 ID (실제로는 인증에서 가져와야 함)
    const testUserId = req.query.user_id || 'test_user_123';
    
    // 페이지네이션 파라미터
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 10;
    const skip = (page - 1) * size;
    
    // 1. 사용자의 채팅방 총 개수 조회
    const totalCount = await prisma.chatRoom.count({
      where: {
        clerk_id: testUserId,
        is_deleted: false
      }
    });
    
    // 대화한 캐릭터가 없는 경우
    if (totalCount === 0) {
      return res.status(200).json({
        message: "검색 결과가 없습니다."
      });
    }
    
    // 2. 사용자의 채팅방 조회 (페이지네이션 적용)
    const chatRooms = await prisma.chatRoom.findMany({
      where: {
        clerk_id: testUserId,
        is_deleted: false
      },
      include: {
        ChatLogs: {
          where: {
            is_deleted: false
          },
          orderBy: {
            time: 'desc'
          },
          take: 1 // 가장 최근 메시지 1개만
        }
      },
      orderBy: {
        updated_at: 'desc' // 최근 대화 순
      },
      skip: skip,
      take: size
    });
    
    // 3. character_id로 Persona 정보 조회
    const characterIds = chatRooms.map(room => room.character_id);
    const personas = await prisma.persona.findMany({
      where: {
        id: {
          in: characterIds
        },
        is_deleted: false
      }
    });
    
    // 4. 응답 데이터 구성
    const characters = chatRooms.map(room => {
      const persona = personas.find(p => p.id === room.character_id);
      const lastChat = room.ChatLogs[0];
      
      return {
        character_id: room.character_id,
        name: persona?.name || '알 수 없는 캐릭터',
        image_url: persona?.image_url || '',
        last_chat: lastChat?.text || '',
        time: lastChat ? formatTime(lastChat.time) : ''
      };
    });
    
    // 5. 페이지 정보 계산
    const totalPages = Math.ceil(totalCount / size);
    
    const response = {
      characters: characters,
      page_info: {
        current_page: page,
        total_pages: totalPages,
        total_elements: totalCount
      }
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('데이터베이스 조회 에러:', error);
    res.status(500).json({
      message: '서버 내부 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 시간 포맷팅 함수
function formatTime(dateTime) {
  const date = new Date(dateTime);
  const options = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  return date.toLocaleString('ko-KR', options);
}