#================================================
# Windows PowerShell 기본 앱 중지 스크립트
#================================================
# 실행 명령어:
#   Windows: .\stop.ps1
#   또는:    powershell .\stop.ps1
#   또는:    docker compose down
#
# 중지 서비스: backend, postgres, redis
# 유지 서비스: 모니터링 서비스들 (별도 중지 필요)
#
# 모니터링 중지: docker compose -f docker-compose.monitoring.yml down
#================================================

Write-Host "⏹️ 기본 앱 서비스 중단..." -ForegroundColor Red

# PowerShell Job 중지
Write-Host "🔄 백그라운드 Job 중지 중..." -ForegroundColor Yellow
Get-Job | Where-Object { $_.Command -like "*docker compose up*" } | Stop-Job
Get-Job | Where-Object { $_.Command -like "*docker compose up*" } | Remove-Job

# Docker Compose 중지
docker compose down

Write-Host "✅ 기본 앱 서비스가 중단되었습니다!" -ForegroundColor Green
Write-Host "💡 모니터링 서비스는 별도로 중지하세요: docker compose -f docker-compose.monitoring.yml down" -ForegroundColor Yellow 