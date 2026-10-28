import { cardCatalog } from '../../data/cards.ts';
import type { GachaSeries } from '../../data/economy.ts';
import { seriesLineup, tierOf, type GachaTier } from '../../game/economy/gachaSeries.ts';
import type { CardDefinition } from '../../game/cards/cardTypes.ts';
import { t } from '../../i18n/i18n.ts';
import { button, h } from '../dom.ts';
import { once } from '../gameStore.ts';
import { sound } from '../sound.ts';
import { createBattleMonsterCard } from './battleMonsterCard.ts';
import { openCardDetail } from './cardDetail.ts';
import { createCardView } from './cardView.ts';
import { seriesPackUrl } from './gachaArt.ts';
import { createPlayCard } from './skillCard.ts';
import cardBackArt from '@assets/images/ui/card_back.webp';
import openBurstArt from '@assets/images/ui/gacha/open_burst.webp';

/**
 * パックを開けてカードをめくる画面（2026-10-28 作り直し。指示書の「4. 開ける」「5. めくる」）。
 * - 開ける：選んだシリーズのパックが大きく出る。上から約17％の所を指で横になぞると破れる（なぞった所に光の線。パックの幅の60％なぞったら破れる）。
 *   破れた瞬間に open_burst と packOpen の音
 * - めくる：5枚が重なって出て、いちばん上が表に返る。タップ、または好きな方向へスライドすると、そのカードがその向きへ飛んでいき（タップなら左上へ）、
 *   次のカードが表に返る。最後の1枚の前は少し間をおいて「最後の1枚…！」
 *   カードはゲームの今のカードの見た目（技＝マナ・ダメージの入ったカード、モンスター＝バトル用カード）。飛ばしたカードは下に小さく並べ、初めてのカードに「NEW」
 *   レア枠：光の筋＋cardReveal（文字は出さない）。モンスター：画面が白く光り、open_burst・reward・「モンスターカード！」
 * - 全部めくったら「もう1回」「もどる」
 * 時間・動きはお試しページ（design-parts/gacha-20261028/prototype/gacha_prototype_reference.html）に合わせた
 */
/** 破れる線（パックの上からの割合） */
const TEAR_AT = 0.17;
/** なぞり始めてよい所（パックの上からこの割合まで。下のほうをなぞっても破れない） */
const TEAR_ZONE = 0.45;
/** 破れるまでになぞる長さ（パックの幅に対する割合） */
const TEAR_NEED = 0.6;
const TORN_MS = 550;
const FIRST_FLIP_MS = 160;
const NEXT_FLIP_MS = 180;
const LAST_FLIP_MS = 900;
/** スライドとみなす指の動き（論理px） */
const SWIPE_MIN = 20;
const SKILL_W = 216;
const MONSTER_W = 250;
const MINI_W = 46;

export interface GachaOpenOptions {
  readonly series: GachaSeries;
  readonly cards: readonly string[];
  /** 買う前に持っていた枚数（初めてのカードに NEW） */
  readonly before: Readonly<Record<string, number>>;
  readonly owned: (cardId: string) => number;
  readonly onAgain: () => void;
  readonly onBack: () => void;
}

/** 表の面：技＝今のカード（マナ・ダメージ・技名・説明入り）、モンスター＝バトル用カード */
function cardFace(card: CardDefinition): HTMLElement {
  if (card.kind === 'monster') return createBattleMonsterCard(card, MONSTER_W);
  return createPlayCard(card, { width: SKILL_W, showText: true });
}

