import { h } from '../dom.ts';

/**
 * 対戦の始まりの「あなた VS 相手」（2026-10-26 デザイン第8弾の VS の部品。assets/images/ui/vs/）。
 * 自分の名札（紺・顔の丸い窓は左）、真ん中に VS の紋章、相手の名札（えんじ・丸い窓は右）を、斜めにずらして並べる。
 * 文字（名前・VS）はゲームが重ねる。顔の窓に入れるもの（顔の絵・モンスターのアイコン）は呼ぶ側で作る
 */
export interface VersusSide {
  readonly name: string;
  readonly face: HTMLElement;
}

function plate(side: 'player' | 'opponent', v: VersusSide): HTMLElement {
  return h(
    'div',
    { class: `battle-vs__plate battle-vs__plate--${side}` },
    h('span', { class: 'battle-vs__face' }, v.face),
    h('span', { class: 'battle-vs__name', text: v.name }),
  );
}

export function versusBanner(player: VersusSide, opponent: VersusSide): HTMLElement {
  return h(
    'div',
    { class: 'battle-vs', attrs: { 'aria-label': `${player.name} VS ${opponent.name}` } },
    plate('player', player),
    h('span', { class: 'battle-vs__emblem', attrs: { 'aria-hidden': 'true' } }, h('span', { class: 'battle-vs__vs', text: 'VS' })),
    plate('opponent', opponent),
  );
}
