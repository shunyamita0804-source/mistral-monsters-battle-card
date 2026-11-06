import { ENCOUNTERS } from '../../data/dungeons.ts';
import { getMonster, skillsOf } from '../../data/cards.ts';
import { BOOSTERS, type BoosterKey } from '../../data/introV2.ts';
import { TYRANT_MONSTER_ID, tyrantSkillId } from '../../data/tyrant.ts';
import { GEAROS_MONSTER_ID, gearosSkillId } from '../../data/gearos.ts';
import { KUYO_MONSTER_ID, kuyoSkillId } from '../../data/kuyo.ts';
import { RADIEL_MONSTER_ID, radielSkillId } from '../../data/radiel.ts';
import { KUROSHIO_MONSTER_ID, kuroshioSkillId } from '../../data/kuroshio.ts';
import { ROUGA_MONSTER_ID, rougaSkillId } from '../../data/rouga.ts';
import { HUGINN_MONSTER_ID, huginnSkillId } from '../../data/huginn.ts';
import { swapDeck } from '../../game/battle/playtest.ts';
import type { Deck } from '../../game/deck/deck.ts';
import { boosterDeck } from '../../game/story/introV2.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { createBattleMonsterCard } from '../components/battleMonsterCard.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { createSkillCard } from '../components/skillCard.ts';
import { button, h } from '../dom.ts';
import type { ScreenDefinition } from './types.ts';

/**
 * 2026-11-05 指示書 AX の確かめ用の画面（?qa=1 のときだけ。設定の「QA用」の欄・?qa=1&lab=tyrant／gearos／kuyo〔指示書 BH〕／radiel〔BI〕／kuroshio〔BK〕／rouga〔BL〕／huginn〔BM〕）。作りはジオルの試遊の画面と同じ。
 * - モンスターのバトル用カードと技カード12枚
 * - そのモンスター入りのデッキで対戦（箱の3体目と入れ替え。どちらのデッキも借り物で、持っているカード・セーブのデッキは変えない）
 * - ギアロスは、機械の塔の守り手テオ（enc-machine-boss。切り札がギアロス）とも対戦できる
 */

/** 入れ替える位置（箱の3体目） */
const LAB_SLOT = 2;

type Pick = readonly { readonly id: string; readonly copies: number }[];

/** 入れ替えの16枚：技12枚を1枚ずつ、足りない分は安い攻撃からもう1枚ずつ（試遊の「レアあり」と同じ） */
function lab16(monsterId: string): Pick {
  const cards = skillsOf(monsterId);
  const counts: Record<string, number> = Object.fromEntries(cards.map((k) => [k.id, 1]));
  let n = cards.length;
  const attacks = cards.filter((k) => k.effect.type === 'attack').sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
  for (let round = 0; n < 16 && round < 2; round++) {
    for (const k of attacks) {
      if (n >= 16) break;
      counts[k.id] = (counts[k.id] ?? 0) + 1;
      n++;
    }
  }
  return cards.map((k) => ({ id: k.id, copies: counts[k.id] ?? 1 }));
}

interface LabSpec {
  readonly id: 'tyrantLab' | 'gearosLab' | 'kuyoLab' | 'radielLab' | 'kuroshioLab' | 'rougaLab' | 'huginnLab';
  readonly monsterId: string;
  /** 新しい効果を目で確かめる用の16枚（新しい効果のカードを多めに） */
  readonly check16: Pick;
  /** 守り手（相手の編成。ギアロスはテオ） */
  readonly bossId?: string;
}

const boosterName = (key: BoosterKey): string => t(`introV2.pack.name.${key.slice(-1)}` as MessageKey);

