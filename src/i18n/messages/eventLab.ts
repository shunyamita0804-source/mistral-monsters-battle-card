import type { MessageEntry } from '../i18n.ts';

/** イベントのダンジョン3つの絵の確認用の画面（?qa=1 のときだけ入れる。src/ui/screens/eventDungeonLabScreen.ts） */
export const EVENT_LAB = {
  'eventLab.title': { ja: 'イベントのダンジョンの絵（確認用）', en: 'Event Dungeon Art (QA)' },
  'eventLab.note': {
    ja: '確認用の画面です。3つのダンジョンは、仕掛け・階・ボス・物語がまだ決まっていないので、ふつうに遊んでいる人には出ません。',
    en: 'QA screen. These three dungeons are not in the game yet (gimmicks, floors, bosses and story are not decided).',
  },
  'eventLab.intro': { ja: '{name}に入ったときの絵を見る', en: 'Show the {name} entrance art' },
  'eventLab.room': { ja: '見本の部屋（床・壁・階段・飾り・ボスのしるし）', en: 'Sample room (floor, walls, stairs, decorations, boss mark)' },
  'eventLab.pictures': { ja: '対戦の背景・ボスの間のしるし', en: 'Battle background and boss mark' },
  'eventLab.battleBg': { ja: '対戦の背景', en: 'Battle background' },
  'eventLab.bossMark': { ja: 'ボスの間のしるし（マゼンタの上）', en: 'Boss mark (on magenta)' },
} as const satisfies Record<string, MessageEntry>;
