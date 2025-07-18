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

    // --- 데이터베이스에서 정보 조회 ---
    const room = await prisma.chatRoom.findUnique({
      where: { id: parseInt(room_id, 10) },
      include: { persona: true },
    });

    if (!room) {
      return res.status(404).json({ error: '채팅방을 찾을 수 없습니다.' });
    }
    const personaInfo = room.persona;
    
    // TODO: 실제 대화 기록을 DB에서 가져오는 로직 추가
    const chatHistory = '...';

    // --- SSE 헤더 설정 ---
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // --- AI 응답 생성 (전체 문장을 한번에 받음) ---
    //실시간 스트리밍 방식 x => ai가 문장을 다 만들어 낸 후 보냄.
    // generateText 함수가 전체 응답을 생성할 때까지 기다립니다.
    const fullResponseText = await chatService.generateAiChatResponse(
      message,  // POST body에서 받은 message 사용
      personaInfo,
      chatHistory
    );

    // --- 생성된 전체 응답을 SSE로 전송 ---
    res.write(`data: ${JSON.stringify({ content: fullResponseText })}\n\n`);
    res.write('data: [DONE]\n\n');
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

export const chatController = {
  streamChatByRoom,
};

export default chatController;
