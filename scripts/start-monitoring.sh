#!/bin/bash

# Docker 데몬 확인
if ! docker info > /dev/null 2>&1; then
  echo "[ERROR] Docker 데몬이 실행 중이 아닙니다. Docker Desktop을 먼저 실행하세요."
  exit 1
fi

echo "[INFO] 모니터링 포함 docker compose build 시작..."
docker compose -f docker-compose.dev.yml -f docker-compose.monitoring.yml build
if [ $? -ne 0 ]; then
  echo "[ERROR] 빌드 실패!"
  exit 1
fi

echo "[INFO] 모니터링 포함 docker compose up 백그라운드 실행..."
nohup docker compose -f docker-compose.dev.yml -f docker-compose.monitoring.yml up --build > docker-monitoring.log 2>&1 &

echo $! > docker-monitoring.pid

sleep 5

echo ""
echo "✅ 모니터링 포함 서버가 백그라운드에서 실행 중입니다."
echo "----------------------------------------"
echo "🌐 서비스 URL:"
echo "📱 앱: http://localhost:3001"
echo "📊 Grafana: http://localhost:3000 (admin/admin123)"
echo "🔍 Prometheus: http://localhost:9090" 
echo "📈 Kibana: http://localhost:5601"
echo "🐳 cAdvisor: http://localhost:8080"
echo "----------------------------------------"
echo "🔍 실시간 로그 보기: tail -f docker-monitoring.log"
echo "📝 서비스별 로그: docker compose -f docker-compose.dev.yml -f docker-compose.monitoring.yml logs [서비스명]"
echo "🛑 서버 중지: sh stop.sh"
echo "----------------------------------------" 