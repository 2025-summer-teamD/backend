import { v4 as uuidv4 } from 'uuid';
import { format } from 'util';
import uploadMiddleware from '../middlewares/uploadMiddleware.js';

const bucket = uploadMiddleware.bucket;

/**
 * GCS에 이미지 업로드하고 public URL 반환
 * @param {Object} file - multer에서 받은 파일 객체
 * @returns {Promise<string>} public URL
 */
export const uploadToGCS = async (file) => {
  if (!file) throw new Error('업로드할 파일이 없습니다.');

  const extension = file.originalname.split('.').pop();
  const gcsFileName = `${uuidv4()}.${extension}`;
  const blob = bucket.file(gcsFileName);

  const blobStream = blob.createWriteStream({
    resumable: false,
    metadata: {
      contentType: file.mimetype,
    },
  });

  return new Promise((resolve, reject) => {
    blobStream.on('error', (err) => {
      reject(err);
    });

    blobStream.on('finish', () => {
      const publicUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
};
