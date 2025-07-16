const { VertexAI } = require('@google-cloud/aiplatform');

const vertexAi = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
});

const model = 'gemini-2.5-pro';

/**
 * Gemini 2.5 Pro에 프롬프트를 보내고 응답을 받아온다.
 * @param {string} prompt - 사용자 프롬프트
 * @returns {Promise<any>} - Gemini 2.5 Pro의 응답
 */
async function generateText(prompt) {
  try {
    const predictionService = vertexAi.getPredictionService();
    const [response] = await predictionService.predict({
      endpoint: model,
      instances: [{ content: prompt }],
    });
    return response.predictions;
  } catch (error) {
    console.error('Gemini 2.5 Pro 호출 에러:', error);
    throw error;
  }
}

// 사용 예시 (직접 실행 시)
if (require.main === module) {
  generateText('안녕, Gemini 2.5 Pro!').then(console.log).catch(console.error);
}

module.exports = { generateText }; 