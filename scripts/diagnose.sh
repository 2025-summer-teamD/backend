#!/bin/bash

echo "🔍 배포 상태 진단 시작..."
echo "========================================"

# 1. Docker 컨테이너 상태 확인
echo "📦 Docker 컨테이너 상태:"
docker ps --filter "name=express_app" --filter "name=traefik" --filter "name=redis_server"
echo ""

# 2. 컨테이너 로그 확인 (최근 20줄)
echo "📝 Express App 로그 (최근 20줄):"
docker logs express_app --tail 20
echo ""

echo "📝 Traefik 로그 (최근 10줄):"
docker logs traefik --tail 10
echo ""

# 3. 네트워크 연결 확인
echo "🌐 네트워크 연결 상태:"
echo "- 로컬 3001 포트 확인:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ || echo "연결 실패"
echo ""

echo "- 80 포트 (Traefik) 확인:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/ || echo "연결 실패"
echo ""

# 4. 포트 사용 상태 확인
echo "🔌 포트 사용 상태:"
netstat -tlnp | grep -E ":80|:443|:3001|:8080" 2>/dev/null || ss -tlnp | grep -E ":80|:443|:3001|:8080"
echo ""

# 5. 환경 변수 확인 (민감한 정보 제외)
echo "🔧 환경 변수 확인:"
echo "NODE_ENV: $(docker exec express_app printenv NODE_ENV 2>/dev/null || echo '설정되지 않음')"
echo "PORT: $(docker exec express_app printenv PORT 2>/dev/null || echo '설정되지 않음')"
echo "DOMAIN: $(printenv DOMAIN || echo '설정되지 않음')"
echo ""

# 6. Traefik 라우터 상태 확인
echo "🚦 Traefik 라우터 상태:"
curl -s http://localhost:8080/api/http/routers | grep -o '"name":"[^"]*"' | head -5 2>/dev/null || echo "Traefik API 접근 실패"
echo ""

# 7. DNS 및 도메인 확인
echo "🌍 도메인 연결 확인:"
if [ ! -z "$DOMAIN" ]; then
    echo "api.$DOMAIN 연결 테스트:"
    curl -s -o /dev/null -w "%{http_code}" http://api.$DOMAIN/ 2>/dev/null || echo "연결 실패"
    echo ""
    
    echo "HTTPS 연결 테스트:"
    curl -s -o /dev/null -w "%{http_code}" https://api.$DOMAIN/ 2>/dev/null || echo "HTTPS 연결 실패"
else
    echo "DOMAIN 환경 변수가 설정되지 않음"
fi
echo ""

# 8. 추천 해결책
echo "💡 문제 해결 방법:"
echo "1. 컨테이너가 실행 중이지 않다면:"
echo "   docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "2. 앱 로그 실시간 확인:"
echo "   docker logs express_app -f"
echo ""
echo "3. 전체 서비스 재시작:"
echo "   docker-compose -f docker-compose.prod.yml restart"
echo ""
echo "4. Traefik 대시보드 확인:"
echo "   http://localhost:8080/dashboard/"
echo ""
echo "5. 직접 앱 접속 테스트 (Traefik 우회):"
echo "   curl http://localhost:3001/"
echo ""

echo "========================================"
echo "✅ 진단 완료" 