import { BATTLE } from './battle.ts';
import { CARDS } from './cards.ts';
import { COMMON } from './common.ts';
import { DUNGEON_RUN_MESSAGES } from './dungeonRun.ts';
import { SCREENS } from './screens.ts';
import { STORY } from './story.ts';
import { INTRO_V2 } from './introV2.ts';
import { WALK_LAB } from './walkLab.ts';
import { WORLD } from './world.ts';

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
  battle: BATTLE,
  story: STORY,
  introV2: INTRO_V2,
  walkLab: WALK_LAB,
} as const;

export const MESSAGES = {
  ...COMMON,
  ...CARDS,
  ...SCREENS,
  ...WORLD,
  ...DUNGEON_RUN_MESSAGES,
  ...BATTLE,
  ...STORY,
  ...INTRO_V2,
  ...WALK_LAB,
};

export type MessageKey = keyof typeof MESSAGES;
