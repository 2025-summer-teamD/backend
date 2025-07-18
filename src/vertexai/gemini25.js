import { GoogleGenerativeAI } from '@google/generative-ai';

// Google AI SDK 초기화
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

/**
 * Gemini 모델에 단일 프롬프트를 보내고, JSON 형식의 응답을 받습니다.
 * @param {string} promptText - Gemini에 보낼 프롬프트
 * @returns {Promise<object>} 파싱된 JSON 객체
 */
export const generatePersonaDetailsWithGemini = async (promptText) => {
  try {
    // Gemini Pro 모델 사용
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const result = await model.generateContent(promptText);
    const response = await result.response;
    const text = response.text();

    // JSON 응답 파싱
    return JSON.parse(text);

  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error('Gemini API를 통해 페르소나 상세 정보를 생성하는 데 실패했습니다.');
  }
};

export const generateText = async (prompt) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
};