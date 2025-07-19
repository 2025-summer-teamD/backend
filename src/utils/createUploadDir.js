import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 업로드 디렉토리가 없으면 생성하는 함수
 */
export const createUploadDirectory = () => {
  const uploadDir = path.join(__dirname, '../../uploads');
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('📁 업로드 디렉토리가 생성되었습니다:', uploadDir);
  }
};

export default createUploadDirectory; 