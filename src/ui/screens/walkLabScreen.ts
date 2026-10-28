import type { MapDefinition } from '../../data/maps.ts';
import type { ArtMap } from '../../data/worldArt.generated.ts';
import type { Direction, Location } from '../../game/save/saveData.ts';
import { MemoryStorage } from '../../game/save/saveRepository.ts';
import { ROW_NAMES, RUN_ROW_BASE, sheetStatus, type Diagonal, type PlayerGender } from '../../game/world/walkAnim.ts';
import { t } from '../../i18n/i18n.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { button, h } from '../dom.ts';
import { GameStore } from '../gameStore.ts';
import type { ScreenContext, ScreenDefinition } from './types.ts';
import { WorldView, type WorldDevFrame, type WorldDevState } from './worldScreen.ts';

/**
 * 歩きの確認画面（開発用・2026-10-24）。?qa=1 のときだけタイトル・ベッドから入れる（?qa=1&lab=walk で直接開く）。
 *
 * 本体の歩行画面（WorldView）をそのまま使い、調整項目（WorldDevState）だけを渡す。別の描画・移動・コマ送りは作らない。
 * セーブは自分用の仮のもの（メモリの中だけ）なので、ここで歩いても本当のセーブ・設定は変わらない。
 * 地図は何もない平らな広場（街と同じマスの大きさ／ダンジョンと同じマスの大きさ）。中央の右に壁の柱（壁への接触の確認用）
 */

type Place = 'town' | 'dungeon';
type Mode = 'treadmill' | 'fixed' | 'follow';
type TreadmillMode = 'idle' | 'walk' | 'run';

/** 広場の大きさ（マス）と出発点 */
const FIELD_W = 41;
const FIELD_H = 31;
const START = { x: 20, y: 15 };
/** 壁の柱（出発点の右 4 マス。2×2） */
const PILLAR = { x: START.x + 4, y: START.y - 1, w: 2, h: 2 };

/** 調整の既定値（本編と同じ） */
const DEFAULT_STATE = (): WorldDevState => ({
  speedScale: 1,
  animScale: 1,
  timeScale: 1,
  paused: false,
  stepFrames: 0,
  fixedCamera: false,
  zoom: null,
  treadmill: { dir: 'left', diag: null, mode: 'walk' },
  overlays: true,
});

/** 本編の見せる倍率（worldScreen.ts の VIEW_ZOOM と同じ値。実寸の表示に使う） */
const ACTUAL_ZOOM: Readonly<Record<Place, number>> = { town: 0.7, dungeon: 1.5 };

/** 広場のマス目（外周と柱が壁） */
function fieldGrid(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < FIELD_H; y += 1) {
    let row = '';
    for (let x = 0; x < FIELD_W; x += 1) {
      const edge = x === 0 || y === 0 || x === FIELD_W - 1 || y === FIELD_H - 1;
      const pillar = x >= PILLAR.x && x < PILLAR.x + PILLAR.w && y >= PILLAR.y && y < PILLAR.y + PILLAR.h;
      row += edge || pillar ? '#' : '.';
    }
    rows.push(row);
  }
  return rows;
}

/** 確認用の地図。街と同じ（正式な絵の地図と同じマス 32 単位）か、ダンジョンと同じ（仮マップの 40 論理px のマス） */
function fieldMap(place: Place): MapDefinition {
  const grid = fieldGrid();
  const base = { id: `walk-lab-${place}`, name: '歩きの確認', tiles: grid, objects: [], spawn: { ...START, dir: 'down' as Direction } };
  if (place === 'dungeon') return { ...base, area: 'dungeon' };
  const art: ArtMap = {
    id: base.id,
    cols: FIELD_W,
    rows: FIELD_H,
    width: FIELD_W * 32,
    height: FIELD_H * 32,
    cell: 32,
    grid,
    tiles: [],
    sprites: [],
    exit: { x: 0, y: 0, w: 1, h: 1 },
    spawn: START,
  };
  return { ...base, area: 'town', art };
}

/** 絵の向きは4方向（2026-10-24 ユーザー「四方向に」。斜めに進むときは横の絵） */
const DIRS: readonly Direction[] = ROW_NAMES;
const isDiagonal = (d: Direction | Diagonal): d is Diagonal => d.length > 5;
const baseDir = (d: Direction | Diagonal): Direction => (isDiagonal(d) ? (d.endsWith('left') ? 'left' : 'right') : d);

