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

// app에 io 인스턴스 설정 (chatController에서 사용)
app.setIo(io);

io.on('connection', (socket) => {
  console.log('🔌 새로운 WebSocket 연결:', socket.id);
  
  // 방 입장
  socket.on('joinRoom', ({ roomId, userId }) => {
    console.log('📡 joinRoom 이벤트 수신:', { socketId: socket.id, roomId, userId });
    socket.join(`room-${roomId}`);
    console.log(`✅ 소켓 ${socket.id}가 방 room-${roomId}에 입장함`);
    io.to(`room-${roomId}`).emit('participants', { userId, joined: true });
  });

  // 메시지 송수신 + AI 응답
  socket.on('sendMessage', async ({ roomId, message, senderType, senderId, aiName, aiId, userName }) => {
    console.log('📨 sendMessage 이벤트 수신:', { roomId, message, senderType, senderId, aiName, aiId, userName });
    
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
    
    // 3. AI 응답 생성 및 push (그룹 채팅만 처리)
    if (!senderType || senderType === 'user') {
      console.log('🤖 AI 응답 생성 시작 (그룹 채팅)');
      
      // 채팅방의 AI(페르소나) 참여자 조회
      const chatRoom = await prismaConfig.prisma.chatRoom.findUnique({
        where: { id: parseInt(roomId, 10) },
        include: { persona: true },
      });
      const aiParticipants = chatRoom.persona ? [chatRoom.persona] : [];
      
      console.log(`👥 AI 참여자 수: ${aiParticipants.length}`, aiParticipants.map(p => ({ id: p.id, name: p.name })));
      
      // 1대1 채팅인지 확인
      const isOneOnOne = aiParticipants.length === 1;
      
      // 1대1 채팅은 SSE로 처리하므로 WebSocket에서는 그룹 채팅만 처리
      if (!isOneOnOne) {
        console.log('👥 그룹 채팅 감지 - AI 응답 처리 시작');
        
        // 최근 10개 메시지 조회
        const recentLogs = await prismaConfig.prisma.chatLog.findMany({
          where: { chatroomId: chatRoom.id, isDeleted: false },
          orderBy: { time: 'desc' },
          take: 10,
          select: { text: true, senderType: true, senderId: true, time: true }
        });
        
        // 대화 기록을 문자열로 변환 (AI 이름 포함)
        const chatHistory = recentLogs
          .reverse()
          .map(log => {
            if (log.senderType === 'user') {
              return `${userName || '사용자'}: ${log.text}`;
            } else {
              // AI 메시지인 경우 해당 AI의 이름 찾기
              const aiParticipant = aiParticipants.find(p => p.id === parseInt(log.senderId));
              const aiName = aiParticipant ? aiParticipant.name : `AI(${log.senderId})`;
              return `${aiName}: ${log.text}`;
            }
          })
          .join('\n');
        
        // 첫 번째 메시지인지 확인 (사용자 메시지가 1개 이하인 경우)
        const userMessageCount = recentLogs.filter(log => log.senderType === 'user').length;
        const aiMessageCount = recentLogs.filter(log => log.senderType === 'ai').length;
        const isFirstMessage = userMessageCount <= 1 && aiMessageCount === 0;
        
        console.log('🔍 첫 번째 메시지 확인:', {
          userMessageCount,
          aiMessageCount,
          isFirstMessage,
          totalLogs: recentLogs.length
        });
        
        // 단체 채팅: 다중 AI 응답
        // 모든 AI 정보 수집
        const allPersonas = aiParticipants;
        
        // 병렬로 모든 AI 응답 생성
        console.log('📝 AI에 전달할 대화 기록:', chatHistory);
        const aiResponses = await chatService.generateAiChatResponseGroup(
          message,
          allPersonas,
          chatHistory,
          isFirstMessage,
          userName
        );
        
        console.log(`🤖 AI 응답 생성 완료: ${aiResponses.length}개`);
        
        // 모든 AI 응답을 병렬로 DB에 저장하고 전송
        const saveAndEmitPromises = aiResponses.map(async (response) => {
          // DB 저장과 웹소켓 전송을 병렬로 처리
          const [dbResult] = await Promise.all([
            // DB 저장
            prismaConfig.prisma.chatLog.create({
              data: {
                chatroomId: parseInt(roomId, 10),
                text: response.content,
                type: 'text',
                senderType: 'ai',
                senderId: String(response.personaId),
                time: new Date()
              }
            }),
            // 웹소켓 전송 (비동기로 처리)
            new Promise((resolve) => {
              const emitData = {
                message: response.content,
                senderType: 'ai',
                senderId: String(response.personaId),
                aiName: String(response.personaName),
                aiId: String(response.personaId)
              };
              console.log(`📡 AI 메시지 전송: ${response.personaName}`, emitData);
              io.to(`room-${roomId}`).emit('receiveMessage', emitData);
              resolve();
            })
          ]);
          
          return dbResult;
        });
        
        // 모든 저장과 전송 작업을 병렬로 실행
        await Promise.all(saveAndEmitPromises);
        
        console.log('🤖 AI 응답 저장 및 전송 완료, 친밀도 업데이트 시작');
        
        // 친밀도 증가 로직 추가
        const friendshipUpdatePromises = aiResponses.map(async (response) => {
          try {
            // 경험치 계산 (간단한 계산: 메시지 길이에 비례)
            const expIncrease = Math.max(1, Math.floor(response.content.length / 10));
            
            console.log(`🔍 AI 응답 친밀도 증가 시도: 캐릭터 ${response.personaId} (${response.personaName}), 경험치 +${expIncrease}`);
            
            // AI 캐릭터의 소유자 찾기
            const aiCharacter = await prismaConfig.prisma.persona.findUnique({
              where: { id: response.personaId },
              select: { clerkId: true, name: true }
            });
            
            if (!aiCharacter) {
              console.error(`❌ AI 캐릭터 ${response.personaId}를 찾을 수 없습니다.`);
              return;
            }
            
            console.log(`👤 AI 캐릭터 소유자 확인: ${aiCharacter.name} (ID: ${response.personaId}) → 사용자 ${aiCharacter.clerkId}`);
            
            // 친밀도 증가 (AI 캐릭터 소유자에게)
            const friendshipResult = await chatService.increaseFriendship(
              aiCharacter.clerkId, // AI 캐릭터 소유자의 clerkId
              response.personaId,
              expIncrease
            );
            
            if (friendshipResult) {
              console.log(`✅ 친밀도 증가 완료: 사용자 ${aiCharacter.clerkId}, 캐릭터 ${response.personaId}, 경험치 +${expIncrease}, 새 경험치: ${friendshipResult.exp}, 새 레벨: ${friendshipResult.friendship}`);
              
              // expUpdated 이벤트 전송
              const expUpdatedData = {
                roomId,
                personaId: response.personaId,
                personaName: response.personaName,
                newExp: friendshipResult.exp,
                newLevel: friendshipResult.friendship,
                expIncrease,
                userId: aiCharacter.clerkId // AI 캐릭터 소유자의 clerkId
              };
              
              console.log(`📡 expUpdated 이벤트 전송:`, expUpdatedData);
              io.to(`room-${roomId}`).emit('expUpdated', expUpdatedData);
            } else {
              console.log(`⚠️ 친밀도 증가 실패: 사용자 ${aiCharacter.clerkId}가 캐릭터 ${response.personaId}를 소유하지 않음`);
            }
          } catch (error) {
            console.error('❌ 친밀도 증가 실패:', error);
          }
        });
        
        // 친밀도 업데이트를 병렬로 실행
        await Promise.all(friendshipUpdatePromises);
        console.log('✅ 친밀도 업데이트 완료');
      } else {
        console.log('👤 1대1 채팅 감지 - WebSocket에서는 처리하지 않음 (SSE에서 처리)');
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 WebSocket 연결 해제:', socket.id);
  });
});

// 서버 시작
httpServer.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  logger.logInfo(`서버가 포트 ${PORT}에서 시작되었습니다.`);
});