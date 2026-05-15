#!/usr/bin/env node
/*
 * Claude Code hooks → agent-view 데몬 중계 스크립트.
 *
 * Claude Code는 hook이 발화하면 이 스크립트를 spawn하고, stdin으로 JSON payload를 전달합니다.
 * 우리는 stdin을 읽어 그대로 데몬의 /api/hook 으로 POST 합니다.
 *
 * 설정 예시 (~/.claude/settings.json):
 *   "hooks": {
 *     "PreToolUse":  [{ "hooks": [{ "type": "command", "command": "node \"~/.claude-office/scripts/hook-emit.mjs\"" }] }],
 *     "PostToolUse": [{ "hooks": [{ "type": "command", "command": "node \"~/.claude-office/scripts/hook-emit.mjs\"" }] }],
 *     ...
 *   }
 *
 * 데몬이 안 떠있어도 hook은 절대 실패하면 안 됩니다 (작업이 멈추니까). 무조건 exit 0.
 */

const PORT = process.env.AGENT_VIEW_PORT || 7878;
const TIMEOUT_MS = 600;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', async () => {
  try {
    if (!raw.trim()) return done();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    await fetch(`http://127.0.0.1:${PORT}/api/hook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw,
      signal: ac.signal,
    }).catch(() => {});
    clearTimeout(timer);
  } catch { /* swallow */ }
  done();
});

// stdin이 안 들어오는 환경 보호용
setTimeout(done, 1500);

function done() { process.exit(0); }
