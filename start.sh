#!/bin/bash

# Docker Desktop 실행 여부 안내
if ! docker info > /dev/null 2>&1; then
  echo "[ERROR] Docker 데몬이 실행 중이 아닙니다. Docker Desktop을 먼저 실행하세요."
  exit 1
fi

echo "[INFO] docker compose build 시작..."
docker compose build
if [ $? -ne 0 ]; then
  echo "[ERROR] 빌드 실패! 오류를 확인하세요."
  exit 1
fi

echo "[INFO] docker compose up 백그라운드 실행 (docker.log 기록)"
docker compose up > docker.log 2>&1 &
echo $! > docker-compose.pid

sleep 1

# 서버가 정상적으로 올라왔는지 간단히 확인 (예: app 서비스가 healthy 상태인지 등)
# 여기서는 단순히 2초 대기 후 안내 메시지 출력
sleep 2

echo ""
echo "✅ 서버가 백그라운드에서 실행 중입니다."
echo "----------------------------------------"
echo "🔍 실시간 로그 보기: tail -f docker.log"
echo "📝 서비스별 로그: docker compose logs [서비스명]"
echo "🛑 서버 중지: sh stop.sh"
echo "----------------------------------------"
echo "* 예시:"
echo "  tail -f docker.log"
echo "  docker compose logs app"
echo "  sh stop.sh"
echo ""