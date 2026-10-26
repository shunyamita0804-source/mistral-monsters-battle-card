import { getMonster, skillsOf } from '../../data/cards.ts';
import { getDungeon } from '../../data/dungeons.ts';
import { DUNGEON_RUN, runBossOpponent, runGuardianOpponent, runNpcOpponent } from '../../data/dungeonRun.ts';
import type { OpponentDefinition } from '../../data/tournaments.ts';
import { isDeckValid } from '../../game/deck/deck.ts';
import type { DungeonFloor, FloorEntity } from '../../game/dungeon/generate.ts';
import {
  activeEntities,
  descend,
  entityAt,
  facingPoint,
  isLastFloor,
  loseRunBattle,
  move,
  nearGuardian,
  openRunChest,
  rewardCandidates,
  runFloor,
  sanitizeRun,
  winRunBattle,
  type BattleTargetKind,
} from '../../game/dungeon/run.ts';
import type { Direction, DungeonRun } from '../../game/save/saveData.ts';
import { DIR_ROW, IDLE_COL, PLAYER_SHEET_COLS, PLAYER_SHEET_ROWS, WALK_COLS } from '../../game/world/walkAnim.ts';
import { t } from '../../i18n/i18n.ts';
import { cardName, dungeonName, opponentName } from '../../i18n/content.ts';
import { bgm, type BgmId } from '../bgm.ts';
import { showDungeonIntro } from '../components/dungeonIntro.ts';
import { confirmModal, messageModal, openModal } from '../components/modal.ts';
import { h } from '../dom.ts';
import type { GameStore } from '../gameStore.ts';
import { sound } from '../sound.ts';
import { PLAYER_SHEET } from './worldScreen.ts';
import type { ScreenContext, ScreenDefinition } from './types.ts';
import dungeonBattleBg from '@assets/images/backgrounds/battle_dungeon.webp';
import bossBattleBg from '@assets/images/backgrounds/battle_boss.webp';
import encounterFx1 from '@assets/images/effects/fx_encounter_1.webp';
import encounterFx2 from '@assets/images/effects/fx_encounter_2.webp';
import encounterFx3 from '@assets/images/effects/fx_encounter_3.webp';

/**
 * ランダム生成のダンジョンの画面（2026-10-26 試作「ミスモンBC ダンジョン試作（たたき台）」。GB 版のダンジョンを参考に）。
 * - 見下ろしで1マスずつ歩く。最初は真っ暗で、自分と隣のマスだけ見える。見たマスは暗めに残り、右上の地図（ミニマップ）にも残る
 * - 画面の下に十字キー（押しっぱなしで歩き続ける）・A ボタン（向いている方に話す・宝箱を開ける）・B ボタン（メニュー。仮）
 * - バトラー・ボスに A で対戦。見えない番人は近づくと画面の端が揺れて「！」、1歩ごとの抽選で対戦
 * ルールは src/game/dungeon/（DOM に依存しない）。数値は src/data/dungeonRun.ts
 */
export const dungeonRunScreen: ScreenDefinition = {
  id: 'dungeonRun',
  titleKey: 'dungeonRun.title',
  create(ctx) {
    const element = h('main', { class: 'screen drun' });
    const view = new DungeonRunView(ctx, element);
    view.load();
    return { element, destroy: () => view.destroy() };
  },
};

