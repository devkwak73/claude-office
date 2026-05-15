/**
 * 도구/이벤트 → 상태 라벨 + 상태 색 매핑.
 * AIMAX 의 "대기·구상중·작업중·검토중·완료" 같은 줄.
 */

export interface StatusInfo {
  label: string;
  color: number;
  pulse: boolean;
}

export const IDLE: StatusInfo   = { label: '대기',    color: 0x9ca3af, pulse: false };
export const WAIT: StatusInfo   = { label: '대기중',  color: 0x6b7280, pulse: false };
export const LEAVE: StatusInfo  = { label: '퇴근중',  color: 0x6b7280, pulse: false };
export const WALK: StatusInfo   = { label: '이동중',  color: 0xfbbf24, pulse: true };
export const THINK: StatusInfo  = { label: '구상중',  color: 0xa78bfa, pulse: true };
export const WORK: StatusInfo   = { label: '작업중',  color: 0xffb454, pulse: true };
export const DONE: StatusInfo   = { label: '완료',    color: 0x34d399, pulse: false };

/** 도구 이름 → 상태 라벨 */
export function statusForTool(tool: string): StatusInfo {
  switch (tool) {
    case 'Bash':
    case 'PowerShell':
      return { label: '실행중', color: 0x34d399, pulse: true };
    case 'Read':
      return { label: '읽는중', color: 0x60a5fa, pulse: true };
    case 'Edit':
    case 'Write':
      return { label: '수정중', color: 0xfb923c, pulse: true };
    case 'Glob':
    case 'Grep':
      return { label: '탐색중', color: 0xfbbf24, pulse: true };
    case 'WebSearch':
    case 'WebFetch':
      return { label: '검색중', color: 0x60a5fa, pulse: true };
    case 'TodoWrite':
      return { label: '계획중', color: 0xa78bfa, pulse: true };
    case 'Agent':
      return { label: '위임중', color: 0xf472b6, pulse: true };
    case 'Skill':
      return WORK;
    default:
      return WORK;
  }
}

/** 도구 입력 → 짧은 작업 설명 (말풍선용) */
export function detailForTool(tool: string, input: any): string {
  if (!input || typeof input !== 'object') return '';
  switch (tool) {
    case 'Bash':
    case 'PowerShell': {
      const cmd = String(input.command ?? '');
      const first = cmd.split(/\s+/)[0] || '';
      return first.slice(0, 30);
    }
    case 'Read': return basename(String(input.file_path ?? ''));
    case 'Edit':
    case 'Write': return basename(String(input.file_path ?? ''));
    case 'Glob': return String(input.pattern ?? '').slice(0, 28);
    case 'Grep': return String(input.pattern ?? '').slice(0, 28);
    case 'WebSearch': return String(input.query ?? '').slice(0, 28);
    case 'WebFetch': {
      try { return new URL(String(input.url ?? '')).hostname; } catch { return ''; }
    }
    case 'TodoWrite':
      return Array.isArray(input.todos) ? `${input.todos.length}개 할일` : '';
    case 'Agent': return String(input.description ?? input.subagent_type ?? '').slice(0, 28);
    case 'Skill': return String(input.skill ?? '').slice(0, 28);
    default: return '';
  }
}

function basename(p: string): string {
  if (!p) return '';
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1].slice(0, 28);
}
