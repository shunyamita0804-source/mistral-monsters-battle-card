import { getMonster, skillsOf } from '../../data/cards.ts';
import { getDungeon } from '../../data/dungeons.ts';
import { DUNGEON_RUN, runBattlerLook, runBossOpponent, runGuardianOpponent, runNpcOpponent } from '../../data/dungeonRun.ts';
import { getItem, ITEM_RULES, ITEMS, type ItemDefinition, type ItemId } from '../../data/items.ts';
import { itemBlock, itemCount, type ItemBlock } from '../../game/items/items.ts';
import type { OpponentDefinition } from '../../data/tournaments.ts';
import { isDeckValid } from '../../game/deck/deck.ts';
import type { DungeonFloor, FloorEntity } from '../../game/dungeon/generate.ts';
import {
  activeEntities,
  chooseRunReward,
  descend,
  escapeGuardian,
  entityAt,
  facingPoint,
  isLastFloor,
  loseRunBattle,
  move,
  nearGuardian,
  openRunChest,
  pickRewardChoices,
  rewardCandidates,
  runFloor,
  sanitizeRun,
  useDungeonItem,
  usesLuckyCoin,
  viewRadiusOf,
  winRunBattle,
  winRunBattleChoosing,
  type BattleTargetKind,
} from '../../game/dungeon/run.ts';
import type { Direction, DungeonRun } from '../../game/save/saveData.ts';
import { DIR_ROW, IDLE_COL, PLAYER_SHEET_COLS, PLAYER_SHEET_ROWS, WALK_COLS } from '../../game/world/walkAnim.ts';
import { t } from '../../i18n/i18n.ts';
import { cardName, dungeonName, itemName, opponentName } from '../../i18n/content.ts';
import { bgm, type BgmId } from '../bgm.ts';
import { showDungeonIntro } from '../components/dungeonIntro.ts';
import { itemIcon } from '../components/itemIcon.ts';
import { confirmModal, messageModal, openModal, type ModalHandle } from '../components/modal.ts';
import { button, h } from '../dom.ts';
import type { GameStore } from '../gameStore.ts';
import { sound } from '../sound.ts';
import { PLAYER_SHEET } from './worldScreen.ts';
import type { ScreenContext, ScreenDefinition } from './types.ts';
import dungeonBattleBg from '@assets/images/backgrounds/battle_dungeon.webp';
import bossBattleBg from '@assets/images/backgrounds/battle_boss.webp';
import encounterFx1 from '@assets/images/effects/fx_encounter_1.webp';
import encounterFx2 from '@assets/images/effects/fx_encounter_2.webp';
import encounterFx3 from '@assets/images/effects/fx_encounter_3.webp';
import guardianArt from '@assets/images/characters/guardian.webp';
import miniYou from '@assets/images/ui/dungeon/mini_you.webp';
import miniStairs from '@assets/images/ui/dungeon/mini_stairs.webp';
import miniChest from '@assets/images/ui/dungeon/mini_chest.webp';
import miniBattler from '@assets/images/ui/dungeon/mini_battler.webp';
import miniBoss from '@assets/images/ui/dungeon/mini_boss.webp';

