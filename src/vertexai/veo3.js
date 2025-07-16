// Veo 3 연동 예시 (실제 엔드포인트/파라미터는 공식 문서 참고)
const { VertexAI } = require('@google-cloud/aiplatform');

const vertexAi = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
});

const model = 'veo-3.0-generate-preview'; // Refer to https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation
/**
 * Veo 3 모델에 프롬프트를 보내고 비디오 생성 응답을 받아온다.
 * @param {string} prompt - 비디오 생성 프롬프트
 * @returns {Promise<any>} - Veo 3 모델의 응답
 */
async function generateVideo(prompt) {
  try {
    const predictionService = vertexAi.getPredictionService();
    const [response] = await predictionService.predict({
      endpoint: model,
      instances: [{ content: prompt }],
    });
    return response.predictions;
  } catch (error) {
    console.error('Veo 3 모델 호출 에러:', error);
    throw error;
  }
}
