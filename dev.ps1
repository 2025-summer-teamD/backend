# Windows PowerShell 개발 환경 시작 스크립트

Write-Host "[INFO] Docker 데몬 확인..." -ForegroundColor Green
try {
    docker info | Out-Null
    Write-Host "[OK] Docker 데몬이 실행 중입니다." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker 데몬이 실행 중이 아닙니다. Docker Desktop을 먼저 실행하세요." -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] 개발 환경 docker compose build 시작..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] 빌드 실패!" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] 개발 환경 docker compose up 백그라운드 실행..." -ForegroundColor Yellow
Start-Process docker-compose -ArgumentList "-f", "docker-compose.dev.yml", "up", "--build" -WindowStyle Hidden

Start-Sleep 3

Write-Host ""
Write-Host "✅ 개발 환경이 백그라운드에서 실행 중입니다." -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "🌐 서비스 URL:" -ForegroundColor White
Write-Host "📱 앱: http://localhost:3001" -ForegroundColor White
Write-Host "🗄️ 데이터베이스: localhost:5432" -ForegroundColor White
Write-Host "🔴 Redis: localhost:6379" -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "💡 트레이싱: 비활성화 (개발 모드)" -ForegroundColor Yellow
Write-Host "📝 서비스별 로그: docker-compose -f docker-compose.dev.yml logs [서비스명]" -ForegroundColor White
Write-Host "🛑 서버 중지: .\stop.ps1" -ForegroundColor White
Write-Host "📊 모니터링 모드: .\monitoring.ps1" -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor Cyan 