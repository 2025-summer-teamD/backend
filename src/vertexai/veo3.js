import { VertexAI } from '@google-cloud/vertexai';
import Bottleneck from "bottleneck";

const vertexAi = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
});

// 비동기 작업 제한을 위한 Bottleneck 인스턴스 생성
const limiter = new Bottleneck({
  minTime: 60000, // 60초 간격
  maxConcurrent: 1
});

// Veo 3 모델 (실제 모델명은 공식 문서 확인 필요)
const generativeModel = vertexAi.getGenerativeModel({
  model: 'veo-2.0-generate-001',
});

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
      return await generativeModel.generateContent(request);
    });

    const videoUrl = result.response.candidates[0].content.parts[0].fileData.fileUri;
    return { videoUrl };

  } catch (error) {
    console.error('Veo 2 Video Generation Error:', error);
    throw new Error('Veo 2 API를 통해 비디오를 생성하는 데 실패했습니다.');
  }
}

export default {
  generateVideo
};
