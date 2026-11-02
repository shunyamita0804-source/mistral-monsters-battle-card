import { getMonster, getSkill } from '../../data/cards.ts';
import type { BoosterKey } from '../../data/introV2.ts';
import type { CpuSkill } from '../../data/tournaments.ts';
import { SOUKAI_TIDE_T1, soukaiTideDeck } from '../../game/battle/playtest.ts';
import { boosterDeck } from '../../game/story/introV2.ts';
import { t } from '../../i18n/i18n.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { createBattleMonsterCard } from '../components/battleMonsterCard.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { createSkillCard } from '../components/skillCard.ts';
import { button, h } from '../dom.ts';
import type { ScreenDefinition } from './types.ts';

/**
 * 蒼海の守り「みちしおあり」（T1）を試す画面（確認用・2026-11-02 指示書 AP）。?qa=1 のときだけ、設定の「QA用」の欄か ?qa=1&lab=soukai から入れる（ふつうに遊んでいる人には出ない）。
 * - 自分：蒼海の守り（ゲームの箱）に、カルシェルの みちしお 1・タイダルクラッシュ 1 を入れたデッキ（はさむ 3→2・すなをほる 2→1）。src/game/battle/playtest.ts の soukaiTideDeck
 * - 相手：旅立ち・烈火の箱。腕前 B・A を選べる
 * どちらのデッキも借り物で、所持カード・セーブのデッキは変えない。作り・見た目のクラスはプカリムの試遊の画面と同じ
 */
type Theirs = Extract<BoosterKey, 'booster-1' | 'booster-2'>;

/** ブースターの箱の名前（worldScreen.ts の箱を選ぶ画面と同じ文） */
const boosterName = (key: BoosterKey): string => t(`introV2.pack.name.${key.slice(-1)}` as MessageKey);

export const soukaiLabScreen: ScreenDefinition = {
  id: 'soukaiLab',
  titleKey: 'soukaiLab.title',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen pukarim-lab' });
    let theirs: Theirs = 'booster-1';
    let skill: CpuSkill = 'B';

    const startBattle = (): void => {
      const opponentDeck = boosterDeck(theirs);
      store.pendingBattle = {
        title: t('soukaiLab.battleTitle'),
        opponent: { id: 'qa-soukai', name: t('pukarimLab.opponent'), monsters: opponentDeck.monsters, lifeScale: 1, skill },
        opponentDeck,
        playerDeck: soukaiTideDeck(),
        allowSurrender: true,
        onFinish: () => ctx.reset('soukaiLab'),
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
      const mine = soukaiTideDeck();
      const added = Object.entries(SOUKAI_TIDE_T1).filter(([, n]) => n > 0).map(([id]) => getSkill(id));
      element.replaceChildren(
        createScreenHeader({ title: t('soukaiLab.title'), back: { label: t('common.back'), onTap: () => ctx.back('settings') } }),
        h(
          'div',
          { class: 'screen__body pukarim-lab__body' },
          h('p', { class: 'pukarim-lab__note', text: t('soukaiLab.note') }),
          h(
            'section',
            { class: 'pukarim-lab__section' },
            h('div', { class: 'pukarim-lab__cards' }, ...mine.monsters.map((id) => h('div', { class: 'pukarim-lab__monster' }, createBattleMonsterCard(getMonster(id), 96)))),
            h('h2', { class: 'pukarim-lab__heading', text: t('soukaiLab.changed') }),
            h('div', { class: 'pukarim-lab__cards' }, ...added.map((s) => createSkillCard(s, { width: 110, showText: true }))),
          ),
          h(
            'section',
            { class: 'pukarim-lab__section' },
            h('p', { class: 'pukarim-lab__label', text: t('soukaiLab.theirs') }),
            h('div', { class: 'pukarim-lab__row' }, ...(['booster-1', 'booster-2'] as const).map((k) => choice<Theirs>(k, theirs, boosterName(k), (v) => (theirs = v)))),
            h('p', { class: 'pukarim-lab__label', text: t('soukaiLab.skill') }),
            h(
              'div',
              { class: 'pukarim-lab__row' },
              choice<CpuSkill>('B', skill, t('soukaiLab.skillB'), (v) => (skill = v)),
              choice<CpuSkill>('A', skill, t('soukaiLab.skillA'), (v) => (skill = v)),
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
