// Veo 3 연동 예시 (실제 엔드포인트/파라미터는 공식 문서 참고)
const { VertexAI } = require('@google-cloud/vertexai');

const vertexAi = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
});

const model = 'veo-3'; // 실제 모델명은 공식 문서 참고

async function generateVideo(prompt) {
  const predictionService = vertexAi.getPredictionService();
  const [response] = await predictionService.predict({
    endpoint: model,
    instances: [{ content: prompt }],
  });
  return response.predictions;
}

module.exports = { generateVideo }; 