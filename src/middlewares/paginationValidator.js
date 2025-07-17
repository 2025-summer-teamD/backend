// 페이지네이션 쿼리를 검증하고 기본값을 설정하는 미들웨어
export const validatePagination = (req, res, next) => {
    // 쿼리 파라미터는 문자열이므로 숫자로 변환
    let page = parseInt(req.query.page, 10);
    let size = parseInt(req.query.size, 10);
  
    // page가 유효하지 않은 값이거나 없으면 1로 설정
    if (isNaN(page) || page < 1) {
      page = 1;
    }
  
    // size가 유효하지 않은 값이거나 없으면 10으로 설정 (최대값 제한도 가능)
    if (isNaN(size) || size < 1) {
      size = 10;
    }
    if (size > 100) { // 한 번에 너무 많은 데이터를 요청하지 못하도록 제한
      size = 100;
    }
  
    // 검증된 값을 req 객체에 다시 넣어 컨트롤러에서 쉽게 사용하도록 함
    req.pagination = {
      skip: (page - 1) * size, // DB에서 건너뛸 개수 (OFFSET)
      take: size,              // 가져올 개수 (LIMIT)
      page,
      size,
    };
  
    next();
};