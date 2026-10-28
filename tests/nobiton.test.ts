import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSkill, MONSTERS, SKILLS } from '../src/data/cards.ts';
import { PACKS } from '../src/data/economy.ts';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { NOBITON_MONSTER, NOBITON_REMOVED_14_IDS, NOBITON_SKILLS, NOBITON_STARTER, nobitonSkillId, parseNobiton14Csv } from '../src/data/nobiton.ts';
import nobitonJson from '../src/data/official/nobiton_cards_OFFICIAL_20261025.json';
import { soramoSkillId } from '../src/data/soramo.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, cardUsability, createBattle, manaOf, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { skillCardFace } from '../src/game/cards/cardFace.ts';
import { createStarterDeck } from '../src/game/deck/deck.ts';
import { createNewSave, migrate, SAVE_VERSION } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

const nob = (n: number): string => nobitonSkillId(n);
const sor = (n: number): string => soramoSkillId(n);

/** 正式の番号 → ゲーム内 ID の番号（それまでの同じ名前の技の ID） */
const ID_NO: Readonly<Record<number, number>> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 12, 12: 13, 13: 15, 14: 16 };
/** 正式の番号の技（ゲーム内 ID） */
const n14 = (no: number): string => nob(ID_NO[no] as number);

describe('ノビトン正式14技（2026-10-26。届いた CSV を無改変で保管し、そのまま読む）', () => {
  const csv = readFileSync('src/data/official/nobiton14_skills_OFFICIAL_20261026.csv', 'utf8');
  const rows = parseNobiton14Csv(csv);

  it('届いた CSV と、ZIP の中の CSV（design-parts）は同じ。14行', () => {
    expect(readFileSync('design-parts/cards-original/nobiton14-20261026/02_CLAUDE_INSTRUCTIONS/02_14技_正式データ_UTF8.csv', 'utf8')).toBe(csv);
    expect(rows).toHaveLength(14);
    expect(rows.map((r) => r.number)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
  });

  it('技名・分類・マナ・ダメージ・特殊効果の文・表示の番号が CSV のとおり。ID は同じ名前の技を引き継ぐ', () => {
    expect(NOBITON_SKILLS).toHaveLength(14);
    expect(new Set(NOBITON_SKILLS.map((s) => s.id)).size).toBe(14);
    for (const r of rows) {
      const s = getSkill(n14(r.number));
      expect(s.name).toBe(r.name_ja);
      expect(s.category).toBe(r.category);
      expect(s.cost).toBe(r.mana);
      expect(s.stat?.value ?? null).toBe(r.damage);
      expect(s.effectTextJa).toBe(r.effect_ja);
      expect(s.displayNo).toBe(r.number);
      expect(s.designId).toBe(`NOB14-SK-${String(r.number).padStart(2, '0')}`);
      expect(s.monsterId).toBe('mon-nobiton');
      expect(s.isPlaceholder).toBe(false);
      expect(s.rarity).toBeNull();
      // 同じ名前の技は、それまでの16技と同じ ID
      expect(nobitonJson.skill_cards.find((x) => x.name_ja === r.name_ja)?.number).toBe(ID_NO[r.number]);
    }
    expect(NOBITON_SKILLS.map((s) => s.name)).toEqual([
      'はなビンタ', 'ずつき', 'まきつく', 'ギガントノーズ', 'くしゃみ', 'ミラージュノーズ', 'ダウナーミスト',
      '考える', '不思議な嗅覚', '鼻でまもる', 'のびのびガード', 'ぐっとがまん', '横によける', '必死によける',
    ]);
  });

  it('正式14技の外になったのは旧11 サイコガード・旧14 ねばりガードだけ（カードの一覧にない）', () => {
    expect(NOBITON_REMOVED_14_IDS).toEqual([nob(11), nob(14)]);
    for (const id of NOBITON_REMOVED_14_IDS) expect(SKILLS.some((s) => s.id === id)).toBe(false);
    expect(nobitonJson.skill_cards.filter((x) => x.number === 11 || x.number === 14).map((x) => x.name_ja)).toEqual(['サイコガード', 'ねばりガード']);
  });

  it('絵：届いた JPEG 14枚を1バイトも変えずに、正式の番号で置いた', () => {
    for (const r of rows) {
      const no = String(r.number).padStart(2, '0');
      const original = readFileSync(`design-parts/cards-original/nobiton14-20261026/01_SKILL_ART/Nobiton_SK${no}.jpg`);
      expect(readFileSync(`assets/images/cards/skills/nob14_sk_${no}.jpg`).equals(original)).toBe(true);
      expect(r.art).toBe(`01_SKILL_ART/Nobiton_SK${no}.jpg`);
      expect(getSkill(n14(r.number)).art?.file).toBe(`nob14_sk_${no}.jpg`);
    }
  });

  it('初期配布16枚：01・02・05 が3枚、03 が1枚、08・10・13 が2枚。ほかは0枚（技の一覧からは消さない）', () => {
    const byNo = Object.fromEntries(NOBITON_STARTER.map((s) => [getSkill(s.id).displayNo, s.copies]));
    expect(byNo).toEqual({ 1: 3, 2: 3, 3: 1, 5: 3, 8: 2, 10: 2, 13: 2 });
    expect(NOBITON_STARTER.reduce((n, s) => n + s.copies, 0)).toBe(16);
    expect(NOBITON_SKILLS.filter((s) => s.availability === 'initial').map((s) => s.displayNo)).toEqual([1, 2, 3, 5, 8, 10, 13]);
  });

  it('新しく始めたとき：所持カードにノビトンの技16枚。初期デッキ60枚・モンスターカード本体は変えない。何度作っても16枚', () => {
    for (let i = 0; i < 2; i++) {
      const save = createNewSave();
      const owned = Object.entries(save.collection).filter(([id]) => id.startsWith('skl-nobiton-'));
      expect(owned.reduce((n, [, c]) => n + c, 0)).toBe(16);
      expect(save.collection['mon-nobiton']).toBeUndefined();
      expect(save.deck).toEqual(createStarterDeck());
      expect(save.deck.skills.some((id) => id.includes('nobiton'))).toBe(false);
      expect(save.deck.skills).toHaveLength(60);
    }
  });

  it('いまのセーブ（version 11）：外れた2技だけ所持・デッキから外す。ほかの所持カードはそのまま。初期配布は配らない', () => {
    const base = createNewSave();
    const collection = { ...Object.fromEntries(Object.entries(base.collection).filter(([id]) => !id.startsWith('skl-nobiton-'))), [nob(1)]: 2, [nob(11)]: 3, [nob(14)]: 1, [nob(16)]: 2 };
    const deckSkills = [...base.deck.skills.slice(0, 58), nob(11), nob(1)];
    const migrated = migrate({ ...base, version: 11, collection, deck: { ...base.deck, skills: deckSkills } });
    if (!migrated) throw new Error('migrate');
    expect(migrated.version).toBe(SAVE_VERSION);
    const c = migrated.collection as Record<string, number>;
    expect(c[nob(11)]).toBeUndefined();
    expect(c[nob(14)]).toBeUndefined();
    expect(c[nob(1)]).toBe(2);
    expect(c[nob(16)]).toBe(2);
    // 初期配布は配らない（はなビンタは2枚のまま・ずつきは無いまま）
    expect(c[nob(2)]).toBeUndefined();
    const deck = migrated.deck as { skills: string[] };
    expect(deck.skills).not.toContain(nob(11));
    expect(deck.skills).toContain(nob(1));
  });

  it('モンスター：ライフ 8。バトル用カードは届いた正式原画（無改変）と黄色の枠。技カードの枠は分類の色のまま', () => {
    expect(NOBITON_MONSTER.life).toBe(8);
    expect(NOBITON_MONSTER.name).toBe('ノビトン');
    expect(MONSTERS.filter((m) => m.id === 'mon-nobiton')).toHaveLength(1);
    expect(SKILLS.filter((s) => s.monsterId === 'mon-nobiton')).toHaveLength(14);
    expect(BATTLE_CARDS['mon-nobiton']).toMatchObject({ art: 'nobiton_battlecard.png', frame: 'nobiton' });
    const original = readFileSync('design-parts/cards-original/nobiton14-20261026/04_BATTLE_MONSTER_CARD/01_Nobiton_Battle_Original_RGBA.png');
    expect(readFileSync('assets/images/cards/monsters/nobiton_battlecard.png').equals(original)).toBe(true);
    expect([original.readUInt32BE(16), original.readUInt32BE(20)]).toEqual([1179, 1334]);
    // ノビトン専用の技カードの枠は作らない（黄色はモンスターカードだけ）
    expect(existsSync('assets/images/ui/skillcard_v5/frame_normal_force_nobiton.webp')).toBe(false);
    expect(existsSync('assets/images/ui/battlecard/frame_nobiton.png')).toBe(true);
  });

  it('パック・相手の編成・初期デッキのモンスターにはまだ入れていない', () => {
    for (const p of PACKS) expect(p.cardIds.some((id) => id.includes('nobiton'))).toBe(false);
    expect(createNewSave().deck.monsters).not.toContain('mon-nobiton');
  });

  it('日本語は CSV の特殊効果の文のまま。英語は仮訳で、日本語が残らない', () => {
    setLanguage('ja');
    expect(skillCardFace(getSkill(n14(3))).description).toBe('相手は次のターン行動不可');
    expect(skillCardFace(getSkill(n14(8))).description).toBe('手札をすべて交換');
    expect(skillCardFace(getSkill(n14(12))).mana).toBe(0);
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

describe('ノビトン：効果（2026-10-25 から同じ動き。2026-10-26 正式14技の番号。細かい裁定は docs/battle-rules.md「正式カード（ノビトン）」）', () => {
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
    const evaded = attackWith(nob(7), [n14(14)], { opponent: 10 });
    expect(monster(evaded, 'o-m1').life).toBe(8);
    expect(manaOf(evaded.sides.opponent)).toBe(7);
    // のびのびガード（マナ2・−3）で0ダメージ：2払って8、さらに−3で5
    const guarded = attackWith(nob(7), [n14(11)], { opponent: 10 });
    expect(monster(guarded, 'o-m1').life).toBe(8);
    expect(manaOf(guarded.sides.opponent)).toBe(5);
  });

  it('03 まきつく：当たった相手は次の手番、技を使えない（攻撃も特殊も）。ほかのモンスターは使える。その次の手番は使える', () => {
    let s = attackWith(nob(3), []);
    expect(monster(s, 'o-m1').life).toBe(6);
    expect(monster(s, 'o-m1').stunnedTurn).toBe(s.turn + 1);
    // 回避されたらかからない
    expect(monster(attackWith(nob(3), [n14(14)]), 'o-m1').stunnedTurn).toBeUndefined();
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
    let s = scene({ player: [nob(6)], opponent: [n14(14), n14(11)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(s, 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'この攻撃は回避できません' });
    expect(cardUsability(s, 'opponent', 'o1').usable).toBe(true);
  });

  it('08 考える：使ったカード以外の手札をすべて山札へ戻してシャッフルし、同じ枚数を引く。戻す手札がなければ使えない', () => {
    let s = scene({ player: [nob(8), nob(1), n14(13), n14(14)] });
    const deckBefore = s.sides.player.deck;
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(s.sides.player.hand).toHaveLength(3);
    expect(s.sides.player.deck).toHaveLength(deckBefore.length);
    expect(s.sides.player.discard).toContain(nob(8));
    expect(monster(s, 'p-m1').acted).toBe(true);
    expect(s.log.at(-1)?.text).toBe('あなたは手札3枚を山札に戻してシャッフルし、3枚引いた。');
    // 山札（ひっかき60枚）＋戻した3枚から引くので、戻した3枚のどれかが戻ってくることもある
    expect([...s.sides.player.deck, ...s.sides.player.hand.map((c) => c.cardId)].sort()).toEqual([...deckBefore, nob(1), n14(13), n14(14)].sort());
    expect(cardUsability(scene({ player: [nob(8)] }), 'player', 'p0')).toMatchObject({ usable: false, reason: '戻す手札がありません' });
  });

  it('09 不思議な嗅覚：相手の手札をすべて確認する（手札は動かない・画面が表を見せる）。相手の手札がなければ使えない', () => {
    let s = scene({ player: [nob(9)], opponent: [nob(1), n14(14)] });
    const handBefore = s.sides.opponent.hand;
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(s.reveal).toEqual({ seq: 1, viewer: 'player', cardIds: [nob(1), n14(14)] });
    expect(s.sides.opponent.hand).toEqual(handBefore);
    expect(manaOfPlayer(s)).toBe(7);
    expect(s.log.at(-1)?.text).toBe('あなたは相手の手札2枚を確認した。');
    expect(cardUsability(scene({ player: [nob(9)] }), 'player', 'p0')).toMatchObject({ usable: false, reason: '相手は手札がありません' });
  });

  it('12 ぐっとがまん：マナ0でも使える（−1）。10〜12 の防御は 0 未満にならない', () => {
    const s = attackWith(nob(1), [n14(12)], { opponent: 0 });
    expect(monster(s, 'o-m1').life).toBe(8);
    expect(monster(attackWith(nob(4), [n14(12)]), 'o-m1').life).toBe(5);
    expect(monster(attackWith(nob(4), [n14(11)]), 'o-m1').life).toBe(7);
    expect(monster(attackWith(nob(2), [nob(10)]), 'o-m1').life).toBe(8);
    // 鼻でまもるはちから技だけ（のびのびガードはかしこさにも使える）
    let w = scene({ player: [nob(5)], opponent: [nob(10), n14(11)] });
    w = applyAction(w, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(w, 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'かしこさ攻撃には使えません' });
    expect(cardUsability(w, 'opponent', 'o1').usable).toBe(true);
  });

  it('13 横によける：ちから技だけ回避。14 必死によける：ちから・かしこさとも回避（条件なし）', () => {
    let f = scene({ player: [nob(1)], opponent: [n14(13), n14(14)] });
    f = applyAction(f, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(f, 'opponent', 'o0').usable).toBe(true);
    expect(cardUsability(f, 'opponent', 'o1').usable).toBe(true);
    let w = scene({ player: [nob(5)], opponent: [n14(13), n14(14)] });
    w = applyAction(w, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(cardUsability(w, 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'かしこさ攻撃には使えません' });
    expect(cardUsability(w, 'opponent', 'o1').usable).toBe(true);
    expect(monster(attackWith(nob(1), [n14(13)]), 'o-m1').life).toBe(8);
  });

  it('ノビトン同士で、相手の思考どうしが最後まで対戦できる（14種すべてを含むデッキ）', () => {
    const skills = [...Array.from({ length: 42 }, (_, i) => n14((i % 14) + 1)), ...Array.from({ length: 18 }, () => sor(1))];
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
