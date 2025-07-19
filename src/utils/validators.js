/**
 * 공통 검증 유틸리티
 * 
 * 사용 위치:
 * - 모든 미들웨어에서 데이터 검증 시
 * - 컨트롤러에서 입력 데이터 검증 시
 * 
 * 기능:
 * - 데이터 타입 검증
 * - 필수 필드 검증
 * - 문자열 길이 검증
 * - 이메일 형식 검증
 * - 숫자 범위 검증
 */

/**
 * 필수 필드 검증
 * @param {object} data - 검증할 데이터 객체
 * @param {string[]} requiredFields - 필수 필드 배열
 * @returns {object} 검증 결과 { isValid: boolean, missingFields: string[] }
 */
export const validateRequiredFields = (data, requiredFields) => {
  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
};

/**
 * 문자열 길이 검증
 * @param {string} value - 검증할 문자열
 * @param {number} minLength - 최소 길이
 * @param {number} maxLength - 최대 길이
 * @returns {boolean} 검증 결과
 */
export const validateStringLength = (value, minLength = 1, maxLength = 1000) => {
  if (typeof value !== 'string') return false;
  return value.length >= minLength && value.length <= maxLength;
};

/**
 * 이메일 형식 검증
 * @param {string} email - 검증할 이메일
 * @returns {boolean} 검증 결과
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 숫자 범위 검증
 * @param {number} value - 검증할 숫자
 * @param {number} min - 최소값
 * @param {number} max - 최대값
 * @returns {boolean} 검증 결과
 */
export const validateNumberRange = (value, min, max) => {
  const num = Number(value);
  return !isNaN(num) && num >= min && num <= max;
};

/**
 * 파일 타입 검증
 * @param {string} filename - 파일명
 * @param {string[]} allowedExtensions - 허용된 확장자 배열
 * @returns {boolean} 검증 결과
 */
export const validateFileType = (filename, allowedExtensions = ['jpg', 'jpeg', 'png', 'gif']) => {
  if (!filename) return false;
  const extension = filename.split('.').pop().toLowerCase();
  return allowedExtensions.includes(extension);
};

/**
 * 파일 크기 검증 (MB 단위)
 * @param {number} fileSize - 파일 크기 (bytes)
 * @param {number} maxSizeMB - 최대 크기 (MB)
 * @returns {boolean} 검증 결과
 */
export const validateFileSize = (fileSize, maxSizeMB = 5) => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return fileSize <= maxSizeBytes;
};

/**
 * UUID 형식 검증
 * @param {string} uuid - 검증할 UUID
 * @returns {boolean} 검증 결과
 */
export const validateUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * 날짜 형식 검증 (ISO 8601)
 * @param {string} date - 검증할 날짜 문자열
 * @returns {boolean} 검증 결과
 */
export const validateDate = (date) => {
  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj);
};

/**
 * URL 형식 검증
 * @param {string} url - 검증할 URL
 * @returns {boolean} 검증 결과
 */
export const validateURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * 복합 검증 함수
 * @param {object} data - 검증할 데이터
 * @param {object} rules - 검증 규칙 객체
 * @returns {object} 검증 결과 { isValid: boolean, errors: object }
 */
export const validateData = (data, rules) => {
  const errors = {};

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field];

    // 필수 필드 검증
    if (fieldRules.required && (value === undefined || value === null || value === '')) {
      errors[field] = `${field}는 필수 필드입니다.`;
      continue;
    }

    // 값이 있으면 추가 검증
    if (value !== undefined && value !== null && value !== '') {
      // 문자열 길이 검증
      if (fieldRules.minLength && !validateStringLength(value, fieldRules.minLength, fieldRules.maxLength)) {
        errors[field] = `${field}는 ${fieldRules.minLength}자 이상 ${fieldRules.maxLength || 1000}자 이하여야 합니다.`;
      }

      // 이메일 검증
      if (fieldRules.email && !validateEmail(value)) {
        errors[field] = `${field}는 유효한 이메일 형식이어야 합니다.`;
      }

      // 숫자 범위 검증
      if (fieldRules.numberRange && !validateNumberRange(value, fieldRules.numberRange.min, fieldRules.numberRange.max)) {
        errors[field] = `${field}는 ${fieldRules.numberRange.min} 이상 ${fieldRules.numberRange.max} 이하여야 합니다.`;
      }

      // URL 검증
      if (fieldRules.url && !validateURL(value)) {
        errors[field] = `${field}는 유효한 URL 형식이어야 합니다.`;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}; 