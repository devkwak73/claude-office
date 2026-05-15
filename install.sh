#!/usr/bin/env bash
# claude-office one-line installer (macOS / Linux)
# 사용:
#   curl -fsSL https://raw.githubusercontent.com/devkwak73/claude-office/main/install.sh | bash

set -euo pipefail

REPO_URL="https://github.com/devkwak73/claude-office.git"
INSTALL_DIR="$HOME/.claude-office"

step()  { printf "\033[1;36m[claude-office]\033[0m %s\n" "$1"; }
err()   { printf "\033[1;31m[claude-office]\033[0m %s\n" "$1" 1>&2; }
have()  { command -v "$1" >/dev/null 2>&1; }

echo ""
echo "╔════════════════════════════════════════╗"
echo "║       claude-office installer          ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 1) 사전 요구
step "환경 확인 중..."

if ! have git; then
    err "git 이 필요합니다. 설치 후 다시 실행하세요."
    exit 1
fi

HAS_BUN=0; HAS_NODE=0
have bun  && HAS_BUN=1
have node && HAS_NODE=1

if [ "$HAS_BUN" -eq 0 ]; then
    step "Bun 이 없어요. 자동 설치할까요?"
    read -r -p "  (Y) 자동 / (N) 수동 후 재실행: " ans
    if [ "${ans:-Y}" = "Y" ] || [ "${ans:-Y}" = "y" ]; then
        curl -fsSL https://bun.com/install | bash || true
        export PATH="$HOME/.bun/bin:$PATH"
        have bun && HAS_BUN=1
    fi
fi

if [ "$HAS_BUN" -eq 0 ] && [ "$HAS_NODE" -eq 0 ]; then
    err "Bun 또는 Node.js 18+ 둘 중 하나가 필요합니다."
    exit 1
fi

# 2) 리포 clone or pull
if [ -d "$INSTALL_DIR" ]; then
    step "기존 설치 발견: $INSTALL_DIR (업데이트 시도)"
    (cd "$INSTALL_DIR" && git pull --quiet 2>/dev/null || true)
else
    step "리포 clone → $INSTALL_DIR"
    git clone --quiet "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# 3) 의존성 + 빌드
step "의존성 설치 + 빌드 중... (1~2분 소요)"
if [ "$HAS_BUN" -eq 1 ]; then
    bun install --silent >/dev/null
    (cd client && bun install --silent >/dev/null && bun run build >/dev/null)
else
    npm install --silent >/dev/null
    (cd client && npm install --silent >/dev/null && npm run build >/dev/null)
fi

# 4) hooks 등록 확인
echo ""
step "Claude Code hooks를 ~/.claude/settings.json에 등록할까요?"
echo "   등록 안 하면 대시보드는 떠도 실시간 이벤트가 안 들어옵니다."
read -r -p "   (Y) 등록 / (N) 나중에 직접: " ans
if [ "${ans:-Y}" = "Y" ] || [ "${ans:-Y}" = "y" ]; then
    node scripts/install-hooks.mjs
fi

# 5) 데몬 시작 + 브라우저
step "데몬 시작 + 브라우저 오픈"
if [ "$HAS_BUN" -eq 1 ]; then
    (bun run server/index.ts >/dev/null 2>&1 &)
else
    (node server/index.ts >/dev/null 2>&1 &)
fi
sleep 2
if [ "$(uname)" = "Darwin" ]; then
    open "http://127.0.0.1:7878/"
else
    xdg-open "http://127.0.0.1:7878/" >/dev/null 2>&1 || true
fi

echo ""
echo "╔════════════════════════════════════════╗"
echo "║         설치 완료! 🎉                  ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "  설치 위치: $INSTALL_DIR"
echo "  대시보드:  http://127.0.0.1:7878"
echo ""
echo "  다음 실행: cd $INSTALL_DIR && bun run start"
echo ""
