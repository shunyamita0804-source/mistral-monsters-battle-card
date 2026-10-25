import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSkill, MONSTERS, SKILLS } from '../src/data/cards.ts';
import { PACKS } from '../src/data/economy.ts';
import { NOBITON_MONSTER, NOBITON_SKILLS, nobitonSkillId } from '../src/data/nobiton.ts';
import nobitonJson from '../src/data/official/nobiton_cards_OFFICIAL_20261025.json';
import { soramoSkillId } from '../src/data/soramo.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, cardUsability, createBattle, manaOf, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { skillCardFace } from '../src/game/cards/cardFace.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

const nob = (n: number): string => nobitonSkillId(n);
const sor = (n: number): string => soramoSkillId(n);

describe('ノビトン16技：正式データ（2026-10-25 ユーザー確定。届いた TSV を無改変で保管し、写した JSON を読む）', () => {
  it('技名・カテゴリ・マナ・効果・区分が、届いた TSV の16行とすべて一致する', () => {
    const tsv = readFileSync('src/data/official/nobiton_skills_OFFICIAL_20261025.tsv', 'utf8').replace(/^﻿/, '');
    const rows = tsv.trim().split(/\r?\n/).slice(1).map((line) => line.split('\t'));
    expect(rows).toHaveLength(16);
    const category = { 力: 'force', 賢: 'wisdom', 特殊: 'special', 防御: 'defense', 回避: 'evade' } as const;
    for (const [no, name, cat, mana, effect, avail, art] of rows) {
      const s = getSkill(nob(Number(no)));
      const j = nobitonJson.skill_cards.find((x) => x.number === Number(no));
      expect(j?.effect_ja).toBe(effect);
      expect(s.name).toBe(name);
      expect(s.category).toBe(category[cat as keyof typeof category]);
      expect(s.cost).toBe(Number(mana));
      expect(s.availability).toBe(avail === '初期配布' ? 'initial' : 'collect');
      expect(art).toBe('正式採用');
      // 攻撃は「ダメージn」＋残りが効果テキスト。それ以外は効果の文がそのまま効果テキスト
      if (s.stat) {
        expect(effect?.startsWith(`ダメージ${s.stat.value}`)).toBe(true);
        expect(s.effectTextJa).toBe(effect?.includes('。') ? effect.split('。')[1] : null);
      } else expect(s.effectTextJa).toBe(effect);
      expect(s.designId).toBe(`NOB-SK-${no}`);
      expect(s.monsterId).toBe('mon-nobiton');
      expect(s.isPlaceholder).toBe(false);
      expect(s.rarity).toBeNull();
    }
    expect(NOBITON_SKILLS).toHaveLength(16);
    expect(new Set(NOBITON_SKILLS.map((s) => s.id)).size).toBe(16);
  });

  it('初期配布8種（01・02・05・08・10・11・13・15）・収集用8種（03・04・06・07・09・12・14・16）', () => {
    const initial = NOBITON_SKILLS.filter((s) => s.availability === 'initial').map((s) => s.designId);
    expect(initial).toEqual(['01', '02', '05', '08', '10', '11', '13', '15'].map((n) => `NOB-SK-${n}`));
    const collect = NOBITON_SKILLS.filter((s) => s.availability === 'collect').map((s) => s.designId);
    expect(collect).toEqual(['03', '04', '06', '07', '09', '12', '14', '16'].map((n) => `NOB-SK-${n}`));
  });

  it('モンスター：ライフ 8・正式カードとバトル用の絵。ランクは画面に出さない。枠色は仮の候補', () => {
    expect(nobitonJson.monster_life).toBe(8);
    expect(NOBITON_MONSTER.id).toBe('mon-nobiton');
    expect(NOBITON_MONSTER.life).toBe(8);
    expect(NOBITON_MONSTER.name).toBe('ノビトン');
    expect(NOBITON_MONSTER.art?.file).toBe('nobiton_official.webp');
    expect(NOBITON_MONSTER.battleArt?.file).toBe('nobiton_battle.webp');
    expect(MONSTERS.filter((m) => m.id === 'mon-nobiton')).toHaveLength(1);
    expect(SKILLS.filter((s) => s.monsterId === 'mon-nobiton')).toHaveLength(16);
  });

  it('原本 PNG 16枚・モンスターカード2枚は届いたものと同じ（SHA-256・大きさ）。ゲーム用の技の絵は縦横比を変えずに幅 827', () => {
    const manifest = JSON.parse(readFileSync('design-parts/cards-original/nobiton/ASSET_SHA256.json', 'utf8')) as {
      number: number;
      name: string;
      file: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    expect(manifest).toHaveLength(16);
    for (const m of manifest) {
      const buf = readFileSync(`design-parts/cards-original/nobiton/${m.file}`);
      expect(createHash('sha256').update(buf).digest('hex')).toBe(m.sha256);
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([m.width, m.height]);
      expect(m.file.startsWith(`${String(m.number).padStart(2, '0')}_${m.name}.`)).toBe(true);
      expect(getSkill(nob(m.number)).name).toBe(m.name);
      const art = readFileSync(`assets/images/cards/skills/nob_sk_${String(m.number).padStart(2, '0')}.webp`);
      const [w, h] = [art.readUInt16LE(26) & 0x3fff, art.readUInt16LE(28) & 0x3fff];
      expect(w).toBe(827);
      expect(h).toBe(Math.round((m.height * 827) / m.width));
    }
    const cards = JSON.parse(readFileSync('design-parts/cards-original/nobiton/cards/ASSET_SHA256.json', 'utf8')) as { file: string; sha256: string }[];
    expect(cards.map((c) => c.file)).toEqual(['battle_card_official.png', 'monster_card_LIFE8_official.jpeg']);
    for (const c of cards) {
      expect(createHash('sha256').update(readFileSync(`design-parts/cards-original/nobiton/cards/${c.file}`)).digest('hex')).toBe(c.sha256);
    }
    // バトル用の絵はソラモ・ガウルと同じ 556×941 をそのまま（縮めていない）
    const battle = readFileSync('assets/images/cards/monsters/nobiton_battle.webp');
    expect([battle.readUInt16LE(26) & 0x3fff, battle.readUInt16LE(28) & 0x3fff]).toEqual([556, 941]);
  });

  it('パック・スターター・相手の編成にはまだ入れていない（配る枚数・敵の編成は未定）', () => {
    for (const p of PACKS) expect(p.cardIds.some((id) => id.includes('nobiton'))).toBe(false);
    expect(createNewSave().deck.monsters).not.toContain('mon-nobiton');
  });

  it('日本語は効果テキストのまま。英語は仮訳で、日本語が残らない', () => {
    setLanguage('ja');
    expect(skillCardFace(getSkill(nob(3))).description).toBe('対象は次ターン行動不可');
    expect(skillCardFace(getSkill(nob(8))).description).toBe('自分の手札全枚を自分の山札へ戻してシャッフルし、戻した枚数だけ引く');
    expect(skillCardFace(getSkill(nob(13))).mana).toBe(0);
    setLanguage('en');
    expect(cardName(NOBITON_MONSTER)).toBe('Nobiton');
    for (const s of NOBITON_SKILLS) {
      expect(cardName(s)).not.toMatch(/[ぁ-んァ-ン一-龯]/);
      expect(skillCardFace(s).description).not.toMatch(/[ぁ-んァ-ン一-龯]/);
    }
    setLanguage('ja');
  });
});

/* ---------- バトル ---------- */

// 自分：ノビトン（m1）・ソラモ（m2）・ラズック（m3）。相手も同じ
const deck = { monsters: ['mon-nobiton', 'mon-soramo', 'mon-lazuck'], skills: Array.from({ length: 60 }, () => sor(1)) };

function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}): BattleState {
  const s = createBattle({ name: 'P', deck }, { name: 'O', deck }, 11, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 10 }, () => sor(1)),
  });
  return { ...s, phase: 'main', active: 'player', manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const monster = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};

