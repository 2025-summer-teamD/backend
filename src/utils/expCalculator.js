/**
 * 경험치 및 레벨 계산 유틸리티
 */

/**
 * 이모지 감지 함수
 * @param {string} text - 검사할 텍스트
 * @returns {number} 이모지 개수
 */
export const countEmojis = (text) => {
  const emojiRegex = /\p{Emoji}/gu;  // ES2018+ 유니코드 이모지 프로퍼티 사용
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
};

/**
 * 게임 상태 확인 함수
 * @param {string} message - 사용자 메시지
 * @returns {boolean} 게임 중 여부
 */
export const isGameActive = (message) => {
  const gameKeywords = [
    '[GAME:끝말잇기]', '[GAME:스무고개]', '[GAME:밸런스게임]'
  ];

  return gameKeywords.some(keyword => message.includes(keyword));
};

/**
 * 채팅 EXP 계산 함수
 * 기본 1점 + 50자 이상이면 2점 + 100자 이상이면 3점 + 이모지 하나당 0.2점 + 게임 중이면 5점 추가
 */
export const calculateExp = (message) => {
  // 기본 1점
  let exp = 1;

  // 글자 수에 따른 추가 경험치
  if (message.length >= 100) {
    exp = 3;
  } else if (message.length >= 50) {
    exp = 2;
  }

  // 이모지 추가 경험치 (이모지 하나당 0.2점)
  const emojiCount = countEmojis(message);
  const emojiExp = emojiCount * 0.2;
  exp += emojiExp;

  // 게임 중이면 5점 추가
  if (isGameActive(message)) {
    exp += 5;
  }

  return Math.round(exp * 10) / 10; // 소수점 첫째자리까지 반올림
};

/**
 * 레벨 계산 함수 (30레벨 시스템)
 */
export const getLevel = (exp) => {
  // 30레벨 시스템: 첫 레벨업은 10exp, 그 다음부터는 10씩 증가
  // 공식: 레벨 = Math.floor((-1 + Math.sqrt(1 + 8 * exp / 10)) / 2) + 1
  if (exp < 10) return 1;
  const level = Math.floor((-1 + Math.sqrt(1 + 8 * exp / 10)) / 2) + 1;
  return Math.min(level, 30); // 최대 30레벨
}; 