/**
 * ランダム生成のダンジョンの画面（2026-10-26 試作「ミスモンBC ダンジョン試作（たたき台）」。GB 版のダンジョンを参考に）。
 * - 見下ろしで1マスずつ歩く。最初は真っ暗で、自分と隣のマスだけ見える。見たマスは暗めに残り、右上の地図（ミニマップ）にも残る
 * - 歩く：画面のどこでも指でなぞると、指を置いた所にスティック（街と同じ。上下左右の4方向・倒している間は歩き続ける）。
 *   2026-10-27 ユーザー指示「片手でできるように」で、それまでの十字キー・A・B の欄をやめた
 * - 右下の「調べる」か画面をタップ：向いている方に話す・宝箱を開ける（それまでの A）。その左の小さな「メニュー」（それまでの B。仮）
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
/** ミニマップの1マスの大きさ（ミニマップの絵の中の px。画面では枠に合わせて縮める。印の絵がつぶれないよう細かめに描く） */
const MINI_CELL = 8;
/** ミニマップの印の大きさ（マスの何倍か。2026-10-27 デザイン第12弾の印） */
const MINI_MARK = 3.4;
/** ミニマップの印の絵（自分・階段・宝箱・バトラー・ボス） */
const MINI_ICONS = { you: miniYou, stairs: miniStairs, chest: miniChest, npc: miniBattler, boss: miniBoss } as const;
/** スティック（街と同じ大きさ・働き。worldScreen.ts の STICK_*）：動かし始める距離・向きを決めない真ん中・輪の半径・輪を出さない上の帯 */
const STICK_START = 12;
const STICK_DEAD = 16;
const STICK_RADIUS = 84;
const STICK_RING_R = 104;
const STICK_TOP = 64;
/** 見えない番人が姿を現したときの絵の高さ（論理px。主人公と同じ） */
const GUARDIAN_H = 84;
/** 主人公の絵の高さ（論理px）と、1コマの縦横比（シート 310×360）。2026-10-27 ユーザー「もう少し大きく」で 70→84（1マス 48 のまま） */
const PLAYER_H = 84;
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
/** 煙玉・お守りの【仮】演出の時間 */
const SMOKE_MS = 900;
/** ダンジョンごとの BGM（歩行画面の DUNGEON_BGM と同じ） */
const RUN_BGM: Readonly<Record<string, BgmId>> = { 'dungeon-01': 'dungeonRuins', 'dungeon-02': 'dungeonForest' };

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
  /** 効いている道具の印（左上。魔除けの香は残りの歩数。印の絵は届くまで仮） */
  readonly #effects = h('div', { class: 'drun__effects', attrs: { role: 'status', 'aria-label': t('dungeonRun.effects') } });
  readonly #mini = h('canvas', { class: 'drun__minimap', attrs: { role: 'img', 'aria-label': t('dungeonRun.minimap') } });
  readonly #live = h('p', { class: 'drun__live', attrs: { 'aria-live': 'polite' } });
  /** スティック（指を置いた所に出る）と、右下の「調べる」 */
  readonly #stick = h('div', { class: 'world__stick drun__stick', attrs: { 'aria-hidden': 'true' } }, h('div', { class: 'world__stick-knob' }));
  readonly #actBtn = h(
    'button',
    { class: 'world__action drun__act', attrs: { type: 'button', 'aria-label': t('dungeonRun.buttonA') }, on: { click: () => this.#actA() } },
    h('span', { class: 'world__action-icon', attrs: { 'aria-hidden': 'true' } }),
    h('span', { class: 'world__action-label', text: t('world.examine') }),
  );
  /** 指を置いた所（なぞり始めたらスティック） */
  #touch: { id: number; x: number; y: number; dragging: boolean } | null = null;
  #tiles: HTMLElement[] = [];
  readonly #entityEls = new Map<string, HTMLElement>();
  #floor: DungeonFloor | null = null;
  /** いま見えている（明るい）マスの番号 */
  #lit: number[] = [];
  /** 会話・確認・対戦への切り替えの間は歩かない */
  #busy = false;
  /** 倒しているスティック（キーボードの矢印）の向き */
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
    // ダンジョンごとの見た目（床・壁・ボスのしるし。dungeonRun.css・uiParts12.css）
    this.#root.classList.add(`drun--${run.dungeonId}`);
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
      h('header', { class: 'drun__hud' }, this.#place, h('div', { class: 'drun__chips' }, this.#losses, this.#gained), this.#effects),
      this.#mini,
      this.#stick,
      this.#actBtn,
      h('button', { class: 'drun__menu-btn', text: t('dungeonRun.buttonB'), attrs: { type: 'button' }, on: { click: () => this.#openMenu() } }),
      this.#live,
    );
    this.#root.addEventListener('pointerdown', (e) => this.#pointerDown(e));
    this.#root.addEventListener('pointermove', (e) => this.#pointerMove(e));
    this.#root.addEventListener('pointerup', (e) => this.#pointerUp(e, true));
    this.#root.addEventListener('pointercancel', (e) => this.#pointerUp(e, false));
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
    // 身代わりのお守りが身代わりになった：お守りが砕ける演出のあとでお知らせ
    const charm = this.#store.flashBanner === 'charm';
    if (charm) this.#store.flashBanner = null;
    if (intro && dungeon) {
      this.#busy = true;
      showDungeonIntro(this.#root, dungeon, () => {
        this.#busy = false;
        this.#floorBanner();
      });
    } else if (run.rewardChoice) {
      // 幸運のコイン：勝ったあと、もらう技カードを選ぶ（選ぶ前に閉じても、次に開いたときにまた選ぶ）
      this.#chooseReward();
    } else if (flash && charm) {
      this.#charmEffect(() => this.#message(flash));
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

  /* ---------- スティック（2026-10-27 ユーザー指示「ダンジョンもバーチャルパッドに。片手でできるように」。街と同じ形） ---------- */

  #pointerDown(e: PointerEvent): void {
    if (this.#touch || (e.target instanceof Element && e.target.closest('button, .modal'))) return;
    this.#touch = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
    try {
      this.#root.setPointerCapture(e.pointerId);
    } catch {
      // 取れなくても動く
    }
  }

  #pointerMove(e: PointerEvent): void {
    const touch = this.#touch;
    if (!touch || touch.id !== e.pointerId) return;
    const scale = this.#stageScale();
    const dx = (e.clientX - touch.x) / scale;
    const dy = (e.clientY - touch.y) / scale;
    const dist = Math.hypot(dx, dy);
    if (!touch.dragging) {
      if (dist < STICK_START) return;
      touch.dragging = true;
      this.#placeStick(touch.x, touch.y, scale);
      this.#stick.classList.add('is-on');
    }
    const k = Math.min(1, STICK_RADIUS / Math.max(dist, 1));
    const knob = this.#stick.firstElementChild as HTMLElement | null;
    if (knob) knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    if (dist < STICK_DEAD) {
      this.#release();
      return;
    }
    // 上下左右の4方向。境目では少しこえるまで前の向きのまま（指のふるえで向きが行ったり来たりしないように。街と同じ）
    const d: Direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    const held = this.#held;
    if (held && held !== d) {
      const along = held === 'left' || held === 'right' ? Math.abs(dx) : Math.abs(dy);
      const across = held === 'left' || held === 'right' ? Math.abs(dy) : Math.abs(dx);
      const sameSide = held === 'right' ? dx > 0 : held === 'left' ? dx < 0 : held === 'down' ? dy > 0 : dy < 0;
      if (sameSide && across < along * 1.3) return;
    }
    if (d !== held) this.#press(d);
  }

  #pointerUp(e: PointerEvent, tap: boolean): void {
    const touch = this.#touch;
    if (!touch || touch.id !== e.pointerId) return;
    this.#touch = null;
    this.#stick.classList.remove('is-on');
    if (touch.dragging) {
      this.#release();
      return;
    }
    // なぞらずに離した：調べる・話す（右下のボタンと同じ）
    if (tap) this.#actA();
  }

  /** スティックの輪を出す位置（指を置いた所）。輪が画面の端で欠けたり、右下の「調べる」に重なったりしないよう内側へずらす */
  #placeStick(clientX: number, clientY: number, scale: number): void {
    const v = this.#root.getBoundingClientRect();
    const vw = this.#root.clientWidth;
    const vh = this.#root.clientHeight;
    const r = STICK_RING_R + 4;
    let x = Math.min(Math.max((clientX - v.left) / scale, r), vw - r);
    const y = Math.min(Math.max((clientY - v.top) / scale, STICK_TOP + r), vh - r);
    const btn = this.#actBtn.getBoundingClientRect();
    const bl = (btn.left - v.left) / scale;
    const bt = (btn.top - v.top) / scale;
    if (x + r > bl && y + r > bt) x = Math.max(r, bl - r);
    this.#stick.style.left = `${x}px`;
    this.#stick.style.top = `${y}px`;
  }

  /** ステージの拡大縮小（画面の px ÷ 論理 px） */
  #stageScale(): number {
    const w = this.#root.clientWidth;
    return w > 0 ? this.#root.getBoundingClientRect().width / w : 1;
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
      // バトラーは3人の見た目のどれか（対戦の顔の絵と同じ人。src/data/dungeonRun.ts の runBattlerLook）
      const look = e.kind === 'npc' ? ` drun__entity--b${runBattlerLook(Number(e.id.split('-').pop() ?? 0))}` : '';
      const el = h('div', { class: `drun__entity drun__entity--${e.kind}${look}`, attrs: { 'aria-hidden': 'true' } });
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
    const r = viewRadiusOf(run);
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
    // 負けた回数：灯りが負けるたびに1つずつ消える（2026-10-27 デザイン第13弾。文字は読み上げ用）
    this.#losses.setAttribute('aria-label', t('dungeonRun.losses', { n: run.losses, max: DUNGEON_RUN.maxLosses }));
    this.#losses.replaceChildren(
      ...Array.from({ length: DUNGEON_RUN.maxLosses }, (_, i) =>
        h('span', { class: `drun__lantern${i < DUNGEON_RUN.maxLosses - run.losses ? '' : ' is-out'}`, attrs: { 'aria-hidden': 'true' } }),
      ),
    );
    this.#gained.textContent = t('dungeonRun.gained', { n: run.gained.length });
    this.#refreshEffects(run);
    this.#drawMinimap();
    // 向いている先にバトラー・ボス・宝箱がある、または階段の上：「調べる」が金色に光る（街と同じ）
    const p = facingPoint(run);
    const ahead = entityAt(run, f, p.x, p.y);
    const onStairs = !!f.stairs && f.stairs.x === run.x && f.stairs.y === run.y && !isLastFloor(run);
    this.#actBtn.classList.toggle('is-ready', (!!ahead && ahead.kind !== 'guardian') || onStairs);
  }

  /** 右上の地図：見たマスだけ。自分・階段・見たバトラー・宝箱・ボスは印の絵（2026-10-27 デザイン第12弾） */
  #drawMinimap(): void {
    const f = this.#floor;
    const g = this.#mini.getContext?.('2d');
    if (!f || !g) return;
    const run = this.#run;
    g.clearRect(0, 0, this.#mini.width, this.#mini.height);
    // 遺跡の地図を使った階：まだ見ていない通路・部屋も薄く出す（宝箱・バトラー・番人は出さない。階段とボスの間は下で印）
    const mapped = run.mapFloor === run.floor;
    for (let y = 0; y < f.height; y++) {
      for (let x = 0; x < f.width; x++) {
        const floor = f.tiles[y]?.[x] === '.';
        if (run.explored[y * f.width + x] !== '1') {
          if (mapped && floor) {
            g.fillStyle = 'rgb(214 200 168 / 0.42)';
            g.fillRect(x * MINI_CELL, y * MINI_CELL, MINI_CELL, MINI_CELL);
          }
          continue;
        }
        g.fillStyle = floor ? 'rgb(214 200 168 / 0.85)' : 'rgb(70 62 52 / 0.85)';
        g.fillRect(x * MINI_CELL, y * MINI_CELL, MINI_CELL, MINI_CELL);
      }
    }
    // 印はマスの真ん中に、足元（下の端）をマスの下の方に合わせて置く。絵の読み込み前は描かない（読み込んだら描き直す）
    const mark = (x: number, y: number, kind: keyof typeof MINI_ICONS): void => {
      const img = miniIcon(kind, () => !this.#destroyed && this.#drawMinimap());
      if (!img) return;
      const hgt = MINI_CELL * MINI_MARK;
      const w = (hgt * img.naturalWidth) / img.naturalHeight;
      g.drawImage(img, (x + 0.5) * MINI_CELL - w / 2, (y + 0.85) * MINI_CELL - hgt, w, hgt);
    };
    if (f.stairs && (mapped || run.explored[f.stairs.y * f.width + f.stairs.x] === '1')) mark(f.stairs.x, f.stairs.y, 'stairs');
    for (const e of activeEntities(run, f)) {
      if (e.kind === 'guardian') continue;
      if (run.explored[e.y * f.width + e.x] !== '1' && !(mapped && e.kind === 'boss')) continue;
      if (e.kind === 'chest' && run.opened.includes(e.id)) continue;
      mark(e.x, e.y, e.kind);
    }
    mark(run.x, run.y, 'you');
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
    this.#showGuardian();
    this.#startBattle('guardian', g.id, runGuardianOpponent(this.#run.floor), 'dungeonRun.guardianAppear');
  }

  /**
   * 見えない番人が姿を現す（2026-10-27 デザイン第12弾の立ち姿）。主人公のとなりの通れるマス（前・左右・後ろの順）に、
   * 煙のように浮かび上がる。番人の本当の位置は見せない（いつも主人公のとなりに出る）
   */
  #showGuardian(): void {
    const f = this.#floor;
    if (!f) return;
    const run = this.#run;
    const front = facingPoint(run);
    const dx = front.x - run.x;
    const dy = front.y - run.y;
    const spots = [front, { x: run.x + dy, y: run.y - dx }, { x: run.x - dy, y: run.y + dx }, { x: run.x - dx, y: run.y - dy }];
    const spot = spots.find((p) => f.tiles[p.y]?.[p.x] === '.') ?? front;
    const w = Math.round((GUARDIAN_H * 244) / 360);
    const el = h('img', { class: 'drun__guardian', attrs: { src: guardianArt, alt: '', draggable: 'false', 'aria-hidden': 'true' } });
    el.style.width = `${w}px`;
    el.style.height = `${GUARDIAN_H}px`;
    el.style.left = `${Math.round((spot.x + 0.5) * TILE - w / 2)}px`;
    el.style.top = `${Math.round(spot.y * TILE + TILE * 0.82 - GUARDIAN_H)}px`;
    this.#world.append(el);
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
    const text = t(key, { name: opponentName(opponent), monsters: names });
    const fight = (): void => {
      this.#busy = true;
      this.#encounterFlash(() => ctx.navigate('battle'));
    };
    const smoke = itemCount(store.save, 'smokeBall');
    if (kind !== 'guardian' || smoke <= 0) {
      this.#message(text, fight);
      return;
    }
    // 見えない番人で煙玉を持っている：相手の顔ぶれを見てから「戦う」か「煙玉を使う」（2026-10-27 道具）
    let chosen = false;
    const handle = openModal(this.#root, {
      body: text.split('\n').map((line) => h('p', { class: 'modal__text', text: line })),
      closeOnBackdrop: false,
      actions: [
        { label: t('dungeonRun.guardianSmoke', { n: smoke }), onTap: () => ((chosen = true), handle.close(), this.#escapeWithSmoke()) },
        { label: t('dungeonRun.guardianFight'), primary: true, onTap: () => ((chosen = true), handle.close(), fight()) },
      ],
      onClose: () => {
        if (!chosen) fight();
      },
    });
  }

  /** 煙玉で見えない番人から逃げる：煙の中で番人が消える。負けの回数は増えず、カードももらえない */
  #escapeWithSmoke(): void {
    const next = escapeGuardian(this.#store.save);
    if (!next) return;
    this.#store.pendingBattle = null;
    this.#store.update(() => next);
    // 【仮】煙玉の演出（絵はデザイン担当に依頼中）：白い煙が広がって、番人が消える
    const puff = h('div', { class: 'drun__smoke', attrs: { 'aria-hidden': 'true' } });
    this.#root.append(puff);
    for (const el of this.#world.querySelectorAll('.drun__guardian')) el.classList.add('is-gone');
    setTimeout(() => {
      puff.remove();
      for (const el of this.#world.querySelectorAll('.drun__guardian')) el.remove();
      this.#refresh(false);
      this.#setOmen(false);
      this.#message(t('dungeonRun.smokeEscaped'));
    }, SMOKE_MS);
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
    let keep = false;
    const cards = [...counts].map(([id, n]) => {
      const name = t('dungeonRun.menuCard', { name: cardName(id), n });
      return h('li', { text: id === run.sealedCard ? t('dungeonRun.menuSealed', { name }) : name });
    });
    const handle = openModal(this.#root, {
      title: t('dungeonRun.menuTitle'),
      className: 'drun__menu',
      body: [
        h('p', { class: 'modal__text', text: t('world.placeDungeon', { dungeon: dungeon ? dungeonName(dungeon) : '', floor: t('dungeonRun.floorName', { n: run.floor + 1 }) }) }),
        h('p', { class: 'modal__text', text: t('dungeonRun.menuLosses', { n: run.losses, max: DUNGEON_RUN.maxLosses }) }),
        h('p', { class: 'modal__text drun__menu-head', text: t('dungeonRun.menuGained') }),
        cards.length > 0 ? h('ul', { class: 'drun__menu-cards' }, ...cards) : h('p', { class: 'modal__text', text: t('dungeonRun.menuNone') }),
      ],
      actions: [
        // 道具（2026-10-27）。朝の「未決事項への回答」（メニューの中身）が届くまでは、項目を足すところまで
        { label: t('dungeonRun.menuItems'), onTap: () => ((keep = true), handle.close(), this.#openItems()) },
        { label: t('common.close'), primary: true, onTap: () => handle.close() },
      ],
      onClose: () => {
        if (!keep) this.#busy = false;
      },
    });
  }

  /* ---------- 道具（2026-10-27 ユーザー指示書「ダンジョンの道具」。ルールは src/game/items/items.ts・src/game/dungeon/run.ts） ---------- */

  /** メニューの「道具」：持っている道具の一覧。使えないものは理由を出して押せなくする */
  #openItems(): void {
    this.#busy = true;
    const save = this.#store.save;
    const owned = ITEMS.filter((i) => itemCount(save, i.id) > 0);
    let next: (() => void) | null = null;
    const rows = owned.map((item) => {
      const block = itemBlock(save, item.id);
      const use = button(t('dungeonRun.itemUse'), () => {
        next = () => this.#askUse(item);
        handle.close();
      }, 'btn btn--primary btn--small');
      use.disabled = block !== null;
      return h(
        'li',
        { class: 'drun__item', dataset: { id: item.id } },
        itemIcon(item),
        h(
          'div',
          { class: 'drun__item-info' },
          h('p', { class: 'drun__item-name' }, itemName(item), h('span', { class: 'drun__item-count', text: t('dungeonRun.itemCount', { n: itemCount(save, item.id) }) })),
          block ? h('p', { class: 'drun__item-block', text: blockText(block) }) : null,
        ),
        use,
      );
    });
    const handle = openModal(this.#root, {
      title: t('dungeonRun.itemsTitle'),
      className: 'drun__items',
      body: rows.length > 0 ? [h('ul', { class: 'drun__item-list' }, ...rows)] : t('dungeonRun.itemsNone').split('\n').map((line) => h('p', { class: 'modal__text', text: line })),
      actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
      onClose: () => {
        if (next) next();
        else this.#busy = false;
      },
    });
  }

  /** 使うか確かめてから使う（帰還の羽根は専用の確認、封印の小箱は守るカードを選ぶ） */
  #askUse(item: ItemDefinition): void {
    if (item.id === 'sealBox') return this.#chooseSealCard();
    const title = item.id === 'returnFeather' ? t('world.leaveTitle') : t('dungeonRun.itemConfirm', { item: itemName(item) });
    const body = item.id === 'returnFeather' ? t('dungeonRun.featherBody').split('\n').map((line) => h('p', { class: 'modal__text', text: line })) : [];
    let used = false;
    confirmModal(
      this.#root,
      title,
      body,
      () => {
        used = true;
        this.#useItem(item.id);
      },
      () => {
        if (!used) this.#busy = false;
      },
    );
  }

  /** 封印の小箱：この挑戦で手に入れた技カードから1枚選ぶ */
  #chooseSealCard(): void {
    const run = this.#run;
    let chosen: string | null = null;
    const ids = [...new Set(run.gained)];
    const handle: ModalHandle = openModal(this.#root, {
      title: t('dungeonRun.sealTitle'),
      className: 'drun__choose',
      body: [
        h('p', { class: 'modal__text', text: t('dungeonRun.sealChoose') }),
        h(
          'div',
          { class: 'drun__choose-list' },
          ...ids.map((id) => button(cardName(id), () => ((chosen = id), handle.close()), 'btn drun__choose-card')),
        ),
      ],
      actions: [{ label: t('common.cancel'), onTap: () => handle.close() }],
      onClose: () => {
        if (chosen) this.#useItem('sealBox', chosen);
        else this.#busy = false;
      },
    });
  }

  #useItem(id: ItemId, sealCard?: string): void {
    const r = useDungeonItem(this.#store.save, id, sealCard);
    if (r.status !== 'ok') {
      this.#busy = false;
      return;
    }
    const gained = this.#run.gained.length;
    this.#store.update(() => r.save);
    sound.play('reward');
    if (r.returned) {
      // 帰還の羽根：挑戦を終えて街の入り口へ
      this.#store.flashMessage = t('dungeonRun.featherDone', { n: gained });
      this.#ctx.reset('world');
      return;
    }
    this.#refresh(false);
    this.#setOmen(nearGuardian(this.#run, runFloor(this.#run)));
    const done: Record<Exclude<ItemId, 'returnFeather' | 'smokeBall'>, string> = {
      torch: t('dungeonRun.usedTorch'),
      incense: t('dungeonRun.usedIncense', { n: ITEM_RULES.incenseSteps }),
      ruinsMap: t('dungeonRun.usedMap'),
      luckyCoin: t('dungeonRun.usedCoin'),
      guardianCharm: t('dungeonRun.usedCharm'),
      sealBox: t('dungeonRun.usedSeal', { card: sealCard ? cardName(sealCard) : '' }),
    };
    this.#message(done[id as keyof typeof done] ?? '');
  }

  /** 幸運のコイン：勝ったあと、候補から1枚選ぶ */
  #chooseReward(): void {
    const choices = this.#run.rewardChoice ?? [];
    this.#release();
    this.#busy = true;
    let chosen: string | null = null;
    const handle = openModal(this.#root, {
      title: t('dungeonRun.coinTitle'),
      className: 'drun__choose',
      closeOnBackdrop: false,
      body: [
        ...t('dungeonRun.coinChoose').split('\n').map((line) => h('p', { class: 'modal__text', text: line })),
        h(
          'div',
          { class: 'drun__choose-list' },
          ...choices.map((id) => button(cardName(id), () => ((chosen = id), handle.close()), 'btn drun__choose-card')),
        ),
      ],
      onClose: () => {
        if (!chosen) return;
        this.#store.update((s) => chooseRunReward(s, chosen as string));
        this.#refresh(false);
        this.#message(t('dungeonRun.coinGot', { card: cardName(chosen) }));
      },
    });
  }

  /** 【仮】お守りが砕ける演出（絵はデザイン担当に依頼中）：主人公の上でお守りが光って消える */
  #charmEffect(after: () => void): void {
    const item = getItem('guardianCharm');
    if (!item) return after();
    this.#busy = true;
    const el = h('div', { class: 'drun__charm-fx', attrs: { 'aria-hidden': 'true' } }, itemIcon(item));
    this.#root.append(el);
    sound.play('reward');
    setTimeout(() => {
      el.remove();
      this.#busy = false;
      after();
    }, SMOKE_MS * 1.4);
  }

  /** 効いている道具の印（左上）。【仮】絵はデザイン担当に依頼中なので、いまは道具の仮アイコンと短い文字 */
  #refreshEffects(run: DungeonRun): void {
    const chips: HTMLElement[] = [];
    const chip = (id: ItemId, label: string): void => {
      const item = getItem(id);
      if (item) chips.push(h('span', { class: `drun__effect drun__effect--${id}` }, itemIcon(item, 'small'), h('span', { text: label })));
    };
    if (run.torchFloor === run.floor) chip('torch', t('dungeonRun.effectTorch'));
    if (run.incenseSteps > 0) chip('incense', t('dungeonRun.effectIncense', { n: run.incenseSteps }));
    if (run.charm) chip('guardianCharm', t('dungeonRun.effectCharm'));
    if (run.luckyCoin) chip('luckyCoin', t('dungeonRun.effectCoin'));
    this.#effects.replaceChildren(...chips);
    this.#effects.hidden = chips.length === 0;
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

