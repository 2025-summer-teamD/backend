const express = require('express');
const router = express.Router();

const myCharacterList = require('./myCharacterList');
const myCharacterDetails = require('./myCharacterDetails');

router.use('/', myCharacterList);
router.use('/', myCharacterDetails);

module.exports = router; 