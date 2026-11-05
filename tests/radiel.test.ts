import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { CARD_NAME_LOGOS, CARD_NAME_LOGOS_EN } from '../src/data/cardNameLogos.generated.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { getMonster, MONSTERS, skillsOf } from '../src/data/cards.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { NPC_BATTLE_ACTORS } from '../src/data/npcBattleLines.generated.ts';
import { RADIEL_COLOR, RADIEL_MONSTER_ID, radielArtFile, radielSkillId } from '../src/data/radiel.ts';
import { AJ_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, badStatusKinds, cardUsability, createBattle, manaOf, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { AJ_EN_MISSING } from '../src/i18n/contentEnAJ.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { skillEffectIcons } from '../src/ui/effectIcons.ts';

/** 指示書 BI（2026-11-05）：ラディエル（天の聖域の切り札・A）と、しんぱんのせんこく・最後の審判・天の恵み */

const ra = radielSkillId;
const sor = (n: number): string => `skl-soramo14-${String(n).padStart(2, '0')}`;
const ky = (n: number): string => `skl-kuyo-${String(n).padStart(2, '0')}`;

describe('ラディエルのデータ（指示書の表のとおり）', () => {
  it('LIFE 9・空中・金 #BE7410。ID は mon-radiel。ふつうの一覧に入る', () => {
    const m = getMonster(RADIEL_MONSTER_ID);
    expect(m.name).toBe('ラディエル');
    expect(m.life).toBe(9);
    expect(m.habitat).toBe('air');
    expect(MONSTER_HABITAT[RADIEL_MONSTER_ID]).toBe('air');
    expect(m.themeColor).toBe(RADIEL_COLOR);
    expect(RADIEL_COLOR).toBe('#BE7410');
    expect(MONSTERS.some((x) => x.id === RADIEL_MONSTER_ID)).toBe(true);
  });

  it('技12枚：名前・分類・マナ・ダメージ・レア（05・06・09・12）。回避の技は無い', () => {
    const table = AJ_SKILLS[RADIEL_MONSTER_ID] ?? [];
    expect(table.map((r) => [r.name, r.cat, r.mana, r.damage])).toEqual([
      ['せいなるつき', 'ち', 2, 3],
      ['クロスニードル', 'ち', 3, 5],
      ['ひかりだま', 'か', 1, 2],
      ['こうりんのひかり', 'か', 3, 2],
      ['せいなるしせん', 'か', 4, 5],
      ['てんのはどう', 'か', 7, 4],
      ['てんりんのさばき', 'か', 6, 8],
      ['しんぱんのせんこく', '特', 3, null],
      ['最後の審判', '特', 3, null],
      ['つばさの守り', '防', 2, null],
      ['天の加護', '防', 2, null],
      ['天の恵み', '特', 2, null],
    ]);
    expect(table.map((r) => r.id)).toEqual(Array.from({ length: 12 }, (_, i) => ra(i + 1)));
    expect(table.map((r) => r.art)).toEqual(Array.from({ length: 12 }, (_, i) => radielArtFile(i + 1)));
    expect(table.filter((r) => r.rare).map((r) => r.id)).toEqual([ra(5), ra(6), ra(9), ra(12)]);
    expect(table.some((r) => r.cat === '避')).toBe(false);
  });

  it('効果：01 防御されない・04/06 相手全員・05 回避されない・07 回避されても半分・08 せんこく・09 最後の審判・10 ちから −5・11 かしこさ −5・12 天の恵み', () => {
    const k = new Map(skillsOf(RADIEL_MONSTER_ID).map((s) => [s.id, s]));
    expect(k.get(ra(1))?.effect).toMatchObject({ type: 'attack', unblockable: true });
    expect(k.get(ra(4))?.effect).toMatchObject({ type: 'attack', allTargets: true });
    expect(k.get(ra(6))?.effect).toMatchObject({ type: 'attack', allTargets: true });
    expect(k.get(ra(5))?.effect).toMatchObject({ type: 'attack', undodgeable: true });
    expect(k.get(ra(7))?.effect).toMatchObject({ type: 'attack', halfOnEvade: true });
    expect(k.get(ra(8))?.effect).toEqual({ type: 'seal', manaDrain: 1 });
    expect(k.get(ra(9))?.effect).toEqual({ type: 'lastJudgment' });
    expect(k.get(ra(10))?.effect).toEqual({ type: 'defense', reduce: 5, against: 'force' });
    expect(k.get(ra(11))?.effect).toEqual({ type: 'defense', reduce: 5, against: 'wisdom' });
    expect(k.get(ra(12))?.effect).toEqual({ type: 'heavenGrace', count: 3 });
  });

  it('天の聖域の切り札：アウレリオの ace・初めてのクリアの報酬（祭壇）・ガチャのシリーズ（カードを手に入れたら並ぶ）。最初の箱には入らない', () => {
    const boss = ENCOUNTERS['enc-holy-boss'];
    expect(boss?.ace).toBe(RADIEL_MONSTER_ID);
    expect(boss?.monsters).toEqual(['mon-gauul', RADIEL_MONSTER_ID, 'mon-kalshell']);
    const d = DUNGEONS.find((x) => x.id === 'dungeon-07');
    expect(d?.firstClearCards).toEqual([{ cardId: RADIEL_MONSTER_ID, count: 1 }]);
    expect(d?.trumpReward).toBe(true);
    for (const b of BOOSTERS) expect(b.monsters).not.toContain(RADIEL_MONSTER_ID);
    expect(GACHA_SERIES.find((g) => g.id === 'radiel')?.rareSkillNames).toEqual(['せいなるしせん', 'てんのはどう', '最後の審判', '天の恵み']);
    const save = createNewSave();
    expect(availableGachaSeriesFor(save).some((g) => g.id === 'radiel')).toBe(false);
    expect(availableGachaSeriesFor({ ...save, collection: { ...save.collection, [RADIEL_MONSTER_ID]: 1 } }).some((g) => g.id === 'radiel')).toBe(true);
  });

  it('図鑑：クヨウのあと No.261〜273', () => {
    const entries = cardBookEntries();
    const mine = entries.filter((e) => e.section.kind === 'monster' && e.section.monsterId === RADIEL_MONSTER_ID);
    expect(mine.map((e) => e.no)).toEqual(Array.from({ length: 13 }, (_, i) => 261 + i));
  });

  it('アウレリオの切り札専用のセリフ3本はラディエルの名前（日英）', () => {
    const a = NPC_BATTLE_ACTORS.find((x) => x.id === 'aurelio');
    expect(a?.extra?.ace_attack_hit).toMatchObject({ ja: '……よく応えた、ラディエル。', en: '...Well answered, Radiel.' });
    expect(a?.extra?.ace_down_continue).toMatchObject({ ja: '……ラディエルを退けるか。見事だ、そなた。', en: '...You drove back Radiel. Splendid.' });
    expect(a?.extra?.ace_down_final).toMatchObject({ ja: 'ラディエルまでも……見事だ。聖域は、そなたを受け入れよう。', en: 'Even Radiel... Splendid. The Sanctuary accepts you.' });
  });

  it('絵・枠・ロゴ・パック・販売機の窓・英語名・アイコン', () => {
    for (let n = 1; n <= 12; n++) expect(existsSync(`assets/images/cards/skills/${radielArtFile(n)}`)).toBe(true);
    for (const f of [
      'assets/images/cards/monsters/radiel_official.webp',
      'assets/images/cards/monsters/radiel_battlecard.png',
      'assets/images/ui/battlecard/frame_radiel.png',
      'assets/images/ui/skillcard_simple/frame_normal_radiel.webp',
      'assets/images/ui/gacha/pack_radiel.webp',
      'assets/images/ui/gacha/panel_radiel.webp',
    ]) {
      expect(existsSync(f), f).toBe(true);
    }
    expect(BATTLE_CARDS[RADIEL_MONSTER_ID]?.frame).toBe('radiel');
    expect(CARD_NAME_LOGOS[RADIEL_MONSTER_ID]?.frame).toBe('#BE7410');
    expect(CARD_NAME_LOGOS_EN[RADIEL_MONSTER_ID]?.frame).toBe('#BE7410');
    setLanguage('en');
    try {
      expect(cardName(RADIEL_MONSTER_ID)).toBe('Radiel');
      expect(cardName(ra(9))).toBe('Last Judgment');
      expect(cardName(ra(12))).toBe("Heaven's Grace");
    } finally {
      setLanguage('ja');
    }
    expect(AJ_EN_MISSING).toEqual([]);
    for (let n = 1; n <= 12; n++) {
      const k = skillsOf(RADIEL_MONSTER_ID)[n - 1];
      if (k?.effectTextJa) expect(skillEffectIcons(k), k.id).not.toBeNull();
    }
  });
});

/* ---------- バトル ---------- */

// 自分：ラディエル（p-m1）・ソラモ・ノビトン。相手：ソラモ（o-m1）・クヨウ（o-m2）・ノビトン（o-m3）
function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}): BattleState {
  const s = createBattle(
    { name: 'P', deck: { monsters: [RADIEL_MONSTER_ID, 'mon-soramo', 'mon-nobiton'], skills: Array.from({ length: 60 }, (_, i) => sor((i % 3) + 1)) } },
    { name: 'O', deck: { monsters: ['mon-soramo', 'mon-kuyo', 'mon-nobiton'], skills: Array.from({ length: 60 }, (_, i) => sor((i % 3) + 4)) } },
    11,
    'player',
  );
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 12 }, () => sor(1)),
  });
  return { ...s, phase: 'main', active: 'player', manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const monster = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};
