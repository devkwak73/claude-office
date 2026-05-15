import * as PIXI from 'pixi.js';
import { Character, type CharacterState } from './character';
import { DEPARTMENTS, classifySkill, getDepartment, type Department } from './departments';
import { IDLE, WAIT, LEAVE, WALK, statusForTool, detailForTool, WORK } from './status';
import type { NormalizedEvent, SkillEntry } from '../types';

interface Slot { x: number; y: number; taken?: Character; }

interface DeptZone {
  dept: Department;
  x: number;
  y: number;
  w: number;
  h: number;
  desks: Slot[];     // 작업 슬롯 (책상)
}

interface Waypoint { x: number; y: number; }

interface CharacterSlot {
  ch: Character;
  /** 현재 점유한 슬롯 (deskSlot 또는 waitSlot) — leaving이면 undefined */
  occupying?: { kind: 'desk'; zone: DeptZone; idx: number } | { kind: 'wait'; idx: number };
  path: Waypoint[];
  retireTimer?: ReturnType<typeof setTimeout>;
  chatTimer?: ReturnType<typeof setTimeout>;
  leaving?: boolean;
  /** path 끝났을 때 표시할 말풍선 텍스트 */
  arrivalBubble?: string;
}

const STAGE_W = 1440;
const STAGE_H = 900;
const HEADER_H = 16;

// 가운데 Claude 자리
const CLAUDE_X = STAGE_W / 2;
const CLAUDE_Y = 180;

// 대기실 영역 (하단)
const WAITING_Y = 540;
const WAITING_H = 340;

// 부서 책상 박스 — 컴팩트하게 (책상 2~4개씩만)
const ZONE_LAYOUT: Array<{ id: string; x: number; y: number; w: number; h: number; cols: number; rows: number }> = [
  { id: 'plan',     x: 20,   y: 30, w: 280, h: 180, cols: 3, rows: 2 },
  { id: 'design',   x: 320,  y: 30, w: 280, h: 180, cols: 3, rows: 2 },
  { id: 'qa',       x: 840,  y: 30, w: 280, h: 180, cols: 3, rows: 2 },
  { id: 'dev',      x: 1140, y: 30, w: 280, h: 180, cols: 3, rows: 2 },
  { id: 'meeting',  x: 480,  y: 230, w: 480, h: 100, cols: 5, rows: 1 },
  { id: 'content',  x: 20,   y: 340, w: 580, h: 180, cols: 6, rows: 2 },
  { id: 'research', x: 620,  y: 340, w: 500, h: 180, cols: 5, rows: 2 },
  { id: 'misc',     x: 1140, y: 340, w: 280, h: 180, cols: 3, rows: 2 },
];

// 슬롯 그리드 셀
const SLOT_W = 86;
const SLOT_H = 78;

const SMALL_TALK = [
  '☕ 커피 한 잔?',
  '😴 졸리네...',
  '💬 다음 호출 대기',
  '🎵 흠~ 흠~',
  '📚 책 좀 볼까',
  '🥱 하품',
  '👀 다들 뭐하지',
  '🍪 간식 시간',
  '😎 여유롭다',
  '🤔 무슨 일 올까',
];

export class Office {
  readonly app: PIXI.Application;
  private bg = new PIXI.Container();
  private floor = new PIXI.Container();
  private layer = new PIXI.Container();
  private slots = new Map<string, CharacterSlot>();
  private skillIndex = new Map<string, SkillEntry>();
  private zonesByDept = new Map<string, DeptZone>();
  private waitSlots: Slot[] = [];
  private logCallback?: (line: string) => void;

  constructor() {
    this.app = new PIXI.Application();
  }