/** player が o-m1 に attack を使い、opponent が guards を使ったあとの状態 */
function attackWith(attack: string, guards: string[], mana: Partial<Record<Side, number>> = {}): BattleState {
  let s = scene({ player: [attack], opponent: guards }, mana);
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
  expect(s.phase).toBe('defense');
  guards.forEach((_, i) => {
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: `o${i}` });
  });
  if (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
  return s;
}

describe('ノビトン：効果（2026-10-25。細かい裁定は docs/battle-rules.md「正式カード（ノビトン）」）', () => {
  it('05 くしゃみ：当たると相手のマナ−1（支払ったマナとは別）。相手のマナが 0 なら 0 のまま', () => {
    const s = attackWith(nob(5), [], { opponent: 2 });
    expect(monster(s, 'o-m1').life).toBe(7);
    expect(manaOf(s.sides.opponent)).toBe(1);
    expect(s.log.at(-1)?.text).toBe('相手のマナが1減った。');
    const zero = attackWith(nob(5), [], { opponent: 0 });
    expect(manaOf(zero.sides.opponent)).toBe(0);
    expect(zero.log.at(-1)?.text).toBe('相手のマナが0減った。');
  });

  it('07 ダウナーミスト：相手のマナ−3（0 より下にはならない）。回避されたらマナは減らない。防御で0ダメージでも減る', () => {
    expect(manaOf(attackWith(nob(7), [], { opponent: 2 }).sides.opponent)).toBe(0);
    expect(manaOf(attackWith(nob(7), [], { opponent: 10 }).sides.opponent)).toBe(7);
    // 必死によける（マナ3）で回避：3払って7のまま（−3はない）
    const evaded = attackWith(nob(7), [nob(16)], { opponent: 10 });
    expect(monster(evaded, 'o-m1').life).toBe(8);
    expect(manaOf(evaded.sides.opponent)).toBe(7);
    // のびのびガード（マナ2・−3）で0ダメージ：2払って8、さらに−3で5
    const guarded = attackWith(nob(7), [nob(12)], { opponent: 10 });
    expect(monster(guarded, 'o-m1').life).toBe(8);
    expect(manaOf(guarded.sides.opponent)).toBe(5);
  });

  it('03 まきつく：当たった相手は次の手番、技を使えない（攻撃も特殊も）。ほかのモンスターは使える。その次の手番は使える', () => {
    let s = attackWith(nob(3), []);
    expect(monster(s, 'o-m1').life).toBe(6);
    expect(monster(s, 'o-m1').stunnedTurn).toBe(s.turn + 1);
    // 回避されたらかからない
    expect(monster(attackWith(nob(3), [nob(16)]), 'o-m1').stunnedTurn).toBeUndefined();
    // 相手の手番：ノビトンの技（攻撃・特殊）は使えない。ソラモの技は使える
    s = { ...s, turn: s.turn + 1, active: 'opponent' };
    s = {
      ...s,
      sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: [nob(1), nob(8), nob(9), sor(1)].map((cardId, i) => ({ uid: `o${i}`, cardId })) } },
    };
    expect(cardUsability(s, 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'このターンは行動できません（まきつく）' });
    expect(cardUsability(s, 'opponent', 'o1').usable).toBe(false);
    expect(cardUsability(s, 'opponent', 'o2').usable).toBe(false);
    expect(cardUsability(s, 'opponent', 'o3').usable).toBe(true);
    // さらに次の相手の手番では使える
    const later = { ...s, turn: s.turn + 2 };
    expect(cardUsability(later, 'opponent', 'o0').usable).toBe(true);
  });

  it('06 ミラージュノーズ：回避カードは使えない（回避不可が優先）。防御は使える', () => {
    let s = scene({ player: [nob(6)], opponent: [nob(16), nob(12)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(s, 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'この攻撃は回避できません' });
    expect(cardUsability(s, 'opponent', 'o1').usable).toBe(true);
  });

  it('08 考える：使ったカード以外の手札をすべて山札へ戻してシャッフルし、同じ枚数を引く。戻す手札がなければ使えない', () => {
    let s = scene({ player: [nob(8), nob(1), nob(15), nob(16)] });
    const deckBefore = s.sides.player.deck;
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(s.sides.player.hand).toHaveLength(3);
    expect(s.sides.player.deck).toHaveLength(deckBefore.length);
    expect(s.sides.player.discard).toContain(nob(8));
    expect(monster(s, 'p-m1').acted).toBe(true);
    expect(s.log.at(-1)?.text).toBe('あなたは手札3枚を山札に戻してシャッフルし、3枚引いた。');
    // 山札（ひっかき60枚）＋戻した3枚から引くので、戻した3枚のどれかが戻ってくることもある
    expect([...s.sides.player.deck, ...s.sides.player.hand.map((c) => c.cardId)].sort()).toEqual([...deckBefore, nob(1), nob(15), nob(16)].sort());
    expect(cardUsability(scene({ player: [nob(8)] }), 'player', 'p0')).toMatchObject({ usable: false, reason: '戻す手札がありません' });
  });

  it('09 不思議な嗅覚：相手の手札をすべて確認する（手札は動かない・画面が表を見せる）。相手の手札がなければ使えない', () => {
    let s = scene({ player: [nob(9)], opponent: [nob(1), nob(16)] });
    const handBefore = s.sides.opponent.hand;
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(s.reveal).toEqual({ seq: 1, viewer: 'player', cardIds: [nob(1), nob(16)] });
    expect(s.sides.opponent.hand).toEqual(handBefore);
    expect(manaOfPlayer(s)).toBe(7);
    expect(s.log.at(-1)?.text).toBe('あなたは相手の手札2枚を確認した。');
    expect(cardUsability(scene({ player: [nob(9)] }), 'player', 'p0')).toMatchObject({ usable: false, reason: '相手は手札がありません' });
  });

  it('13 ぐっとがまん：マナ0でも使える（−1）。10〜14 の防御は 0 未満にならない', () => {
    const s = attackWith(nob(1), [nob(13)], { opponent: 0 });
    expect(monster(s, 'o-m1').life).toBe(8);
    expect(monster(attackWith(nob(4), [nob(13)]), 'o-m1').life).toBe(5);
    expect(monster(attackWith(nob(4), [nob(14)]), 'o-m1').life).toBe(8);
    expect(monster(attackWith(nob(2), [nob(10)]), 'o-m1').life).toBe(8);
    // 鼻でまもるはちから技だけ
    let w = scene({ player: [nob(5)], opponent: [nob(10), nob(11)] });
    w = applyAction(w, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(w, 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'かしこさ攻撃には使えません' });
    expect(cardUsability(w, 'opponent', 'o1').usable).toBe(true);
  });

  it('15 横によける：ちから技だけ回避。16 必死によける：ちから・かしこさとも回避（条件なし）', () => {
    let f = scene({ player: [nob(1)], opponent: [nob(15), nob(16)] });
    f = applyAction(f, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(f, 'opponent', 'o0').usable).toBe(true);
    expect(cardUsability(f, 'opponent', 'o1').usable).toBe(true);
    let w = scene({ player: [nob(5)], opponent: [nob(15), nob(16)] });
    w = applyAction(w, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(w, 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'かしこさ攻撃には使えません' });
    expect(cardUsability(w, 'opponent', 'o1').usable).toBe(true);
    expect(monster(attackWith(nob(1), [nob(15)]), 'o-m1').life).toBe(8);
  });

  it('ノビトン同士で、相手の思考どうしが最後まで対戦できる（16種すべてを含むデッキ）', () => {
    const skills = [...Array.from({ length: 48 }, (_, i) => nob((i % 16) + 1)), ...Array.from({ length: 12 }, () => sor(1))];
    const d = { monsters: ['mon-nobiton', 'mon-soramo', 'mon-lazuck'], skills };
    for (const [seed, first] of [[1, 'player'], [2, 'opponent'], [3, 'player']] as const) {
      let s = createBattle({ name: 'P', deck: d }, { name: 'O', deck: d }, seed, first);
      let steps = 0;
      while (s.phase !== 'ended' && steps < 5000) {
        const side = actingSide(s);
        if (!side) break;
        const action = chooseAction(s, side);
        if (!action) break;
        const next = applyAction(s, action);
        expect(next).not.toBe(s);
        s = next;
        steps += 1;
      }
      expect(s.phase).toBe('ended');
      expect(s.winner).not.toBeNull();
    }
  });
});

const manaOfPlayer = (s: BattleState): number => manaOf(s.sides.player);
