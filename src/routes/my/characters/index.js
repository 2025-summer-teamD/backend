const express = require('express');
const router = express.Router();


const myCharacterDetails = require('./myCharacterDetails');
const myCharacterList = require('./myCharacterList');

router.use('/', myCharacterDetails);    
router.use('/', myCharacterList);

module.exports = router; 

