/**
 * 메인 라우터
 * 
 * 모든 API 라우트를 중앙에서 관리하고 연결합니다.
 */

import express from 'express';
import personaRoute from './personaRoute.js';
import chatRoutes from './chatRoutes.js';
import uploadRoute from './uploadRoute.js';
import userRoute from './userRoute.js';
import communitiRoutes from './communitiRoutes.js';

const router = express.Router();

// 페르소나 관련 라우트
router.use('/personas', personaRoute);
router.use('/characters', personaRoute);

// 채팅 관련 라우트
router.use('/chat', chatRoutes);

// 파일 업로드 관련 라우트
router.use('/uploads', uploadRoute);

// 사용자 관련 라우트
router.use('/users', userRoute);
router.use('/my', userRoute);

// 커뮤니티 관련 라우트
router.use('/communities', communitiRoutes);

export default router;