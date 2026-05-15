# claude-office one-line installer (Windows PowerShell)
# 사용:
#   powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/devkwak73/claude-office/main/install.ps1 | iex"

$ErrorActionPreference = 'Stop'

$RepoUrl   = 'https://github.com/devkwak73/claude-office.git'
$InstallDir = Join-Path $HOME '.claude-office'

function Test-Cmd($name) { $null -ne (Get-Command $name -ErrorAction SilentlyContinue) }
function Write-Step($msg) { Write-Host "[claude-office] $msg" -ForegroundColor Cyan }
function Write-Err($msg)  { Write-Host "[claude-office] $msg" -ForegroundColor Red }

Write-Host ''
Write-Host '╔════════════════════════════════════════╗' -ForegroundColor Yellow
Write-Host '║       claude-office installer          ║' -ForegroundColor Yellow
Write-Host '╚════════════════════════════════════════╝' -ForegroundColor Yellow
Write-Host ''

# 1) 사전 요구 환경
Write-Step '환경 확인 중...'

if (-not (Test-Cmd 'git')) {
    Write-Err 'git 이 필요합니다. https://git-scm.com 에서 설치 후 다시 실행하세요.'
    exit 1
}

$hasBun  = Test-Cmd 'bun'
$hasNode = Test-Cmd 'node'

if (-not $hasBun) {
    Write-Step 'Bun 이 없어요. 자동 설치할까요?'
    $ans = Read-Host '  (Y) 자동 설치 / (N) 수동 설치 후 재실행'
    if ($ans -eq 'Y' -or $ans -eq 'y' -or $ans -eq '') {
        Write-Step 'Bun 설치 중... (powershell -c "irm bun.com/install.ps1 | iex")'
        try {
            powershell -ExecutionPolicy Bypass -c "irm bun.com/install.ps1 | iex"
        } catch {
            Write-Err 'Bun 자동 설치 실패. https://bun.com 에서 수동 설치 후 다시 실행하세요.'
            exit 1
        }
        # 새 PATH 반영
        $env:Path = [System.Environment]::GetEnvironmentVariable('Path','User') + ';' + [System.Environment]::GetEnvironmentVariable('Path','Machine')
        $hasBun = Test-Cmd 'bun'
    }
}

if (-not $hasBun -and -not $hasNode) {
    Write-Err 'Bun 또는 Node.js 18+ 둘 중 하나가 필요합니다.'
    exit 1
}

# 2) 리포 clone or pull
if (Test-Path $InstallDir) {
    Write-Step "기존 설치 발견: $InstallDir (업데이트 시도)"
    Push-Location $InstallDir
    try {
        git pull --quiet 2>&1 | Out-Null
    } catch {
        Write-Step '업데이트 실패 — 기존 코드 그대로 진행'
    }
    Pop-Location
} else {
    Write-Step "리포 clone → $InstallDir"
    git clone --quiet $RepoUrl $InstallDir
}

Push-Location $InstallDir

# 3) 의존성 설치 + 빌드
Write-Step '의존성 설치 + 빌드 중... (1~2분 소요)'
if ($hasBun) {
    bun install --silent | Out-Null
    Push-Location client
    bun install --silent | Out-Null
    bun run build | Out-Null
    Pop-Location
} else {
    npm install --silent | Out-Null
    Push-Location client
    npm install --silent | Out-Null
    npm run build | Out-Null
    Pop-Location
}

# 4) hooks 등록 확인
Write-Host ''
Write-Step 'Claude Code hooks를 ~/.claude/settings.json에 등록할까요?'
Write-Host '   등록 안 하면 대시보드는 떠도 실시간 이벤트가 안 들어옵니다.' -ForegroundColor DarkGray
$confirmHook = Read-Host '   (Y) 등록 / (N) 나중에 직접'
if ($confirmHook -eq 'Y' -or $confirmHook -eq 'y' -or $confirmHook -eq '') {
    node scripts\install-hooks.mjs
}

# 5) 데몬 시작 + 브라우저 오픈
Write-Step '데몬 시작 + 브라우저 오픈'
if ($hasBun) {
    Start-Process -WindowStyle Hidden -FilePath 'bun' -ArgumentList 'run','server/index.ts'
} else {
    Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList 'server/index.ts'
}
Start-Sleep -Seconds 2
Start-Process 'http://127.0.0.1:7878/'

Pop-Location

Write-Host ''
Write-Host '╔════════════════════════════════════════╗' -ForegroundColor Green
Write-Host '║         설치 완료! 🎉                  ║' -ForegroundColor Green
Write-Host '╚════════════════════════════════════════╝' -ForegroundColor Green
Write-Host ''
Write-Host '  설치 위치: ' -NoNewline; Write-Host $InstallDir -ForegroundColor Yellow
Write-Host '  대시보드: ' -NoNewline; Write-Host 'http://127.0.0.1:7878' -ForegroundColor Yellow
Write-Host ''
Write-Host '  다음 실행은 다음 명령으로:' -ForegroundColor DarkGray
Write-Host "    cd $InstallDir; bun run start" -ForegroundColor White
Write-Host ''