export function showGachaOpen(root: HTMLElement, options: GachaOpenOptions): void {
  const { series, cards } = options;
  const lineup = seriesLineup(series);
  const packUrl = seriesPackUrl(series);
  const hint = h('p', { class: 'gacha-open__hint', text: t('gacha.tearHint') });
  const table = h('div', { class: 'gacha-open__table' });
  const tray = h('div', { class: 'gacha-open__tray' });
  const again = button(t('gacha.again'), () => finishWith(options.onAgain), 'btn btn--primary gacha-open__again');
  const back = button(t('common.back'), () => finishWith(options.onBack), 'btn gacha-open__return');
  const actions = h('div', { class: 'gacha-open__actions' }, back, again);
  actions.hidden = true;
  const flash = h('div', { class: 'gacha-open__flash', attrs: { 'aria-hidden': 'true' } });
  const burst = h('img', { class: 'gacha-open__burst', attrs: { src: openBurstArt, alt: '', draggable: 'false', 'aria-hidden': 'true' } });
  const word = h('p', { class: 'gacha-open__word', attrs: { 'aria-live': 'polite' } });
  const overlay = h('div', { class: 'gacha-open', dataset: { series: series.id } }, hint, table, tray, actions, flash, burst, word);
  const finishWith = once((next: () => void) => {
    overlay.remove();
    next();
  });

  // ===== めくる山（下に重ねておき、破れたら見せる） =====
  const tiers: GachaTier[] = cards.map((id) => tierOf(lineup, id));
  const seen = new Set<string>();
  const items = cards.map((id, i) => {
    const card = cardCatalog.get(id);
    const isNew = (options.before[id] ?? 0) === 0 && !seen.has(id);
    seen.add(id);
    const face = card ? cardFace(card) : h('div');
    const isMonster = card?.kind === 'monster';
    const el = h(
      'div',
      { class: `gacha-open__card${isMonster ? ' is-monster' : ''}${tiers[i] === 'rare' ? ' is-rare' : ''}` },
      h(
        'div',
        { class: 'gacha-open__flip' },
        h('img', { class: 'gacha-open__back', attrs: { src: cardBackArt, alt: '', draggable: 'false' } }),
        h('div', { class: 'gacha-open__face' }, face, h('span', { class: 'gacha-open__shine' })),
      ),
    );
    el.style.zIndex = String(cards.length - i);
    el.style.setProperty('--i', String(i));
    return { id, card, el, isNew };
  });
  const stack = h('div', { class: 'gacha-open__stack' }, ...items.map((it) => it.el));
  table.append(stack);

  // ===== 開ける：パックの上のほうを横になぞる =====
  const packArt = (cls: string): HTMLElement => h('img', { class: cls, attrs: { src: packUrl, alt: '', draggable: 'false' } });
  const line = h('span', { class: 'gacha-open__line' });
  const guide = h('span', { class: 'gacha-open__guide', attrs: { 'aria-hidden': 'true' } });
  const pack = h('div', { class: 'gacha-open__pack', attrs: { role: 'img', 'aria-label': t('gacha.tearHint') } }, packArt('gacha-open__pack-body'), packArt('gacha-open__pack-lid'), guide, line);
  pack.style.setProperty('--tear', `${TEAR_AT * 100}%`);
  table.append(pack);
  let startX: number | null = null;
  let reach = 0;
  let torn = false;
  pack.addEventListener('pointerdown', (e) => {
    if (torn) return;
    const r = pack.getBoundingClientRect();
    if (e.clientY - r.top > r.height * TEAR_ZONE) return;
    pack.setPointerCapture(e.pointerId);
    startX = e.clientX;
    reach = 0;
  });
  pack.addEventListener('pointermove', (e) => {
    if (startX === null || torn) return;
    const r = pack.getBoundingClientRect();
    const dx = Math.abs(e.clientX - startX);
    if (dx > reach) reach = dx;
    line.style.width = `${Math.min(100, (reach / (r.width * TEAR_NEED)) * 100)}%`;
    line.style.left = `${Math.max(0, Math.min(startX, e.clientX) - r.left)}px`;
    if (reach >= r.width * TEAR_NEED) tear();
  });
  const releaseTear = (): void => {
    if (torn) return;
    startX = null;
    line.style.width = '0';
  };
  pack.addEventListener('pointerup', releaseTear);
  pack.addEventListener('pointercancel', releaseTear);

  const pop = (el: HTMLElement): void => {
    el.classList.remove('is-go');
    void el.offsetWidth;
    el.classList.add('is-go');
  };

  const tear = (): void => {
    if (torn) return;
    torn = true;
    startX = null;
    sound.play('packOpen');
    pop(burst);
    pack.classList.add('is-torn');
    stack.classList.add('is-shown');
    setTimeout(() => {
      pack.remove();
      startReveal();
    }, TORN_MS);
  };

  // ===== めくる =====
  let idx = 0;
  let lock = true;
  const flipTop = (): void => {
    const it = items[idx];
    if (!it) return;
    it.el.classList.add('is-face');
    sound.play('cardFlip');
    const tier = tiers[idx];
    if (tier === 'monster') {
      pop(flash);
      pop(burst);
      word.textContent = t('gacha.monsterCard');
      pop(word);
      sound.play('reward');
    } else if (tier === 'rare') {
      sound.play('cardReveal');
    }
    lock = false;
  };

  const next = (dx: number, dy: number): void => {
    const it = items[idx];
    if (lock || !it) return;
    lock = true;
    const len = Math.hypot(dx, dy);
    // スライドした向きへ。タップなら左上へ
    const vx = len > SWIPE_MIN ? dx / len : -0.9;
    const vy = len > SWIPE_MIN ? dy / len : -0.44;
    it.el.style.setProperty('--fly-x', `${(vx * 460).toFixed(0)}px`);
    it.el.style.setProperty('--fly-y', `${(vy * 460).toFixed(0)}px`);
    it.el.style.setProperty('--fly-r', `${(vx * 18).toFixed(1)}deg`);
    it.el.classList.add('is-flown');
    sound.play('cardDraw');
    const mini = h(
      'button',
      { class: 'gacha-open__mini', attrs: { type: 'button' }, on: { click: () => it.card && openCardDetail(overlay, it.card, { owned: options.owned(it.id) }) } },
      it.card ? createCardView(it.card, MINI_W, false) : null,
      it.isNew ? h('span', { class: 'gacha-open__new', text: t('gacha.new') }) : null,
    );
    tray.append(mini);
    idx += 1;
    if (idx < items.length) {
      const last = idx === items.length - 1;
      if (last) hint.textContent = t('gacha.lastCard');
      setTimeout(flipTop, last ? LAST_FLIP_MS : NEXT_FLIP_MS);
    } else {
      hint.textContent = t('gacha.allDone');
      actions.hidden = false;
    }
  };

  const startReveal = (): void => {
    hint.textContent = t('gacha.flipHint');
    let sx: number | null = null;
    let sy = 0;
    table.addEventListener('pointerdown', (e) => {
      // 台の外で指を離しても受け取れるように（外へ大きくスライドしたとき）
      table.setPointerCapture(e.pointerId);
      sx = e.clientX;
      sy = e.clientY;
    });
    table.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      next(e.clientX - sx, e.clientY - sy);
      sx = null;
    });
    table.addEventListener('pointercancel', () => {
      sx = null;
    });
    setTimeout(flipTop, FIRST_FLIP_MS);
  };

  root.append(overlay);
}
