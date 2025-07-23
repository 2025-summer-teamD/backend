// backend/src/controllers/uploadController.js

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '파일이 업로드되지 않았습니다.' });
    }
    // 업로드된 파일의 URL 생성 (정적 공개 경로)
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, imageUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: '업로드 실패', error: err.message });
  }
}; 