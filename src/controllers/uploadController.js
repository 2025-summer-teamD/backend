import { uploadToGCS } from '../middlewares/uploadMiddleware.js';
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';

dotenv.config();

// GCS 클라이언트 초기화
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

/**
 * 단일 이미지 업로드
 */
export const uploadSingleImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '이미지 파일을 업로드해주세요.' });
    }

    const publicUrl = await uploadToGCS(req.file);

    res.status(200).json({
      message: '이미지가 성공적으로 업로드되었습니다.',
      data: {
        filename: req.file.originalname,
        originalName: req.file.originalname,
        size: req.file.size,
        url: publicUrl,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 여러 이미지 업로드
 */
export const uploadMultipleImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: '이미지 파일을 업로드해주세요.' });
    }

    const uploadPromises = req.files.map(file => uploadToGCS(file));
    const publicUrls = await Promise.all(uploadPromises);

    const uploadedFiles = req.files.map((file, index) => ({
      filename: file.originalname,
      originalName: file.originalname,
      size: file.size,
      url: publicUrls[index],
      mimetype: file.mimetype
    }));

    res.status(200).json({
      message: `${uploadedFiles.length}개의 이미지가 성공적으로 업로드되었습니다.`,
      data: uploadedFiles
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 이미지 삭제
 */
export const deleteImage = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);

    const file = bucket.file(decodedFilename);
    const [exists] = await file.exists();

    console.log(`[삭제요청] filename: ${decodedFilename}, exists: ${exists}`);

    if (!exists) {
      return res.status(404).json({ message: '해당 이미지를 찾을 수 없습니다.' });
    }

    await file.delete();

    res.status(200).json({
      message: '이미지가 성공적으로 삭제되었습니다.',
      data: { filename: decodedFilename }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 업로드된 이미지 서빙 (GCS에서 직접 스트리밍)
 */
export const serveImage = async (req, res, next) => {
  try {

    const encodedFilename = req.params.filename;
    const decodedFilename = decodeURIComponent(encodedFilename);
    const file = bucket.file(decodedFilename);

    const [exists] = await file.exists();
    console.log(`[이미지요청] filename: ${decodedFilename}, exists: ${exists}`);

    if (!exists) {
      return res.status(404).json({ message: '이미지를 찾을 수 없습니다.' });
    }

    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);

    file.createReadStream()
      .on('error', (err) => {
        console.error('Stream error:', err);
        res.status(500).send('이미지를 불러오는 중 오류 발생');
      })
      .pipe(res);
  } catch (error) {
    next(error);
  }
};

const uploadController = {
  uploadSingleImage,
  uploadMultipleImages,
  deleteImage,
  serveImage
};

export default uploadController;
