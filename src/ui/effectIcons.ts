import type { SkillCard } from '../game/cards/cardTypes.ts';
import type { StatusIconId } from './statusIcons.ts';

/**
 * 技カードの効果のアイコン（2026-11-05 指示書 BA【4】→ 指示書 BB で正式の技すべて）。
 * 指示書 BB（ユーザー決定）：技ごとのアイコンは作らない。共通のアイコンを使い回し、違いは角の小さな印と数字の札で見せる。
 * 細かい意味は押したときの説明（今の効果の文そのまま）で伝える。
 *
 * 1つのアイコン＝本体1つ＋小さな印（0〜2つ・本体の右上）＋札（0〜1つ・本体の右下）。本体が2つ要る効果は2つ並べる。
 * カードの効果の文（日本語の正本の文）で決める。表に無い文は null（今の文のまま）。
 */

/** 本体のアイコン */
export type FxMainId = StatusIconId;

/**
 * 小さな印
 * - ally 味方に（M01）・target この相手だけ（S13）・ko 倒れた味方（倒れた印）
 * - ground・air・water 居場所（T01・T02・T03）・force ちから・wisdom かしこさ（分類の印）・charge ためているとき（B09）
 */
export type FxMark = 'ally' | 'target' | 'ko' | 'ground' | 'air' | 'water' | 'force' | 'wisdom' | 'charge';

/** 札：value＝数字の札（N01）、turn＝時計の札（N02。次のターン） */
export interface FxBadge {
  readonly kind: 'value' | 'turn';
  readonly text: string;
}

export interface FxIcon {
  readonly main: FxMainId;
  readonly marks?: readonly FxMark[];
  readonly badge?: FxBadge;
}

const MINUS = '−';
const v = (text: string): FxBadge => ({ kind: 'value', text });
const NEXT_TURN: FxBadge = { kind: 'turn', text: '1' };
const one = (main: FxMainId, marks?: readonly FxMark[], badge?: FxBadge): readonly FxIcon[] => [{ main, ...(marks ? { marks } : {}), ...(badge ? { badge } : {}) }];

