#!/usr/bin/env node
/*
 * 데몬이 떠있으면 브라우저만 열고, 안 떠있으면 spawn 한 뒤 health 응답 확인 후 브라우저 열기.
 * Bun 또는 Node 18+ 어느 쪽에서도 실행 가능.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = Number(process.env.AGENT_VIEW_PORT ?? 7878);
const URL_ = `http://127.0.0.1:${PORT}/`;

async function isAlive() {
  try {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 400);
    const r = await fetch(URL_ + 'health', { signal: ac.signal });
    return r.ok;
  } catch { return false; }
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32' ? 'cmd' :
    process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url];
  try { spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref(); } catch { /* ignore */ }
}

async function waitAlive(maxMs = 7000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await isAlive()) return true;
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  if (await isAlive()) {
    console.log(`[claude-office] 데몬이 이미 떠있음 — 브라우저만 엽니다`);
    openBrowser(URL_);
    return;
  }

  // 데몬 spawn (Bun 우선, 없으면 node)
  const useBun = !!process.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH || !!globalThis.Bun;
  const cmd = useBun ? 'bun' : (process.platform === 'win32' ? 'bun.cmd' : 'bun');
  const args = ['run', 'server/index.ts'];

  console.log(`[claude-office] 데몬 시작 중...`);
  const child = spawn(cmd, args, {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  if (await waitAlive()) {
    console.log(`[claude-office] 데몬 ${URL_} 로 가동, 브라우저 엽니다`);
    openBrowser(URL_);
  } else {
    console.error(`[claude-office] 데몬 시작 실패. 수동 실행: bun run start:daemon`);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
