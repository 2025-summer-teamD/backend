// src/middlewares/uploadMiddleware.js

import multer from 'multer';
import path from 'path';
import { uploadImageToGCS } from '../services/gcsService.js';
import { Storage } from '@google-cloud/storage';

// ✅ 환경 변수 유효성 검사
const requiredEnvVars = [
  'GOOGLE_CLOUD_PROJECT',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GCS_BUCKET_NAME',
];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});

// ✅ GCS 클라이언트 초기화
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

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

export { upload, uploadImageToGCS as uploadToGCS, bucket };

// ✅ default export 추가
export default {
  upload,
  uploadToGCS: uploadImageToGCS,
  bucket,
};