  async mount(el: HTMLElement) {
    await this.app.init({
      width: STAGE_W,
      height: STAGE_H,
      background: 0x12151c,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    el.appendChild(this.app.canvas);
    this.app.stage.addChild(this.bg);
    this.app.stage.addChild(this.floor);
    this.app.stage.addChild(this.layer);
    this.drawBackground();
    this.buildZones();
    this.buildWaitingRoom();
    this.placeClaude();
    this.app.ticker.add(this.tick);

    const ro = new ResizeObserver(() => this.fit(el));
    ro.observe(el);
    this.fit(el);
  }

  setSkills(skills: SkillEntry[]) {
    for (const s of skills) this.skillIndex.set(s.name, s);
  }

  onLog(cb: (line: string) => void) { this.logCallback = cb; }

  private fit(el: HTMLElement) {
    const w = el.clientWidth;
    const h = el.clientHeight;
    const scale = Math.min(w / STAGE_W, h / STAGE_H);
    this.app.stage.scale.set(scale);
    this.app.renderer.resize(STAGE_W * scale, STAGE_H * scale);
  }

  // ---------- 배경 ----------

  private drawBackground() {
    const g = new PIXI.Graphics();
    g.rect(0, 0, STAGE_W, STAGE_H).fill(0x12151c);
    this.bg.addChild(g);
  }

  // ---------- 부서 책상 ----------

  private buildZones() {
    for (const layout of ZONE_LAYOUT) {
      const dept = getDepartment(layout.id);
      const zone: DeptZone = {
        dept, x: layout.x, y: layout.y, w: layout.w, h: layout.h, desks: [],
      };
      const padX = 16, padY = 36;
      const colSpace = (layout.w - padX * 2) / layout.cols;
      const rowSpace = (layout.h - padY - 16) / layout.rows;
      for (let r = 0; r < layout.rows; r++) {
        for (let c = 0; c < layout.cols; c++) {
          zone.desks.push({
            x: layout.x + padX + colSpace * (c + 0.5),
            y: layout.y + padY + rowSpace * (r + 0.5),
          });
        }
      }
      this.zonesByDept.set(layout.id, zone);
      this.drawZone(zone);
    }
  }

  private drawZone(z: DeptZone) {
    const g = new PIXI.Graphics();
    g.roundRect(z.x, z.y, z.w, z.h, 10).fill(z.dept.bgColor);
    g.roundRect(z.x, z.y, z.w, 3, 2).fill(z.dept.color);
    this.floor.addChild(g);

    // 책상 그리기 (각 슬롯에 작은 책상)
    for (const desk of z.desks) {
      const dg = new PIXI.Graphics();
      dg.roundRect(desk.x - 22, desk.y + 2, 44, 6, 2).fill(0x6b4a2b);
      dg.roundRect(desk.x - 22, desk.y + 6, 44, 2, 1).fill({ color: 0x000, alpha: 0.3 });
      this.floor.addChild(dg);
    }

    const label = new PIXI.Text({
      text: `${z.dept.icon} ${z.dept.label}`,
      style: { fontFamily: 'Pretendard, sans-serif', fontSize: 14, fontWeight: '700', fill: z.dept.color },
    });
    label.x = z.x + 12;
    label.y = z.y + 10;
    this.floor.addChild(label);
  }

  // ---------- 대기실 ----------

  private buildWaitingRoom() {
    // 배경
    const g = new PIXI.Graphics();
    g.roundRect(20, WAITING_Y, STAGE_W - 40, WAITING_H, 12).fill(0x1f2530);
    g.roundRect(20, WAITING_Y, STAGE_W - 40, 3, 2).fill(0x60a5fa);

    // 카페트 무늬
    for (let y = WAITING_Y + 60; y < WAITING_Y + WAITING_H - 10; y += 8) {
      g.rect(40, y, STAGE_W - 80, 1).fill({ color: 0xffffff, alpha: 0.02 });
    }

    // 테이블 + 소파 장식
    const couchY = WAITING_Y + 60;
    for (const cx of [180, 720, 1260]) {
      // 라운드 테이블
      g.circle(cx, couchY + 110, 22).fill(0x4a4538).stroke({ color: 0x2a2620, width: 1 });
      // 의자 (작은 원)
      g.circle(cx - 40, couchY + 110, 9).fill(0x3a4252);
      g.circle(cx + 40, couchY + 110, 9).fill(0x3a4252);
      g.circle(cx, couchY + 70, 9).fill(0x3a4252);
      g.circle(cx, couchY + 150, 9).fill(0x3a4252);
    }
    this.floor.addChild(g);

    const label = new PIXI.Text({
      text: '🛋️ 대기실 / 휴게실',
      style: { fontFamily: 'Pretendard, sans-serif', fontSize: 15, fontWeight: '700', fill: 0x60a5fa },
    });
    label.x = 32;
    label.y = WAITING_Y + 12;
    this.floor.addChild(label);

    const hint = new PIXI.Text({
      text: '호출 안 받은 친구들이 모여서 쉬는 곳',
      style: { fontFamily: 'Pretendard, sans-serif', fontSize: 11, fill: 0x8a93a3 },
    });
    hint.x = 200;
    hint.y = WAITING_Y + 16;
    this.floor.addChild(hint);

    // 슬롯 그리드
    const padX = 50;
    const padY = 50;
    const cols = 14;
    const rows = 3;
    const colSpace = (STAGE_W - 40 - padX * 2) / cols;
    const rowSpace = (WAITING_H - padY - 30) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // 테이블 자리는 스킵
        const x = 20 + padX + colSpace * (c + 0.5);
        const y = WAITING_Y + padY + rowSpace * (r + 0.5);
        // 테이블 좌표 부근(180, 720, 1260, y=couchY+110≈730)은 스킵
        const nearTable = [180, 720, 1260].some(tx => Math.abs(tx - x) < 50 && Math.abs(couchY + 110 - y) < 40);
        if (nearTable) continue;
        this.waitSlots.push({ x, y });
      }
    }
  }