export const walkLabScreen: ScreenDefinition = {
  id: 'walkLab',
  titleKey: 'walkLab.title',
  create(ctx) {
    const element = h('main', { class: 'screen walk-lab' });
    const state = DEFAULT_STATE();
    let gender: PlayerGender = 'male';
    let place: Place = 'town';
    let mode: Mode = 'treadmill';
    let facing: Direction | Diagonal = 'left';
    let zoomMul = 1;
    let view: WorldView | null = null;
    let worldRoot: HTMLElement | null = null;
    let lastRead = '';
    let lastArt = '';

    const stage = h('div', { class: 'walk-lab__stage' });
    const read = h('p', { class: 'walk-lab__read', attrs: { 'aria-live': 'off' } });
    const art = h('p', { class: 'walk-lab__art' });

    /** 本体と同じ WorldView を、仮のセーブ（メモリの中だけ）で作る */
    const buildView = (): void => {
      view?.destroy();
      const store = new GameStore(new MemoryStorage(), true);
      store.newGame(gender);
      const devCtx: ScreenContext = { navigate: ctx.navigate, back: ctx.back, reset: ctx.reset, store };
      worldRoot = h('main', { class: 'screen world' });
      stage.replaceChildren(worldRoot);
      const start: Location = { mapId: `walk-lab-${place}`, x: START.x, y: START.y, dir: baseDir(facing) };
      state.zoom = ACTUAL_ZOOM[place] * zoomMul;
      view = new WorldView(devCtx, worldRoot, { map: fieldMap(place), start, state, onFrame });
      view.load();
      view.setFacing(baseDir(facing), isDiagonal(facing) ? facing : null);
      lastArt = '';
    };

    /** 毎コマの数値（変わったときだけ文字を書く） */
    const onFrame = (f: WorldDevFrame): void => {
      // 行 4〜7 は走りの行（正面・背中・左・右）
      const dirName = `${t(`walkLab.dir.${ROW_NAMES[f.row % RUN_ROW_BASE] ?? 'down'}` as MessageKey)}${f.row >= RUN_ROW_BASE ? `・${t('walkLab.stateRun')}` : ''}`;
      const lines = [
        f.walking ? t('walkLab.readFrame', { col: f.col + 1, phase: f.phase.toFixed(2) }) : t('walkLab.readIdle'),
        t('walkLab.readRow', { row: f.row + 1, dir: dirName }),
        t('walkLab.readSpeed', { speed: f.speedPx.toFixed(0), stride: f.stride.toFixed(1), fps: f.fps.toFixed(1) }),
        t('walkLab.readSize', { cell: f.cell.toFixed(1), figure: f.figureH.toFixed(1), shown: f.shownCellH.toFixed(1), zoom: f.zoom.toFixed(2) }),
        t('walkLab.readPos', { x: f.pos.x.toFixed(2), y: f.pos.y.toFixed(2), fx: f.foot.x.toFixed(1), fy: f.foot.y.toFixed(1) }),
      ];
      const text = lines.join('\n');
      if (text !== lastRead) {
        lastRead = text;
        read.textContent = text;
      }
      const key = `${f.gender}:${f.row}`;
      if (key !== lastArt) {
        lastArt = key;
        const s = sheetStatus(f.gender, f.row);
        const parts = [
          t(s.walk === 'v2' ? 'walkLab.artWalkV2' : 'walkLab.artWalkLegacy'),
          t(s.run === 'v3' ? 'walkLab.artRunV3' : 'walkLab.artRunNone'),
          t('walkLab.artIdle'),
          ...(s.mirrored ? [t('walkLab.artMirrored')] : []),
        ];
        art.textContent = `${t('walkLab.art')}\n${parts.join('\n')}`;
        art.classList.toggle('is-missing', s.walk !== 'v2' || s.run !== 'v3');
      }
    };

    /** 向き・状態・見かたを WorldView に反映 */
    const applyMode = (): void => {
      const tm: TreadmillMode = state.treadmill?.mode ?? 'walk';
      if (mode === 'treadmill') state.treadmill = { dir: baseDir(facing), diag: isDiagonal(facing) ? facing : null, mode: tm };
      else state.treadmill = null;
      state.fixedCamera = mode === 'fixed';
      view?.setFacing(baseDir(facing), isDiagonal(facing) ? facing : null);
      refresh();
    };

    /** 選択肢のボタンの列（選ばれているものを強調） */
    const choice = <T extends string>(labelKey: MessageKey, items: readonly { value: T; key: MessageKey }[], get: () => T, set: (v: T) => void): HTMLElement => {
      const row = h('div', { class: 'walk-lab__row' }, h('span', { class: 'walk-lab__label', text: t(labelKey) }));
      for (const item of items) {
        const btn = button(t(item.key), () => {
          set(item.value);
          refresh();
        }, 'btn btn--small');
        btn.dataset.value = item.value;
        row.append(btn);
      }
      row.dataset.get = '';
      refreshers.push(() => {
        const cur = get();
        for (const b of row.querySelectorAll<HTMLButtonElement>('button')) b.classList.toggle('is-active', b.dataset.value === cur);
      });
      return row;
    };
    const refreshers: (() => void)[] = [];
    const refresh = (): void => {
      for (const r of refreshers) r();
    };

    const slider = (labelKey: 'walkLab.speed' | 'walkLab.anim', get: () => number, set: (v: number) => void): HTMLElement => {
      const label = h('label', { text: t(labelKey, { n: get().toFixed(2) }) });
      const input = h('input', {
        class: 'walk-lab__range',
        attrs: { type: 'range', min: '0.25', max: '2.5', step: '0.05', value: String(get()), 'aria-label': t(labelKey, { n: get().toFixed(2) }) },
        on: {
          input: () => {
            set(Number(input.value));
            label.textContent = t(labelKey, { n: Number(input.value).toFixed(2) });
          },
        },
      });
      refreshers.push(() => {
        input.value = String(get());
        label.textContent = t(labelKey, { n: get().toFixed(2) });
      });
      return h('div', { class: 'walk-lab__slider' }, label, input);
    };

    const playRow = h(
      'div',
      { class: 'walk-lab__row' },
      h('span', { class: 'walk-lab__label', text: t('walkLab.play') }),
      ...(
        [
          ['normal', 'walkLab.playNormal', () => { state.paused = false; state.timeScale = 1; }],
          ['slow', 'walkLab.playSlow', () => { state.paused = false; state.timeScale = 0.25; }],
          ['pause', 'walkLab.playPause', () => { state.paused = true; }],
        ] as const
      ).map(([value, key, fn]) => {
        const b = button(t(key), () => {
          fn();
          refresh();
        }, 'btn btn--small');
        b.dataset.value = value;
        return b;
      }),
      button(t('walkLab.playStep'), () => {
        state.paused = true;
        state.stepFrames += 1;
        refresh();
      }, 'btn btn--small'),
    );
    refreshers.push(() => {
      const cur = state.paused ? 'pause' : state.timeScale < 1 ? 'slow' : 'normal';
      for (const b of playRow.querySelectorAll<HTMLButtonElement>('button[data-value]')) b.classList.toggle('is-active', b.dataset.value === cur);
    });

    const panel = h(
      'div',
      { class: 'walk-lab__panel' },
      choice('walkLab.gender', [{ value: 'male', key: 'newGame.male' }, { value: 'female', key: 'newGame.female' }], () => gender, (v) => {
        gender = v;
        buildView();
      }),
      choice('walkLab.place', [{ value: 'town', key: 'walkLab.placeTown' }, { value: 'dungeon', key: 'walkLab.placeDungeon' }], () => place, (v) => {
        place = v;
        buildView();
        applyMode();
      }),
      choice('walkLab.dir', DIRS.map((d) => ({ value: d, key: `walkLab.dir.${d}` as MessageKey })), () => facing, (v) => {
        facing = v;
        applyMode();
      }),
      choice(
        'walkLab.state',
        [{ value: 'idle', key: 'walkLab.stateIdle' }, { value: 'walk', key: 'walkLab.stateWalk' }, { value: 'run', key: 'walkLab.stateRun' }] as const,
        () => state.treadmill?.mode ?? 'walk',
        (v) => {
          if (state.treadmill) state.treadmill = { ...state.treadmill, mode: v };
          else state.treadmill = { dir: baseDir(facing), diag: isDiagonal(facing) ? facing : null, mode: v };
          mode = 'treadmill';
          applyMode();
        },
      ),
      choice(
        'walkLab.mode',
        [{ value: 'treadmill', key: 'walkLab.modeTreadmill' }, { value: 'fixed', key: 'walkLab.modeFixed' }, { value: 'follow', key: 'walkLab.modeFollow' }] as const,
        () => mode,
        (v) => {
          mode = v;
          applyMode();
        },
      ),
      // 拡大は 3 倍まで（街の実寸 111.8px × 3 ＝ 335px で、上の表示の高さ 400px に足まで収まる）
      choice('walkLab.zoom', [{ value: '1', key: 'walkLab.zoomActual' }, { value: '2', key: 'walkLab.zoomX2' }, { value: '3', key: 'walkLab.zoomX3' }] as const, () => String(zoomMul) as '1' | '2' | '3', (v) => {
        zoomMul = Number(v);
        state.zoom = ACTUAL_ZOOM[place] * zoomMul;
      }),
      playRow,
      slider('walkLab.speed', () => state.speedScale, (v) => { state.speedScale = v; }),
      slider('walkLab.anim', () => state.animScale, (v) => { state.animScale = v; }),
      h(
        'div',
        { class: 'walk-lab__row' },
        button(t('walkLab.reset'), () => {
          Object.assign(state, DEFAULT_STATE(), { zoom: ACTUAL_ZOOM[place] });
          zoomMul = 1;
          facing = 'left';
          mode = 'treadmill';
          applyMode();
        }, 'btn btn--small'),
        button(t('walkLab.resetPos'), () => view?.resetPosition(), 'btn btn--small'),
        button(`${t('walkLab.overlays')}：${t(state.overlays ? 'walkLab.on' : 'walkLab.off')}`, () => {
          state.overlays = !state.overlays;
          refresh();
        }, 'btn btn--small walk-lab__overlay'),
      ),
      art,
      h('p', { class: 'walk-lab__note', text: t('walkLab.note') }),
    );
    refreshers.push(() => {
      const b = panel.querySelector<HTMLButtonElement>('.walk-lab__overlay');
      if (b) b.textContent = `${t('walkLab.overlays')}：${t(state.overlays ? 'walkLab.on' : 'walkLab.off')}`;
    });

    element.append(createScreenHeader({ title: t('walkLab.title'), back: { label: t('walkLab.back'), onTap: () => ctx.reset('title') } }), stage, read, panel);
    buildView();
    applyMode();
    return {
      element,
      destroy: () => {
        view?.destroy();
        view = null;
      },
    };
  },
};
