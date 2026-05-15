import fs from 'node:fs';
import path from 'node:path';
import { CLAUDE_DIR } from './config.ts';

const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

export interface UsageWindow {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
  messages: number;
}

export interface UsageSummary {
  windowHours: number;
  total: UsageWindow;
  byModel: Record<string, UsageWindow>;
  generatedAt: number;
  lastMessageAt?: number;
}

let cache: { at: number; data: UsageSummary } | null = null;
const CACHE_TTL_MS = 15_000;

function emptyWindow(): UsageWindow {
  return { input: 0, output: 0, cacheRead: 0, cacheCreate: 0, messages: 0 };
}

/**
 * ~/.claude/projects/*\/*.jsonl 파일을 스캔해서 최근 N시간 토큰 사용량을 집계.
 * 각 라인의 message.usage 필드 합산.
 */
export function computeUsage(windowHours = 5): UsageSummary {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS && cache.data.windowHours === windowHours) {
    return cache.data;
  }

  const since = Date.now() - windowHours * 3600 * 1000;
  const total = emptyWindow();
  const byModel: Record<string, UsageWindow> = {};
  let lastTs = 0;

  let projectDirs: string[] = [];
  try {
    projectDirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(PROJECTS_DIR, d.name));
  } catch { /* ignore */ }

  for (const dir of projectDirs) {
    let files: fs.Dirent[] = [];
    try { files = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const f of files) {
      if (!f.isFile() || !f.name.endsWith('.jsonl')) continue;
      const full = path.join(dir, f.name);
      let stat: fs.Stats;
      try { stat = fs.statSync(full); } catch { continue; }
      // 파일이 마지막에 수정된 시점이 윈도우 이전이면 통째로 스킵
      if (stat.mtimeMs < since) continue;

      let raw = '';
      try { raw = fs.readFileSync(full, 'utf8'); } catch { continue; }
      const lines = raw.split('\n');
      for (const line of lines) {
        if (!line || line[0] !== '{') continue;
        let obj: any;
        try { obj = JSON.parse(line); } catch { continue; }
        const ts = parseTs(obj.timestamp);
        if (ts === null || ts < since) continue;
        const msg = obj.message;
        const usage = msg?.usage;
        if (!usage) continue;

        const model = String(msg?.model ?? 'unknown');
        if (!byModel[model]) byModel[model] = emptyWindow();
        const w = byModel[model];

        const inT = Number(usage.input_tokens ?? 0);
        const outT = Number(usage.output_tokens ?? 0);
        const crT = Number(usage.cache_read_input_tokens ?? 0);
        const ccT = Number(usage.cache_creation_input_tokens ?? 0);

        w.input += inT; w.output += outT; w.cacheRead += crT; w.cacheCreate += ccT; w.messages += 1;
        total.input += inT; total.output += outT; total.cacheRead += crT; total.cacheCreate += ccT; total.messages += 1;
        if (ts > lastTs) lastTs = ts;
      }
    }
  }

  const data: UsageSummary = {
    windowHours,
    total,
    byModel,
    generatedAt: Date.now(),
    lastMessageAt: lastTs || undefined,
  };
  cache = { at: Date.now(), data };
  return data;
}

function parseTs(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'number') return v;
  const t = Date.parse(String(v));
  return isNaN(t) ? null : t;
}

export function totalTokens(w: UsageWindow): number {
  return w.input + w.output + w.cacheRead + w.cacheCreate;
}
