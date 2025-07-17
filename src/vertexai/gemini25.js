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

/**
 * Gemini 모델에 단일 프롬프트를 보내고, JSON 형식의 응답을 받습니다.
 * @param {string} promptText - Gemini에 보낼 프롬프트
 * @returns {Promise<object>} 파싱된 JSON 객체
 */
export const generatePersonaDetailsWithGemini = async (promptText) => {
  try {
    const request = {
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: 'application/json', // ★★★ JSON 모드 활성화
      },
    };

    const result = await generativeModel.generateContent(request);
    const response = result.response;
    const jsonString = response.candidates[0].content.parts[0].text;

    return JSON.parse(jsonString); // JSON 문자열을 객체로 파싱하여 반환

  } catch (error) {
    console.error('Vertex AI Gemini Generation Error:', error);
    throw new Error('Gemini API를 통해 페르소나 상세 정보를 생성하는 데 실패했습니다.');
  }
};