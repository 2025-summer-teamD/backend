import multer from 'multer';

// 파일을 디스크가 아닌 메모리에 저장합니다.
// GCS로 바로 스트리밍할 것이므로 서버에 임시 파일을 만들 필요가 없습니다.
const memoryStorage = multer.memoryStorage();

// Multer 설정
export const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 파일 사이즈 제한: 5MB
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용 (MIME 타입 체크)
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
    }
  },
});
