/**
 * 공통 응답 처리 유틸리티
 * 
 * 사용 위치:
 * - 모든 컨트롤러에서 API 응답 생성 시
 * 
 * 기능:
 * - 성공 응답 표준화
 * - 에러 응답 표준화
 * - 일관된 응답 형식 제공
 * - HTTP 상태 코드 관리
 */

/**
 * 성공 응답 생성
 * @param {object} res - Express response 객체
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 200)
 * @param {string} message - 응답 메시지
 * @param {any} data - 응답 데이터
 * @param {object} pageInfo - 페이지네이션 정보 (선택사항)
 */
const sendSuccess = (res, statusCode = 200, message, data = null, pageInfo = null) => {
  const response = {
    success: true,
    message,
    ...(data && { data }),
    ...(pageInfo && { page_info: pageInfo })
  };

  return res.status(statusCode).json(response);
};

/**
 * 에러 응답 생성
 * @param {object} res - Express response 객체
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 500)
 * @param {string} message - 에러 메시지
 * @param {any} error - 에러 객체 (선택사항)
 */
const sendError = (res, statusCode = 500, message, error = null) => {
  const response = {
    success: false,
    message,
    ...(error && { error: error.message })
  };

  return res.status(statusCode).json(response);
};

/**
 * 404 Not Found 응답
 * @param {object} res - Express response 객체
 * @param {string} message - 에러 메시지 (기본값: "리소스를 찾을 수 없습니다.")
 */
const sendNotFound = (res, message = "리소스를 찾을 수 없습니다.") => {
  return sendError(res, 404, message);
};

/**
 * 400 Bad Request 응답
 * @param {object} res - Express response 객체
 * @param {string} message - 에러 메시지 (기본값: "잘못된 요청입니다.")
 */
const sendBadRequest = (res, message = "잘못된 요청입니다.") => {
  return sendError(res, 400, message);
};

/**
 * 401 Unauthorized 응답
 * @param {object} res - Express response 객체
 * @param {string} message - 에러 메시지 (기본값: "인증이 필요합니다.")
 */
const sendUnauthorized = (res, message = "인증이 필요합니다.") => {
  return sendError(res, 401, message);
};

/**
 * 403 Forbidden 응답
 * @param {object} res - Express response 객체
 * @param {string} message - 에러 메시지 (기본값: "접근 권한이 없습니다.")
 */
const sendForbidden = (res, message = "접근 권한이 없습니다.") => {
  return sendError(res, 403, message);
};

/**
 * 500 Internal Server Error 응답
 * @param {object} res - Express response 객체
 * @param {string} message - 에러 메시지 (기본값: "서버 내부 오류가 발생했습니다.")
 */
const sendInternalError = (res, message = "서버 내부 오류가 발생했습니다.") => {
  return sendError(res, 500, message);
};

export default {
  sendSuccess,
  sendError,
  sendNotFound,
  sendBadRequest,
  sendUnauthorized,
  sendForbidden,
  sendInternalError
}; 