const use = (s: BattleState, side: Side, cardUid: string, targetUid?: string): BattleState => applyAction(s, { type: 'useCard', side, cardUid, ...(targetUid ? { targetUid } : {}) });

describe('08 しんぱんのせんこく：攻撃できない（すなかけと同じ）＋相手のマナ−1', () => {
  it('次の相手の手番に攻撃できない・相手のマナ −1（0 未満にしない）', () => {
    let s = use(scene({ player: [ra(8)] }, { opponent: 3 }), 'player', 'p0', 'o-m1');
    expect(monster(s, 'o-m1').sealedTurn).toBe(s.turn + 1);
    expect(manaOf(s.sides.opponent)).toBe(2);
    const zero = use(scene({ player: [ra(8)] }, { opponent: 0 }), 'player', 'p0', 'o-m1');
    expect(manaOf(zero.sides.opponent)).toBe(0);
    s = { ...s, turn: s.turn + 1 };
    expect(badStatusKinds(s, monster(s, 'o-m1'))).toEqual(['sealed']);
  });

  it('クヨウの悪い状態に入る：おはらいで消せる・まよけのふだで防げる（マナ −1 はまよけのふだでも減る）', () => {
    // まよけのふだ（相手の側）が効いている
    let s = scene({ player: [ra(8)] }, { opponent: 4 });
    s = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, wardCharm: { untilTurn: s.turn + 1 } } } };
    s = use(s, 'player', 'p0', 'o-m1');
    expect(monster(s, 'o-m1').sealedTurn ?? null).toBeNull();
    expect(manaOf(s.sides.opponent)).toBe(3);
    expect(s.log.some((l) => l.text.startsWith('まよけのふだが防いだ'))).toBe(true);
    // おはらいで消す（相手の手番にクヨウが使う）
    let p = use(scene({ player: [ra(8)] }), 'player', 'p0', 'o-m1');
    p = applyAction(applyAction(p, { type: 'endAttack', side: 'player' }), { type: 'endTurn', side: 'player' });
    p = { ...p, phase: 'main', sides: { ...p.sides, opponent: { ...p.sides.opponent, hand: [{ uid: 'k0', cardId: ky(8) }], manaPile: Array.from({ length: 5 }, () => sor(1)) } } };
    expect(badStatusKinds(p, monster(p, 'o-m1'))).toEqual(['sealed']);
    p = use(p, 'opponent', 'k0', 'o-m1');
    expect(badStatusKinds(p, monster(p, 'o-m1'))).toEqual([]);
  });
});

