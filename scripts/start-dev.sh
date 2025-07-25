#!/bin/bash

# Docker 데몬 확인
if ! docker info > /dev/null 2>&1; then
  echo "[ERROR] Docker 데몬이 실행 중이 아닙니다. Docker Desktop을 먼저 실행하세요."
  exit 1
fi

echo "[INFO] 개발 환경 docker compose build 시작..."
docker compose -f docker-compose.dev.yml build
if [ $? -ne 0 ]; then
  echo "[ERROR] 빌드 실패!"
  exit 1
fi

echo "[INFO] 개발 환경 docker compose up 백그라운드 실행..."
nohup docker compose -f docker-compose.dev.yml up --build > docker-dev.log 2>&1 &

echo $! > docker-dev.pid

sleep 2

echo ""
echo "✅ 개발 환경이 백그라운드에서 실행 중입니다."
echo "----------------------------------------"
echo "🌐 서비스 URL:"
echo "📱 앱: http://localhost:3001"
echo "🗄️ 데이터베이스: localhost:5432"
echo "🔴 Redis: localhost:6379"
echo "----------------------------------------"
echo "🔍 실시간 로그 보기: tail -f docker-dev.log"
echo "📝 서비스별 로그: docker compose -f docker-compose.dev.yml logs [서비스명]"
echo "🛑 서버 중지: sh stop.sh"
echo "----------------------------------------" 