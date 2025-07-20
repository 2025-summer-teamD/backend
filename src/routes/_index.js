import express from 'express';
import communitiRouter from './communitiRoutes.js';
import personaRouter from './personaRoute.js';
import userRouter from './userRoute.js';
import chatRouter from './chatRoutes.js';
import uploadRouter from './uploadRoute.js';

const router = express.Router();

router.use('/communities', communitiRouter);
router.use('/my', userRouter);
router.use('/characters', personaRouter);
router.use('/chat', chatRouter);

// upload routes (단수·복수 모두 지원)
router.use('/upload', uploadRouter);
router.use('/uploads', uploadRouter);   // ← 추가된 라우트

export default router;