const BY_TEXT: Readonly<Record<string, readonly FxIcon[]>> = {
  // ---- 指示書 BA（文が言い切れるもの） ----
  回避されない: one('e01'),
  防御されない: one('e02'),
  回避されても半分のダメージ: one('e03'),
  相手全員にダメージ: one('e04'),
  '相手全員に当たる（守りは1体ずつ）': one('e04'),
  ちから技に効く: one('e05'),
  かしこさ技に効く: one('e06'),
  'ちから技・かしこさ技に効く': [{ main: 'e05' }, { main: 'e06' }],

  // ---- 指示書 BB：回避 ----
  'マナに関係なく、ちから技・かしこさ技を回避': one('e15'),
  条件なしで回避: one('e15'),
  'ちから技・かしこさ技を回避': one('e15'),
  'マナ2以上のちから技・かしこさ技を回避': one('e15', undefined, v('2+')),
  '消費マナ2以上のちから技・かしこさ技を回避': one('e15', undefined, v('2+')),
  'マナ3以上のちから技・かしこさ技を回避': one('e15', undefined, v('3+')),
  ちから技を回避: one('e15', ['force']),
  かしこさ技を回避: one('e15', ['wisdom']),

  // ---- 相手を止める・ねらいを変える ----
  相手1体は次の攻撃を行えない: one('s08'),
  相手は次のターン行動できない: one('s07'),
  '相手は次のターン、ラズックしか攻撃できない': one('s13'),
  '相手は次のターン、リリルしか攻撃できない': one('s13'),
  次のターン攻撃の的にならない: one('s12'),
  '相手は次のターン、リリルを攻撃できない': one('s12'),

  // ---- 強く・弱く ----
  '相手の次のターンのちから技−1': one('b02', undefined, v(`${MINUS}1`)),
  '次の相手のターン、受けるちから技すべて−3': one('e05', undefined, v(`${MINUS}3`)),
  '次の攻撃＋2（使うまで続く）': one('b09', undefined, v('+2')),
  'プカリム以外の味方1体、次のターンの攻撃＋1': one('b09', ['ally'], v('+1')),
  'フォルン以外の味方1体、次のターンの攻撃＋1': one('b09', ['ally'], v('+1')),
  'フォルン以外の味方1体、次の相手のターンに受けるダメージ−1': one('b05', ['ally'], v(`${MINUS}1`)),
  '次のターン、ツムジの攻撃のマナ−1': one('b13', undefined, v(`${MINUS}1`)),
  '次のターン、最初のかしこさ技を2倍に': one('b03', undefined, v('×2')),
  次のターン回避されない: one('e01', undefined, NEXT_TURN),
  次のターン防御されない: one('e02', undefined, NEXT_TURN),
  ためているときは回避されない: one('e01', ['charge']),

  // ---- マナ ----
  '相手のマナ−1': one('b13', undefined, v(`${MINUS}1`)),
  '相手のマナ−3': one('b13', undefined, v(`${MINUS}3`)),
  '相手のマナ−4': one('b13', undefined, v(`${MINUS}4`)),

  // ---- 手札・山札 ----
  相手の手札からランダムに1枚捨てさせる: one('e17'),
  相手の手札をすべて見る: one('e18'),
  相手の手札をすべて見て1枚選んで捨てさせる: [{ main: 'e18' }, { main: 'e17' }],
  '相手の手札1枚をランダムに山札へ（補充なし）': one('e17'),
  相手の手札1枚をランダムに山札へもどす: one('e17'),
  手札をすべて交換: one('e21'),
  '山札から手札が5枚になるまで引き、そのあと手札から1枚捨てる': [{ main: 'e21' }, { main: 'e17' }],
  '手札から1枚山札に戻し、1枚引いて、そのあと山札をシャッフル': one('e21'),
  山札の上から3枚まで確かめる: one('e18', undefined, v('3')),
  同じターンにもう1枚続けて使える: one('e21', undefined, v('+1')),

  // ---- ライフ ----
  '自分のライフ＋2（もとのLIFEまで）': one('b11', undefined, v('+2')),
  '味方1体のライフ＋2': one('b11', ['ally'], v('+2')),
  与えたダメージぶん回復: one('b11'),
  '当たると自分のライフ−1': one('e24', undefined, v(`${MINUS}1`)),
  '当たると自分のライフ−2': one('e24', undefined, v(`${MINUS}2`)),
  '当たると自分のライフ−3': one('e24', undefined, v(`${MINUS}3`)),
  味方への攻撃を代わりに受ける: one('b05', ['ally']),
  // 2026-11-05 指示書 BH：クヨウ。みがわりは かばう に −2 の札。おはらい・まよけのふだは合うアイコンが無いので【仮】（新しい絵が要る）
  '味方への攻撃を代わりに受け、ダメージ−2': one('b05', ['ally'], v(`${MINUS}2`)),
  '味方1体の悪い状態をすべて消し、ライフ＋1（もとのLIFEまで）': one('b11', ['ally'], v('+1')),
  '次の相手のターンの終わりまで、味方全員に悪い状態がつかない': one('b05', ['ally'], NEXT_TURN),

  // ---- 居場所・場 ----
  地上の相手だけに使える: one('t01', ['target']),
  '地上の相手全員に当たる（守りは1体ずつ）': one('e04', ['ground']),
  水中の相手には防御されない: one('e02', ['water']),
  水中の相手は回避できない: one('s09', ['water']),
  空中の相手は回避できない: one('s09', ['air']),
  場が水中なら2倍: one('t03', undefined, v('×2')),
  '相手が空中なら +2（ダメージ4）': one('b09', ['air'], v('+2')),
  '相手全員に1ダメージ。空中の相手には2ダメージ': one('e04', ['air'], v('+1')),
  '次の自分のターンの終わりまで、全モンスターを水中にする': one('e13', ['water']),

  // ---- デスオル ----
  '倒れている味方1体につき＋2': one('b09', ['ko'], v('+2')),
  'ライフ1以下の、デスオル以外のモンスターをすべて倒す': one('e04', undefined, v('≤1')),
};

/** その技の効果のアイコン（アイコンにしない技は null＝今の文のまま。仮のカードなど） */
export function skillEffectIcons(skill: SkillCard): readonly FxIcon[] | null {
  const text = skill.effectTextJa;
  return text ? (BY_TEXT[text] ?? null) : null;
}

/** アイコンにしている効果の文（テスト・報告用） */
export const ICON_EFFECT_TEXTS: readonly string[] = Object.keys(BY_TEXT);
