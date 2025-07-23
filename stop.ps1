Write-Host "⏹️ 모든 서비스 중단..." -ForegroundColor Red
docker compose -f docker-compose.dev.yml -f docker-compose.monitoring.yml down
Write-Host "✅ 모든 서비스가 중단되었습니다!" -ForegroundColor Green 