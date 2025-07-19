import express from 'express';
import communitiRouter from './communitiRoutes.js';
import personaRouter from './personaRoute.js';
import userRouter from './userRoute.js';
import chatRouter from './chatRoutes.js';
import uploadRouter from './uploadRoute.js';

const router = express.Router();

// router.use('/chat', chatRouter);
router.use('/communities', communitiRouter);
router.use('/my', userRouter);
router.use('/characters', personaRouter);
router.use('/chat', chatRouter);
router.use('/upload', uploadRouter);

export default router;