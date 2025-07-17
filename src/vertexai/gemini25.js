import pkg from '@google-cloud/aiplatform';
const { PredictionServiceClient } = pkg.v1;

const predictionServiceClient = new PredictionServiceClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  apiEndpoint: `${process.env.GOOGLE_CLOUD_REGION || 'us-central1'}-aiplatform.googleapis.com`,
});

// 실제 endpoint는 프로젝트/위치에 맞게 수정 필요
const GEMINI_ENDPOINT = 'projects/' + process.env.GOOGLE_CLOUD_PROJECT + '/locations/' + (process.env.GOOGLE_CLOUD_REGION || 'us-central1') + '/publishers/google/models/gemini-2.5-pro';

async function generateText(prompt) {
  const [response] = await predictionServiceClient.predict({
    endpoint: GEMINI_ENDPOINT,
    instances: [{ content: prompt }],
  });
  return response;
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

export { generateText };