/**
 * 게임 관련 서비스
 * 끝말잇기, 스무고개, 밸런스 게임 등의 로직을 처리합니다.
 */

import gemini25 from '../vertexai/gemini25.js';

/**
 * 끝말잇기 게임 모드 감지
 * @param {string} userMessage - 사용자 메시지
 * @returns {boolean} 끝말잇기 게임 모드 여부
 */
const isWordChainGame = (userMessage) => {
  const message = userMessage.toLowerCase().trim();
  return message.includes('끝말잇기') || message.includes('끝말 잇기') || message.includes('[game:끝말잇기]');
};

/**
 * 스무고개 게임 모드 감지
 * @param {string} userMessage - 사용자 메시지
 * @returns {boolean} 스무고개 게임 모드 여부
 */
const isTwentyQuestionsGame = (userMessage) => {
  const message = userMessage.toLowerCase().trim();
  return message.includes('스무고개') || message.includes('20고개') || message.includes('[game:스무고개]');
};

/**
 * 밸런스 게임 모드 감지
 * @param {string} userMessage - 사용자 메시지
 * @returns {boolean} 밸런스 게임 모드 여부
 */
const isBalanceGame = (userMessage) => {
  const message = userMessage.toLowerCase().trim();
  return message.includes('밸런스') || message.includes('밸런스게임') || message.includes('[game:밸런스게임]');
};

/**
 * 끝말잇기 게임 시작 프롬프트 생성
 * @param {object} personaInfo - AI 캐릭터 정보
 * @returns {string} 게임 시작 프롬프트
 */
const generateWordChainStartPrompt = (personaInfo) => {
  const personaName = personaInfo.name || 'AI';
  
  return `
당신은 ${personaName}입니다. 끝말잇기 게임을 시작하려고 합니다.

게임 규칙:
1. 사용자가 단어를 말하면, 그 단어의 마지막 글자로 시작하는 새로운 단어를 답해주세요
2. 이미 사용된 단어는 다시 사용할 수 없습니다
3. 답할 수 없는 경우 "끝!"이라고 말해주세요

중요한 규칙:
- 반드시 2문장 이내로만 답변하세요
- 자신의 말투와 성격을 유지하세요
- 게임에 집중하고 불필요한 설명은 하지 마세요
- 사용자가 틀렸을 때는 격려해주고 다시 시도하라고 하세요

${personaName}의 말투로 자연스럽게 게임을 시작해주세요. 게임 규칙을 간단히 설명하고 마음에 드는 단어 하나를 선택해서 그 단어로 시작하겠다고 말해주세요.
`;
};

/**
 * 스무고개 게임 시작 프롬프트 생성
 * @param {object} personaInfo - AI 캐릭터 정보
 * @returns {string} 게임 시작 프롬프트
 */
const generateTwentyQuestionsStartPrompt = (personaInfo) => {
  const personaName = personaInfo.name || 'AI';
  
  // 다양한 주제들
  const topics = ['동물', '음식', '직업', '나라', '도시', '영화', '책', '운동', '색깔', '음악'];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  
  return `
당신은 ${personaName}입니다. 스무고개 게임을 시작하려고 합니다.

게임 규칙:
1. 주제는 "${randomTopic}" 중 사용자에게 하나를 선택하라고 말해주세요
2. 당신이 생각한 것을 사용자가 20번 안에 맞춰야 합니다
3. 사용자는 "네" 또는 "아니오"로 답할 수 있는 질문만 할 수 있습니다
4. 20번 안에 맞추면 사용자 승리, 못 맞추면 당신 승리입니다

중요한 규칙:
- 반드시 2문장 이내로만 답변하세요
- 자신의 말투와 성격을 유지하세요
- 게임에 집중하고 불필요한 설명은 하지 마세요
- 사용자가 질문할 때마다 캐릭터의 말투로 자연스럽게 "네" 또는 "아니오"로만 답변하세요

${personaName}의 말투로 자연스럽게 게임을 시작해주세요. 게임 규칙을 간단히 설명하고 "${randomTopic}" 주제로 시작하겠다고 말해주세요.
`;
};

