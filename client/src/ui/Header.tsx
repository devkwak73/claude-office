import React, { useEffect, useState } from 'react';
import type { NormalizedEvent } from '../types';

interface Props {
  connected: boolean;
  recent: NormalizedEvent[];
  onPlayDemo: () => void;
}

interface HealthInfo {
  osUser: string;
  email: string | null;
  pid: number;
  startedAt: number;
}

interface UsageWindow {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
  messages: number;
}

interface UsageSummary {
  windowHours: number;
  total: UsageWindow;
  byModel: Record<string, UsageWindow>;
  lastMessageAt?: number;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function fmtDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function Header({ connected, recent, onPlayDemo }: Props) {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetch('/health').then(r => r.json()).then(setHealth).catch(() => {});
    const refreshUsage = () => fetch('/api/usage').then(r => r.json()).then(setUsage).catch(() => {});
    refreshUsage();
    const usageId = setInterval(refreshUsage, 15000);
    const clockId = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(usageId); clearInterval(clockId); };
  }, []);

  const totalTokens = usage ? usage.total.input + usage.total.output + usage.total.cacheRead + usage.total.cacheCreate : 0;
  const model = usage ? Object.keys(usage.byModel)[0] : '';
  const account = health?.email || health?.osUser || '...';
  const tools = recent.filter(e => e.kind === 'tool_start').length;
  const skills = recent.filter(e => e.kind === 'skill_start').length;
  const agents = recent.filter(e => e.kind === 'subagent_start').length;

  return (
    <header className="topbar-row">
      <div className="tb-left">
        <span className={`dot${connected ? '' : ' off'}`} />
        <span className="tb-label">{connected ? 'live · ws connected' : 'offline'}</span>
      </div>

      <div className="tb-center">
        <div className="tb-stat tb-stat-wide" title="Claude 로그인 계정 (이메일은 AGENT_VIEW_USER_EMAIL 환경변수로 노출)">
          <span className="tb-stat-ico">👤</span>
          <span className="tb-stat-val">{account}</span>
        </div>
        <div className="tb-sep" />
        <div className="tb-stat" title={`최근 ${usage?.windowHours ?? 5}h 모델별 첫 항목`}>
          <span className="tb-stat-ico">🧠</span>
          <span className="tb-stat-val">{model.replace('claude-', '') || '...'}</span>
        </div>
        <div className="tb-sep" />
        <div className="tb-stat" title={`최근 ${usage?.windowHours ?? 5}시간 누적 토큰 (input + output + cache)`}>
          <span className="tb-stat-ico">🔥</span>
          <span className="tb-stat-val">{fmtNum(totalTokens)} tok</span>
        </div>
        <div className="tb-stat" title="input / output 토큰">
          <span className="tb-stat-ico">📥</span>
          <span className="tb-stat-val">{fmtNum(usage?.total.input ?? 0)}</span>
          <span className="tb-stat-divider">·</span>
          <span className="tb-stat-ico">📤</span>
          <span className="tb-stat-val">{fmtNum(usage?.total.output ?? 0)}</span>
        </div>
        <div className="tb-stat" title="cache 적중 / 생성 (캐싱은 별도 단가)">
          <span className="tb-stat-ico">⚡</span>
          <span className="tb-stat-val">{fmtNum(usage?.total.cacheRead ?? 0)}</span>
          <span className="tb-stat-divider">·</span>
          <span className="tb-stat-ico">🆕</span>
          <span className="tb-stat-val">{fmtNum(usage?.total.cacheCreate ?? 0)}</span>
        </div>
        <div className="tb-sep" />
        <div className="tb-stat" title="현재 세션 도구 호출 / 스킬 / 서브에이전트">
          <span className="tb-stat-ico">🔧</span>
          <span className="tb-stat-val">{tools}</span>
          <span className="tb-stat-divider">·</span>
          <span className="tb-stat-ico">✨</span>
          <span className="tb-stat-val">{skills}</span>
          <span className="tb-stat-divider">·</span>
          <span className="tb-stat-ico">👥</span>
          <span className="tb-stat-val">{agents}</span>
        </div>
      </div>

      <div className="tb-right">
        <span className="tb-uptime" title="데몬 가동 시간">⏱ {health ? fmtDuration(now - health.startedAt) : '...'}</span>
        <button className="demo-btn" onClick={onPlayDemo} title="20초짜리 데모 시퀀스 실행">▶ 데모</button>
      </div>
    </header>
  );
}
