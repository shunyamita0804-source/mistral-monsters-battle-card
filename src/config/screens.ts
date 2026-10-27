/**
 * 画面ID一覧。
 *
 * 画面を追加するときは、ここにIDを足し、src/ui/screens/registry.ts に画面定義を登録する。
 * 街・家・ショップ・大会会場・ダンジョンの歩行は、セーブの現在地に応じて 'world' 画面1つで表示する。
 */
export const SCREEN_IDS = [
  'title',
  'newGame',
  'world',
  'deck',
  'collection',
  /** 名刺図鑑（家の本棚。2026-10-27） */
  'peopleBook',
  'shopMenu',
  'cardList',
  'gacha',
  /** カードショップの「道具を買う」（2026-10-27） */
  'itemShop',
  'dungeonSelect',
  /** ランダム生成のダンジョン（2026-10-26 試作。挑戦中は 'world' の代わりにこの画面を開く） */
  'dungeonRun',
  'tournament',
  'battle',
  'settings',
  'options',
  /** 歩きの確認画面（開発用。?qa=1 のときだけ入れる） */
  'walkLab',
] as const;

export type ScreenId = (typeof SCREEN_IDS)[number];

/** 起動時の画面 */
export const INITIAL_SCREEN: ScreenId = 'title';

export function isScreenId(value: string): value is ScreenId {
  return (SCREEN_IDS as readonly string[]).includes(value);
}
