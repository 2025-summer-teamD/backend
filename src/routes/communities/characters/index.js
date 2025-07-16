const express = require('express');
const router = express.Router();

const characterDetails = require('./characterDetails');
const communityList = require('./communityList');


router.use('/', communityList);
router.use('/', characterDetails);

module.exports = router;