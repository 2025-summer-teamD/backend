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
 *       404:
 *         description: 리소스를 찾을 수 없음 (Not Found)
 *       409:
 *         description: 충돌/중복 (Conflict)
 *       422:
 *         description: 유효성 검사 실패 (Unprocessable Entity)
 *       500:
 *         description: 서버 내부 에러 (Internal Server Error)
 *       503:
 *         description: 서비스 불가 (Service Unavailable)
 */
const express = require('express');
const router = express.Router();


const myCharacterList = require('./my/characters/myCharacterList'); // 실제 API 파일
router.use('/my/characters', myCharacterList); // /my/characters/list로 들어오는 요청 처리

const characterRouter = require('./communities/characters');
router.use('/communities/characters', characterRouter);

// 커뮤니티 캐릭터 상세 라우터 등록
const characterDetailRouter = require('./communities/characters');
router.use('/communities/characters', characterDetailRouter);

module.exports = router;
