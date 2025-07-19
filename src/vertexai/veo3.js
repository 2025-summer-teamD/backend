import { VertexAI } from '@google-cloud/vertexai';

const vertexAi = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
});

// Veo 3 모델 (실제 모델명은 공식 문서 확인 필요)
const generativeModel = vertexAi.getGenerativeModel({
  model: 'veo-3.0-generate-preview',
});

/**
 * Veo 3 모델을 사용하여 비디오를 생성합니다.
 * @param {string} prompt - 비디오 생성 프롬프트
 * @returns {Promise<object>} 생성된 비디오 정보
 */
async function generateVideo(prompt) {
  try {
    const request = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    const result = await generativeModel.generateContent(request);
    return result.response;
  } catch (error) {
    console.error('Veo 3 Video Generation Error:', error);
    throw new Error('Veo 3 API를 통해 비디오를 생성하는 데 실패했습니다.');
  }
}

export default {
  generateVideo
};
