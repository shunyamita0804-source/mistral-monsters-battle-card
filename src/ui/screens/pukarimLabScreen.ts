import { getMonster } from '../../data/cards.ts';
import { BOOSTERS, type BoosterKey } from '../../data/introV2.ts';
import { PUKARIM_MONSTER_ID, PUKARIM_SKILLS } from '../../data/pukarim.ts';
import { PUKARIM_EFFECT_CHECK_16, pukarimSwapDeck } from '../../game/battle/playtest.ts';
import type { Deck } from '../../game/deck/deck.ts';
import { boosterDeck } from '../../game/story/introV2.ts';
import { t } from '../../i18n/i18n.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { createBattleMonsterCard } from '../components/battleMonsterCard.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { createSkillCard } from '../components/skillCard.ts';
import { button, h } from '../dom.ts';
import type { ScreenDefinition } from './types.ts';

/**
 * プカリムの試遊の画面（確認用・2026-10-28 新モンスター制作の手順 4）。?qa=1 のときだけ、設定の「QA用」の欄から入れる（ふつうに遊んでいる人には出ない）。
 * - プカリムのバトル用カードと技カード14枚（技の絵はまだ無いので「絵が無いとき」の見た目）
 * - プカリム入りのデッキで対戦（相手は元のデッキか、プカリム入りのデッキ）。どちらのデッキも借り物で、所持カード・セーブのデッキは変えない
 * 自動の対戦で勝率を出すのは npm run playtest:pukarim（tests/pukarimPlaytest.test.ts）。結果は docs/pukarim.md
 */

/** 確認用の対戦で入れ替える位置（箱の3体目：旅立ち＝ミュロル・烈火＝ノビトン・蒼海＝ノビトン） */
const LAB_SLOT = 2;

type OpponentChoice = BoosterKey | `puk:${BoosterKey}`;

/** ブースターの箱の名前（worldScreen.ts の箱を選ぶ画面と同じ文） */
const boosterName = (key: BoosterKey): string => t(`introV2.pack.name.${key.slice(-1)}` as MessageKey);

export const pukarimLabScreen: ScreenDefinition = {
  id: 'pukarimLab',
  titleKey: 'pukarimLab.title',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen pukarim-lab' });
    /** 自分のデッキ（check＝効果を確かめる用：旅立ちのきらめき＋プカリムで、ほっぺにためる・おいかぜ・ぷはーっ・おおつむじを多めに） */
    let mine: BoosterKey | 'check' = 'booster-1';
    let theirs: OpponentChoice = 'puk:booster-2';

    const deckOf = (c: OpponentChoice): Deck => (c.startsWith('puk:') ? pukarimSwapDeck(c.slice(4) as BoosterKey, LAB_SLOT) : boosterDeck(c as BoosterKey));
    const label = (c: OpponentChoice): string => (c.startsWith('puk:') ? t('pukarimLab.withPukarim', { box: boosterName(c.slice(4) as BoosterKey) }) : boosterName(c as BoosterKey));

    const startBattle = (): void => {
      const opponentDeck = deckOf(theirs);
      store.pendingBattle = {
        title: t('pukarimLab.battleTitle'),
        opponent: { id: 'qa-pukarim', name: t('pukarimLab.opponent'), monsters: opponentDeck.monsters, lifeScale: 1 },
        opponentDeck,
        playerDeck: mine === 'check' ? pukarimSwapDeck('booster-1', LAB_SLOT, PUKARIM_EFFECT_CHECK_16) : deckOf(`puk:${mine}`),
        allowSurrender: true,
        onFinish: () => ctx.reset('pukarimLab'),
      };
      ctx.navigate('battle');
    };

    const choice = <T extends string>(value: T, current: T, text: string, pick: (v: T) => void): HTMLButtonElement => {
      const b = button(text, () => {
        pick(value);
        render();
      }, `btn btn--small pukarim-lab__choice${value === current ? ' is-active' : ''}`);
      b.setAttribute('aria-pressed', String(value === current));
      return b;
    };

    const render = (): void => {
      const keys = BOOSTERS.map((b) => b.key);
      element.replaceChildren(
        createScreenHeader({ title: t('pukarimLab.title'), back: { label: t('common.back'), onTap: () => ctx.back('settings') } }),
        h(
          'div',
          { class: 'screen__body pukarim-lab__body' },
          h('p', { class: 'pukarim-lab__note', text: t('pukarimLab.note') }),
          h(
            'section',
            { class: 'pukarim-lab__section' },
            h('h2', { class: 'pukarim-lab__heading', text: t('pukarimLab.cards') }),
            h(
              'div',
              { class: 'pukarim-lab__cards' },
              h('div', { class: 'pukarim-lab__monster' }, createBattleMonsterCard(getMonster(PUKARIM_MONSTER_ID), 110)),
              ...PUKARIM_SKILLS.map((s) => createSkillCard(s, { width: 110, showText: true })),
            ),
          ),
          h(
            'section',
            { class: 'pukarim-lab__section' },
            h('h2', { class: 'pukarim-lab__heading', text: t('pukarimLab.battle') }),
            h('p', { class: 'pukarim-lab__label', text: t('pukarimLab.mine') }),
            h(
              'div',
              { class: 'pukarim-lab__row' },
              ...keys.map((k) => choice<BoosterKey | 'check'>(k, mine, t('pukarimLab.withPukarim', { box: boosterName(k) }), (v) => (mine = v))),
              choice<BoosterKey | 'check'>('check', mine, t('pukarimLab.effectCheck'), (v) => (mine = v)),
            ),
            h('p', { class: 'pukarim-lab__label', text: t('pukarimLab.theirs') }),
            h(
              'div',
              { class: 'pukarim-lab__row' },
              ...[...keys, ...keys.map((k) => `puk:${k}` as const)].map((k) => choice<OpponentChoice>(k, theirs, label(k), (v) => (theirs = v))),
            ),
            button(t('pukarimLab.start'), startBattle, 'btn btn--primary pukarim-lab__start'),
          ),
        ),
      );
    };
    render();
    return { element };
  },
};