  // ---------- Claude ----------

  private placeClaude() {
    const g = new PIXI.Graphics();
    g.roundRect(CLAUDE_X - 100, CLAUDE_Y - 6, 200, 24, 5).fill(0x6b4a2b).stroke({ color: 0x3d2614, width: 1 });
    g.roundRect(CLAUDE_X - 100 + 3, CLAUDE_Y - 6 + 24, 200, 8, 2).fill({ color: 0x000, alpha: 0.3 });
    for (const dx of [-36, 36]) {
      g.roundRect(CLAUDE_X + dx - 16, CLAUDE_Y - 38, 32, 24, 2).fill(0x1c1f25).stroke({ color: 0x000, width: 1 });
      g.rect(CLAUDE_X + dx - 14, CLAUDE_Y - 36, 28, 20).fill(0x4ade80);
    }
    this.floor.addChild(g);
    const tag = new PIXI.Text({
      text: '🌟 CLAUDE',
      style: { fontFamily: 'Pretendard, sans-serif', fontSize: 13, fontWeight: '700', fill: 0xffd166 },
    });
    tag.anchor.set(0.5, 0);
    tag.x = CLAUDE_X;
    tag.y = CLAUDE_Y + 24;
    this.floor.addChild(tag);

    const ch = new Character({
      name: 'Claude', source: 'claude',
      department: { id: 'claude', label: 'Claude', icon: '🌟', color: 0xffd166, bgColor: 0x2a2418 },
      isClaude: true,
    });
    ch.view.x = CLAUDE_X;
    ch.view.y = CLAUDE_Y - 20;
    ch.setState('working');
    ch.setStatus(WORK);
    this.layer.addChild(ch.view);
    this.slots.set('__claude__', { ch, path: [] });
  }

  // ---------- 슬롯 할당 ----------

  private allocateDesk(zone: DeptZone): number {
    return zone.desks.findIndex(s => !s.taken);
  }

  private allocateWait(): number {
    return this.waitSlots.findIndex(s => !s.taken);
  }

  // ---------- 라이프사이클 ----------

