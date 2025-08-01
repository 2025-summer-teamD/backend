// src/services/gcsService.js

import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';

// 환경에 따른 설정 분리
const isDevelopment = process.env.NODE_ENV === 'development';

// ✅ 환경변수 유효성 검사
// 공통 필수 환경 변수
const requiredEnvVars = [
  'GOOGLE_CLOUD_PROJECT',
  'GCS_BUCKET_NAME',
];

// 개발 환경에서만 GOOGLE_APPLICATION_CREDENTIALS 필수
if (isDevelopment) {
  requiredEnvVars.push('GOOGLE_APPLICATION_CREDENTIALS');
}

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});

const gcsConfig = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
};

// 개발 환경에서만 keyFilename 설정 (배포 환경에서는 ADC 사용)
if (isDevelopment) {
  gcsConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

// ✅ GCS 클라이언트 초기화
const storage = new Storage(gcsConfig);

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

/**
 * 메모리에 있는 파일을 GCS에 업로드합니다.
 * @param {object} file - multer가 생성한 req.file 객체
 * @returns {Promise<string>} 업로드된 파일의 공개 URL
 */
export const uploadImageToGCS = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('업로드할 파일이 없습니다.'));
    }

    // ✅ 충돌 방지를 위한 보안 랜덤값 포함 파일 이름 생성
    const timestamp = Date.now();
    const random = crypto.randomBytes(6).toString('hex'); // 12자리 hex (보안 안전)
    const gcsFileName = `${timestamp}-${random}-${file.originalname}`;

    const blob = bucket.file(gcsFileName);

    const blobStream = blob.createWriteStream({
      resumable: false,
      gzip: true,
      metadata: {
        contentType: file.mimetype,
      },
    });

    blobStream.on('error', (err) => {
      reject(err);
    });

    blobStream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
};

export { bucket };
