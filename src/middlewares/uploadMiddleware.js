// src/middlewares/uploadMiddleware.js
import multer from 'multer';
import path from 'path';
import { Storage } from '@google-cloud/storage';

// 환경에 따른 설정 분리
const isDevelopment = process.env.NODE_ENV === 'development';

const requiredEnvVars = ['GOOGLE_CLOUD_PROJECT', 'GCS_BUCKET_NAME'];
if (isDevelopment) {
  requiredEnvVars.push('GOOGLE_APPLICATION_CREDENTIALS');
}

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});

// ✅ GCS 클라이언트 초기화
const storageConfig = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
};
if (isDevelopment) {
  storageConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const storage = new Storage(storageConfig);

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

// ✅ 메모리에 파일 저장
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다. (jpeg, jpg, png, gif, webp)'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB 제한
  },
});


const uploadMiddleware = {
  requiredEnvVars,
  bucket,
  storage,
  upload
};
export default uploadMiddleware;