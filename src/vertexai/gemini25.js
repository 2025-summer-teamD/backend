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

// Perplexity API 키 유효성 테스트 함수
async function testPerplexityAPI() {
  try {
    if (!process.env.PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY가 설정되지 않았습니다.');
    }

    console.log('Perplexity API 키 테스트 시작');
    console.log('API 키:', process.env.PERPLEXITY_API_KEY);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a test message.'
          }
        ]
      })
    });

    console.log('테스트 응답 상태:', response.status);
    const responseText = await response.text();
    console.log('테스트 응답 내용:', responseText);

    if (response.ok) {
      console.log('Perplexity API 키가 유효합니다.');
      return true;
    } else {
      console.log('Perplexity API 키가 유효하지 않습니다.');
      return false;
    }
  } catch (error) {
    console.error('Perplexity API 테스트 오류:', error.message);
    return false;
  }
}

// Perplexity API 호출 함수
async function generateCharacterWithPerplexity(characterName) {
 try {
   // API 키 확인
   if (!process.env.PERPLEXITY_API_KEY) {
     throw new Error('PERPLEXITY_API_KEY가 설정되지 않았습니다.');
   }

   console.log('Perplexity API 호출 시작:', characterName);
   console.log('API 키 길이:', process.env.PERPLEXITY_API_KEY?.length);
   console.log('API 키 전체:', process.env.PERPLEXITY_API_KEY);

   const requestBody = {
     model: 'sonar-pro',
     messages: [
        {
          'role': 'system',
          'content': '당신은 웹 검색을 통해 캐릭터나 인물 정보를 찾는 전문가입니다. 반드시 검색을 수행하고 검색 결과를 바탕으로 답변하세요.'
        },
       {
         role: 'user',
         content: `${characterName}에 대해 검색해서 알려주세요. 이 인물/캐릭터가 누구인지, 어떤 특징이 있는지 자세히 설명해주세요. 아래 JSON 형식에 맞춰 ${characterName}의 실제 정보로 상세 설정을 한국어로 생성해주세요

아래 JSON 형식에 맞춰 ${characterName}의 실제 정보로 상세 설정을 한국어로 생성해주세요:

{
 "description": "${characterName}에 대한 상세하고 디테일한 캐릭터적 소개를 검색하여 요약. 특히 주목해야할 특징위주로 (3-4문장)",
 "prompt": {
   "tone": "${characterName}의 대표적인 말투 혹은 유행어",
   "personality": "${characterName}의 성격을 아주 디테일하고 자세하게 묘사",
   "tag": "${characterName}를 대표하는 해시태그 4가지 (직업, 성별, 성격, 특징) (쉼표로 구분, # 제외)",
   "ImageUrl": []
 }
}`
       }
     ],
     search_recency_filter: 'year',
     response_format: {
       type: 'json_schema',
       json_schema: {
         schema: {
           type: 'object',
           properties: {
             description: { type: 'string' },
             prompt: {
               type: 'object',
               properties: {
                 tone: { type: 'string' },
                 personality: { type: 'string' },
                 tag: { type: 'string' },
                 ImageUrl: {
                   type: 'array',
                   items: { type: 'string' }
                 }
               },
               required: ['tone', 'personality', 'tag', 'ImageUrl']
             }
           },
           required: ['description', 'prompt']
         }
       }
     }
   };

   console.log('Perplexity API 요청 URL:', 'https://api.perplexity.ai/chat/completions');
   console.log('Perplexity API 요청 헤더:', {
     'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY?.substring(0, 10)}...`,
     'Content-Type': 'application/json'
   });

   const response = await fetch('https://api.perplexity.ai/chat/completions', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify(requestBody)
   });

   // 응답 상태 확인
   if (!response.ok) {
     const errorText = await response.text();
     console.error('Perplexity API HTTP 오류:', response.status, response.statusText);
     console.error('Perplexity API 응답 내용:', errorText);
     throw new Error(`Perplexity API 오류: ${response.status} ${response.statusText}`);
   }

   const responseText = await response.text();
   console.log('Perplexity API 원본 응답:', responseText);
   
   let data;
   try {
     data = JSON.parse(responseText);
   } catch (parseError) {
     console.error('Perplexity API JSON 파싱 오류:', parseError);
     console.error('파싱 실패한 응답:', responseText);
     throw new Error(`Perplexity API JSON 파싱 오류: ${parseError.message}`);
   }
   
   console.log('Perplexity API 파싱된 응답:', data);
   
   // 응답 구조 확인
   if (!data.choices || !data.choices[0] || !data.choices[0].message) {
     console.error('Perplexity API 응답 구조 오류:', data);
     throw new Error('Perplexity API 응답 구조가 올바르지 않습니다.');
   }

   // JSON 응답 파싱
   const messageContent = data.choices[0].message.content;
   const characterData = JSON.parse(messageContent);

   return characterData;

  } catch (error) {
    console.error('Perplexity API 오류:', error.message);
    throw new Error(`Perplexity API 오류: ${error.message}`);
  }
}

/**
 * 이미지 URL과 텍스트 프롬프트를 함께 보내 멀티모달 응답을 생성합니다.
 * @param {string} imageUrl - 공개적으로 접근 가능한 이미지 URL (예: GCS public URL)
 * @param {string} textPrompt - 이미지에 대해 질문하거나 요청할 내용 (한국어)
 * @returns {Promise<string>} 생성된 텍스트
 */
const generateTextWithImage = async (imageUrl, textPrompt = '이 이미지를 보고 자세히 설명해줘') => {
  try {
    console.log('🖼️ [GEMINI] 이미지 처리 시작:', { imageUrl, textPrompt });
    
    // 이미지 파일을 다운로드해 base64로 인코딩 (inlineData 사용)
    console.log('📥 [GEMINI] 이미지 다운로드 시작...');
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    console.log('✅ [GEMINI] 이미지 다운로드 완료:', { 
      size: buffer.length, 
      imageUrl 
    });

    // 간단한 MIME 타입 추정
    let mimeType = 'image/jpeg';
    if (imageUrl.endsWith('.png')) mimeType = 'image/png';
    else if (imageUrl.endsWith('.webp')) mimeType = 'image/webp';

    const base64Data = buffer.toString('base64');
    console.log('🔄 [GEMINI] Base64 인코딩 완료:', { 
      mimeType, 
      base64Length: base64Data.length 
    });

    const request = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: textPrompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
    };

    console.log('🤖 [GEMINI] Gemini API 호출 시작...');
    const result = await generativeModel.generateContent(request);
    const res = result.response;
    const generatedText = res.candidates[0].content.parts[0].text;
    
    console.log('✅ [GEMINI] 이미지+텍스트 생성 완료:', { 
      responseLength: generatedText.length,
      responsePreview: generatedText.substring(0, 100) + '...'
    });
    
    return generatedText;
  } catch (error) {
    console.error('❌ [GEMINI] 이미지+텍스트 생성 오류:', error.message);
    console.error('❌ [GEMINI] 오류 상세:', error);
    throw new Error('Gemini가 이미지를 처리하는데 실패했습니다.');
  }
};


export default {
  generateText,
  generatePersonaDetailsWithGemini,
  getGoogleImages,
  generateCharacterWithPerplexity,
  generateTextWithImage,
  testPerplexityAPI,
};


