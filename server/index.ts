import fs from 'node:fs';
import path from 'node:path';
import { PORT, HOST, CLIENT_BUILD, CLIENT_PUBLIC } from './config.ts';
import { scanSkills } from './skills.ts';
import { computeUsage } from './usage.ts';
import {
  normalizeHookPayload, recordEvent, recentEvents,
  nextEventId, type NormalizedEvent,
} from './events.ts';

const CLIENT_ROOT = fs.existsSync(CLIENT_BUILD) ? CLIENT_BUILD : CLIENT_PUBLIC;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function serveStatic(reqPath: string): Response | null {
  let rel = decodeURIComponent(reqPath);
  if (rel === '/' || rel === '') rel = '/index.html';
  rel = rel.replace(/\\/g, '/');
  const full = path.normalize(path.join(CLIENT_ROOT, rel));
  if (!full.startsWith(CLIENT_ROOT)) return new Response('forbidden', { status: 403 });
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  const ext = path.extname(full).toLowerCase();
  const mime = MIME[ext] ?? 'application/octet-stream';
  return new Response(fs.readFileSync(full), { headers: { 'content-type': mime } });
}

function broadcast(ev: NormalizedEvent) {
  const msg = JSON.stringify({ type: 'event', event: ev });
  for (const ws of clients) {
    try { ws.send(msg); } catch { /* ignore */ }
  }
}

const clients = new Set<any>();
const START_TIME = Date.now();

/** 클라이언트 "데모 재생" 버튼이 호출. 서버가 자체 setTimeout 으로 시퀀스를 흘려보냄. */
const DEMO_SCRIPT: Array<{ at: number; payload: any }> = [
  { at: 0,     payload: { hook_event_name: 'SessionStart', session_id: 'demo', cwd: '~/demo-project' } },
  { at: 800,   payload: { hook_event_name: 'UserPromptSubmit', prompt: '실거래가 데이터 업데이트 + 디자인 리뷰 부탁해' } },
  { at: 1600,  payload: { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ssh ubuntu@example.com "sudo crontab -l"' } } },
  { at: 2400,  payload: { hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'investigate', args: '' } } },
  { at: 3600,  payload: { hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'Explore', description: '주간 통계표 탐색' } } },
  { at: 4800,  payload: { hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: '주간 통계 API 스펙' } } },
  { at: 6000,  payload: { hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'plan-eng-review', args: '' } } },
  { at: 7600,  payload: { hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'design-review', args: '' } } },
  { at: 9000,  payload: { hook_event_name: 'PostToolUse', tool_name: 'WebSearch', tool_input: {} } },
  { at: 9800,  payload: { hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'wp-blog-writer', args: '' } } },
  { at: 11200, payload: { hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'qa', args: '' } } },
  { at: 12500, payload: { hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'plan-eng-review' } } },
  { at: 13500, payload: { hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'real-estate-investor-report', args: '' } } },
  { at: 14800, payload: { hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'ship', args: '' } } },
  { at: 16000, payload: { hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'design-review' } } },
  { at: 17000, payload: { hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'Explore' } } },
  { at: 18200, payload: { hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'wp-blog-writer' } } },
  { at: 19500, payload: { hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'qa' } } },
  { at: 20500, payload: { hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'real-estate-investor-report' } } },
  { at: 21500, payload: { hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'ship' } } },
  { at: 22500, payload: { hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'investigate' } } },
  { at: 23500, payload: { hook_event_name: 'SessionEnd' } },
];

function runDemoSequence() {
  for (const step of DEMO_SCRIPT) {
    setTimeout(() => {
      const ev = normalizeHookPayload(step.payload);
      if (ev) { recordEvent(ev); broadcast(ev); }
    }, step.at);
  }
}

let server: ReturnType<typeof Bun.serve>;
try {
  server = Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(req, srv) {
    const url = new URL(req.url);

    if (url.pathname === '/ws') {
      if (srv.upgrade(req)) return undefined as any;
      return new Response('websocket only', { status: 426 });
    }

    if (url.pathname === '/health') {
      const osUser = (process.env.USERNAME || process.env.USER || '').toString();
      // Anthropic 계정 이메일은 환경변수로 노출 가능 (Claude Code가 키체인에 보관해서 직접 못 읽음)
      const email = (process.env.AGENT_VIEW_USER_EMAIL || process.env.ANTHROPIC_USER_EMAIL || '').toString();
      return Response.json({
        ok: true,
        pid: process.pid,
        port: PORT,
        osUser: osUser || 'unknown',
        email: email || null,
        startedAt: START_TIME,
      });
    }

    if (url.pathname === '/api/skills') {
      return Response.json({ skills: scanSkills() });
    }

    if (url.pathname === '/api/events/recent') {
      return Response.json({ events: recentEvents() });
    }

    if (url.pathname === '/api/usage') {
      const hours = Number(url.searchParams.get('hours') ?? 5) || 5;
      return Response.json(computeUsage(hours));
    }

    if (url.pathname === '/api/hook' && req.method === 'POST') {
      let payload: any;
      try { payload = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
      const ev = normalizeHookPayload(payload);
      if (ev) {
        recordEvent(ev);
        broadcast(ev);
      }
      return Response.json({ ok: true, recorded: !!ev });
    }

    if (url.pathname === '/api/demo' && req.method === 'POST') {
      runDemoSequence();
      return Response.json({ ok: true, steps: DEMO_SCRIPT.length });
    }

    if (url.pathname === '/api/emit' && req.method === 'POST') {
      let payload: any;
      try { payload = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
      const ev: NormalizedEvent = {
        id: nextEventId(),
        ts: Date.now(),
        kind: payload.kind ?? 'notification',
        actor: payload.actor ?? 'claude',
        target: payload.target,
        detail: payload.detail,
        sessionId: payload.sessionId,
        cwd: payload.cwd,
      };
      recordEvent(ev);
      broadcast(ev);
      return Response.json({ ok: true });
    }

    if (req.method === 'GET') {
      const direct = serveStatic(url.pathname);
      if (direct) return direct;
      const fallback = serveStatic('/index.html');
      if (fallback) return fallback;
    }

    return new Response('not found', { status: 404 });
  },
  websocket: {
    open(ws) {
      clients.add(ws);
      ws.send(JSON.stringify({ type: 'hello', skills: scanSkills(), events: recentEvents() }));
    },
    close(ws) { clients.delete(ws); },
    message() { /* one-way for now */ },
  },
  error() {
    return new Response('server error', { status: 500 });
  },
  });
} catch (err: any) {
  if (err?.code === 'EADDRINUSE' || /port.*in use/i.test(String(err?.message))) {
    try {
      const res = await fetch(`http://${HOST}:${PORT}/health`).then(r => r.json()).catch(() => null);
      if (res?.ok) {
        console.log(`[agent-view] 이미 떠있는 데몬 발견 (pid ${res.pid}). 종료합니다.`);
        process.exit(0);
      }
    } catch { /* ignore */ }
    console.error(`[agent-view] 포트 ${PORT}이 점유돼있지만 우리 데몬 응답이 없습니다. 다른 프로세스가 쓰는지 확인하세요.`);
    process.exit(1);
  }
  throw err;
}

console.log(`[agent-view] http://${HOST}:${server.port}`);
console.log(`[agent-view] hook endpoint: POST http://${HOST}:${server.port}/api/hook`);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig as any, () => { server.stop(); process.exit(0); });
}
