#!/usr/bin/env node
/*
 * 데모 이벤트 시퀀스. 데몬이 떠있는 상태에서 실행하면
 * 사무실에 캐릭터들이 등장 → 작업 → 퇴장 하는 흐름을 시연합니다.
 *
 *   node scripts/demo.mjs
 */
const PORT = process.env.AGENT_VIEW_PORT || 7878;
const URL_ = `http://127.0.0.1:${PORT}/api/hook`;

async function post(body) {
  await fetch(URL_, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

const SCRIPT = [
  { d: 0,    p: { hook_event_name: 'SessionStart', session_id: 'demo', cwd: '~/demo-project' } },
  { d: 300,  p: { hook_event_name: 'UserPromptSubmit', prompt: '부동산 시세 데이터 업데이트 좀 해줘' } },
  { d: 600,  p: { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ssh ubuntu@example.com \"sudo crontab -l\"' } } },
  { d: 700,  p: { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: {} } },
  { d: 800,  p: { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'src/cron/indicator_update.php' } } },
  { d: 900,  p: { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: {} } },
  { d: 1200, p: { hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'investigate', args: '' } } },
  { d: 2400, p: { hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'Explore', description: 'R-ONE WK 통계표 탐색' } } },
  { d: 3600, p: { hook_event_name: 'PreToolUse', tool_name: 'WebSearch', tool_input: { query: 'R-ONE 주간 STATBL_ID' } } },
  { d: 3700, p: { hook_event_name: 'PostToolUse', tool_name: 'WebSearch', tool_input: {} } },
  { d: 4800, p: { hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'Explore' } } },
  { d: 5400, p: { hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'ship', args: '' } } },
  { d: 6600, p: { hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'ship' } } },
  { d: 7400, p: { hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'investigate' } } },
  { d: 8200, p: { hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'design-review', args: '' } } },
  { d: 9800, p: { hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'design-review' } } },
  { d: 10400,p: { hook_event_name: 'SessionEnd' } },
];

let prev = 0;
for (const step of SCRIPT) {
  await wait(step.d - prev);
  prev = step.d;
  await post(step.p);
  process.stdout.write('.');
}
console.log('\n[demo] done');
