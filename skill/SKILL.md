---
name: claude-office
description: claude-office 대시보드를 열고 Claude의 작업을 실시간으로 시각화. 데몬이 떠있는지 확인하고 없으면 시작, 브라우저까지 자동으로 열어줍니다. "에이전트뷰 열어줘", "claude office 시작", "office view 띄워줘", "사무실 보여줘" 같은 발화에 트리거.
---

# claude-office 대시보드 시작

이 스킬은 [devkwak73/claude-office](https://github.com/devkwak73/claude-office) 의 데몬을 띄우고 대시보드를 엽니다.

## 동작 순서

1. **설치 위치 확인**: `~/.claude-office/` (Windows: `%USERPROFILE%\.claude-office\`) 가 존재하는지 확인
   - 없으면: 설치 안내 출력 후 종료 — 사용자가 [README](https://github.com/devkwak73/claude-office#설치) 의 한 줄 installer를 실행해야 함
2. **데몬 상태 확인**: `curl http://127.0.0.1:7878/health` 응답이 ok 이면 이미 떠있는 상태
3. **데몬이 안 떠있으면 spawn**: 설치 디렉토리에서 `bun run server/index.ts` 백그라운드 실행
4. **health 응답 폴링** (최대 7초)
5. **브라우저 자동 오픈**: `http://127.0.0.1:7878/`
6. **hooks 등록 상태 점검**: `~/.claude/settings.json` 에 hook-emit.mjs 가 등록돼있는지 확인
   - 안 돼있으면 1회 사용자 동의 받고 `node ~/.claude-office/scripts/install-hooks.mjs` 실행

## 실행 명령

설치 디렉토리에서 한 줄로 시작 가능합니다:

```bash
cd ~/.claude-office && bun run start
```

`start` 스크립트가 다음을 자동 수행:
- 데몬 떠있으면 브라우저만 오픈
- 안 떠있으면 spawn 후 health 확인 → 브라우저 오픈

## 트리거 키워드

- "에이전트뷰 열어줘"
- "claude office 시작"
- "office view 띄워줘"
- "사무실 보여줘"
- "agent view start"
- "대시보드 열어줘"

## 미설치 시 안내 메시지 템플릿

```
claude-office 가 설치돼있지 않습니다. 아래 한 줄로 설치하세요:

  Windows (PowerShell):
    powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/devkwak73/claude-office/main/install.ps1 | iex"

  macOS / Linux:
    curl -fsSL https://raw.githubusercontent.com/devkwak73/claude-office/main/install.sh | bash

설치하면 자동으로 데몬이 뜨고 브라우저가 열립니다.
```
