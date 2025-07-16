const express = require('express');
const router = express.Router();

const myCharacterDetails = require('./myCharacterDetails');

router.use('/', myCharacterDetails);    

module.exports = router;