/** 1マスの大きさ（論理px） */
const TILE = 48;
/** 床・壁の絵（つなげて敷ける絵）を何マスごとに敷くか */
const TEXTURE_TILES = 4;
/** 1歩の動きの長さ（ミリ秒。押しっぱなしの1歩の間隔より少し短く） */
const STEP_MS = 150;
/** ミニマップの1マスの大きさ（px） */
const MINI_CELL = 3;
/** 主人公の絵の高さ（論理px）と、1コマの縦横比（シート 310×360） */
const PLAYER_H = 70;
const PLAYER_W = Math.round((PLAYER_H * 310) / 360);
/** 主人公の足元（コマの中の位置の割合。シートの足元 (155, 338)） */
const FOOT_Y_RATIO = 338 / 360;
/** 「！」を出しておく時間（ミリ秒） */
const OMEN_MARK_MS = 900;
/** 対戦に入るときの光（歩行画面と同じ3コマ） */
const ENCOUNTER_FRAME_MS = 90;
const ENCOUNTER_WHITE_MS = 220;
/** 階に入ったときの帯 */
const BANNER_MS = 2200;
/** ダンジョンごとの BGM（歩行画面の DUNGEON_BGM と同じ） */
const RUN_BGM: Readonly<Record<string, BgmId>> = { 'dungeon-01': 'dungeonRuins', 'dungeon-02': 'dungeonForest' };

const DIRS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const KEY_DIR: Readonly<Record<string, Direction>> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

class DungeonRunView {
  readonly #ctx: ScreenContext;
  readonly #store: GameStore;
  readonly #root: HTMLElement;
  /** マス・置いてあるものを並べる層（主人公が真ん中に来るように動かす） */
  readonly #world = h('div', { class: 'drun__world' });
  readonly #view = h('div', { class: 'drun__view' }, this.#world);
  readonly #player = h('div', { class: 'drun__player', attrs: { 'aria-hidden': 'true' } });
  readonly #omenMark = h('div', { class: 'drun__omen-mark', attrs: { 'aria-hidden': 'true' } });
  readonly #omenEdge = h('div', { class: 'drun__omen-edge', attrs: { 'aria-hidden': 'true' } });
  readonly #place = h('p', { class: 'drun__place' });
  readonly #losses = h('span', { class: 'drun__chip' });
  readonly #gained = h('span', { class: 'drun__chip' });
  readonly #mini = h('canvas', { class: 'drun__minimap', attrs: { role: 'img', 'aria-label': t('dungeonRun.minimap') } });
  readonly #live = h('p', { class: 'drun__live', attrs: { 'aria-live': 'polite' } });
  #tiles: HTMLElement[] = [];
  readonly #entityEls = new Map<string, HTMLElement>();
  #floor: DungeonFloor | null = null;
  /** いま見えている（明るい）マスの番号 */
  #lit: number[] = [];
  /** 会話・確認・対戦への切り替えの間は歩かない */
  #busy = false;
  /** 押している十字キーの向き */
  #held: Direction | null = null;
  #holdTimer = 0;
  #raf = 0;
  /** 歩き始めた時刻・最後に1歩進んだ時刻（コマ送り用） */
  #walkStart = 0;
  #lastStep = -Infinity;
  #omen = false;
  #destroyed = false;
  readonly #onKeyDown = (e: KeyboardEvent): void => this.#keyDown(e);
  readonly #onKeyUp = (e: KeyboardEvent): void => {
    if (KEY_DIR[e.key] && KEY_DIR[e.key] === this.#held) this.#release();
  };

  constructor(ctx: ScreenContext, root: HTMLElement) {
    this.#ctx = ctx;
    this.#store = ctx.store;
    this.#root = root;
  }

