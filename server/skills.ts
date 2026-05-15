import fs from 'node:fs';
import path from 'node:path';
import { SKILLS_ROOTS } from './config.ts';

export interface SkillEntry {
  name: string;
  source: string;
  description: string;
  triggers: string[];
}

function parseFrontmatter(md: string): Record<string, string> {
  if (!md.startsWith('---')) return {};
  const end = md.indexOf('\n---', 4);
  if (end < 0) return {};
  const block = md.slice(4, end);
  const out: Record<string, string> = {};
  let key = '';
  let buf: string[] = [];
  for (const raw of block.split(/\r?\n/)) {
    const m = raw.match(/^([A-Za-z_-]+):\s?(.*)$/);
    if (m) {
      if (key) out[key] = buf.join('\n').trim();
      key = m[1];
      buf = [m[2]];
    } else if (key) {
      buf.push(raw.replace(/^\s{2}/, ''));
    }
  }
  if (key) out[key] = buf.join('\n').trim();
  return out;
}

function walk(dir: string, depth = 0, out: string[] = []): string[] {
  if (depth > 6) return out;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, depth + 1, out);
    else if (e.isFile() && e.name === 'SKILL.md') out.push(p);
  }
  return out;
}

function deriveName(filePath: string): string {
  const dir = path.basename(path.dirname(filePath));
  return dir;
}

function deriveSource(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/');
  const m = norm.match(/\.claude\/(skills|plugins)\/([^/]+)/);
  if (!m) return 'unknown';
  if (m[1] === 'plugins') return `plugin:${m[2]}`;
  return m[2] === 'gstack' ? 'gstack' : m[2];
}

export function scanSkills(): SkillEntry[] {
  const files: string[] = [];
  for (const root of SKILLS_ROOTS) walk(root, 0, files);

  const byName = new Map<string, SkillEntry>();
  for (const f of files) {
    let raw = '';
    try { raw = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const fm = parseFrontmatter(raw);
    const name = (fm.name || deriveName(f)).trim();
    if (!name) continue;
    if (byName.has(name)) continue;
    const desc = (fm.description || '').replace(/\s+/g, ' ').trim();
    const triggers = (fm.triggers || '')
      .split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    byName.set(name, {
      name,
      source: deriveSource(f),
      description: desc.slice(0, 240),
      triggers,
    });
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}
