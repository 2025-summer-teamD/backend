const express = require('express');
const router = express.Router();

const characterDetails = require('./characterDetails');
const communityList = require('./communityList');

router.use('/', characterDetails);
router.use('/', communityList);

module.exports = router; 