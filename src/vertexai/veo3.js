import { VertexAI } from '@google-cloud/vertexai';
import Bottleneck from "bottleneck";

const vertexAi = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
});

// 비동기 작업 제한을 위한 Bottleneck 인스턴스 생성
const limiter = new Bottleneck({
  minTime: 120000, // 2분 간격으로 증가
  maxConcurrent: 1
});

// Veo 3 모델 (실제 모델명은 공식 문서 확인 필요)
const generativeModel = vertexAi.getGenerativeModel({
  model: 'veo-2.0-generate-001',
});

/**
 * 지수 백오프를 사용한 재시도 함수
 * @param {Function} fn - 실행할 함수
 * @param {number} maxRetries - 최대 재시도 횟수
 * @returns {Promise<any>} 함수 실행 결과
 */
async function retryWithExponentialBackoff(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // 429 오류인 경우에만 재시도
      if (error.code === 429 || error.status === 'RESOURCE_EXHAUSTED') {
        const delay = Math.pow(2, attempt) * 1000; // 1초, 2초, 4초
        console.log(`Veo API 할당량 초과. ${delay}ms 후 재시도... (시도 ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
}

/**
 * Veo 모델을 사용하여 비디오를 생성합니다.
 * @param {string} prompt - 비디오 생성 프롬프트
 * @returns {Promise<object>} 생성된 비디오 정보
 */
async function generateVideo(prompt) {
  try {
    const request = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    const result = await limiter.schedule(async () => {
      return await retryWithExponentialBackoff(async () => {
        return await generativeModel.generateContent(request);
      });
    });

    const videoUrl = result.response.candidates[0].content.parts[0].fileData.fileUri;
    return { videoUrl };

  } catch (error) {
    console.error('Veo 2 Video Generation Error:', error);
    
    // 할당량 초과 오류인 경우 사용자에게 더 명확한 메시지 제공
    if (error.code === 429 || error.status === 'RESOURCE_EXHAUSTED') {
      throw new Error('Veo API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }
    
    throw new Error('Veo 2 API를 통해 비디오를 생성하는 데 실패했습니다.');
  }
}

export default {
  generateVideo
};
