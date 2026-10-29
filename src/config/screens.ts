/**
 * 画面ID一覧。
 *
 * 画面を追加するときは、ここにIDを足し、src/ui/screens/registry.ts に画面定義を登録する。
 * 街・家・ショップ・大会会場・ダンジョンの歩行は、セーブの現在地に応じて 'world' 画面1つで表示する。
 */
export const SCREEN_IDS = [
  'title',
  /** プロローグ（「最初から」のあと・主人公を選ぶ前の挿絵2枚。2026-10-30） */
  'prologue',
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
  /** プカリムの試遊の画面（確認用。?qa=1 のときだけ設定から入れる。2026-10-28） */
  'pukarimLab',
  /** ジオルの試遊の画面（確認用。?qa=1 のときだけ設定から入れる。2026-10-29） */
  'geolLab',
  /** イベントのダンジョン3つの絵の確認用の画面（?qa=1 のときだけ設定から入れる。2026-10-29） */
  'eventDungeonLab',
] as const;

export type ScreenId = (typeof SCREEN_IDS)[number];

/** 起動時の画面 */
export const INITIAL_SCREEN: ScreenId = 'title';

export function isScreenId(value: string): value is ScreenId {
  return (SCREEN_IDS as readonly string[]).includes(value);
}
