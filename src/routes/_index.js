/**
 * 메인 라우터
 * 
 * 모든 API 라우트를 중앙에서 관리하고 연결합니다.
 */

import express from 'express';
import personaRoute from './personaRoute.js';
import chatRoutes from './chatRoutes.js';
import userRoute from './userRoute.js';
import communitiRoutes from './communitiRoutes.js';
import imageRoute from './imageRoute.js';

const router = express.Router();


// 페르소나 관련 라우트
router.use('/personas', personaRoute);
router.use('/characters', personaRoute);

// 채팅 관련 라우트
router.use('/chat', chatRoutes);

// 사용자 관련 라우트
router.use('/users', userRoute);
router.use('/my', userRoute);

// 커뮤니티 관련 라우트
router.use('/communities', communitiRoutes);
router.use('/', imageRoute);

export default router;
