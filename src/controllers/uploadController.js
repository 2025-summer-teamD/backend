// backend/src/controllers/uploadController.js

import { uploadImageToGCS } from '../services/gcsService.js';

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '파일이 업로드되지 않았습니다.' });
    }

    // 메모리 저장소이므로 req.file.buffer 가 존재
    const gcsUrl = await uploadImageToGCS(req.file);

    res.json({ success: true, imageUrl: gcsUrl });
  } catch (err) {
    console.error('이미지 업로드 실패:', err);
    res.status(500).json({ success: false, message: '업로드 실패', error: err.message });
  }
}; 