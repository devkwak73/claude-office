import React from 'react';
import type { NormalizedEvent, SkillEntry } from '../types';

interface Props {
  connected: boolean;
  skills: SkillEntry[];
  active: Set<string>;
  recent: NormalizedEvent[];
}

export function SidePanel({ connected, skills, active, recent }: Props) {
  const userPrompts = recent.filter(e => e.kind === 'user_prompt').length;
  const toolCalls = recent.filter(e => e.kind === 'tool_start').length;
  const subagents = recent.filter(e => e.kind === 'subagent_start').length;
  const skillCalls = recent.filter(e => e.kind === 'skill_start').length;

  return (
    <aside className="side">
      <h2>오늘 활동</h2>
      <div>
        <div className="stat"><span>유저 발언</span><span className="stat-val">{userPrompts}</span></div>
        <div className="stat"><span>도구 호출</span><span className="stat-val">{toolCalls}</span></div>
        <div className="stat"><span>스킬 호출</span><span className="stat-val">{skillCalls}</span></div>
        <div className="stat"><span>서브에이전트</span><span className="stat-val">{subagents}</span></div>
        <div className="stat"><span>연결</span><span className="stat-val">{connected ? 'live' : 'offline'}</span></div>
      </div>
      <h2>스킬 인벤토리 ({skills.length})</h2>
      <div className="skill-list">
        {skills.map(s => (
          <div key={s.name} className={`item${active.has(s.name) ? ' active' : ''}`} title={s.description}>
            <span>{s.name}</span>
            <span className="src">{s.source}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
