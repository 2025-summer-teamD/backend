/**
 * @swagger
 * /my/chat-characters:
 *   get:
 *     summary: 대화한 캐릭터 목록 조회
 *     description: 현재 사용자가 대화한 적이 있는 캐릭터들의 목록을 조회합니다
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *           default: test_user_123
 *         description: 사용자 ID (테스트용)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: 한 페이지당 개수
 *     responses:
 *       200:
 *         description: 성공
 *       500:
 *         description: 서버 내부 오류
 */

const express = require('express');
const router = express.Router();
const { dbConnection } = require('../pgdb');

router.get('/chat-characters', async (req, res) => {
  try {
    const sql = 'SELECT * FROM board_post';
    const result = await dbConnection(sql);
    res.json({
      characters: result.rows,  // 실제 데이터
      page_info: {
        current_page: 1,
        total_pages: 1,
        total_elements: result.rowCount,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 내부 오류', error: err.message });
  }
});

module.exports = router;
//쿼리날려서 db에서 가져온다
///api-docs 