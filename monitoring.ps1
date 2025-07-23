# Windows PowerShell 모니터링 환경 시작 스크립트

Write-Host "[INFO] Docker 데몬 확인..." -ForegroundColor Green
try {
    docker info | Out-Null
    Write-Host "[OK] Docker 데몬이 실행 중입니다." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker 데몬이 실행 중이 아닙니다. Docker Desktop을 먼저 실행하세요." -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] 네트워크 생성..." -ForegroundColor Yellow
docker network create app-network 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] 네트워크가 생성되었습니다." -ForegroundColor Green
} else {
    Write-Host "[INFO] 네트워크가 이미 존재합니다." -ForegroundColor Yellow
}

Write-Host "[INFO] 모니터링 스택 시작..." -ForegroundColor Yellow
docker-compose -f docker-compose.monitoring.yml up -d

Start-Sleep 5

Write-Host ""
Write-Host "✅ 모니터링 스택이 실행 중입니다." -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "🌐 모니터링 대시보드:" -ForegroundColor White
Write-Host "📊 Jaeger (트레이싱): http://localhost:16686" -ForegroundColor White
Write-Host "🎛️ Traefik 대시보드: http://localhost:8080" -ForegroundColor White
Write-Host "📈 Grafana (메트릭): http://localhost:3000 (admin/admin123)" -ForegroundColor White
Write-Host "🔍 Kibana (로그): http://localhost:5601" -ForegroundColor White
Write-Host "📊 Prometheus: http://localhost:9090" -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "💡 이제 백엔드를 트레이싱 모드로 시작하세요:" -ForegroundColor Yellow
Write-Host "   `$env:ENABLE_TRACING=`"true`"; npm start" -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "🔍 실시간 로그: docker-compose -f docker-compose.monitoring.yml logs -f" -ForegroundColor White
Write-Host "🛑 모니터링 중지: docker-compose -f docker-compose.monitoring.yml down" -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor Cyan 