/**
 * 밸런스 게임 시작 프롬프트 생성
 * @param {object} personaInfo - AI 캐릭터 정보
 * @returns {string} 게임 시작 프롬프트
 */
const generateBalanceGameStartPrompt = (personaInfo) => {
  const personaName = personaInfo.name || 'AI';
  
  return `
당신은 ${personaName}입니다. 밸런스 게임을 시작하려고 합니다.

게임 규칙:
1. 서로 번갈아가면서 주제를 제시합니다 (총 6번, 각자 3번씩)
2. 사용자가 선택하면, 당신이 다음 주제를 제시합니다
3. 6번이 끝나면 몇 개가 같은 선택을 했는지 확인합니다

중요한 규칙:
- 반드시 2문장 이내로만 답변하세요
- 자신의 말투와 성격을 유지하세요
- 게임에 집중하고 불필요한 설명은 하지 마세요
- 주제를 제시할 때는 "A vs B" 형태로 제시하세요

${personaName}의 말투로 자연스럽게 게임을 시작해주세요. 게임 규칙을 간단히 설명하고 마음에 드는 주제 하나를 "A vs B" 형태로 제시해주세요.
`;
};

/**
 * 밸런스 게임 진행 프롬프트 생성
 * @param {object} personaInfo - AI 캐릭터 정보
 * @param {string} userChoice - 사용자 선택
 * @param {number} round - 현재 라운드 (1-6)
 * @param {Array} choices - 지금까지의 선택들
 * @param {string} chatHistory - 대화 기록
 * @returns {string} 게임 진행 프롬프트
 */
const generateBalanceGamePrompt = (personaInfo, userChoice, round = 1, choices = [], chatHistory = '') => {
  const personaName = personaInfo.name || 'AI';
  
  let prompt = '';
  
  if (round <= 6) {
    // 게임 진행 중
    prompt = `
당신은 ${personaName}입니다. 밸런스 게임을 진행하고 있습니다.

게임 정보:
- 현재 라운드: ${round}/6
- 사용자 선택: "${userChoice}"

게임 규칙:
1. 사용자의 선택을 확인하고, 당신의 선택을 말해주세요
2. 그 다음 당신이 새로운 주제를 제시해주세요
3. 주제는 "A vs B" 형태로 제시하세요 (예시 : 10억 빛 차운우 vs 억만장자 유병재)

중요한 규칙:
- 반드시 2문장 이내로만 답변하세요
- 자신의 말투와 성격을 유지하세요
- 게임에 집중하고 불필요한 설명은 하지 마세요

[대화 기록]
${chatHistory}

사용자: ${userChoice}
${personaName}:`;
  } else {
    // 게임 종료 - 결과 확인
    prompt = `
당신은 ${personaName}입니다. 밸런스 게임이 끝났습니다.

게임 결과:
- 사용자 선택: ${choices.filter(c => c.type === 'user').map(c => c.choice).join(', ')}
- AI 선택: ${choices.filter(c => c.type === 'ai').map(c => c.choice).join(', ')}

게임 규칙:
1. 사용자와 AI의 선택을 비교해서 몇 개가 같은지 확인해주세요
2. 결과를 재미있게 말해주세요

중요한 규칙:
- 반드시 2문장 이내로만 답변하세요
- 자신의 말투와 성격을 유지하세요
- 게임에 집중하고 불필요한 설명은 하지 마세요

[대화 기록]
${chatHistory}

${personaName}:`;
  }
  
  return prompt;
};

/**
 * 스무고개 게임 진행 프롬프트 생성
 * @param {object} personaInfo - AI 캐릭터 정보
 * @param {string} userQuestion - 사용자 질문
 * @param {string} topic - 게임 주제
 * @param {number} questionCount - 질문 횟수
 * @param {string} chatHistory - 대화 기록
 * @returns {string} 게임 진행 프롬프트
 */