describe('09 最後の審判：おたがい手札を山札の下に戻す → 同じ枚数を引く → シャッフル', () => {
  it('手札の枚数はそのまま・カードは山札から引いた新しいもの。使ったカードは捨て札へ（戻す手札に入らない）。記録の文', () => {
    const s0 = scene({ player: [ra(9), ra(2), ra(3)], opponent: [ky(1), ky(2), ky(3), ky(4)] });
    const s = use(s0, 'player', 'p0');
    expect(s.sides.player.hand).toHaveLength(2);
    expect(s.sides.opponent.hand).toHaveLength(4);
    expect(s.sides.player.discard).toContain(ra(9));
    // 山札の上から引いた（戻したカードは山札のいちばん下へ入ってからシャッフル）
    expect(s.sides.player.hand.map((c) => c.cardId)).toEqual(s0.sides.player.deck.slice(0, 2));
    expect(s.sides.opponent.hand.map((c) => c.cardId)).toEqual(s0.sides.opponent.deck.slice(0, 4));
    // 山札の枚数は同じ（戻した分＝引いた分）。戻したカードは山札の中
    expect(s.sides.player.deck).toHaveLength(s0.sides.player.deck.length);
    expect(s.sides.player.deck).toContain(ra(2));
    expect(s.sides.opponent.deck.filter((id) => id.startsWith('skl-kuyo'))).toHaveLength(4);
    expect(s.log.at(-1)?.text).toBe('最後の審判！ おたがいの手札が山札に戻り、引き直した。');
    expect(s.phase).toBe('main');
  });

  it('山札が少なくても、戻した札があるので引ける（山札切れにならない）', () => {
    let s = scene({ player: [ra(9), ra(2), ra(3)], opponent: [ky(1), ky(2)] });
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, deck: [sor(1)] }, opponent: { ...s.sides.opponent, deck: [] } } };
    s = use(s, 'player', 'p0');
    expect(s.phase).toBe('main');
    expect(s.sides.player.hand).toHaveLength(2);
    expect(s.sides.opponent.hand.map((c) => c.cardId).sort()).toEqual([ky(1), ky(2)]);
  });

  it('自分（このカードのほか）も相手も手札が0枚なら使えない', () => {
    expect(cardUsability(scene({ player: [ra(9)] }), 'player', 'p0')).toEqual({ usable: false, reason: '戻す手札がありません（自分も相手も）' });
    expect(cardUsability(scene({ player: [ra(9)], opponent: [ky(1)] }), 'player', 'p0').usable).toBe(true);
  });
});

