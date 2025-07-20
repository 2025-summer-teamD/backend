// src/middlewares/uploadMiddleware.js

import multer from 'multer';
import path from 'path';
import { uploadImageToGCS } from '../services/gcsService.js';

// 1. 메모리에 파일 저장
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

export { upload, uploadImageToGCS as uploadToGCS };