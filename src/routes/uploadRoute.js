import express from 'express';
import uploadController from '../controllers/uploadController.js';
import { upload } from '../middlewares/uploadMiddleware.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /upload/single:
 *   post:
 *     summary: 단일 이미지 업로드
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: 업로드할 이미지 파일
 *     responses:
 *       200:
 *         description: 이미지 업로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     filename:
 *                       type: string
 *                     originalName:
 *                       type: string
 *                     size:
 *                       type: number
 *                     url:
 *                       type: string
 *                     mimetype:
 *                       type: string
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.post('/single', upload.single('image'), uploadController.uploadSingleImage);

/**
 * @swagger
 * /upload/multiple:
 *   post:
 *     summary: 여러 이미지 업로드
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: 업로드할 이미지 파일들
 *     responses:
 *       200:
 *         description: 이미지들 업로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       filename:
 *                         type: string
 *                       originalName:
 *                         type: string
 *                       size:
 *                         type: number
 *                       url:
 *                         type: string
 *                       mimetype:
 *                         type: string
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.post('/multiple', upload.array('images', 10), uploadController.uploadMultipleImages);

/**
 * @swagger
 * /upload/{filename}:
 *   delete:
 *     summary: 이미지 삭제
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: 삭제할 이미지 파일명
 *     responses:
 *       200:
 *         description: 이미지 삭제 성공
 *       404:
 *         description: 이미지를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.delete('/:filename', authMiddleware, uploadController.deleteImage);

/**
 * @swagger
 * /uploads/{filename}:
 *   get:
 *     summary: 업로드된 이미지 조회
 *     tags: [Upload]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: 조회할 이미지 파일명
 *     responses:
 *       200:
 *         description: 이미지 파일
 *       404:
 *         description: 이미지를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/:filename', uploadController.serveImage);

export default router;
