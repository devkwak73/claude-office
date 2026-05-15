import { LOG_BUFFER_SIZE } from './config.ts';

export type EventKind =
  | 'tool_start'
  | 'tool_end'
  | 'skill_start'
  | 'skill_end'
  | 'subagent_start'
  | 'subagent_end'
  | 'user_prompt'
  | 'session_start'
  | 'session_stop'
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

const buf: NormalizedEvent[] = [];

export function recordEvent(ev: NormalizedEvent): void {
  buf.push(ev);
  if (buf.length > LOG_BUFFER_SIZE) buf.splice(0, buf.length - LOG_BUFFER_SIZE);
}

export function recentEvents(): NormalizedEvent[] {
  return buf.slice();
}

let counter = 0;
export function nextEventId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

/**
 * Claude Code hook payload → 정규화 이벤트.
 * hook payload 형식:
 *   { hook_event_name, tool_name?, tool_input?, tool_response?, session_id, cwd, message? }
 */
export function normalizeHookPayload(payload: any): NormalizedEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const hookName: string = String(payload.hook_event_name ?? '');
  const sessionId = payload.session_id;
  const cwd = payload.cwd;
  const base = { id: nextEventId(), ts: Date.now(), sessionId, cwd };

  switch (hookName) {
    case 'PreToolUse': {
      const tool = String(payload.tool_name ?? 'tool');
      const input = payload.tool_input ?? {};
      if (tool === 'Skill') {
        return { ...base, kind: 'skill_start', actor: 'claude', target: String(input.skill ?? ''), detail: input.args ?? '' };
      }
      if (tool === 'Agent') {
        return { ...base, kind: 'subagent_start', actor: 'claude', target: String(input.subagent_type ?? 'general'), detail: String(input.description ?? '') };
      }
      return { ...base, kind: 'tool_start', actor: 'claude', target: tool, detail: summarizeToolInput(tool, input) };
    }
    case 'PostToolUse': {
      const tool = String(payload.tool_name ?? 'tool');
      const input = payload.tool_input ?? {};
      if (tool === 'Skill') {
        return { ...base, kind: 'skill_end', actor: 'claude', target: String(input.skill ?? '') };
      }
      if (tool === 'Agent') {
        return { ...base, kind: 'subagent_end', actor: 'claude', target: String(input.subagent_type ?? 'general') };
      }
      return { ...base, kind: 'tool_end', actor: 'claude', target: tool };
    }
    case 'UserPromptSubmit':
      return { ...base, kind: 'user_prompt', actor: 'user', detail: String(payload.prompt ?? '').slice(0, 200) };
    case 'SessionStart':
      return { ...base, kind: 'session_start', actor: 'claude' };
    case 'SessionEnd':
    case 'Stop':
      return { ...base, kind: 'session_stop', actor: 'claude' };
    case 'SubagentStop':
      return { ...base, kind: 'subagent_end', actor: 'claude', target: 'agent' };
    case 'Notification':
      return { ...base, kind: 'notification', actor: 'claude', detail: String(payload.message ?? '') };
    default:
      return null;
  }
}

function summarizeToolInput(tool: string, input: any): string {
  if (!input || typeof input !== 'object') return '';
  switch (tool) {
    case 'Bash':
    case 'PowerShell':
      return String(input.command ?? '').slice(0, 160);
    case 'Read':
    case 'Edit':
    case 'Write':
      return String(input.file_path ?? '').slice(0, 160);
    case 'Glob':
      return String(input.pattern ?? '').slice(0, 160);
    case 'Grep':
      return String(input.pattern ?? '').slice(0, 160);
    case 'WebFetch':
    case 'WebSearch':
      return String(input.url ?? input.query ?? '').slice(0, 160);
    case 'TodoWrite':
      return Array.isArray(input.todos) ? `${input.todos.length} todos` : '';
    default:
      return '';
  }
}