/** 道具を使えない理由の文 */
function blockText(block: ItemBlock): string {
  switch (block) {
    case 'torchActive':
    case 'mapActive':
      return t('dungeonRun.blockFloor');
    case 'coinActive':
      return t('dungeonRun.blockActive');
    case 'charmUsed':
    case 'sealBoxUsed':
      return t('dungeonRun.blockOnce');
    case 'noCards':
      return t('dungeonRun.blockNoCards');
    case 'guardianOnly':
      return t('dungeonRun.blockGuardian');
    case 'none':
    case 'noRun':
    case 'choosing':
      return '';
  }
}

/** ミニマップの印の絵（一度だけ読み込んで使い回す。読み込み中は null を返し、読み込めたら onLoad） */
const miniIcons = new Map<string, HTMLImageElement>();
function miniIcon(kind: keyof typeof MINI_ICONS, onLoad: () => void): HTMLImageElement | null {
  let img = miniIcons.get(kind);
  if (!img) {
    img = new Image();
    img.src = MINI_ICONS[kind];
    miniIcons.set(kind, img);
  }
  if (img.complete && img.naturalWidth > 0) return img;
  img.addEventListener('load', onLoad, { once: true });
  return null;
}

/** ダンジョンの足音（森は芝生、ほかは砂利） */
function groundOf(dungeonId: string): 'grass' | 'gravel' {
  return dungeonId === 'dungeon-02' ? 'grass' : 'gravel';
}

