// src/services/geminiService.js

import { VertexAI } from '@google-cloud/vertexai';
import axios from 'axios';

const vertexAi = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
});

const generativeModel = vertexAi.getGenerativeModel({
  model: 'gemini-2.5-pro',
});

/**
 * Gemini 2.5 Pro에 프롬프트를 보내고 일반 텍스트 응답을 받습니다.
 * @param {string} promptText - Gemini에 보낼 프롬프트
 * @returns {Promise<string>} 생성된 텍스트
 */
const generateText = async (promptText) => {
  try {
    const request = {
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
    };

    const result = await generativeModel.generateContent(request);
    const response = result.response;
    return response.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Vertex AI Gemini Generation Error:', error);
    throw new Error('Gemini API를 통해 텍스트를 생성하는 데 실패했습니다.');
  }
};

/**
 * Gemini 2.5 Pro에 프롬프트를 보내고, JSON 형식의 응답을 받습니다.
 * @param {string} promptText - Gemini에 보낼 프롬프트
 * @returns {Promise<object>} 파싱된 JSON 객체
 */
const generatePersonaDetailsWithGemini = async (promptText) => {
  try {
    const request = {
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    };

    const result = await generativeModel.generateContent(request);
    const response = result.response;
    const jsonString = response.candidates[0].content.parts[0].text;
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Vertex AI Gemini Generation Error:', error);
    throw new Error('Gemini API를 통해 페르소나 상세 정보를 생성하는 데 실패했습니다.');
  }
};

const getGoogleImages = async (query, GOOGLE_API_KEY, GOOGLE_CX, limit=10) => {
    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
        console.log('Google API 키 상태:', {
            hasApiKey: !!GOOGLE_API_KEY,
            hasCustomSearchId: !!GOOGLE_CX,
            apiKeyLength: GOOGLE_API_KEY?.length,
            cxLength: GOOGLE_CX?.length
        });
        return ["Error: Google API 키 또는 Custom Search ID가 설정되지 않았습니다."];
    }

    try {
        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
                key: GOOGLE_API_KEY,
                cx: GOOGLE_CX,
                q: query,
                searchType: 'image',
                num: Math.min(limit, 10),
                safe: 'active'
            }
        });

        return response.data.items?.map(item => ({
            title: item.title || '',
            url: item.link || '',
            thumbnail: item.image?.thumbnailLink || '',
            source: 'google',
            width: item.image?.width,
            height: item.image?.height
        })) || [];
    } catch (error) {
        console.error('Google Images 검색 오류:', error.message);
        console.error('에러 상세:', error.response?.data);
        console.error('요청 URL:', error.config?.url);
        console.error('요청 파라미터:', error.config?.params);
        return [];
    }
}


export default {
  generateText,
  generatePersonaDetailsWithGemini,
  getGoogleImages
};
