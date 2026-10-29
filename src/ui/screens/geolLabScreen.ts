import { getMonster } from '../../data/cards.ts';
import { BOOSTERS, type BoosterKey } from '../../data/introV2.ts';
import { GEOL_EFFECT_CHECK_16, GEOL_MONSTER_ID, GEOL_PLAYTEST_16, GEOL_SKILLS } from '../../data/geol.ts';
import { swapDeck } from '../../game/battle/playtest.ts';
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
 * ジオルの試遊の画面（確認用・2026-10-29 新モンスター制作の手順 4・G4）。?qa=1 のときだけ、設定の「QA用」の欄から入れる（ふつうに遊んでいる人には出ない）。
 * 作りはプカリムの試遊の画面（pukarimLabScreen.ts）と同じ。見た目のクラスも同じものを使う。
 * - ジオルのバトル用カードと技カード14枚
 * - ジオル入りのデッキで対戦（相手は元のデッキか、ジオル入りのデッキ）。どちらのデッキも借り物で、所持カード・セーブのデッキは変えない
 * 自動の対戦で勝率を出すのは npm run playtest:geol（tests/geolPlaytest.test.ts）。結果は docs/geol.md
 */

/** 確認用の対戦で入れ替える位置（箱の3体目：旅立ち＝ミュロル・烈火＝ノビトン・蒼海＝ノビトン） */
const LAB_SLOT = 2;

type OpponentChoice = BoosterKey | `geol:${BoosterKey}` | `check:${BoosterKey}`;

/** ブースターの箱の名前（worldScreen.ts の箱を選ぶ画面と同じ文） */
const boosterName = (key: BoosterKey): string => t(`introV2.pack.name.${key.slice(-1)}` as MessageKey);

export const geolLabScreen: ScreenDefinition = {
  id: 'geolLab',
  titleKey: 'geolLab.title',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen pukarim-lab geol-lab' });
    /** 自分のデッキ（check＝効果を確かめる用：旅立ちのきらめき＋ジオルで、地ひびき・じならし・エネルギーをためる・かばう・うけとめるを多めに） */
    let mine: BoosterKey | 'check' = 'booster-1';
    let theirs: OpponentChoice = 'geol:booster-2';

    const keyOf = (c: string): BoosterKey => c.slice(c.indexOf(':') + 1) as BoosterKey;
    const deckOf = (c: OpponentChoice): Deck =>
      c.startsWith('geol:')
        ? swapDeck(keyOf(c), LAB_SLOT, GEOL_MONSTER_ID, GEOL_PLAYTEST_16)
        : c.startsWith('check:')
          ? swapDeck(keyOf(c), LAB_SLOT, GEOL_MONSTER_ID, GEOL_EFFECT_CHECK_16)
          : boosterDeck(c as BoosterKey);
    const label = (c: OpponentChoice): string =>
      c.startsWith('geol:')
        ? t('geolLab.withGeol', { box: boosterName(keyOf(c)) })
        : c.startsWith('check:')
          ? t('geolLab.effectCheckOf', { box: boosterName(keyOf(c)) })
          : boosterName(c as BoosterKey);

    const startBattle = (): void => {
      const opponentDeck = deckOf(theirs);
      store.pendingBattle = {
        title: t('geolLab.battleTitle'),
        opponent: { id: 'qa-geol', name: t('geolLab.opponent'), monsters: opponentDeck.monsters, lifeScale: 1 },
        opponentDeck,
        playerDeck: mine === 'check' ? swapDeck('booster-1', LAB_SLOT, GEOL_MONSTER_ID, GEOL_EFFECT_CHECK_16) : deckOf(`geol:${mine}`),
        allowSurrender: true,
        onFinish: () => ctx.reset('geolLab'),
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
        createScreenHeader({ title: t('geolLab.title'), back: { label: t('common.back'), onTap: () => ctx.back('settings') } }),
        h(
          'div',
          { class: 'screen__body pukarim-lab__body' },
          h('p', { class: 'pukarim-lab__note', text: t('pukarimLab.note') }),
          h(
            'section',
            { class: 'pukarim-lab__section' },
            h('h2', { class: 'pukarim-lab__heading', text: t('geolLab.cards') }),
            h(
              'div',
              { class: 'pukarim-lab__cards' },
              h('div', { class: 'pukarim-lab__monster' }, createBattleMonsterCard(getMonster(GEOL_MONSTER_ID), 110)),
              ...GEOL_SKILLS.map((s) => createSkillCard(s, { width: 110, showText: true })),
            ),
          ),
          h(
            'section',
            { class: 'pukarim-lab__section' },
            h('h2', { class: 'pukarim-lab__heading', text: t('geolLab.battle') }),
            h('p', { class: 'pukarim-lab__label', text: t('geolLab.mine') }),
            h(
              'div',
              { class: 'pukarim-lab__row' },
              ...keys.map((k) => choice<BoosterKey | 'check'>(k, mine, t('geolLab.withGeol', { box: boosterName(k) }), (v) => (mine = v))),
              choice<BoosterKey | 'check'>('check', mine, t('geolLab.effectCheck'), (v) => (mine = v)),
            ),
            h('p', { class: 'pukarim-lab__label', text: t('geolLab.theirs') }),
            h(
              'div',
              { class: 'pukarim-lab__row' },
              ...[...keys, ...keys.map((k) => `geol:${k}` as const), `check:${keys[1] ?? 'booster-2'}` as const].map((k) => choice<OpponentChoice>(k, theirs, label(k), (v) => (theirs = v))),
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
