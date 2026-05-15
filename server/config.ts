import os from 'node:os';
import path from 'node:path';

export const PORT = Number(process.env.AGENT_VIEW_PORT ?? 7878);
export const HOST = '127.0.0.1';
export const HOME = os.homedir();
export const CLAUDE_DIR = path.join(HOME, '.claude');
export const SKILLS_ROOTS = [
  path.join(CLAUDE_DIR, 'skills'),
  path.join(CLAUDE_DIR, 'plugins'),
];
export const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');

export const CLIENT_BUILD = path.join(import.meta.dirname, '..', 'client', 'dist');
export const CLIENT_PUBLIC = path.join(import.meta.dirname, '..', 'client', 'public');

export const LOG_BUFFER_SIZE = 500;
