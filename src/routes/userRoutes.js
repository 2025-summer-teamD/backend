import { Router } from 'express';
import { getUserProfile } from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// /api/users/profile 경로에 대한 GET 요청을 처리합니다.
// 요청이 오면, 먼저 requireAuth 미들웨어를 실행하여 인증 여부를 확인합니다.
// 인증이 성공하면, getUserProfile 컨트롤러 함수가 실행됩니다.
router.get('/profile', requireAuth, getUserProfile);

export default router;