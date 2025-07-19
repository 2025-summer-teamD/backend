import app from './app.js';
import createUploadDirectory from './utils/createUploadDir.js';
import createDefaultImage from './utils/createDefaultImage.js';

const PORT = process.env.PORT || 3001;

// 서버 시작 시 업로드 디렉토리와 기본 이미지 생성
createUploadDirectory();
createDefaultImage();

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});