  /** 도구/스킬 호출 — 캐릭터가 없으면 입구에서 등장, 있으면 대기실 → 책상 이동. */
  startWork(name: string, source: string, status = WORK, bubbleText = '') {
    let slot = this.slots.get(name);
    const deptId = classifySkill(name, source);
    const zone = this.zonesByDept.get(deptId) ?? this.zonesByDept.get('misc')!;

    if (!slot) {
      // 신규 등장: 입구 → 책상
      const deskIdx = this.allocateDesk(zone);
      if (deskIdx < 0) { this.log(`자리 부족: ${name}`); return; }
      const desk = zone.desks[deskIdx];
      const ch = new Character({ name, source, department: zone.dept });
      ch.view.x = -40;
      ch.view.y = STAGE_H - 50;
      ch.setState('walking');
      ch.setStatus(WALK);
      ch.setBubble('🚪 출근!');
      this.layer.addChild(ch.view);
      zone.desks[deskIdx].taken = ch;
      slot = {
        ch,
        occupying: { kind: 'desk', zone, idx: deskIdx },
        path: [
          { x: desk.x, y: STAGE_H - 50 },
          { x: desk.x, y: desk.y - 18 },
        ],
        arrivalBubble: bubbleText || '작업중',
      };
      this.slots.set(name, slot);
      return;
    }

    // 기존 캐릭터: 재호출
    if (slot.retireTimer) { clearTimeout(slot.retireTimer); slot.retireTimer = undefined; }
    if (slot.chatTimer)   { clearTimeout(slot.chatTimer);   slot.chatTimer = undefined; }
    slot.leaving = false;

    if (slot.occupying?.kind === 'desk') {
      // 이미 책상에 있음 — 상태만 갱신
      slot.ch.setStatus(status);
      if (bubbleText) slot.ch.setBubble(bubbleText);
      return;
    }

    // 대기실에 있던 캐릭터 → 책상으로 호출
    const deskIdx = this.allocateDesk(zone);
    if (deskIdx < 0) {
      // 자리 없으면 대기실에 그대로
      slot.ch.setStatus(status);
      if (bubbleText) slot.ch.setBubble(bubbleText);
      return;
    }
    // 대기실 슬롯 비우기
    if (slot.occupying?.kind === 'wait') {
      this.waitSlots[slot.occupying.idx].taken = undefined;
    }
    const desk = zone.desks[deskIdx];
    zone.desks[deskIdx].taken = slot.ch;
    slot.occupying = { kind: 'desk', zone, idx: deskIdx };
    slot.ch.setBubble('🏃 나 갈게~');
    slot.ch.setState('walking');
    slot.ch.setStatus(WALK);
    // 경로: 현재 위치 → 복도(WAITING_Y - 30) → 책상 x → 책상 자리
    const corridorY = WAITING_Y - 30;
    slot.path = [
      { x: slot.ch.view.x, y: corridorY },
      { x: desk.x, y: corridorY },
      { x: desk.x, y: desk.y - 18 },
    ];
    slot.arrivalBubble = bubbleText || '작업중';
  }

  /** 작업 종료 — 책상 → 대기실로 이동. */
  endWork(name: string) {
    const slot = this.slots.get(name);
    if (!slot) return;
    if (slot.occupying?.kind !== 'desk') return;
    // 책상 비우기
    const { zone, idx } = slot.occupying;
    zone.desks[idx].taken = undefined;

    // 대기실 슬롯 할당
    const waitIdx = this.allocateWait();
    if (waitIdx < 0) {
      // 대기실 자리 없으면 그냥 퇴근
      this.retire(name);
      return;
    }
    this.waitSlots[waitIdx].taken = slot.ch;
    slot.occupying = { kind: 'wait', idx: waitIdx };
    slot.ch.setBubble('✓ 끝! 쉬러가자');
    slot.ch.setState('walking');
    slot.ch.setStatus(WALK);
    // 경로: 책상 → 복도 → 대기실 슬롯 x → 대기실 슬롯 자리
    const target = this.waitSlots[waitIdx];
    const corridorY = WAITING_Y - 30;
    slot.path = [
      { x: slot.ch.view.x, y: corridorY },
      { x: target.x, y: corridorY },
      { x: target.x, y: target.y },
    ];
    slot.arrivalBubble = '';

    // 1분 후 자동 퇴근 (또는 빠른 데모용으로 조정 가능)
    if (slot.retireTimer) clearTimeout(slot.retireTimer);
    slot.retireTimer = setTimeout(() => this.retire(name), 60_000);
  }

  /** 즉시 퇴근 — 출구로 걸어나가서 layer에서 제거 */
  private retire(name: string) {
    const slot = this.slots.get(name);
    if (!slot) return;
    if (slot === this.slots.get('__claude__')) return;
    if (slot.occupying?.kind === 'desk') {
      slot.occupying.zone.desks[slot.occupying.idx].taken = undefined;
    } else if (slot.occupying?.kind === 'wait') {
      this.waitSlots[slot.occupying.idx].taken = undefined;
    }
    slot.occupying = undefined;
    slot.retireTimer = undefined;
    if (slot.chatTimer) { clearTimeout(slot.chatTimer); slot.chatTimer = undefined; }
    slot.leaving = true;
    slot.ch.setState('leaving');
    slot.ch.setStatus(LEAVE);
    slot.ch.setBubble('👋 안녕히~');
    const corridorY = STAGE_H - 50;
    slot.path = [
      { x: slot.ch.view.x, y: corridorY },
      { x: STAGE_W + 60, y: corridorY },
    ];
  }

