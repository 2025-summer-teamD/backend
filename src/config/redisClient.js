// src/config/redisClient.js

import redis from 'redis';
import dotenv from 'dotenv';

dotenv.config(); // .env 파일의 환경 변수를 로드합니다.

// 1. Redis 클라이언트 생성
const redisClient = redis.createClient({
    // url: 'redis://<user>:<password>@<host>:<port>' // Docker나 원격 Redis 서버 사용 시
    // 로컬에서 기본 설정으로 실행 중인 Redis는 url을 명시할 필요가 없습니다.
    // 아래는 .env 파일을 사용하는 예시입니다.
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// 2. Redis 클라이언트 이벤트 리스너 설정
redisClient.on('connect', () => {
    console.log('✅ Connected to Redis');
});
redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
});

// 3. Redis v4부터는 명시적으로 연결을 해줘야 합니다.
// 애플리케이션 시작 시 한 번만 호출되도록 합니다.
(async () => {
    await redisClient.connect();
})();

// 4. 생성 및 연결된 클라이언트 객체를 다른 파일에서 사용할 수 있도록 export 합니다.
export default redisClient;