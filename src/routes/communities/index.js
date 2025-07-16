const express = require('express');
const router = express.Router();

const charactersRouter = require('./characters');
router.use('/characters', charactersRouter);

module.exports = router;