  pulseClaude(active: boolean, label?: string) {
    const claude = this.slots.get('__claude__');
    if (!claude) return;
    if (active) {
      claude.ch.setStatus(WORK);
      if (label) claude.ch.setBubble(label);
    } else {
      claude.ch.setStatus(IDLE);
      claude.ch.clearBubble();
    }
  }

  log(s: string) { this.logCallback?.(s); }

  handleEvent(ev: NormalizedEvent) {
    switch (ev.kind) {
      case 'skill_start':
        if (ev.target) this.startWork(ev.target, this.skillIndex.get(ev.target)?.source ?? 'skill', WORK, ev.detail || '작업중');
        this.pulseClaude(true, `🔧 ${ev.target ?? ''}`);
        break;
      case 'skill_end':
        if (ev.target) this.endWork(ev.target);
        break;
      case 'subagent_start':
        if (ev.target) this.startWork(`agent:${ev.target}`, 'subagent', { ...WORK, label: '위임중', color: 0xf472b6 }, ev.detail || '');
        this.pulseClaude(true, `👤 ${ev.target ?? ''}`);
        break;
      case 'subagent_end':
        if (ev.target) this.endWork(`agent:${ev.target}`);
        break;
      case 'tool_start': {
        const tool = ev.target ?? '';
        const status = statusForTool(tool);
        this.pulseClaude(true, `${status.label} · ${ev.detail || tool}`);
        const claude = this.slots.get('__claude__');
        if (claude) claude.ch.setStatus(status);
        break;
      }
      case 'tool_end':
        this.pulseClaude(false);
        break;
      case 'user_prompt':
        this.pulseClaude(true, '💭 분석중');
        break;
      case 'session_start':
      case 'session_stop':
        this.pulseClaude(false);
        break;
    }
  }

  // ---------- 메인 루프 ----------

  private scheduleSmallTalk(key: string, slot: CharacterSlot) {
    if (slot.chatTimer) return;
    const delay = 3000 + Math.random() * 8000;
    slot.chatTimer = setTimeout(() => {
      slot.chatTimer = undefined;
      // 여전히 대기실에 있을 때만
      if (slot.occupying?.kind === 'wait' && !slot.leaving && slot.path.length === 0) {
        const line = SMALL_TALK[Math.floor(Math.random() * SMALL_TALK.length)];
        slot.ch.setBubble(line);
        // 2.5초 후 다시 회색 "대기중"
        setTimeout(() => {
          if (slot.occupying?.kind === 'wait' && slot.path.length === 0 && !slot.leaving) {
            slot.ch.setBubble('대기중');
          }
        }, 2500);
        this.scheduleSmallTalk(key, slot);
      }
    }, delay);
  }

  private tick = (ticker: PIXI.Ticker) => {
    const dt = ticker.deltaMS / 1000;
    for (const [key, slot] of this.slots) {
      const { ch } = slot;
      const next = slot.path[0];
      if (next) {
        const dx = next.x - ch.view.x;
        const dy = next.y - ch.view.y;
        const dist = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.5) ch.setFacing(dx > 0 ? 1 : -1);
        if (dist > 1) {
          const step = Math.min(dist, 180 * dt);
          ch.view.x += (dx / dist) * step;
          ch.view.y += (dy / dist) * step;
        } else {
          ch.view.x = next.x;
          ch.view.y = next.y;
          slot.path.shift();
          if (slot.path.length === 0) {
            if (slot.leaving) {
              this.layer.removeChild(ch.view);
              this.slots.delete(key);
              continue;
            }
            ch.setState('idle');
            if (slot.occupying?.kind === 'desk') {
              ch.setStatus(WORK);
              ch.setBubble(slot.arrivalBubble || '작업중');
            } else if (slot.occupying?.kind === 'wait') {
              ch.setStatus(WAIT);
              ch.setBubble('대기중');
              this.scheduleSmallTalk(key, slot);
            }
            slot.arrivalBubble = undefined;
          }
        }
      }
      ch.tick(dt);
    }
  };
}
