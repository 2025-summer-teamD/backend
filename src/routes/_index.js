import express from 'express';
// import chatRouter from './chat.js';
import communitiRouter from './communitiRoutes.js';
import personaRouter from './personaRoute.js';
import userRouter from './userRoute.js';
import chatRouter from './chatRoutes.js';

const router = express.Router();

// router.use('/chat', chatRouter);
router.use('/communities', communitiRouter);
router.use('/my', userRouter);
router.use('/characters', personaRouter);
router.use('/chat', chatRouter);

export default router;