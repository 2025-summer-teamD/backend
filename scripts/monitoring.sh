#!/bin/bash

#================================================
# 모니터링 스택 실행 스크립트
#================================================
# 실행 명령어:
#   Linux/Mac: ./monitoring.sh
#   또는:      sh monitoring.sh  
#   또는:      docker compose -f docker-compose.monitoring.yml up -d
#
# 포함 서비스: traefik, jaeger, prometheus, grafana, kibana, elasticsearch 등
# 전제 조건: 기본 앱이 먼저 실행되어 있어야 함 (./start.sh)
#
# 접속 URL:
#   - Jaeger: http://localhost:16686
#   - Grafana: http://localhost:3000 (admin/admin123)
#   - Kibana: http://localhost:5601
#   - Prometheus: http://localhost:9090
#================================================

# Docker 데몬 확인
if ! docker info > /dev/null 2>&1; then
  echo "[ERROR] Docker 데몬이 실행 중이 아닙니다. Docker Desktop을 먼저 실행하세요."
  exit 1
fi

echo "[INFO] 네트워크 생성..."
docker network create app-network 2>/dev/null || echo "[INFO] 네트워크가 이미 존재합니다."

echo "[INFO] 모니터링 스택 시작..."
docker compose -f docker-compose.monitoring.yml up -d

sleep 5

echo ""
echo "✅ 모니터링 스택이 실행 중입니다."
echo "----------------------------------------"
echo "🌐 모니터링 대시보드:"
echo "📊 Jaeger (트레이싱): http://localhost:16686"
echo "🎛️ Traefik 대시보드: http://localhost:8080"
echo "📈 Grafana (메트릭): http://localhost:3000 (admin/admin123)"
echo "🔍 Kibana (로그): http://localhost:5601"
echo "📊 Prometheus: http://localhost:9090"
echo "----------------------------------------"
echo "💡 이제 백엔드를 트레이싱 모드로 시작하세요:"
echo "   ENABLE_TRACING=true npm start"
echo "----------------------------------------"
echo "🔍 실시간 로그: docker compose -f docker-compose.monitoring.yml logs -f"
echo "🛑 모니터링 중지: docker compose -f docker-compose.monitoring.yml down"
echo "----------------------------------------" 