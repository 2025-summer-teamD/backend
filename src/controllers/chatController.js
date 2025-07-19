import chatService from '../services/chatService.js';
import { prisma } from '../config/prisma.js';

const streamChatByRoom = async (req, res, next) => {
  try {
    const { room_id } = req.params;
    const { message, sender, timestamp } = req.body;

    // 입력 검증
    if (!message || !sender || !timestamp) {
      return res.status(400).json({ 
        error: 'message, sender, timestamp 필드가 모두 필요합니다.' 
      });
    }

    // 실제 채팅방 정보를 데이터베이스에서 조회
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { 
        id: parseInt(room_id, 10),
        isDeleted: false
      },
      include: {
        persona: {
          select: {
            id: true,
            name: true,
            introduction: true,
            prompt: true
          }
        },
        ChatLogs: {
          where: { isDeleted: false },
          orderBy: { time: 'desc' },
          take: 10, // 최근 10개 대화 기록
          select: {
            text: true,
            speaker: true,
            time: true
          }
        }
      }
    });

    if (!chatRoom) {
      return res.status(404).json({ 
        error: `채팅방 ID ${room_id}를 찾을 수 없습니다.` 
      });
    }

    const personaInfo = {
      id: chatRoom.persona.id,
      name: chatRoom.persona.name,
      personality: chatRoom.persona.introduction || '친근하고 도움이 되는 성격',
      tone: '친근하고 자연스러운 말투',
      prompt: chatRoom.persona.prompt
    };

    // 실제 대화 기록을 문자열로 변환
    let chatHistory = '';
    if (chatRoom.ChatLogs.length > 0) {
      chatHistory = chatRoom.ChatLogs
        .reverse() // 오래된 순서로 정렬
        .map(log => `${log.speaker === 'user' ? '사용자' : personaInfo.name}: ${log.text}`)
        .join('\n');
    } else {
      chatHistory = '아직 대화 기록이 없습니다.';
    }

    console.log(`실제 채팅방 ${room_id} 정보 조회 완료:`, {
      personaName: personaInfo.name,
      chatHistoryLength: chatRoom.ChatLogs.length
    });

    // --- SSE 헤더 설정 ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    console.log('SSE 헤더 설정 완료');
    console.log('AI 응답 생성 시작...');

    // --- AI 응답 생성 (전체 문장을 한번에 받음) ---
    //실시간 스트리밍 방식 x => ai가 문장을 다 만들어 낸 후 보냄.
    // generateText 함수가 전체 응답을 생성할 때까지 기다립니다.
    const fullResponseText = await chatService.generateAiChatResponse(
      message,  // POST body에서 받은 message 사용
      personaInfo,
      chatHistory
    );

    console.log('AI 응답 생성 완료:', fullResponseText);

    // --- 사용자 메시지와 AI 응답을 데이터베이스에 저장 ---
    try {
      // 사용자 메시지 저장
      await prisma.chatLog.create({
        data: {
          chatroomId: parseInt(room_id, 10),
          text: message,
          type: 'text',
          speaker: 'user',
          time: new Date(timestamp)
        }
      });

      // AI 응답 저장
      await prisma.chatLog.create({
        data: {
          chatroomId: parseInt(room_id, 10),
          text: fullResponseText,
          type: 'text',
          speaker: 'ai',
          time: new Date()
        }
      });

      console.log('대화 기록 데이터베이스 저장 완료');
    } catch (dbError) {
      console.error('데이터베이스 저장 실패:', dbError);
      // 저장 실패해도 SSE 응답은 계속 진행
    }

    // --- 생성된 전체 응답을 SSE로 전송 ---
    res.write(`data: ${JSON.stringify({ content: fullResponseText })}\n\n`);
    console.log('첫 번째 데이터 전송 완료');
    
    res.write('data: [DONE]\n\n');
    console.log('종료 신호 전송 완료');
    
    res.end();

  } catch (error) {
    // 에러 처리
    console.error('SSE Controller Error:', error);
    if (!res.headersSent) {
      next(error);
    } else {
      res.end();
    }
  }

  // 클라이언트 연결 종료 이벤트 처리
  req.on('close', () => {
    console.log('클라이언트가 연결을 종료했습니다.');
    res.end();
  });
};

/**
 * 내가 참여한 채팅방 목록을 조회합니다.
 */
const getMyChats = async (req, res, next) => {
  try {
    const userId = req.auth.userId; // Clerk 인증에서 받은 사용자 ID
    const pagination = req.pagination; // 페이지네이션 미들웨어에서 준비된 값

    const result = await chatService.getMyChatList(userId, pagination);

    res.status(200).json({
      success: true,
      data: result.chatList,
      pagination: {
        page: pagination.page,
        size: pagination.size,
        totalElements: result.totalElements,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    console.error('내 채팅 목록 조회 에러:', error);
    next(error);
  }
};


//채팅방 입장
const enterChatRoom = async (req, res) => {
  try {
    const { character_id } = req.query;
    
    console.log('요청된 쿼리 파라미터:', req.query);
    console.log('character_id 값:', character_id);
    console.log('character_id 타입:', typeof character_id);
    
    if (!character_id) {
      return res.status(400).json({ error: 'character_id 쿼리 파라미터가 필요합니다.' });
    }

    const parsedCharacterId = parseInt(character_id);
    console.log('파싱된 characterId:', parsedCharacterId);
    console.log('파싱 결과 유효성:', !isNaN(parsedCharacterId));

    if (isNaN(parsedCharacterId)) {
      return res.status(400).json({ error: 'character_id는 숫자여야 합니다.' });
    }

    // 데이터베이스에서 채팅방 조회 (character_id로만 조회)
    const chatRoom = await prisma.chatRoom.findFirst({
      where: {
        characterId: parsedCharacterId,
        isDeleted: false
      },
      include: {
        persona: true,
        _count: {
          select: {
            ChatLogs: {
              where: { isDeleted: false }
            }
          }
        }
      }
    });

    if (!chatRoom) {
      return res.status(401).json({ error: '채팅방이 없습니다.' });
    }

    // 응답 데이터 구성
    const response = {
      room_id: `chat-${chatRoom.id}`,
      user_id: chatRoom.clerkId,
      persona_id: chatRoom.characterId,
      created_at: chatRoom.createdAt.toISOString(),
      count: chatRoom._count.ChatLogs,
      friendship: chatRoom.friendship,
      exp: chatRoom.exp
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('채팅방 입장 에러:', error);
    res.status(401).json({ error: '입장 실패' });
  }
};

export const chatController = {
  streamChatByRoom,
  getMyChats,
  enterChatRoom,
};

export default chatController;
