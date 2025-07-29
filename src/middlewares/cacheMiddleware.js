/**
 * 통합 캐시 미들웨어
 * 
 * 기능:
 * - 사용자 캐릭터 목록 캐시
 * - 통합 캐시 서비스 활용
 */

import { UserDataCache } from '../services/cacheService.js';
import responseHandler from '../utils/responseHandler.js';
import logger from '../utils/logger.js';

/**
 * 사용자 캐릭터 목록 조회를 위한 캐시 미들웨어
 */
export async function cacheMyCharacters(req, res, next) {
    const userId = req.auth?.userId;
    const { type, _t } = req.query;

    // 사용자 ID나 type이 없으면 캐싱을 건너뜁니다.
    if (!userId || !type) {
        return next();
    }

    // 타임스탬프가 있으면 캐시를 우회합니다 (강제 새로고침)
    if (_t) {
        logger.logInfo('강제 새로고침 감지', { userId, type, timestamp: _t });
        return next();
    }

    try {
        // 통합 캐시 서비스 사용
        const cachedData = await UserDataCache.getUserCharacters(userId, type);

        if (cachedData) {
            // 캐시 히트: 바로 응답
            return responseHandler.sendSuccess(res, 200, '캐시된 데이터 조회 성공', cachedData);
        } else {
            // 캐시 미스: 컨트롤러로 진행하고 응답 캐시 저장을 위해 플래그 설정
            req.shouldCache = true;
            req.cacheInfo = { userId, type };
            next();
        }
    } catch (error) {
        logger.logError('캐시 미들웨어 오류', error, { userId, type });
        // Redis 문제 시에도 서비스 계속
        next();
    }
}

/**
 * 응답 후 캐시 저장 미들웨어
 * (컨트롤러 응답 후에 호출되어야 함)
 */
export function cacheResponse(req, res, next) {
    if (!req.shouldCache || !req.cacheInfo) {
        return next();
    }

    // 원본 json 메소드 저장
    const originalJson = res.json;
    
    // json 메소드 오버라이드
    res.json = function(data) {
        // 응답 성공 시에만 캐시 저장
        if (res.statusCode === 200 && data && data.success) {
            // 비동기로 캐시 저장 (응답 속도에 영향 없음)
            UserDataCache.setUserCharacters(
                req.cacheInfo.userId,
                req.cacheInfo.type,
                data,
                600 // 10분 TTL
            ).catch(error => {
                logger.logError('응답 캐시 저장 실패', error, req.cacheInfo);
            });
        }
        
        // 원본 응답 실행
        return originalJson.call(this, data);
    };
    
    next();
}