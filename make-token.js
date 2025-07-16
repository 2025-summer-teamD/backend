// 토큰 생성 코드

const jwt = require('jsonwebtoken');
const SECRET_KEY = 'your-secret-key'; // authMiddleware.js와 동일해야 함

const payload = { username: 'testuser' }; // 원하는 정보로 수정 가능
const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

console.log(token);