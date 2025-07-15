#!/bin/bash

# Docker Desktop 실행 여부 안내
if ! docker info > /dev/null 2>&1; then
  echo "[ERROR] Docker 데몬이 실행 중이 아닙니다. Docker Desktop을 먼저 실행하세요."
  exit 1
fi

if [ -f docker-compose.pid ]; then
  PID=$(cat docker-compose.pid)
  echo "[INFO] 서버(백그라운드 프로세스, PID: $PID) 중지 시도 중..."
  kill $PID 2>/dev/null && echo "[INFO] 백그라운드 서버 프로세스가 성공적으로 중지되었습니다." || echo "[WARN] 프로세스가 이미 종료되었거나 찾을 수 없습니다."
  rm -f docker-compose.pid
else
  echo "[WARN] 서버 PID 파일이 없어 백그라운드 프로세스 종료를 건너뜁니다."
fi

echo "[INFO] Docker 컨테이너 정리(docker compose down) 중..."
docker compose down

echo ""
echo "🛑 서버와 모든 관련 컨테이너가 중지되었습니다."
echo "----------------------------------------"
echo "🔄 서버 재시작: sh start.sh"
echo "----------------------------------------"
echo "* tip: docker ps -a 명령으로 컨테이너 상태를 확인할 수 있습니다."
echo "" 