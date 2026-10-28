import { BATTLE } from './battle.ts';
import { CARDS } from './cards.ts';
import { COMMON } from './common.ts';
import { DUNGEON_RUN_MESSAGES } from './dungeonRun.ts';
import { ITEMS_MESSAGES } from './items.ts';
import { SCREENS } from './screens.ts';
import { STORY } from './story.ts';
import { INTRO_V2 } from './introV2.ts';
import { BOOK } from './book.ts';
import { WALK_LAB } from './walkLab.ts';
import { PUKARIM_LAB } from './pukarimLab.ts';
import { WORLD } from './world.ts';
import { NAME_MESSAGES } from './name.ts';

/**
 * 画面の文字の辞書（固定キー → ja/en）。分野ごとのファイルに分け、ここでまとめる。
 * キーは「分野.用途」。同じキーが2つの分野にあるとテスト（tests/i18n.test.ts）で失敗する。
 */
export const MESSAGE_GROUPS = {
  common: COMMON,
  cards: CARDS,
  screens: SCREENS,
  world: WORLD,
  dungeonRun: DUNGEON_RUN_MESSAGES,
  items: ITEMS_MESSAGES,
  battle: BATTLE,
  story: STORY,
  introV2: INTRO_V2,
  book: BOOK,
  walkLab: WALK_LAB,
  pukarimLab: PUKARIM_LAB,
  name: NAME_MESSAGES,
} as const;

export const MESSAGES = {
  ...COMMON,
  ...CARDS,
  ...SCREENS,
  ...WORLD,
  ...DUNGEON_RUN_MESSAGES,
  ...ITEMS_MESSAGES,
  ...BATTLE,
  ...STORY,
  ...INTRO_V2,
  ...BOOK,
  ...WALK_LAB,
  ...PUKARIM_LAB,
  ...NAME_MESSAGES,
};

export type MessageKey = keyof typeof MESSAGES;