function makeLab(spec: LabSpec): ScreenDefinition {
  return {
    id: spec.id,
    titleKey: 'axLab.title',
    create(ctx) {
      const store = ctx.store;
      const element = h('main', { class: 'screen pukarim-lab geol-lab' });
      const name = cardName(spec.monsterId);
      type Mine = BoosterKey | 'check';
      type Theirs = BoosterKey | `with:${BoosterKey}` | 'boss';
      let mine: Mine = 'booster-1';
      let theirs: Theirs = spec.bossId ? 'boss' : `with:booster-2`;
      const keyOf = (c: string): BoosterKey => c.slice(c.indexOf(':') + 1) as BoosterKey;
      const withMonster = (k: BoosterKey): Deck => swapDeck(k, LAB_SLOT, spec.monsterId, lab16(spec.monsterId));
      const labelOf = (c: Theirs): string =>
        c === 'boss' && spec.bossId ? t('axLab.boss', { boss: ENCOUNTERS[spec.bossId]?.name ?? '' }) : c.startsWith('with:') ? t('axLab.withMonster', { box: boosterName(keyOf(c)), name }) : boosterName(c as BoosterKey);

      const startBattle = (): void => {
        const playerDeck = mine === 'check' ? swapDeck('booster-1', LAB_SLOT, spec.monsterId, spec.check16) : withMonster(mine);
        const boss = spec.bossId ? ENCOUNTERS[spec.bossId] : undefined;
        if (theirs === 'boss' && boss) {
          store.pendingBattle = { title: t('axLab.battleTitle', { name }), opponent: boss, playerDeck, allowSurrender: true, onFinish: () => ctx.reset(spec.id) };
        } else {
          const opponentDeck = theirs.startsWith('with:') ? withMonster(keyOf(theirs)) : boosterDeck(theirs as BoosterKey);
          store.pendingBattle = {
            title: t('axLab.battleTitle', { name }),
            opponent: { id: `qa-${spec.id}`, name: t('axLab.opponent'), monsters: opponentDeck.monsters, lifeScale: 1 },
            opponentDeck,
            playerDeck,
            allowSurrender: true,
            onFinish: () => ctx.reset(spec.id),
          };
        }
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
        const theirChoices: Theirs[] = [...(spec.bossId ? (['boss'] as const) : []), ...keys, ...keys.map((k) => `with:${k}` as const)];
        element.replaceChildren(
          createScreenHeader({ title: t('axLab.titleOf', { name }), back: { label: t('common.back'), onTap: () => ctx.back('settings') } }),
          h(
            'div',
            { class: 'screen__body pukarim-lab__body' },
            h('p', { class: 'pukarim-lab__note', text: t('pukarimLab.note') }),
            h(
              'section',
              { class: 'pukarim-lab__section' },
              h('h2', { class: 'pukarim-lab__heading', text: t('axLab.cards', { name }) }),
              h(
                'div',
                { class: 'pukarim-lab__cards' },
                h('div', { class: 'pukarim-lab__monster' }, createBattleMonsterCard(getMonster(spec.monsterId), 110)),
                ...[...skillsOf(spec.monsterId)].sort((a, b) => (a.displayNo ?? 0) - (b.displayNo ?? 0)).map((s) => createSkillCard(s, { width: 110, showText: true })),
              ),
            ),
            h(
              'section',
              { class: 'pukarim-lab__section' },
              h('h2', { class: 'pukarim-lab__heading', text: t('axLab.battle', { name }) }),
              h('p', { class: 'pukarim-lab__label', text: t('axLab.mine', { name }) }),
              h(
                'div',
                { class: 'pukarim-lab__row' },
                ...keys.map((k) => choice<Mine>(k, mine, t('axLab.withMonster', { box: boosterName(k), name }), (v) => (mine = v))),
                choice<Mine>('check', mine, t('axLab.effectCheck'), (v) => (mine = v)),
              ),
              h('p', { class: 'pukarim-lab__label', text: t('axLab.theirs') }),
              h('div', { class: 'pukarim-lab__row' }, ...theirChoices.map((k) => choice<Theirs>(k, theirs, labelOf(k), (v) => (theirs = v)))),
              button(t('pukarimLab.start'), startBattle, 'btn btn--primary pukarim-lab__start'),
            ),
          ),
        );
      };
      render();
      return { element };
    },
  };
}

