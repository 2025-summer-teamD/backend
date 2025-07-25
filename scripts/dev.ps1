#================================================
# Windows PowerShell 기본 앱 실행 스크립트 (모니터링 제외)
#================================================
# 실행 명령어:
#   Windows: .\dev.ps1
#   또는:    powershell .\dev.ps1
#   또는:    docker compose up --build
#
# 포함 서비스: backend, postgres, redis
# 제외 서비스: 모든 모니터링 서비스 (traefik, jaeger, grafana 등)
#
# 모니터링 추가 실행: .\monitoring.ps1
#================================================

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

Write-Host "[INFO] 기본 앱 docker compose build 시작..." -ForegroundColor Yellow
docker compose build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] 빌드 실패!" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] 기본 앱 docker compose up 백그라운드 실행..." -ForegroundColor Yellow

# PowerShell Job으로 백그라운드 실행 (작업 디렉토리와 환경변수 유지)
$job = Start-Job -ScriptBlock {
    param($workingDir)
    Set-Location $workingDir
    docker compose up --build
} -ArgumentList (Get-Location).Path

Write-Host "[INFO] 백그라운드 Job ID: $($job.Id)" -ForegroundColor Yellow
Start-Sleep 5

Write-Host ""
Write-Host "✅ 기본 앱이 백그라운드에서 실행 중입니다." -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "🌐 서비스 URL:" -ForegroundColor White
Write-Host "📱 앱: http://localhost:3001" -ForegroundColor White
Write-Host "🗄️ 데이터베이스: localhost:5432" -ForegroundColor White
Write-Host "🔴 Redis: localhost:6379" -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "💡 트레이싱: 비활성화 (기본 모드)" -ForegroundColor Yellow
Write-Host "📝 서비스별 로그: docker compose logs [서비스명]" -ForegroundColor White
Write-Host "🔍 Job 상태 확인: Get-Job; Receive-Job $($job.Id) -Keep" -ForegroundColor White
Write-Host "🛑 서버 중지: .\stop.ps1" -ForegroundColor White
Write-Host "📊 모니터링 추가 실행: .\monitoring.ps1" -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor Cyan 