const generateTwentyQuestionsGamePrompt = (personaInfo, userQuestion, topic, questionCount = 1, chatHistory = '') => {
  const personaName = personaInfo.name || 'AI';
  
  return `
당신은 ${personaName}입니다. 스무고개 게임을 진행하고 있습니다.

게임 정보:
- 주제: ${topic}
- 현재 질문 횟수: ${questionCount}/20
- 사용자 질문: "${userQuestion}"

게임 규칙:
1. 사용자의 질문에 "네" 또는 "아니오"로만 답변하세요
2. 20번 안에 맞추면 사용자 승리, 못 맞추면 당신 승리입니다
3. 자신의 말투와 성격을 유지하세요

중요한 규칙:
- 반드시 2문장 이내로만 답변하세요
- "네" 또는 "아니오"로만 답변하세요
- 불필요한 설명은 하지 마세요

[대화 기록]
${chatHistory}

사용자: ${userQuestion}
${personaName}:`;
};

/**
 * 끝말잇기 게임 진행 프롬프트 생성
 * @param {object} personaInfo - AI 캐릭터 정보
 * @param {string} userWord - 사용자가 말한 단어
 * @param {Array} usedWords - 이미 사용된 단어들
 * @param {string} chatHistory - 대화 기록
 * @returns {string} 게임 진행 프롬프트
 */
const generateWordChainGamePrompt = (personaInfo, userWord, usedWords = [], chatHistory = '') => {
  const personaName = personaInfo.name || 'AI';
  const usedWordsList = usedWords.join(', ');
  
  return `
당신은 ${personaName}입니다. 끝말잇기 게임을 진행하고 있습니다.

게임 규칙:
1. 사용자가 말한 단어: "${userWord}"
2. 이 단어의 마지막 글자로 시작하는 새로운 단어를 답해주세요
3. 이미 사용된 단어: ${usedWordsList || '없음'}
4. 답할 수 없는 경우 "끝!"이라고 말해주세요

중요한 규칙:
- 반드시 2문장 이내로만 답변하세요
- 자신의 말투와 성격을 유지하세요
- 게임에 집중하고 불필요한 설명은 하지 마세요
- 사용자가 틀렸을 때는 격려해주고 다시 시도하라고 하세요

[대화 기록]
${chatHistory}

사용자: ${userWord}
${personaName}:`;
};

/**
 * 끝말잇기 게임 응답 생성
 * @param {object} personaInfo - AI 캐릭터 정보
 * @param {string} userMessage - 사용자 메시지
 * @param {Array} usedWords - 이미 사용된 단어들
 * @param {string} chatHistory - 대화 기록
 * @returns {Promise<string>} AI 응답
 */
const generateWordChainResponse = async (personaInfo, userMessage, usedWords = [], chatHistory = '') => {
  try {
    // 게임 시작인지 확인
    if (isWordChainGame(userMessage)) {
      const startPrompt = generateWordChainStartPrompt(personaInfo);
      const response = await gemini25.generateText(startPrompt.trim());
      return response;
    }
    
    // 게임 진행 중
    const gamePrompt = generateWordChainGamePrompt(personaInfo, userMessage, usedWords, chatHistory);
    const response = await gemini25.generateText(gamePrompt.trim());
    return response;
    
  } catch (error) {
    console.error('끝말잇기 게임 응답 생성 실패:', error);
    return `안녕하세요! 저는 ${personaInfo.name}입니다. 현재 게임 서버가 일시적으로 불안정해요. 잠시 후 다시 시도해주세요! 😊`;
  }
};

/**
 * 스무고개 게임 응답 생성
 * @param {object} personaInfo - AI 캐릭터 정보
 * @param {string} userMessage - 사용자 메시지
 * @param {string} topic - 게임 주제
 * @param {number} questionCount - 질문 횟수
 * @param {string} chatHistory - 대화 기록
 * @returns {Promise<string>} AI 응답
 */
const generateTwentyQuestionsResponse = async (personaInfo, userMessage, topic, questionCount = 1, chatHistory = '') => {
  try {
    // 게임 시작인지 확인
    if (isTwentyQuestionsGame(userMessage)) {
      const startPrompt = generateTwentyQuestionsStartPrompt(personaInfo);
      const response = await gemini25.generateText(startPrompt.trim());
      return response;
    }
    
    // 게임 진행 중
    const gamePrompt = generateTwentyQuestionsGamePrompt(personaInfo, userMessage, topic, questionCount, chatHistory);
    const response = await gemini25.generateText(gamePrompt.trim());
    return response;
    
  } catch (error) {
    console.error('스무고개 게임 응답 생성 실패:', error);
    return `안녕하세요! 저는 ${personaInfo.name}입니다. 현재 게임 서버가 일시적으로 불안정해요. 잠시 후 다시 시도해주세요! 😊`;
  }
};

