/**
 * 스킬 → 부서 매핑. AIMAX 스타일 부서 그룹화.
 */

export interface Department {
  id: string;
  label: string;
  icon: string;       // 이모지 또는 단문자
  color: number;      // 부서 헤더 색
  bgColor: number;    // 구역 배경
}

export const DEPARTMENTS: Department[] = [
  { id: 'plan',     label: '기획실',   icon: '📋', color: 0xfbbf24, bgColor: 0x3a2e1a },
  { id: 'design',   label: '디자인실', icon: '🎨', color: 0xf472b6, bgColor: 0x3a1e2e },
  { id: 'dev',      label: '개발팀',   icon: '⚙️', color: 0x60a5fa, bgColor: 0x1e2a3a },
  { id: 'qa',       label: 'QA팀',    icon: '🔍', color: 0x34d399, bgColor: 0x1e3a2e },
  { id: 'content',  label: '콘텐츠팀', icon: '📝', color: 0xa78bfa, bgColor: 0x2a1e3a },
  { id: 'research', label: '리서치팀', icon: '🔬', color: 0xfb923c, bgColor: 0x3a261a },
  { id: 'meeting',  label: '회의실',   icon: '🤝', color: 0xffd166, bgColor: 0x2e2818 },
  { id: 'misc',     label: '기타',     icon: '📌', color: 0x9ca3af, bgColor: 0x252a35 },
];

const DEPARTMENT_BY_ID = new Map(DEPARTMENTS.map(d => [d.id, d]));

export function getDepartment(id: string): Department {
  return DEPARTMENT_BY_ID.get(id) ?? DEPARTMENTS[DEPARTMENTS.length - 1];
}

/**
 * 스킬 name/source 로 부서 결정. 패턴 매칭.
 */
export function classifySkill(name: string, source: string): string {
  const n = name.toLowerCase();
  const s = (source || '').toLowerCase();

  // 서브에이전트는 회의실로
  if (s === 'subagent' || n.startsWith('agent:')) return 'meeting';

  // 디자인 부서
  if (/^design/.test(n) || /design-/.test(n) || n.includes('design')) return 'design';

  // 기획 부서
  if (/^plan-/.test(n) || n === 'office-hours' || n === 'plan-tune') return 'plan';

  // QA 부서
  if (n === 'qa' || n === 'qa-only' || n === 'review' || n === 'security-review' ||
      n === 'codex' || n === 'investigate' || n === 'benchmark' || n === 'canary' ||
      n === 'careful' || n === 'guard' || n === 'freeze' || n === 'unfreeze' ||
      n === 'health' || n === 'cso' || n === 'browse') {
    return 'qa';
  }

  // 개발/배포
  if (n === 'ship' || n === 'land-and-deploy' || n === 'setup-deploy' || n === 'gstack' ||
      n === 'simplify' || n === 'fewer-permission-prompts' || n === 'init' ||
      n === 'gstack-upgrade' || n === 'checkpoint' || n === 'document-release' ||
      n === 'retro' || n === 'devex-review' || n === 'plan-devex-review') {
    return 'dev';
  }

  // 콘텐츠 제작
  if (/blog/.test(n) || /shorts/.test(n) || /ebook/.test(n) || /script/.test(n) ||
      n === 'autoplan' || s.includes('korean-skills') || n === '일일학습생성') {
    return 'content';
  }

  // 리서치/조회
  if (/real-estate/.test(n) || /law/.test(n) || /lck/.test(n) || /zipcode/.test(n) ||
      /car/.test(n) || /search/.test(n) || /find-skills/.test(n) || n === 'learn' ||
      n === 'context-builder' || n === 'context-automation-skill-designer') {
    return 'research';
  }

  // DevX는 dev에 흡수 — 별도로 분리하면 너무 많아짐
  if (n === 'open-gstack-browser' || n === 'connect-chrome' || n === 'pair-agent' ||
      n === 'setup-browser-cookies' || n === 'k-skill-setup' ||
      n === 'claude-api' || n === 'claude-code-guide' ||
      n === 'update-config' || n === 'keybindings-help' || n === 'loop' ||
      n === 'schedule' || n === 'gp-support') {
    return 'dev';
  }

  return 'misc';
}
