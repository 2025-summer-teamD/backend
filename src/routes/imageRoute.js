import express from 'express';
import { Storage } from '@google-cloud/storage';

const router = express.Router();
const storage = new Storage();
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

router.get('/image/:filename', async (req, res) => {
  const { filename } = req.params;
  try {
    const file = bucket.file(filename);
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).send('이미지를 찾을 수 없습니다.');
    }
    const [metadata] = await file.getMetadata();
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    file.createReadStream().pipe(res);
  } catch (err) {
    res.status(500).send('이미지 로딩 실패');
  }
});

export default router; 