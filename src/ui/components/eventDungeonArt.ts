import mistMineArt from '@assets/images/ui/dungeon_intro/mist_mine_art.webp';
import mistMineOverlay from '@assets/images/ui/dungeon_intro/mist_mine_overlay.webp';
import mistMineTitle from '@assets/images/ui/dungeon_intro/mist_mine_title.webp';
import archiveArt from '@assets/images/ui/dungeon_intro/archive_art.webp';
import archiveOverlay from '@assets/images/ui/dungeon_intro/archive_overlay.webp';
import archiveTitle from '@assets/images/ui/dungeon_intro/archive_title.webp';
import altarArt from '@assets/images/ui/dungeon_intro/altar_art.webp';
import altarOverlay from '@assets/images/ui/dungeon_intro/altar_overlay.webp';
import altarTitle from '@assets/images/ui/dungeon_intro/altar_title.webp';
import mistMineBattleBg from '@assets/images/backgrounds/battle_mist_mine.webp';
import archiveBattleBg from '@assets/images/backgrounds/battle_archive.webp';
import altarBattleBg from '@assets/images/backgrounds/battle_altar.webp';
import mistMineBossMark from '@assets/images/maps/dungeon/boss_mark_mist_mine.webp';
import archiveBossMark from '@assets/images/maps/dungeon/boss_mark_archive.webp';
import altarBossMark from '@assets/images/maps/dungeon/boss_mark_altar.webp';
import type { FloorDecorKind } from '../../game/dungeon/decor.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';

/**
 * イベントのダンジョン3つ（霧の廃坑・忘れられた書庫・静かなる祭壇）の見た目の割り当て（2026-10-29 届いた正式な絵。
 * 原本 design-parts/event-dungeons3-20261029/、切り出し tools/design/event_dungeons3_build.py）。
 *
 * **まだダンジョンとしては足さない**（仕掛け・階の数・ボス・物語・入り方が決まっていない。世界地図・ダンジョンの一覧には出ない）。
 * あとで足すときにすぐ使えるよう、今のダンジョンと同じ形で書いておく。いまは ?qa=1 の確認用の画面（eventDungeonLabScreen.ts）だけが使う。
 * - id：仮の ID。ダンジョンとして足すときは、この ID で src/data/dungeons.ts・dungeonRun.ts に足す（別の ID にするなら、ここ・dungeonIntro.ts・
 *   eventDungeons.css の .drun--{id}・decor.ts の飾りの決まりも合わせて書きかえる）
 * - 床・壁・階段・ボスのしるし：src/ui/styles/eventDungeons.css の .drun--{id}（ランダム生成のダンジョンの画面がルートに付けるクラスと同じ形）
 * - 床の上の飾り：src/game/dungeon/decor.ts の DECOR_RULES（{id} の決まり）と eventDungeons.css の .drun__decor--{種類}-{番号}
 * - 入ったときの挿絵・名前の絵・重ねる輪：dungeonIntro.ts の DUNGEON_INTRO（{id}）
 * - 対戦の背景：battleBg（dungeonRunScreen.ts の RUN_BATTLE_BG と同じ使い方。ボス戦もこの背景にするかは足すときに決める）
 */
export interface EventDungeonArt {
  readonly id: string;
  /** 名前（i18n の world.eventDungeon.*） */
  readonly nameKey: MessageKey;
  readonly intro: { readonly art: string; readonly title: string; readonly overlay: string; readonly artX: string };
  readonly battleBg: string;
  readonly bossMark: string;
  /** 床の上の飾り（種類と絵の数。確認用の画面で1つずつ並べる） */
  readonly decor: readonly { readonly kind: FloorDecorKind; readonly variants: number }[];
}

export const EVENT_DUNGEON_ART: readonly EventDungeonArt[] = [
  {
    id: 'event-mist-mine',
    nameKey: 'world.eventDungeon.mistMine',
    intro: { art: mistMineArt, title: mistMineTitle, overlay: mistMineOverlay, artX: '50%' },
    battleBg: mistMineBattleBg,
    bossMark: mistMineBossMark,
    decor: [
      { kind: 'rail', variants: 2 },
      { kind: 'ore', variants: 2 },
      { kind: 'fog', variants: 2 },
    ],
  },
  {
    id: 'event-archive',
    nameKey: 'world.eventDungeon.archive',
    intro: { art: archiveArt, title: archiveTitle, overlay: archiveOverlay, artX: '50%' },
    battleBg: archiveBattleBg,
    bossMark: archiveBossMark,
    decor: [
      { kind: 'rug', variants: 3 },
      { kind: 'books', variants: 2 },
      { kind: 'slab', variants: 2 },
      { kind: 'candlestand', variants: 1 },
    ],
  },
  {
    id: 'event-altar',
    nameKey: 'world.eventDungeon.altar',
    intro: { art: altarArt, title: altarTitle, overlay: altarOverlay, artX: '50%' },
    battleBg: altarBattleBg,
    bossMark: altarBossMark,
    decor: [
      { kind: 'lantern', variants: 2 },
      { kind: 'emblem', variants: 1 },
      { kind: 'pillar', variants: 2 },
    ],
  },
];
