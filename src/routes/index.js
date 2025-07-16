/**
 * @swagger
 * /:
 *   get:
 *     summary: 기본 홈 라우트
 *     responses:
 *       200:
 *         description: 성공 (OK)
 *       201:
 *         description: 생성됨 (Created)
 *       204:
 *         description: 내용 없음 (No Content)
 *       400:
 *         description: 잘못된 요청 (Bad Request)
 *       401:
 *         description: 인증 필요/실패 (Unauthorized)
 *       403:
 *         description: 권한 없음 (Forbidden)
 */

const express = require('express');
const router = express.Router();
const charactersRoutes = require('./charactersRoutes');

router.use('/characters', charactersRoutes);

module.exports = router;