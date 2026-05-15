#!/usr/bin/env node
/*
 * 글로벌 ~/.claude/settings.json 에 agent-view hooks 를 추가/제거.
 *
 * 사용:
 *   node scripts/install-hooks.mjs            # 추가
 *   node scripts/install-hooks.mjs --uninstall  # 제거
 *
 * 추가하는 hook 이벤트:
 *   PreToolUse, PostToolUse, UserPromptSubmit, Notification,
 *   SessionStart, SessionEnd, Stop, SubagentStop
 *
 * 안전 규칙:
 *   - 기존 settings.json 의 다른 필드는 절대 건드리지 않음
 *   - 기존 hook entry 가 있으면 중복 없이 우리 entry만 추가/제거
 *   - 백업: settings.json.bak.<timestamp>
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import url from 'node:url';

const HOME = os.homedir();
const SETTINGS = path.join(HOME, '.claude', 'settings.json');
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const EMIT_SCRIPT = path.resolve(HERE, 'hook-emit.mjs');

const HOOK_EVENTS = [
  'PreToolUse', 'PostToolUse',
  'UserPromptSubmit', 'Notification',
  'SessionStart', 'SessionEnd', 'Stop', 'SubagentStop',
];

const COMMAND = `node "${EMIT_SCRIPT.replace(/\\/g, '/')}"`;
const TAG = '__agent_view__';

function readSettings() {
  if (!fs.existsSync(SETTINGS)) return {};
  const raw = fs.readFileSync(SETTINGS, 'utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function backup() {
  if (!fs.existsSync(SETTINGS)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(SETTINGS, `${SETTINGS}.bak.${stamp}`);
}

function isOurEntry(entry) {
  if (!entry || !Array.isArray(entry.hooks)) return false;
  return entry.hooks.some(h => h && h.command && h.command.includes('hook-emit.mjs'));
}

function buildOurEntry() {
  return {
    [TAG]: true,
    hooks: [{ type: 'command', command: COMMAND }],
  };
}

function install() {
  const settings = readSettings();
  settings.hooks ??= {};
  let added = 0;
  for (const ev of HOOK_EVENTS) {
    const arr = (settings.hooks[ev] ??= []);
    if (arr.some(isOurEntry)) continue;
    arr.push(buildOurEntry());
    added++;
  }
  backup();
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
  console.log(`[install-hooks] ${added}개 이벤트에 hook 추가됨 (settings: ${SETTINGS})`);
  if (added === 0) console.log('[install-hooks] 이미 설치돼있어요.');
  console.log(`[install-hooks] 데몬 시작: bun run start  (포트 7878)`);
}

function uninstall() {
  if (!fs.existsSync(SETTINGS)) { console.log('settings.json 없음 — skip'); return; }
  const settings = readSettings();
  if (!settings.hooks) { console.log('hooks 섹션 없음 — skip'); return; }
  let removed = 0;
  for (const ev of Object.keys(settings.hooks)) {
    const arr = settings.hooks[ev];
    if (!Array.isArray(arr)) continue;
    const before = arr.length;
    settings.hooks[ev] = arr.filter(e => !isOurEntry(e));
    removed += before - settings.hooks[ev].length;
    if (settings.hooks[ev].length === 0) delete settings.hooks[ev];
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  backup();
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
  console.log(`[install-hooks] ${removed}개 entry 제거됨`);
}

const mode = process.argv.includes('--uninstall') ? 'uninstall' : 'install';
if (mode === 'install') install(); else uninstall();
