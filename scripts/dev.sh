#!/bin/bash
echo "🚀 개발 환경 시작..."
docker-compose -f docker-compose.dev.yml up -d
echo "✅ 개발 환경이 시작되었습니다!"
echo "📱 앱: http://localhost:3001"
echo "🗄️ 데이터베이스: localhost:5432"
echo "🔴 Redis: localhost:6379" 