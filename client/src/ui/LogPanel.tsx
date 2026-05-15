import React, { useEffect, useRef } from 'react';
import type { NormalizedEvent } from '../types';

interface Props {
  events: NormalizedEvent[];
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function fmtKind(k: string) {
  return k.replace('_', '/');
}

function fmtMsg(e: NormalizedEvent): string {
  switch (e.kind) {
    case 'tool_start':   return `${e.target}${e.detail ? ' · ' + e.detail : ''}`;
    case 'tool_end':     return `${e.target} done`;
    case 'skill_start':  return `${e.target} 호출${e.detail ? ' · ' + e.detail : ''}`;
    case 'skill_end':    return `${e.target} 완료`;
    case 'subagent_start': return `${e.target}${e.detail ? ' · ' + e.detail : ''}`;
    case 'subagent_end': return `${e.target} 완료`;
    case 'user_prompt':  return e.detail ?? '';
    case 'notification': return e.detail ?? '';
    case 'session_start': return e.cwd ? `세션 시작 · ${e.cwd}` : '세션 시작';
    case 'session_stop':  return '세션 종료';
    default: return e.detail ?? '';
  }
}

export function LogPanel({ events }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events]);

  return (
    <section className="logs" ref={ref}>
      {events.length === 0 && <div className="log-row"><span className="log-time">--:--:--</span><span className="log-kind">대기</span><span className="log-msg">이벤트를 기다리는 중...</span></div>}
      {events.map(e => (
        <div className="log-row" key={e.id}>
          <span className="log-time">{fmtTime(e.ts)}</span>
          <span className="log-kind">{fmtKind(e.kind)}</span>
          <span className="log-msg">{fmtMsg(e)}</span>
        </div>
      ))}
    </section>
  );
}
