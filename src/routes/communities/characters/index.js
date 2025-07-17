const express = require('express');
const router = express.Router();


// const communityList = require('./communityList');
const characterDetails = require('./characterDetails');



// router.use('/', communityList);
router.use('/', characterDetails);

module.exports = router;