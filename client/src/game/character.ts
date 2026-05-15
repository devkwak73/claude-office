import * as PIXI from 'pixi.js';
import { CLAUDE_COLOR, colorForSkill, shortLabel } from './palette';
import type { Department } from './departments';
import type { StatusInfo } from './status';
import { IDLE } from './status';

export type CharacterState = 'idle' | 'walking' | 'working' | 'leaving';

export interface CharacterOpts {
  name: string;
  source: string;
  department: Department;
  isClaude?: boolean;
}

/**
 * 도형 기반 도트 풍 캐릭터.
 *   - 머리 위에 이름표 + 부서 칩
 *   - 이름표 아래에 상태 라벨 ("대기"/"작업중" 등)
 *   - 작업 시 옆에 말풍선으로 현재 도구/대상 텍스트
 */
export class Character {
  readonly view = new PIXI.Container();
  readonly name: string;
  readonly source: string;
  readonly department: Department;
  readonly color: number;
  readonly isClaude: boolean;
  state: CharacterState = 'idle';
  status: StatusInfo = IDLE;

  private body = new PIXI.Graphics();
  private legs = new PIXI.Graphics();
  private nameBg = new PIXI.Graphics();
  private nameTag: PIXI.Text;
  private statusChip = new PIXI.Graphics();
  private statusText: PIXI.Text;
  private bubble = new PIXI.Container();
  private bubbleBg = new PIXI.Graphics();
  private bubbleText: PIXI.Text;
  private walkPhase = Math.random() * Math.PI * 2;
  private statusPhase = 0;
  private bobAmt = 0;
  private facing: 1 | -1 = 1;

  constructor(opts: CharacterOpts) {
    this.name = opts.name;
    this.source = opts.source;
    this.department = opts.department;
    this.isClaude = !!opts.isClaude;
    this.color = this.isClaude ? CLAUDE_COLOR : colorForSkill(opts.name, opts.source);

    // 신체 (그림자 → 다리 → 몸통)
    this.view.addChild(this.legs);
    this.view.addChild(this.body);
    this.drawBody();
    this.drawLegs(0);

    // 이름표 — 머리 위 (더 크게)
    const fontSize = this.isClaude ? 16 : 13;
    this.nameTag = new PIXI.Text({
      text: shortLabel(this.name, this.isClaude ? 16 : 16),
      style: {
        fontFamily: 'Pretendard, system-ui, -apple-system, sans-serif',
        fontSize,
        fontWeight: '700',
        fill: this.isClaude ? 0xfff2c4 : 0xffffff,
        align: 'center',
      },
    });
    this.nameTag.anchor.set(0.5, 1);
    this.nameTag.y = -28;
    this.view.addChild(this.nameBg);
    this.view.addChild(this.nameTag);
    this.drawNameBg();

    // 상태 칩 (글자 크게)
    this.statusText = new PIXI.Text({
      text: this.status.label,
      style: {
        fontFamily: 'Pretendard, system-ui, sans-serif',
        fontSize: 11,
        fontWeight: '600',
        fill: 0xffffff,
        align: 'center',
      },
    });
    this.statusText.anchor.set(0.5, 0);
    this.statusText.y = -12;
    this.view.addChild(this.statusChip);
    this.view.addChild(this.statusText);
    this.drawStatusChip();

    // 작업 말풍선 (초기엔 숨김) — 글자 크게
    this.bubbleText = new PIXI.Text({
      text: '',
      style: {
        fontFamily: 'Pretendard, system-ui, sans-serif',
        fontSize: 12,
        fontWeight: '600',
        fill: 0x1a1a1a,
        align: 'left',
      },
    });
    this.bubbleText.anchor.set(0, 0.5);
    this.bubble.addChild(this.bubbleBg);
    this.bubble.addChild(this.bubbleText);
    this.bubble.visible = false;
    this.bubble.y = -66;
    this.view.addChild(this.bubble);
  }

  // ---------- 그리기 ----------

