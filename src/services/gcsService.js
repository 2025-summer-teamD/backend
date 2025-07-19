// src/services/gcs.service.js
import { Storage } from '@google-cloud/storage';
import path from 'path';
import { fileURLToPath } from 'url';

// 서비스 계정 키 파일 경로 설정
// __dirname은 ES 모듈에서 사용할 수 없으므로 아래와 같이 경로를 만듭니다.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const keyFilePath = path.join(__dirname, '../../google-credentials/your-service-account-key.json');

// GCS 클라이언트 초기화
const storage = new Storage({
  keyFilename: keyFilePath,
  projectId: process.env.GOOGLE_PROJECT_ID,
});

const bucketName = process.env.GCS_BUCKET_NAME; // 버킷 이름도 환경변수로 관리
const bucket = storage.bucket(bucketName);

/**
 * 메모리에 있는 파일을 GCS에 업로드합니다.
 * @param {object} file - multer가 생성한 req.file 객체
 * @returns {Promise<string>} 업로드된 파일의 공개 URL
 */
export const uploadImageToGCS = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('업로드할 파일이 없습니다.'));
      return;
    }

    // 파일 이름을 유니크하게 만듭니다 (덮어쓰기 방지)
    const gcsFileName = `${Date.now()}-${file.originalname}`;
    const blob = bucket.file(gcsFileName);

    // GCS에 파일을 쓰는 스트림 생성
    const blobStream = blob.createWriteStream({
      resumable: false,
      gzip: true,
    });

    blobStream.on('error', (err) => {
      reject(err);
    });

    blobStream.on('finish', () => {
      // 업로드가 완료되면 공개 URL을 생성하여 반환
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(publicUrl);
    });

    // 파일 버퍼를 스트림에 씁니다.
    blobStream.end(file.buffer);
  });
};

