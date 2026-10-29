import type { DungeonDefinition } from '../../data/dungeons.ts';
import { t } from '../../i18n/i18n.ts';
import { showDungeonIntro } from '../components/dungeonIntro.ts';
import { EVENT_DUNGEON_ART, type EventDungeonArt } from '../components/eventDungeonArt.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { button, h } from '../dom.ts';
import type { ScreenDefinition } from './types.ts';

/**
 * イベントのダンジョン3つの絵の確認用の画面（2026-10-29。?qa=1 のときだけ、設定の「QA用」の欄から。ふつうに遊んでいる人には出ない）。
 * 指示書 design-parts/event-dungeons3-20261029/00_instructions_for_claude_code.txt の 3：
 * - 入ったときの挿絵＋名前の絵＋輪の演出（今のダンジョンに入ったときと同じ動き：dungeonIntro.ts の showDungeonIntro）
 * - 床・壁・階段・飾りを今のダンジョンと同じ並べ方で敷いた見本の部屋（歩けない。1マス 48px でランダム生成の階と同じ見え方）
 * - 対戦の背景・ボスの間のしるし
 */

/** 1マスの大きさ（dungeonRunScreen.ts の TILE と同じ） */
const TILE = 48;

/** 見本の部屋（# 壁・. 床・S 下り階段・B ボスの間のしるし）。7×8マス */
const ROOM: readonly string[] = ['#######', '#.....#', '#.S...#', '#.....#', '#...B.#', '#.....#', '#.....#', '#######'];

/** 飾りを置く床のマス（階段・ボスのしるし〔大きいので上と左右にはみ出す〕のまわりは避ける）。飾りの数（最大8）だけ順に使う */
const DECOR_SPOTS: readonly (readonly [number, number])[] = [
  [4, 1], [1, 4], [5, 2], [2, 6], [5, 6], [1, 1], [3, 6], [1, 6],
];

function sampleRoom(d: EventDungeonArt): HTMLElement {
  const room = h('div', { class: `event-lab__room drun--${d.id}`, attrs: { role: 'img', 'aria-label': t('eventLab.room') } });
  const tiles = ROOM.map((row) => [...row]);
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < (tiles[y]?.length ?? 0); x++) {
      const ch = tiles[y]?.[x];
      const wall = ch === '#';
      const below = tiles[y + 1]?.[x];
      const face = wall && below !== undefined && below !== '#';
      const el = h('div', { class: `drun__tile drun__tile--${wall ? 'wall' : 'floor'}${face ? ' drun__tile--face' : ''}${ch === 'S' ? ' drun__tile--stairs' : ''} is-seen is-lit` });
      el.style.left = `${x * TILE}px`;
      el.style.top = `${y * TILE}px`;
      el.style.setProperty('--ax', `${-x * TILE}px`);
      el.style.setProperty('--ay', `${-y * TILE}px`);
      room.append(el);
      if (ch === 'B') {
        const boss = h('div', { class: 'drun__entity drun__entity--boss is-lit', attrs: { 'aria-hidden': 'true' } });
        boss.style.left = `${x * TILE}px`;
        boss.style.top = `${y * TILE}px`;
        boss.style.filter = 'none';
        room.append(boss);
      }
    }
  }
  // 飾りを1つずつ（種類ごとに、絵の番号順に）
  const decors = d.decor.flatMap((k) => Array.from({ length: k.variants }, (_, i) => `${k.kind}-${i + 1}`));
  decors.forEach((name, i) => {
    const [x, y] = DECOR_SPOTS[i] ?? [1, 1];
    const el = h('div', { class: `drun__decor drun__decor--${name} is-lit`, attrs: { 'aria-hidden': 'true' } });
    el.style.left = `${x * TILE}px`;
    el.style.top = `${y * TILE}px`;
    room.append(el);
  });
  return room;
}

export const eventDungeonLabScreen: ScreenDefinition = {
  id: 'eventDungeonLab',
  titleKey: 'eventLab.title',
  create(ctx) {
    const element = h('main', { class: 'screen event-lab' });
    let current = 0;

    const render = (): void => {
      const d = EVENT_DUNGEON_ART[current] as EventDungeonArt;
      const name = t(d.nameKey);
      const intro = (): void => {
        // 入ったときと同じ動き（まだダンジョンとしては足していないので、名前だけの仮の定義で呼ぶ）
        const def: DungeonDefinition = { id: d.id, name, description: '', floors: [], isPlaceholder: true };
        showDungeonIntro(element, def);
      };
      element.replaceChildren(
        createScreenHeader({ title: t('eventLab.title'), back: { label: t('common.back'), onTap: () => ctx.back('settings') } }),
        h(
          'div',
          { class: 'screen__body event-lab__body' },
          h('p', { class: 'pukarim-lab__note', text: t('eventLab.note') }),
          h(
            'div',
            { class: 'event-lab__tabs' },
            ...EVENT_DUNGEON_ART.map((x, i) => {
              const b = button(t(x.nameKey), () => {
                current = i;
                render();
              }, `btn btn--small${i === current ? ' is-active' : ''}`);
              b.setAttribute('aria-pressed', String(i === current));
              return b;
            }),
          ),
          button(t('eventLab.intro', { name }), intro, 'btn btn--primary'),
          h('h2', { class: 'event-lab__heading', text: t('eventLab.room') }),
          sampleRoom(d),
          h('h2', { class: 'event-lab__heading', text: t('eventLab.pictures') }),
          h(
            'div',
            { class: 'event-lab__pics' },
            h('figure', { class: 'event-lab__pic' }, h('img', { attrs: { src: d.battleBg, alt: t('eventLab.battleBg'), draggable: 'false' } }), h('figcaption', { text: t('eventLab.battleBg') })),
            h('figure', { class: 'event-lab__pic event-lab__pic--mark' }, h('img', { attrs: { src: d.bossMark, alt: t('eventLab.bossMark'), draggable: 'false' } }), h('figcaption', { text: t('eventLab.bossMark') })),
          ),
        ),
      );
    };
    render();
    return { element };
  },
};