  private drawBody() {
    const g = this.body;
    g.clear();
    g.ellipse(0, 26, 12, 3).fill({ color: 0x000000, alpha: 0.35 });
    g.roundRect(-9, 0, 18, 18, 3).fill(this.color);
    g.rect(-9, 7, 18, 1).fill({ color: 0x000000, alpha: 0.18 });
    g.roundRect(-11, 2, 4, 12, 1.5).fill(this.color);
    g.roundRect(7, 2, 4, 12, 1.5).fill(this.color);
    g.circle(0, -6, 8).fill(this.isClaude ? 0xfff2c4 : 0xf4d8b3);
    g.arc(0, -8, 8, Math.PI, 0).fill(0x2a1d12);
    const eyeOffset = this.facing > 0 ? 0.5 : -0.5;
    g.circle(-3 + eyeOffset, -6, 1).fill(0x000);
    g.circle(3 + eyeOffset, -6, 1).fill(0x000);
    if (this.isClaude) {
      g.star(0, -16, 5, 4, 2).fill(0xffd166);
    }
  }

  private drawLegs(phase: number) {
    const g = this.legs;
    g.clear();
    const swing = Math.sin(phase) * 4;
    const lift = Math.max(0, Math.sin(phase)) * 2;
    const liftR = Math.max(0, -Math.sin(phase)) * 2;
    g.roundRect(-6, 18 - lift, 5, 8 + lift - swing * 0.2, 1.5).fill(0x2a3142);
    g.roundRect(1, 18 - liftR, 5, 8 + liftR + swing * 0.2, 1.5).fill(0x2a3142);
  }

  private drawNameBg() {
    const w = this.nameTag.width + 10;
    const h = this.nameTag.height + 4;
    const g = this.nameBg;
    g.clear();
    // 좌측 부서 색 띠
    g.roundRect(-w / 2 - 2, this.nameTag.y - h, 4, h, 1.5).fill(this.department.color);
    g.roundRect(-w / 2, this.nameTag.y - h, w, h, 3)
     .fill({ color: 0x000000, alpha: 0.75 });
  }

  private drawStatusChip() {
    const w = this.statusText.width + 8;
    const h = this.statusText.height + 2;
    const g = this.statusChip;
    g.clear();
    g.roundRect(-w / 2, this.statusText.y - 1, w, h + 1, h / 2)
     .fill({ color: this.status.color, alpha: 0.92 });
  }

  private drawBubble() {
    const padX = 7, padY = 4;
    const w = this.bubbleText.width + padX * 2;
    const h = this.bubbleText.height + padY * 2;
    this.bubbleText.x = -w / 2 + padX;
    this.bubbleText.y = 0;
    const g = this.bubbleBg;
    g.clear();
    g.roundRect(-w / 2, -h / 2, w, h, 4).fill(0xffffff).stroke({ color: 0x000, width: 1, alpha: 0.3 });
    // 꼬리
    g.moveTo(-3, h / 2).lineTo(0, h / 2 + 5).lineTo(3, h / 2).fill(0xffffff);
  }

  // ---------- 외부 API ----------

  setStatus(status: StatusInfo) {
    if (status.label === this.status.label && status.color === this.status.color) return;
    this.status = status;
    this.statusText.text = status.label;
    this.drawStatusChip();
  }

  setBubble(text: string) {
    if (!text) { this.bubble.visible = false; return; }
    this.bubbleText.text = text.slice(0, 24);
    this.drawBubble();
    this.bubble.visible = true;
  }

  clearBubble() { this.bubble.visible = false; }

  setState(s: CharacterState) {
    this.state = s;
    if (s !== 'walking' && s !== 'leaving') this.drawLegs(0);
  }

  setFacing(dir: 1 | -1) {
    if (dir === this.facing) return;
    this.facing = dir;
    this.drawBody();
  }

  /** dt: 초 단위 delta */
  tick(dt: number) {
    if (this.state === 'walking' || this.state === 'leaving') {
      this.walkPhase += dt * 10;
      this.drawLegs(this.walkPhase);
      this.bobAmt = Math.abs(Math.sin(this.walkPhase)) * -1.2;
    } else if (this.state === 'working') {
      this.walkPhase += dt * 3;
      this.bobAmt = Math.sin(this.walkPhase) * 0.6;
    } else {
      // idle — 살짝 호흡
      this.walkPhase += dt * 1.5;
      this.bobAmt = Math.sin(this.walkPhase) * 0.4;
    }
    this.body.y = this.bobAmt;
    this.legs.y = this.bobAmt;

    // 상태 칩 펄스
    if (this.status.pulse) {
      this.statusPhase += dt * 6;
      this.statusChip.alpha = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(this.statusPhase));
    } else if (this.statusChip.alpha !== 1) {
      this.statusChip.alpha = 1;
    }
  }
}
