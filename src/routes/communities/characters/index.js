const express = require('express');
const router = express.Router();
const characterDetailRouter = require('./characterDetails');
router.use('/', characterDetailRouter);
module.exports = router;