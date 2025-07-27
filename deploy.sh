#!/bin/bash

echo "🚀 프로덕션 환경 배포 시작..."

# 환경 변수 확인
if [ ! -f .env ]; then
    echo "❌ .env 파일이 없습니다. .env 파일을 생성해주세요."
    exit 1
fi

# Docker 이미지 빌드
echo "📦 Docker 이미지 빌드 중..."
docker build -t ${DOCKER_HUB_USERNAME}/your-repo-name:latest .

# 기존 컨테이너 정리
echo "🧹 기존 컨테이너 정리 중..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.monitoring.yml down

# 프로덕션 환경 시작
echo "🌐 프로덕션 환경 시작 중..."
docker-compose -f docker-compose.prod.yml up -d

# 모니터링 환경 시작
echo "📊 모니터링 환경 시작 중..."
docker-compose -f docker-compose.monitoring.yml up -d

# 서비스 상태 확인
echo "⏳ 서비스 시작 대기 중..."
sleep 30

echo ""
echo "✅ 배포가 완료되었습니다!"
echo "=========================================="
echo "🌐 서비스 URL:"
echo "📱 API 서버: https://api.${DOMAIN}"
echo "🔒 Traefik 대시보드: http://localhost:8080"
echo ""
echo "📊 모니터링 URL:"
echo "📈 Grafana: https://grafana.localhost"
echo "🔍 Prometheus: https://prometheus.localhost"
echo "📋 Kibana: https://kibana.localhost"
echo "🔎 Jaeger: https://jaeger.localhost"
echo ""
echo "🐳 로컬 접속:"
echo "📊 Grafana: http://localhost:3000 (admin/admin123)"
echo "🔍 Prometheus: http://localhost:9090"
echo "📋 Kibana: http://localhost:5601"
echo "🔎 Jaeger: http://localhost:16686"
echo "=========================================="
echo ""
echo "📝 로그 확인:"
echo "  프로덕션: docker-compose -f docker-compose.prod.yml logs -f"
echo "  모니터링: docker-compose -f docker-compose.monitoring.yml logs -f"
echo ""
echo "🛑 서비스 중지:"
echo "  ./scripts/stop.sh" 