/**
 * 밸런스 게임 응답 생성
 * @param {object} personaInfo - AI 캐릭터 정보
 * @param {string} userMessage - 사용자 메시지
 * @param {number} round - 현재 라운드
 * @param {Array} choices - 지금까지의 선택들
 * @param {string} chatHistory - 대화 기록
 * @returns {Promise<string>} AI 응답
 */
const generateBalanceGameResponse = async (personaInfo, userMessage, round = 1, choices = [], chatHistory = '') => {
  try {
    // 게임 시작인지 확인
    if (isBalanceGame(userMessage)) {
      const startPrompt = generateBalanceGameStartPrompt(personaInfo);
      const response = await gemini25.generateText(startPrompt.trim());
      return response;
    }
    
    // 게임 진행 중
    const gamePrompt = generateBalanceGamePrompt(personaInfo, userMessage, round, choices, chatHistory);
    const response = await gemini25.generateText(gamePrompt.trim());
    return response;
    
  } catch (error) {
    console.error('밸런스 게임 응답 생성 실패:', error);
    return `안녕하세요! 저는 ${personaInfo.name}입니다. 현재 게임 서버가 일시적으로 불안정해요. 잠시 후 다시 시도해주세요! 😊`;
  }
};

/**
 * 게임 모드 감지 (향후 다른 게임 추가 시 확장)
 * @param {string} userMessage - 사용자 메시지
 * @returns {string|null} 게임 모드 (wordchain, twentyquestions, balancegame) 또는 null
 */
const detectGameMode = (userMessage) => {
  const message = userMessage.toLowerCase().trim();
  
  if (message.includes('끝말잇기') || message.includes('끝말 잇기') || message.includes('[game:끝말잇기]')) {
    return 'wordchain';
  }
  
  if (message.includes('스무고개') || message.includes('20고개') || message.includes('[game:스무고개]')) {
    return 'twentyquestions';
  }
  
  if (message.includes('밸런스') || message.includes('밸런스게임') || message.includes('[game:밸런스게임]')) {
    return 'balancegame';
  }
  
  return null;
};

/**
 * 게임 응답 생성 (메인 함수)
 * @param {string} gameMode - 게임 모드
 * @param {object} personaInfo - AI 캐릭터 정보
 * @param {string} userMessage - 사용자 메시지
 * @param {Array} usedWords - 이미 사용된 단어들 (끝말잇기용)
 * @param {string} chatHistory - 대화 기록
 * @param {string} topic - 게임 주제 (스무고개용)
 * @param {number} questionCount - 질문 횟수 (스무고개용)
 * @param {number} round - 현재 라운드 (밸런스게임용)
 * @param {Array} choices - 지금까지의 선택들 (밸런스게임용)
 * @returns {Promise<string>} AI 응답
 */
const generateGameResponse = async (gameMode, personaInfo, userMessage, usedWords = [], chatHistory = '', topic = '', questionCount = 1, round = 1, choices = []) => {
  switch (gameMode) {
    case 'wordchain':
      return await generateWordChainResponse(personaInfo, userMessage, usedWords, chatHistory);
    case 'twentyquestions':
      return await generateTwentyQuestionsResponse(personaInfo, userMessage, topic, questionCount, chatHistory);
    case 'balancegame':
      return await generateBalanceGameResponse(personaInfo, userMessage, round, choices, chatHistory);
    default:
      return null;
  }
};

export {
  isWordChainGame,
  generateWordChainStartPrompt,
  generateWordChainGamePrompt,
  generateWordChainResponse,
  isTwentyQuestionsGame,
  generateTwentyQuestionsStartPrompt,
  generateTwentyQuestionsGamePrompt,
  generateTwentyQuestionsResponse,
  isBalanceGame,
  generateBalanceGameStartPrompt,
  generateBalanceGamePrompt,
  generateBalanceGameResponse,
  detectGameMode,
  generateGameResponse
}; 