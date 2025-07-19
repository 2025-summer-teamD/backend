import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 단일 이미지 업로드
 */
export const uploadSingleImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        message: '이미지 파일을 업로드해주세요.' 
      });
    }

    // 업로드된 파일 정보
    const uploadedFile = req.file;
    
    // 파일 URL 생성 (프론트엔드에서 접근 가능한 경로)
    const fileUrl = `/api/uploads/${uploadedFile.filename}`;

    res.status(200).json({
      message: '이미지가 성공적으로 업로드되었습니다.',
      data: {
        filename: uploadedFile.filename,
        originalName: uploadedFile.originalname,
        size: uploadedFile.size,
        url: fileUrl,
        mimetype: uploadedFile.mimetype
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
      return res.status(400).json({ 
        message: '이미지 파일을 업로드해주세요.' 
      });
    }

    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      url: `/api/uploads/${file.filename}`,
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
    const uploadDir = path.join(__dirname, '../../uploads');
    const filePath = path.join(uploadDir, filename);

    // 파일 존재 여부 확인
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        message: '해당 이미지를 찾을 수 없습니다.' 
      });
    }

    // 파일 삭제
    fs.unlinkSync(filePath);

    res.status(200).json({
      message: '이미지가 성공적으로 삭제되었습니다.',
      data: { filename }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 업로드된 이미지 서빙
 */
export const serveImage = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const uploadDir = path.join(__dirname, '../../uploads');
    const filePath = path.join(uploadDir, filename);

    // 파일 존재 여부 확인
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        message: '이미지를 찾을 수 없습니다.' 
      });
    }

    // 이미지 파일 전송
    res.sendFile(filePath);
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