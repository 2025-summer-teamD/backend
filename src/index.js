import app from './app.js';
import createUploadDirectory from './utils/createUploadDir.js';
import createDefaultImage from './utils/createDefaultImage.js';
import logger from './utils/logger.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import prismaConfig from './config/prisma.js';
import chatService from './services/chatService.js';

const PORT = process.env.PORT || 3001;

// 서버 시작 시 업로드 디렉토리와 기본 이미지 생성
createUploadDirectory();
createDefaultImage();

// 기존 app.listen → httpServer + socket.io로 변경
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  }
});

io.on('connection', (socket) => {
  // 방 입장
  socket.on('joinRoom', ({ roomId, userId }) => {
    socket.join(`room-${roomId}`);
    io.to(`room-${roomId}`).emit('participants', { userId, joined: true });
  });

  // 메시지 송수신 + AI 응답
  socket.on('sendMessage', async ({ roomId, message, senderType, senderId, aiName, aiId }) => {
    // 1. 메시지 DB 저장
    await prismaConfig.prisma.chatLog.create({
      data: {
        chatroomId: parseInt(roomId, 10),
        text: message,
        type: 'text',
        senderType: senderType || 'user',
        senderId: String(senderId), // String으로 변환
        time: new Date()
      }
    });
    
    // 2. 메시지 모든 참여자에게 push
    if (senderType === 'ai') {
      // AI 메시지인 경우 aiName, aiId 포함해서 전송
      io.to(`room-${roomId}`).emit('receiveMessage', { 
        message, 
        senderType: 'ai', 
        senderId,
        aiName: aiName,
        aiId: aiId
      });
    } else {
      // 유저 메시지인 경우
      io.to(`room-${roomId}`).emit('receiveMessage', { 
        message, 
        senderType: senderType || 'user', 
        senderId 
      });
    }
    
    // 3. AI 응답 생성 및 push (멀티 AI) - 유저 메시지일 때만
    if (!senderType || senderType === 'user') {
      // 채팅방의 모든 AI(페르소나) 참여자 조회
      const chatRoom = await prismaConfig.prisma.chatRoom.findUnique({
        where: { id: parseInt(roomId, 10) },
        include: { participants: { include: { persona: true } } },
      });
      const aiParticipants = chatRoom.participants.filter(p => p.personaId && p.persona);
      // 최근 10개 메시지 조회
      const recentLogs = await prismaConfig.prisma.chatLog.findMany({
        where: { chatroomId: chatRoom.id, isDeleted: false },
        orderBy: { time: 'desc' },
        take: 10,
        select: { text: true, senderType: true, senderId: true, time: true }
      });
      for (const aiP of aiParticipants) {
        const persona = aiP.persona;
        const aiResponseText = await chatService.generateAiChatResponse(
          message,
          persona,
          recentLogs.reverse().map(log => `${log.senderType === 'user' ? '사용자' : persona.name}: ${log.text}`).join('\n'),
          aiParticipants.filter(p => p.persona.id !== persona.id)
        );
        // DB 저장
        await prismaConfig.prisma.chatLog.create({
          data: {
            chatroomId: parseInt(roomId, 10),
            text: aiResponseText,
            type: 'text',
            senderType: 'ai',
            senderId: String(persona.id), // String으로 변환
            time: new Date()
          }
        });
        // AI 응답 push
        const emitData = {
          message: aiResponseText,
          senderType: 'ai',
          senderId: String(persona.id),
          aiName: String(persona.name),
          aiId: String(persona.id)
        };
        io.to(`room-${roomId}`).emit('receiveMessage', emitData);
      }
    }
  });
});

// 서버 시작
httpServer.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  logger.logInfo(`서버가 포트 ${PORT}에서 시작되었습니다.`);
});