#!/bin/bash

#================================================
# 기본 앱 실행 스크립트 (모니터링 제외)
#================================================
# 실행 명령어: 
#   Linux/Mac: ./start.sh
#   또는:      sh start.sh
#   또는:      docker compose up --build
#
# 포함 서비스: backend, postgres, redis
# 제외 서비스: 모든 모니터링 서비스 (traefik, jaeger, grafana 등)
#
# 모니터링 추가 실행: ./monitoring.sh
#================================================

# Docker 데몬 확인
if ! docker info > /dev/null 2>&1; then
  echo "[ERROR] Docker 데몬이 실행 중이 아닙니다. Docker Desktop을 먼저 실행하세요."
  exit 1
fi

echo "[INFO] 네트워크 생성..."
docker network create app-network 2>/dev/null || echo "[INFO] 네트워크가 이미 존재합니다."

echo "[INFO] 기본 앱 docker compose build 시작..."
docker compose build
if [ $? -ne 0 ]; then
  echo "[ERROR] 빌드 실패!"
  exit 1
fi

echo "[INFO] 기본 앱 docker compose up 백그라운드 실행..."
nohup docker compose up --build > docker-app.log 2>&1 &
PID=$!
echo $PID > docker-app.pid

echo "[INFO] 백그라운드 프로세스 ID: $PID"
echo "[INFO] 로그 파일: docker-app.log"

sleep 5

# 프로세스가 실제로 실행 중인지 확인
if kill -0 $PID 2>/dev/null; then
    echo "[OK] 백그라운드 프로세스가 정상적으로 시작되었습니다."
else
    echo "[ERROR] 백그라운드 프로세스 시작에 실패했습니다. 로그를 확인하세요: tail -f docker-app.log"
    exit 1
fi

echo ""
echo "✅ 기본 앱이 백그라운드에서 실행 중입니다."
echo "----------------------------------------"
echo "🌐 서비스 URL:"
echo "📱 앱: http://localhost:3001"
echo "🗄️ 데이터베이스: localhost:5432"
echo "🔴 Redis: localhost:6379"
echo "----------------------------------------"
echo "💡 트레이싱: 비활성화 (기본 모드)"
echo "🔍 실시간 로그 보기: tail -f docker-app.log"
echo "📝 서비스별 로그: docker compose logs [서비스명]"
echo "🔧 프로세스 상태 확인: ps aux | grep 'docker compose'"
echo "⚡ 컨테이너 상태 확인: docker ps"
echo "🛑 서버 중지: ./stop.sh (또는 sh stop.sh)"
echo "📊 모니터링 추가 실행: ./monitoring.sh"
echo "----------------------------------------"
