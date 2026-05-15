@echo off
REM agent-view 데몬 시작 + 브라우저 열기 (Windows)
setlocal
cd /d "%~dp0\.."
where bun >nul 2>nul || (echo Bun이 설치돼있지 않습니다. https://bun.com 참조. & pause & exit /b 1)
if not exist client\dist\index.html (
  echo [start] 클라이언트 빌드가 없습니다. 먼저 빌드합니다.
  pushd client && call npm run build && popd
)
start "" http://127.0.0.1:7878/
bun run server/index.ts
