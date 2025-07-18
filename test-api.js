import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

// 테스트용 페르소나 데이터
const testPersona = {
  name: "테스트 캐릭터",
  image_url: "https://example.com/image.jpg",
  is_public: true,
  prompt: {
    tone: "친근하고 따뜻한",
    personality: "친절한, 이해심 많은, 긍정적인",
    tag: "친구, 상담, 위로"
  },
  description: "테스트용 캐릭터입니다."
};

async function testPersonaAPI() {
  try {
    console.log('🚀 페르소나 API 테스트 시작...\n');

    // 1. 페르소나 생성 테스트
    console.log('1️⃣ 페르소나 생성 테스트...');
    try {
      const createResponse = await axios.post(`${BASE_URL}/api/personas`, testPersona);
      console.log('✅ 생성 성공:', createResponse.data);
    } catch (error) {
      console.log('❌ 생성 실패:', error.response?.data || error.message);
    }

    // 2. 페르소나 목록 조회 테스트
    console.log('\n2️⃣ 페르소나 목록 조회 테스트...');
    try {
      const listResponse = await axios.get(`${BASE_URL}/api/personas`);
      console.log('✅ 목록 조회 성공:', listResponse.data);
    } catch (error) {
      console.log('❌ 목록 조회 실패:', error.response?.data || error.message);
    }

    // 3. 페르소나 상세 조회 테스트 (첫 번째 페르소나 ID 사용)
    console.log('\n3️⃣ 페르소나 상세 조회 테스트...');
    try {
      const detailResponse = await axios.get(`${BASE_URL}/api/personas/1`);
      console.log('✅ 상세 조회 성공:', detailResponse.data);
    } catch (error) {
      console.log('❌ 상세 조회 실패:', error.response?.data || error.message);
    }

    console.log('\n🎉 API 테스트 완료!');

  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error.message);
  }
}

// 서버가 시작될 때까지 잠시 기다린 후 테스트 실행
setTimeout(testPersonaAPI, 3000); 