#!/bin/bash

echo "🚀 개발 환경 시작 중..."

# 기존 컨테이너 정리
echo "🧹 기존 컨테이너 정리 중..."
docker-compose -f docker-compose.dev.yml down

# 개발 환경 시작
echo "📦 개발 환경 컨테이너 시작 중..."
docker-compose -f docker-compose.dev.yml up -d

# 마이그레이션 실행
echo "🗄️ 데이터베이스 마이그레이션 실행 중..."
docker-compose -f docker-compose.dev.yml run --rm migrate

echo "✅ 개발 환경이 시작되었습니다!"
echo "📊 API 서버: http://localhost:3001"
echo "🗄️ 데이터베이스: localhost:5432"
echo "🔴 Redis: localhost:6379"
echo ""
echo "📝 로그 확인: docker-compose -f docker-compose.dev.yml logs -f"
echo "🛑 중지: docker-compose -f docker-compose.dev.yml down" 