/** 勝った：相手のモンスターの技から1枚（ランダム）。ボスならクリアして街へ */
function onRunWin(store: GameStore, kind: BattleTargetKind, id: string, opponent: OpponentDefinition): void {
  const candidates = rewardCandidates(opponent.monsters, skillsOf);
  // 幸運のコイン：バトラー・番人なら、別々の2枚の候補から選ぶ（選ぶのはダンジョンの画面に戻ってから。中断しても残る）
  if (usesLuckyCoin(store.save.dungeonRun, kind, candidates)) {
    const choices = pickRewardChoices(candidates, ITEM_RULES.luckyCoinChoices, Math.random);
    store.update((s) => ({ ...winRunBattleChoosing(s, { kind, id }, choices), stats: { ...s.stats, battlesWon: s.stats.battlesWon + 1 } }));
    return;
  }
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
  if (r.charmSaved) store.flashBanner = 'charm';
  store.flashMessage = r.charmSaved
    ? t('dungeonRun.charmSaved')
    : r.expelled
      ? t('dungeonRun.expelled', { n: r.lostCards.length }) + (r.keptCard ? `\n${t('dungeonRun.expelledKept', { card: cardName(r.keptCard) })}` : '')
      : t('dungeonRun.lose', { n: r.lossesLeft });
  // 3回負けて入り口へ戻されたときの帯（2026-10-27 デザイン第13弾）
  if (r.expelled) store.flashBanner = 'retreat';
}