/** タイラント：竜のまなざし・竜のちから・ドラゴンブレスを3枚ずつ（ほかは安い攻撃と守り） */
export const tyrantLabScreen: ScreenDefinition = makeLab({
  id: 'tyrantLab',
  monsterId: TYRANT_MONSTER_ID,
  check16: [
    [9, 3], [10, 3], [7, 2], [1, 2], [5, 2], [3, 1], [11, 1], [12, 2],
  ].map(([no, copies]) => ({ id: tyrantSkillId(no as number), copies: copies as number })),
});

/** ギアロス：オーバードライブ α・β・γ・システムチェンジ・システムチェックを多めに。相手は機械の塔の守り手テオ（切り札がギアロス）も選べる */
export const gearosLabScreen: ScreenDefinition = makeLab({
  id: 'gearosLab',
  monsterId: GEAROS_MONSTER_ID,
  bossId: 'enc-machine-boss',
  check16: [
    [5, 3], [6, 3], [7, 3], [8, 2], [9, 2], [4, 1], [11, 1], [12, 1],
  ].map(([no, copies]) => ({ id: gearosSkillId(no as number), copies: copies as number })),
});

/** クヨウ（2026-11-05 指示書 BH）：おはらい・まよけのふだ・みがわりを3枚ずつ（ほかは安い攻撃と守り） */
export const kuyoLabScreen: ScreenDefinition = makeLab({
  id: 'kuyoLab',
  monsterId: KUYO_MONSTER_ID,
  check16: [
    [8, 3], [9, 3], [11, 3], [1, 2], [3, 2], [5, 1], [10, 1], [12, 1],
  ].map(([no, copies]) => ({ id: kuyoSkillId(no as number), copies: copies as number })),
});

/** ラディエル（2026-11-05 指示書 BI）：しんぱんのせんこく・最後の審判・天の恵み・こうりんのひかりを多めに。相手は天の聖域の守り手アウレリオ（切り札がラディエル）も選べる */
export const radielLabScreen: ScreenDefinition = makeLab({
  id: 'radielLab',
  monsterId: RADIEL_MONSTER_ID,
  bossId: 'enc-holy-boss',
  check16: [
    [8, 2], [9, 3], [12, 3], [4, 3], [3, 2], [1, 1], [10, 1], [11, 1],
  ].map(([no, copies]) => ({ id: radielSkillId(no as number), copies: copies as number })),
});

/** クロシオ（2026-11-06 指示書 BK）：ひきずりこむ・おおうずしお・みちしお・しおふきキャノン・よびごえを多めに（ほかは安い攻撃と回避） */
export const kuroshioLabScreen: ScreenDefinition = makeLab({
  id: 'kuroshioLab',
  monsterId: KUROSHIO_MONSTER_ID,
  check16: [
    [4, 3], [7, 2], [9, 2], [6, 2], [10, 2], [11, 2], [1, 2], [12, 1],
  ].map(([no, copies]) => ({ id: kuroshioSkillId(no as number), copies: copies as number })),
});

/** ロウガ（2026-11-06 指示書 BL）：とおぼえ・こおりのきば・ひょうろうのいちげき・ひょうけつのかぎづめを多めに */
export const rougaLabScreen: ScreenDefinition = makeLab({
  id: 'rougaLab',
  monsterId: ROUGA_MONSTER_ID,
  check16: [
    [9, 3], [4, 3], [10, 2], [6, 2], [2, 2], [7, 2], [11, 1], [12, 1],
  ].map(([no, copies]) => ({ id: rougaSkillId(no as number), copies: copies as number })),
});

/** フギン（2026-11-06 指示書 BM）：ちえのささやき・はねやすめ・かぜよみ・よみのまなざし・ひかりものをぬすむを多めに */
export const huginnLabScreen: ScreenDefinition = makeLab({
  id: 'huginnLab',
  monsterId: HUGINN_MONSTER_ID,
  check16: [
    [7, 3], [10, 3], [11, 3], [6, 2], [8, 2], [12, 1], [9, 1], [2, 1],
  ].map(([no, copies]) => ({ id: huginnSkillId(no as number), copies: copies as number })),
});
