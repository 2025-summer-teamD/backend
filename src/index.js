import app from './app.js';
import createUploadDirectory from './utils/createUploadDir.js';
import createDefaultImage from './utils/createDefaultImage.js';
import logger from './utils/logger.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import prismaConfig from './config/prisma.js';
import chatService from './services/chatService.js';
import { addAiChatJob } from './services/queueService.js';
import onlineStatusService from './services/onlineStatusService.js';
import redisClient from './config/redisClient.js';

// BullMQ AI 워커를 메인 프로세스에서 함께 실행
import './workers/aiChatWorker.js';

const PORT = process.env.PORT || 3001;

// 서버 시작 시 업로드 디렉토리와 기본 이미지 생성
createUploadDirectory();
createDefaultImage();

// 기존 app.listen → httpServer + socket.io로 변경
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'], // 🔧 추가: 5174 포트
    credentials: true,
  }
});

// app에 io 인스턴스 설정 (chatController에서 사용)
app.setIo(io);

// Redis Pub/Sub 전용 클라이언트 생성 (메인 클라이언트와 분리)
const pubSubClient = redisClient.duplicate();
await pubSubClient.connect();

// app에 pubSubClient 설정 (SSE에서 사용)
app.set('pubSubClient', pubSubClient);

io.on('connection', (socket) => {
  console.log('🔌 새로운 WebSocket 연결:', socket.id);
  
  // 방 입장
  socket.on('joinRoom', async ({ roomId, userId }) => {
    console.log('📡 joinRoom 이벤트 수신:', { socketId: socket.id, roomId, userId });
    
    // 온라인 상태 및 방 참여 설정
    await onlineStatusService.setUserOnline(userId, socket.id);
    await onlineStatusService.joinRoom(userId, roomId);
    
    socket.join(`room-${roomId}`);
    console.log(`✅ 소켓 ${socket.id}가 방 room-${roomId}에 입장함`);
    
    // 오프라인 상태에서 쌓인 메시지들 전송
    const pendingMessages = await onlineStatusService.getPendingMessagesForUser(userId, roomId);
    if (pendingMessages.length > 0) {
      console.log(`📬 오프라인 메시지 ${pendingMessages.length}개 전송`);
      pendingMessages.forEach(msg => {
        socket.emit('newMessage', msg);
      });
    }
    
    io.to(`room-${roomId}`).emit('participants', { userId, joined: true });
  });

  // 메시지 송수신 + AI 응답 (BullMQ 사용)
  socket.on('sendMessage', async ({ roomId, message, senderType, senderId, aiName, aiId, userName }) => {
    console.log('📨 sendMessage 이벤트 수신:', { roomId, message, senderType, senderId, aiName, aiId, userName });
    
    try {
      // 1. 사용자 메시지만 처리 (AI 메시지는 워커에서 처리됨)
      if (!senderType || senderType === 'user') {
        // 사용자 메시지 DB 저장
        await prismaConfig.prisma.chatLog.create({
          data: {
            chatroomId: parseInt(roomId, 10),
            text: message,
            type: 'text',
            senderType: 'user',
            senderId: String(senderId),
            time: new Date()
          }
        });
        
        // 2. 사용자 메시지를 온라인 사용자들에게 즉시 전송
        const messageData = { 
          message, 
          senderType: 'user', 
          senderId,
          userName,
          timestamp: new Date().toISOString()
        };
        io.to(`room-${roomId}`).emit('receiveMessage', messageData);
        
        // 3. 오프라인 사용자 처리 (푸시 알림 제거됨)
        // 오프라인 사용자는 다음 접속 시 메시지 확인 가능
        
        // 4. AI 응답 처리를 BullMQ 큐에 추가 (기존 WebSocket 그룹 채팅용)
        console.log('🤖 AI 응답 작업을 BullMQ 큐에 추가 (WebSocket 방식)');
        await addAiChatJob({
          roomId,
          message,
          senderId,
          userName: userName || '사용자',
          isGroupChat: false, // WebSocket 방식은 기존 방식 유지
          responseChannel: null
        });
        
        console.log('✅ 메시지 처리 완료 - AI 응답은 워커에서 처리됩니다');
      }
    } catch (error) {
      console.error('❌ sendMessage 처리 중 오류:', error);
      socket.emit('error', { message: '메시지 전송 중 오류가 발생했습니다.' });
    }
  });
  
  socket.on('disconnect', async () => {
    console.log('🔌 WebSocket 연결 해제:', socket.id);
    // 연결 해제 시 온라인 상태 정리 (userId가 필요하지만 여기서는 socket.id만 사용)
    // 실제로는 userId를 socket에 저장해두고 사용해야 함
  });
});

// Redis Pub/Sub 리스너 설정 (워커에서 WebSocket으로 메시지 전송)
pubSubClient.subscribe('websocket-message', (message) => {
  try {
    const { roomId, messageData } = JSON.parse(message);
    io.to(roomId).emit('newMessage', messageData);
    console.log('🔄 워커에서 WebSocket으로 메시지 전달:', { roomId, messageData });
  } catch (error) {
    console.error('❌ Redis Pub/Sub 메시지 처리 오류:', error);
  }
});

console.log('📡 Redis Pub/Sub 시스템 초기화 완료');
console.log('  - WebSocket 메시지: websocket-message 채널');
console.log('  - SSE 그룹 채팅: group-chat-response:* 채널');

// 서버 시작
httpServer.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log('🤖 BullMQ AI 워커가 함께 시작되었습니다.');
  logger.logInfo(`서버가 포트 ${PORT}에서 시작되었습니다.`);
});