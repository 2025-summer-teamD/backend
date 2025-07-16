const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const characterController = require('../controllers/characterController');

router.post('/existing', authMiddleware, characterController.createCharacter);

module.exports = router; 