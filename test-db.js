import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 데이터베이스 확인 시작...');
    
    // 모든 채팅방 확인
    const chatRooms = await prisma.chatRoom.findMany({
      include: {
        participants: {
          include: {
            user: true,
            persona: true
          }
        }
      }
    });
    
    console.log('📊 총 채팅방 수:', chatRooms.length);
    
    // 모든 ChatRoomParticipant 확인
    const participants = await prisma.chatRoomParticipant.findMany({
      include: {
        chatRoom: true,
        user: true,
        persona: true
      }
    });
    
    console.log('📊 총 ChatRoomParticipant 수:', participants.length);
    
    // 사용자별 참가자 수 확인
    const userParticipants = participants.filter(p => p.userId);
    console.log('📊 사용자 참가자 수:', userParticipants.length);
    
    // AI 참가자 수 확인
    const aiParticipants = participants.filter(p => p.personaId);
    console.log('📊 AI 참가자 수:', aiParticipants.length);
    
    // 각 채팅방의 상세 정보
    chatRooms.forEach((room, index) => {
      console.log(`\n🏠 채팅방 ${index + 1}:`, {
        id: room.id,
        name: room.name,
        clerkId: room.clerkId,
        isPublic: room.isPublic,
        isDeleted: room.isDeleted,
        participantsCount: room.participants.length,
        participants: room.participants.map(p => ({
          userId: p.userId,
          personaId: p.personaId,
          userName: p.user?.name,
          personaName: p.persona?.name
        }))
      });
    });
    
  } catch (error) {
    console.error('❌ 데이터베이스 확인 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase(); 