  get #run(): DungeonRun {
    return this.#store.save.dungeonRun as DungeonRun;
  }

  load(): void {
    // 中断したセーブから再開：同じ階・同じ位置から（壊れていれば階のスタート）
    this.#store.update((s) => (s.dungeonRun ? { ...s, dungeonRun: sanitizeRun(s.dungeonRun) } : s));
    const run = this.#store.save.dungeonRun;
    if (!run) {
      // 続けられない挑戦だった：画面を組み立て終えてから歩行画面へ
      queueMicrotask(() => this.#ctx.reset('world'));
      return;
    }
    const dungeon = getDungeon(run.dungeonId);
    bgm.play(RUN_BGM[run.dungeonId] ?? 'dungeon');
    sound.ambient(run.dungeonId === 'dungeon-02' ? null : 'drip');
    this.#player.style.backgroundImage = `url("${PLAYER_SHEET[this.#store.save.player.gender === 'female' ? 'female' : 'male']}")`;
    this.#player.style.backgroundSize = `${PLAYER_W * PLAYER_SHEET_COLS}px ${PLAYER_H * PLAYER_SHEET_ROWS}px`;
    this.#root.append(
      this.#view,
      h('div', { class: 'drun__light', attrs: { 'aria-hidden': 'true' } }),
      this.#omenEdge,
      this.#player,
      this.#omenMark,
      h('header', { class: 'drun__hud' }, this.#place, h('div', { class: 'drun__chips' }, this.#losses, this.#gained)),
      this.#mini,
      this.#controls(),
      this.#live,
    );
    this.#buildFloor();
    this.#setOmen(nearGuardian(run, runFloor(run)));
    window.addEventListener('keydown', this.#onKeyDown);
    window.addEventListener('keyup', this.#onKeyUp);
    this.#raf = requestAnimationFrame((now) => this.#frame(now));
    // 画面に置かれてから大きさが分かるので、もう一度カメラを合わせる
    requestAnimationFrame(() => {
      if (!this.#destroyed) this.#refresh(false);
    });

    // ダンジョンに入った直後：挿絵とダンジョン名。対戦から戻ったとき：結果のお知らせ
    const intro = this.#store.dungeonIntro;
    this.#store.dungeonIntro = null;
    const flash = this.#store.flashMessage;
    this.#store.flashMessage = null;
    if (intro && dungeon) {
      this.#busy = true;
      showDungeonIntro(this.#root, dungeon, () => {
        this.#busy = false;
        this.#floorBanner();
      });
    } else if (flash) {
      this.#message(flash);
    } else {
      this.#floorBanner();
    }
  }

  destroy(): void {
    this.#destroyed = true;
    cancelAnimationFrame(this.#raf);
    clearTimeout(this.#holdTimer);
    window.removeEventListener('keydown', this.#onKeyDown);
    window.removeEventListener('keyup', this.#onKeyUp);
    sound.ambient(null);
  }

  // ===== 組み立て =====

  /** 十字キー・A・B */
  #controls(): HTMLElement {
    const arrows = DIRS.map((d) => h('span', { class: `drun__pad-arrow drun__pad-arrow--${d}` }));
    const pad = h('div', { class: 'drun__pad', attrs: { role: 'group', 'aria-label': t('dungeonRun.padLabel') } }, h('span', { class: 'drun__pad-cross' }), ...arrows);
    // 押した位置で向きを決める（指を滑らせると向きが変わる）。真ん中の小さな範囲は向きなし
    const dirAt = (e: PointerEvent): Direction | null => {
      const r = pad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) < r.width * 0.1) return null;
      return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    };
    const showPressed = (d: Direction | null): void => {
      for (const [i, a] of arrows.entries()) a.classList.toggle('is-on', DIRS[i] === d);
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pad.setPointerCapture?.(e.pointerId);
      const d = dirAt(e);
      showPressed(d);
      if (d) this.#press(d);
    });
    pad.addEventListener('pointermove', (e) => {
      if (!pad.hasPointerCapture?.(e.pointerId)) return;
      const d = dirAt(e);
      showPressed(d);
      if (d && d !== this.#held) this.#press(d);
      else if (!d) this.#release();
    });
    const up = (): void => {
      showPressed(null);
      this.#release();
    };
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    pad.addEventListener('lostpointercapture', up);

    const a = h('button', { class: 'drun__btn drun__btn--a', text: 'A', attrs: { type: 'button', 'aria-label': t('dungeonRun.buttonA') }, on: { click: () => this.#actA() } });
    const b = h('button', { class: 'drun__btn drun__btn--b', text: 'B', attrs: { type: 'button', 'aria-label': t('dungeonRun.buttonB') }, on: { click: () => this.#openMenu() } });
    return h('div', { class: 'drun__controls' }, pad, h('div', { class: 'drun__ab' }, b, a));
  }

  /** いまの階のマスと、置いてあるものを作り直す */
  #buildFloor(): void {
    const f = runFloor(this.#run);
    this.#floor = f;
    this.#world.replaceChildren();
    this.#entityEls.clear();
    this.#world.style.width = `${f.width * TILE}px`;
    this.#world.style.height = `${f.height * TILE}px`;
    const frag = document.createDocumentFragment();
    this.#tiles = [];
    for (let y = 0; y < f.height; y++) {
      for (let x = 0; x < f.width; x++) {
        const wall = f.tiles[y]?.[x] !== '.';
        const face = wall && f.tiles[y + 1]?.[x] === '.';
        const stairs = !!f.stairs && f.stairs.x === x && f.stairs.y === y;
        const el = h('div', { class: `drun__tile drun__tile--${wall ? 'wall' : 'floor'}${face ? ' drun__tile--face' : ''}${stairs ? ' drun__tile--stairs' : ''}` });
        el.style.left = `${x * TILE}px`;
        el.style.top = `${y * TILE}px`;
        el.style.setProperty('--tx', `${-(x % TEXTURE_TILES) * TILE}px`);
        el.style.setProperty('--ty', `${-(y % TEXTURE_TILES) * TILE}px`);
        this.#tiles.push(el);
        frag.append(el);
      }
    }
    for (const e of f.entities) {
      if (e.kind === 'guardian') continue;
      const el = h('div', { class: `drun__entity drun__entity--${e.kind}`, attrs: { 'aria-hidden': 'true' } });
      el.style.left = `${e.x * TILE}px`;
      el.style.top = `${e.y * TILE}px`;
      this.#entityEls.set(e.id, el);
      frag.append(el);
    }
    this.#world.append(frag);
    this.#mini.width = f.width * MINI_CELL;
    this.#mini.height = f.height * MINI_CELL;
    this.#lit = [];
    this.#refresh(false);
  }

  // ===== 表示の更新 =====

  /** 見たマス・見えているマス・置いてあるもの・カメラ・上の札・ミニマップを、いまの状態に合わせる */
  #refresh(animate: boolean): void {
    const f = this.#floor;
    if (!f) return;
    const run = this.#run;
    // 見たマス（暗め）と、いま見えているマス（明るい）
    for (const i of this.#lit) this.#tiles[i]?.classList.remove('is-lit');
    this.#lit = [];
    const r = DUNGEON_RUN.viewRadius;
    for (let y = run.y - r; y <= run.y + r; y++) {
      for (let x = run.x - r; x <= run.x + r; x++) {
        if (x < 0 || y < 0 || x >= f.width || y >= f.height) continue;
        const i = y * f.width + x;
        this.#tiles[i]?.classList.add('is-lit');
        this.#lit.push(i);
      }
    }
    for (let i = 0; i < this.#tiles.length; i++) {
      if (run.explored[i] === '1') this.#tiles[i]?.classList.add('is-seen');
    }
    // 置いてあるもの：見たマスにあれば見える（倒した相手は消える。開けた宝箱は開いた絵）
    const active = new Set(activeEntities(run, f).map((e) => e.id));
    for (const e of f.entities) {
      const el = this.#entityEls.get(e.id);
      if (!el) continue;
      const seen = run.explored[e.y * f.width + e.x] === '1';
      el.hidden = !seen || !active.has(e.id);
      el.classList.toggle('is-lit', Math.abs(e.x - run.x) <= r && Math.abs(e.y - run.y) <= r);
      el.classList.toggle('is-open', e.kind === 'chest' && run.opened.includes(e.id));
    }
    // カメラ：主人公のマスが画面の真ん中
    const cx = this.#view.clientWidth / 2 || 195;
    const cy = this.#view.clientHeight / 2 || 300;
    this.#world.style.transition = animate ? `transform ${STEP_MS}ms linear` : 'none';
    this.#world.style.transform = `translate(${Math.round(cx - (run.x + 0.5) * TILE)}px, ${Math.round(cy - (run.y + 0.5) * TILE)}px)`;
    // 主人公：足元がマスの下の方に来るように
    const viewTop = this.#view.offsetTop;
    this.#player.style.left = `${Math.round(cx - PLAYER_W / 2)}px`;
    this.#player.style.top = `${Math.round(viewTop + cy + TILE * 0.32 - PLAYER_H * FOOT_Y_RATIO)}px`;
    this.#omenMark.style.left = `${Math.round(cx)}px`;
    this.#omenMark.style.top = `${Math.round(viewTop + cy + TILE * 0.32 - PLAYER_H - 6)}px`;
    // 上の札
    const dungeon = getDungeon(run.dungeonId);
    this.#place.textContent = t('world.placeDungeon', { dungeon: dungeon ? dungeonName(dungeon) : '', floor: t('dungeonRun.floorName', { n: run.floor + 1 }) });
    this.#losses.textContent = t('dungeonRun.losses', { n: run.losses, max: DUNGEON_RUN.maxLosses });
    this.#gained.textContent = t('dungeonRun.gained', { n: run.gained.length });
    this.#drawMinimap();
  }

  /** 右上の地図：見たマスだけ。自分（赤）・階段（青）・見たバトラー（橙）・宝箱（黄）・ボス（紫） */
  #drawMinimap(): void {
    const f = this.#floor;
    const g = this.#mini.getContext?.('2d');
    if (!f || !g) return;
    const run = this.#run;
    g.clearRect(0, 0, this.#mini.width, this.#mini.height);
    for (let y = 0; y < f.height; y++) {
      for (let x = 0; x < f.width; x++) {
        if (run.explored[y * f.width + x] !== '1') continue;
        g.fillStyle = f.tiles[y]?.[x] === '.' ? 'rgb(214 200 168 / 0.85)' : 'rgb(70 62 52 / 0.85)';
        g.fillRect(x * MINI_CELL, y * MINI_CELL, MINI_CELL, MINI_CELL);
      }
    }
    const dot = (x: number, y: number, color: string): void => {
      g.fillStyle = color;
      g.fillRect(x * MINI_CELL - 1, y * MINI_CELL - 1, MINI_CELL + 2, MINI_CELL + 2);
    };
    if (f.stairs && run.explored[f.stairs.y * f.width + f.stairs.x] === '1') dot(f.stairs.x, f.stairs.y, '#4aa8ff');
    const color: Readonly<Record<string, string>> = { npc: '#ff8a3d', chest: '#ffd84a', boss: '#c86bff' };
    for (const e of activeEntities(run, f)) {
      const c = color[e.kind];
      if (!c || run.explored[e.y * f.width + e.x] !== '1') continue;
      if (e.kind === 'chest' && run.opened.includes(e.id)) continue;
      dot(e.x, e.y, c);
    }
    dot(run.x, run.y, '#ff3b3b');
  }

  /** 主人公のコマ送り（歩いている間は歩きの8コマ、止まったら立ち止まりのコマ） */
  #frame(now: number): void {
    if (this.#destroyed) return;
    const walking = now - this.#lastStep < STEP_MS + 60;
    const col = walking ? Math.floor((now - this.#walkStart) / (STEP_MS / 4)) % WALK_COLS : IDLE_COL;
    const row = DIR_ROW[this.#store.save.dungeonRun?.dir ?? 'down'];
    this.#player.style.backgroundPosition = `${-col * PLAYER_W}px ${-row * PLAYER_H}px`;
    this.#raf = requestAnimationFrame((t2) => this.#frame(t2));
  }

  // ===== 操作 =====

  #keyDown(e: KeyboardEvent): void {
    const d = KEY_DIR[e.key];
    if (d) {
      e.preventDefault();
      if (!e.repeat && d !== this.#held) this.#press(d);
      return;
    }
    if (e.repeat) return;
    if (e.key === 'z' || e.key === 'Z' || e.key === ' ') this.#actA();
    else if (e.key === 'x' || e.key === 'X') this.#openMenu();
  }

  /** 十字キーを押した：すぐ1歩。押しっぱなしなら少し待ってから続けて歩く */
  #press(d: Direction): void {
    this.#held = d;
    clearTimeout(this.#holdTimer);
    this.#step();
    const repeat = (delay: number): void => {
      this.#holdTimer = window.setTimeout(() => {
        if (!this.#held || this.#destroyed) return;
        this.#step();
        repeat(DUNGEON_RUN.stepRepeatMs);
      }, delay);
    };
    repeat(DUNGEON_RUN.holdDelayMs);
  }

  #release(): void {
    this.#held = null;
    clearTimeout(this.#holdTimer);
  }

  /** 押している向きへ1歩 */
  #step(): void {
    const d = this.#held;
    if (!d || this.#busy || !this.#store.save.dungeonRun) return;
    const r = move(this.#run, d);
    this.#store.update((s) => ({ ...s, dungeonRun: r.run }));
    if (r.moved) {
      const now = performance.now();
      if (now - this.#lastStep > STEP_MS + 60) this.#walkStart = now;
      this.#lastStep = now;
      sound.step(groundOf(this.#run.dungeonId), false);
    }
    this.#refresh(r.moved);
    this.#setOmen(r.omen);
    if (r.guardian) {
      this.#release();
      this.#guardianAppears(r.guardian);
    } else if (r.onStairs) {
      this.#release();
      this.#askStairs();
    }
  }

  /** 見えない番人の気配：画面の端が揺れて、気配が出た瞬間に「！」 */
  #setOmen(on: boolean): void {
    if (on === this.#omen) return;
    this.#omen = on;
    this.#root.classList.toggle('is-omen', on);
    if (on) {
      this.#showMark();
      this.#live.textContent = t('dungeonRun.omen');
    }
  }

  #showMark(): void {
    this.#omenMark.textContent = t('dungeonRun.omenMark');
    this.#omenMark.classList.remove('is-on');
    void this.#omenMark.offsetWidth;
    this.#omenMark.classList.add('is-on');
    setTimeout(() => this.#omenMark.classList.remove('is-on'), OMEN_MARK_MS);
  }

  /** A ボタン：向いている先のバトラー・ボスと対戦、宝箱を開ける。階段の上なら下りるか聞く */
  #actA(): void {
    if (this.#busy || !this.#store.save.dungeonRun) return;
    const run = this.#run;
    const f = runFloor(run);
    const p = facingPoint(run);
    const target = entityAt(run, f, p.x, p.y);
    if (target?.kind === 'chest') return this.#openChest(target);
    if (target?.kind === 'npc' || target?.kind === 'boss') return this.#talk(target);
    if (f.stairs && f.stairs.x === run.x && f.stairs.y === run.y) this.#askStairs();
  }

  #openChest(chest: FloorEntity): void {
    const r = openRunChest(this.#run, chest.id);
    if (!r.opened) {
      this.#message(t('world.chestAlreadyEmpty'));
      return;
    }
    this.#store.update((s) => ({ ...s, dungeonRun: r.run }));
    sound.play('chestUnlock');
    sound.play('chestOpenWood', 280);
    this.#refresh(false);
    // 【仮】中身はまだ決まっていない（推測で決めない）
    this.#message(t('dungeonRun.chestOpened'));
  }

  /** バトラー・ボスに話しかけた：ひと言のあと対戦 */
  #talk(e: FloorEntity): void {
    const run = this.#run;
    const opponent = e.kind === 'boss' ? runBossOpponent() : runNpcOpponent(run.floor, Number(e.id.split('-').pop() ?? 0));
    const key = e.kind === 'boss' ? 'dungeonRun.bossTalk' : 'dungeonRun.npcTalk';
    this.#startBattle(e.kind === 'boss' ? 'boss' : 'npc', e.id, opponent, key);
  }

  #guardianAppears(g: FloorEntity): void {
    this.#showMark();
    this.#startBattle('guardian', g.id, runGuardianOpponent(this.#run.floor), 'dungeonRun.guardianAppear');
  }

  #startBattle(kind: BattleTargetKind, id: string, opponent: OpponentDefinition, key: 'dungeonRun.bossTalk' | 'dungeonRun.npcTalk' | 'dungeonRun.guardianAppear'): void {
    const store = this.#store;
    if (!isDeckValid(store.save.deck, store.save.collection)) {
      this.#message(t('world.deckInvalidBattle'));
      return;
    }
    this.#busy = true;
    const ctx = this.#ctx;
    const names = opponent.monsters.map((m) => cardName(getMonster(m))).join(t('common.listSeparator'));
    store.pendingBattle = {
      title: kind === 'boss' ? t('world.bossBattle') : t('world.dungeonBattle'),
      opponent,
      allowSurrender: true,
      bgm: kind === 'boss' ? 'bossBattle' : 'battle',
      background: kind === 'boss' ? bossBattleBg : dungeonBattleBg,
      onFinish: (winner) => {
        if (winner === 'player') onRunWin(store, kind, id, opponent);
        else onRunLoss(store, kind, id);
        ctx.reset(store.save.dungeonRun ? 'dungeonRun' : 'world');
      },
    };
    this.#message(t(key, { name: opponentName(opponent), monsters: names }), () => {
      this.#busy = true;
      this.#encounterFlash(() => ctx.navigate('battle'));
    });
  }

  /** 対戦に入るときの光（歩行画面と同じ絵） */
  #encounterFlash(next: () => void): void {
    const img = h('img', { class: 'world__encounter-fx-img', attrs: { src: encounterFx1, alt: '', draggable: 'false' } });
    const el = h('div', { class: 'world__encounter-fx', attrs: { 'aria-hidden': 'true' } }, img);
    this.#root.append(el);
    const frames = [encounterFx2, encounterFx3];
    frames.forEach((src, i) => setTimeout(() => (img.src = src), (i + 1) * ENCOUNTER_FRAME_MS));
    setTimeout(() => el.classList.add('is-white'), frames.length * ENCOUNTER_FRAME_MS + ENCOUNTER_FRAME_MS / 2);
    setTimeout(next, (frames.length + 1) * ENCOUNTER_FRAME_MS + ENCOUNTER_WHITE_MS);
  }

  /** 下り階段：下りるか聞く（下りたら戻れない） */
  #askStairs(): void {
    if (isLastFloor(this.#run)) return;
    this.#busy = true;
    confirmModal(
      this.#root,
      t('dungeonRun.stairsTitle'),
      [h('p', { class: 'modal__text', text: t('dungeonRun.stairsBody') })],
      () => {
        sound.play('stairs');
        this.#store.update((s) => (s.dungeonRun ? { ...s, dungeonRun: descend(s.dungeonRun) } : s));
        this.#setOmen(false);
        this.#buildFloor();
        this.#floorBanner();
      },
      () => (this.#busy = false),
    );
  }

  /** B ボタン：メニュー（仮）。いまの場所・負けた回数・この挑戦で手に入れた技カード */
  #openMenu(): void {
    if (this.#busy || !this.#store.save.dungeonRun) return;
    this.#release();
    this.#busy = true;
    const run = this.#run;
    const dungeon = getDungeon(run.dungeonId);
    const counts = new Map<string, number>();
    for (const id of run.gained) counts.set(id, (counts.get(id) ?? 0) + 1);
    const cards = [...counts].map(([id, n]) => h('li', { text: t('dungeonRun.menuCard', { name: cardName(id), n }) }));
    const handle = openModal(this.#root, {
      title: t('dungeonRun.menuTitle'),
      className: 'drun__menu',
      body: [
        h('p', { class: 'modal__text', text: t('world.placeDungeon', { dungeon: dungeon ? dungeonName(dungeon) : '', floor: t('dungeonRun.floorName', { n: run.floor + 1 }) }) }),
        h('p', { class: 'modal__text', text: t('dungeonRun.menuLosses', { n: run.losses, max: DUNGEON_RUN.maxLosses }) }),
        h('p', { class: 'modal__text drun__menu-head', text: t('dungeonRun.menuGained') }),
        cards.length > 0 ? h('ul', { class: 'drun__menu-cards' }, ...cards) : h('p', { class: 'modal__text', text: t('dungeonRun.menuNone') }),
      ],
      actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
      onClose: () => (this.#busy = false),
    });
  }

  #message(text: string, after?: () => void): void {
    this.#release();
    this.#busy = true;
    messageModal(this.#root, text, () => {
      this.#busy = false;
      after?.();
    });
  }

  /** 階に入ったときの帯（最後の階はボスの帯） */
  #floorBanner(): void {
    const run = this.#store.save.dungeonRun;
    if (!run) return;
    const dungeon = getDungeon(run.dungeonId);
    const kind = isLastFloor(run) ? 'boss' : 'floor';
    const text = t('world.placeDungeon', { dungeon: dungeon ? dungeonName(dungeon) : '', floor: t('dungeonRun.floorName', { n: run.floor + 1 }) });
    const el = h('div', { class: `world__banner world__banner--${kind}`, attrs: { 'aria-hidden': 'true' } }, h('span', { class: 'world__banner-text', text }));
    this.#root.append(el);
    setTimeout(() => el.remove(), BANNER_MS);
  }
}

/** ダンジョンの足音（森は芝生、ほかは砂利） */
function groundOf(dungeonId: string): 'grass' | 'gravel' {
  return dungeonId === 'dungeon-02' ? 'grass' : 'gravel';
}

/** 勝った：相手のモンスターの技から1枚（ランダム）。ボスならクリアして街へ */
function onRunWin(store: GameStore, kind: BattleTargetKind, id: string, opponent: OpponentDefinition): void {
  const candidates = rewardCandidates(opponent.monsters, skillsOf);
  const card = candidates.length > 0 ? (candidates[Math.floor(Math.random() * candidates.length)] as string) : null;
  const r = winRunBattle(store.save, { kind, id }, card);
  store.update((s) => ({ ...r.save, stats: { ...s.stats, battlesWon: s.stats.battlesWon + 1 } }));
  const got = card ? t('dungeonRun.win', { card: cardName(card) }) : t('dungeonRun.winNoCard');
  if (!r.cleared) {
    store.flashMessage = got;
    return;
  }
  const coins = t('common.coins', { n: r.coins });
  store.flashBanner = 'clear';
  store.flashMessage = `${got}\n${t(r.firstClear ? 'world.dungeonClearedFirst' : 'world.dungeonCleared', { coins })}`;
  if (r.clearCards.length > 0) {
    const names = r.clearCards.map((c) => t('tournament.prizeCard', { name: cardName(c.cardId), n: c.count })).join(t('common.listSeparator'));
    store.flashMessage += `\n${t('world.bossCards', { cards: names })}`;
  }
}

/** 負けた（降参も）：負けられる回数に達したら、手に入れた技カードを失って街の入り口へ */
function onRunLoss(store: GameStore, kind: BattleTargetKind, id: string): void {
  const r = loseRunBattle(store.save, { kind, id });
  store.update((s) => ({ ...r.save, stats: { ...s.stats, battlesLost: s.stats.battlesLost + 1 } }));
  store.flashMessage = r.expelled ? t('dungeonRun.expelled', { n: r.lostCards.length }) : t('dungeonRun.lose', { n: r.lossesLeft });
}
