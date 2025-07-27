// /middleware/cacheMiddleware.js (파일을 분리하거나 기존 파일에 추가)
import redisClient from '../config/redisClient.js'; // Redis 클라이언트 가져오기 (경로는 실제 프로젝트에 맞게 수정)

/**
 * 내 캐릭터 목록 조회를 위한 캐시 미들웨어
 */
export async function cacheMyCharacters(req, res, next) {
    // 1. 인증 미들웨어(clerkAuthMiddleware)가 설정해준 사용자 ID를 가져옵니다.
    const userId = req.auth?.userId;
    // 2. 쿼리 파라미터를 가져옵니다.
    const { type, _t } = req.query;

    // 사용자 ID나 type이 없으면 캐싱을 건너뜁니다.
    if (!userId || !type) {
        return next();
    }

    // 타임스탬프가 있으면 캐시를 우회합니다 (강제 새로고침)
    if (_t) {
        console.log(`🔄 강제 새로고침 감지: 타임스탬프 ${_t}`);
        return next();
    }

    // 3. 고유한 캐시 키를 생성합니다. (예: "user:클럭ID:characters:liked")
    const cacheKey = `user:${userId}:characters:${type}`;

    try {
        const cachedData = await redisClient.get(cacheKey);

        if (cachedData) {
            // 4. 캐시 히트: Redis에 데이터가 있으면 파싱해서 바로 응답합니다.
            console.log(`✅ Cache HIT for key: ${cacheKey}`);
            return res.status(200).json(JSON.parse(cachedData));
        } else {
            // 5. 캐시 미스: 데이터가 없으면 다음 핸들러(컨트롤러)로 넘어갑니다.
            console.log(`❌ Cache MISS for key: ${cacheKey}`);
            next();
        }
    } catch (error) {
        console.error('Redis Error:', error);
        // Redis에 문제가 생겨도 서비스는 계속되어야 하므로 그냥 넘어갑니다.
        next();
    }
}