describe('12 天の恵み：自分の捨て札から3枚（新しい順）をマナに', () => {
  it('使う前の捨て札の新しい3枚がマナに。このカードと払ったマナは入らない。山札は減らない。記録の文', () => {
    let s = scene({ player: [ra(12)] }, { player: 2 });
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, discard: [ra(1), ra(2), ra(3), ra(4)] } } };
    const deck = s.sides.player.deck.length;
    s = use(s, 'player', 'p0');
    expect(manaOf(s.sides.player)).toBe(3);
    expect([...s.sides.player.manaPile].sort()).toEqual([ra(2), ra(3), ra(4)].sort());
    expect(s.sides.player.discard).toEqual([ra(1), ra(12), sor(1), sor(1)]);
    expect(s.sides.player.deck).toHaveLength(deck);
    expect(s.log.at(-1)?.text).toBe('天の恵み！ 捨て札から3枚がマナになった。');
  });

  it('捨て札が3枚より少なければあるだけ。0枚なら使えない（理由）', () => {
    let s = scene({ player: [ra(12)] }, { player: 2 });
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, discard: [ra(1)] } } };
    s = use(s, 'player', 'p0');
    expect(manaOf(s.sides.player)).toBe(1);
    expect(cardUsability(scene({ player: [ra(12)] }), 'player', 'p0')).toEqual({ usable: false, reason: '捨て札がありません' });
  });
});

describe('CPU：しんぱんのせんこく・最後の審判・天の恵み', () => {
  it('天の恵み：大きな技（てんりんのさばき 6）が手札にあってマナが足りないとき', () => {
    let s = scene({ player: [ra(12), ra(7)] }, { player: 3 });
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, discard: [ra(1), ra(2), ra(3)] } } };
    expect(chooseAction(s, 'player', 'normal', 'A')).toMatchObject({ type: 'useCard', cardUid: 'p0' });
  });

  it('最後の審判：相手の手札が多い（5枚以上）とき', () => {
    const s = scene({ player: [ra(9), ra(10)], opponent: [ky(1), ky(2), ky(3), ky(4), ky(5)] }, { player: 3 });
    expect(chooseAction(s, 'player', 'normal', 'B')).toMatchObject({ type: 'useCard', cardUid: 'p0' });
  });

  it('しんぱんのせんこく：攻撃のあと、相手のいちばん強そうな攻撃役へ（腕前 A）', () => {
    // 攻撃のカードが無い（ラディエルは攻撃できない）→ せんこく。相手：ソラモ・クヨウ・ノビトン
    const s = scene({ player: [ra(8)] }, { player: 5, opponent: 6 });
    const a = chooseAction(s, 'player', 'normal', 'A');
    expect(a).toMatchObject({ type: 'useCard', cardUid: 'p0' });
  });
});
