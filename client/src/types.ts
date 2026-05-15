export type EventKind =
  | 'tool_start' | 'tool_end'
  | 'skill_start' | 'skill_end'
  | 'subagent_start' | 'subagent_end'
  | 'user_prompt'
  | 'session_start' | 'session_stop'
  | 'notification';

export interface NormalizedEvent {
  id: string;
  ts: number;
  kind: EventKind;
  actor: string;
  target?: string;
  detail?: string;
  sessionId?: string;
  cwd?: string;
}

export interface SkillEntry {
  name: string;
  source: string;
  description: string;
  triggers: string[];
}
