/**
 * 스킬 소스별 색조 — 카테고리 알아보기 쉽게 캐릭터 색을 다르게.
 */
const SOURCE_COLORS: Record<string, number> = {
  'gstack': 0xffb454,
  'plugin:korean-skills': 0x7dd3fc,
  'plugin:claude': 0x9b9bff,
  'plugin:marketplaces': 0x9b9bff,
  'connect-chrome': 0x4ade80,
  'context-builder': 0x4ade80,
  'wp-blog-writer': 0xf472b6,
  'real-estate-investor-report': 0xfb923c,
  'remotion-shorts-creator': 0xa78bfa,
  'korean-shorts-maker': 0xa78bfa,
};

export const CLAUDE_COLOR = 0xffd166;

const FALLBACK_PALETTE = [
  0x60a5fa, 0xf472b6, 0xfb923c, 0x34d399, 0xa78bfa,
  0xfbbf24, 0x22d3ee, 0xff6b6b, 0x6ee7b7, 0xd8b4fe,
  0x93c5fd, 0xfca5a5, 0xfde68a, 0xc4b5fd,
];

export function colorForSkill(name: string, source: string): number {
  if (SOURCE_COLORS[source]) return SOURCE_COLORS[source];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}

export function shortLabel(name: string, max = 10): string {
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}
