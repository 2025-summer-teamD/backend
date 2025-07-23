#!/bin/bash

#================================================
# 기본 앱 중지 스크립트
#================================================
# 실행 명령어:
#   Linux/Mac: ./stop.sh
#   또는:      sh stop.sh
#   또는:      docker compose down
#
# 중지 서비스: backend, postgres, redis
# 유지 서비스: 모니터링 서비스들 (별도 중지 필요)
#
# 모니터링 중지: docker compose -f docker-compose.monitoring.yml down
#================================================

# Docker Desktop 실행 여부 안내
if ! docker info > /dev/null 2>&1; then
  echo "[ERROR] Docker 데몬이 실행 중이 아닙니다. Docker Desktop을 먼저 실행하세요."
  exit 1
fi

if [ -f docker-app.pid ]; then
  PID=$(cat docker-app.pid)
  echo "[INFO] 서버(백그라운드 프로세스, PID: $PID) 중지 시도 중..."
  
  # 프로세스가 실제로 실행 중인지 확인
  if kill -0 $PID 2>/dev/null; then
    kill $PID 2>/dev/null
    sleep 2
    
    # 강제 종료가 필요한지 확인
    if kill -0 $PID 2>/dev/null; then
      echo "[WARN] 프로세스가 정상 종료되지 않아 강제 종료합니다..."
      kill -9 $PID 2>/dev/null
    fi
    echo "[INFO] 백그라운드 서버 프로세스가 성공적으로 중지되었습니다."
  else
    echo "[INFO] 프로세스가 이미 종료되었습니다."
  fi
  
  rm -f docker-app.pid
  rm -f docker-app.log
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