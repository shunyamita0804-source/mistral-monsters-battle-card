import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSkill, MONSTERS, SKILLS } from '../src/data/cards.ts';
import { PACKS } from '../src/data/economy.ts';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import evasionJson from '../src/data/official/evasion_LATEST_20261024.json';
import officialJson from '../src/data/official/soramo_cards_OFFICIAL.json';
import { REGISTERED_ONLY_MONSTERS } from '../src/data/registeredMonsters.ts';
import { SORAMO_MONSTER, SORAMO_SKILLS, soramoSkillId } from '../src/data/soramo.ts';
import { TOURNAMENTS } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import {
  actingSide,
  applyAction,
  cardUsability,
  createBattle,
  type BattleState,
  type Side,
} from '../src/game/battle/engine.ts';
import { skillCardFace } from '../src/game/cards/cardFace.ts';
import { describeSkill } from '../src/game/cards/cardTypes.ts';
import { buildAutoDeck, createSoramoTestDeck, createStarterDeck, validateDeck } from '../src/game/deck/deck.ts';
import { packCardRates } from '../src/game/economy/gacha.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

const ids = (n: number): string => soramoSkillId(n);

describe('ソラモ16技：正式データ（正本 JSON を無改変で導入）', () => {
  it('置いた JSON は届いたファイルと同じ（16種・初期8種・収集8種）', () => {
    expect(officialJson.total_skills).toBe(16);
    expect(officialJson.skill_cards).toHaveLength(16);
    expect(officialJson.skill_cards.filter((c) => c.availability === 'initial').map((c) => c.number)).toEqual([1, 2, 4, 7, 9, 11, 12, 14]);
    expect(officialJson.skill_cards.filter((c) => c.availability === 'collect').map((c) => c.number)).toEqual([3, 5, 6, 8, 10, 13, 15, 16]);
  });

  it('技名・マナ・ダメージ・種別・効果テキスト・区分が JSON とすべて一致する', () => {
    expect(SORAMO_SKILLS).toHaveLength(16);
    // 14 ひらりジャンプ・16 星影ステップは 2026-10-24 の回避の改訂（evasion_LATEST_20261024.json）のマナ・文
    const evasion = evasionJson.updates.filter((u) => u.monster === 'soramo');
    expect(evasion.map((u) => u.skill_number)).toEqual([14, 16]);
    for (const o of officialJson.skill_cards) {
      const s = getSkill(ids(o.number));
      const u = evasion.find((x) => x.skill_number === o.number);
      expect(s.designId).toBe(o.design_id);
      expect(s.name).toBe(o.name_ja);
      expect(s.cost).toBe(u ? u.mana : o.mana);
      expect(s.stat?.value ?? null).toBe(o.damage);
      expect(s.category).toBe(o.category);
      expect(s.effectTextJa).toBe(u ? u.effect_text_ja : o.effect_text_ja);
      expect(s.availability).toBe(o.availability);
      expect(s.monsterId).toBe('mon-soramo');
      expect(s.isPlaceholder).toBe(false);
      // レアリティはモンスターのランク C とは別物で、未定
      expect(s.rarity).toBeNull();
    }
  });

  it('数値のある攻撃はちから/かしこさだけ。特殊・防御・回避はダメージのダミー値を持たない。マナ0 がある', () => {
    for (const s of SORAMO_SKILLS) {
      const attack = s.category === 'force' || s.category === 'wisdom';
      expect(s.stat !== null).toBe(attack);
      if (s.stat) expect(s.stat.type).toBe(s.category);
    }
    expect(SORAMO_SKILLS.filter((s) => s.cost === 0).map((s) => s.designId)).toEqual(['SOR-SK-01', 'SOR-SK-15']);
  });

  it('防御の「−3」と効く攻撃の種類は、効果テキストのとおり', () => {
    const expected: Record<string, [number, string]> = {
      'SOR-SK-11': [3, 'force'],
      'SOR-SK-12': [3, 'wisdom'],
      'SOR-SK-13': [3, 'all'],
      'SOR-SK-15': [3, 'all'],
    };
    for (const [designId, [reduce, against]] of Object.entries(expected)) {
      const s = SORAMO_SKILLS.find((x) => x.designId === designId);
      expect(s?.effect).toEqual({ type: 'defense', reduce, against });
      expect(s?.effectTextJa).toContain(`−${reduce}`);
      if (against === 'force') expect(s?.effectTextJa).toContain('ちから技');
      if (against === 'wisdom') expect(s?.effectTextJa).toContain('かしこさ技');
    }
  });

  it('絵は 05_SKILL_ART_16 の番号どおり（02＝たいあたり・03＝すてみタックルの新しい絵）で、827×937', () => {
    for (const s of SORAMO_SKILLS) {
      const no = s.designId?.slice(-2);
      expect(s.art?.file).toBe(`sor_sk_${no}.webp`);
      const path = `assets/images/cards/skills/${s.art?.file}`;
      expect(existsSync(path)).toBe(true);
      // WebP（VP8）の大きさを読む
      const buf = readFileSync(path);
      const chunk = buf.toString('ascii', 12, 16);
      expect(chunk).toBe('VP8 ');
      const w = buf.readUInt16LE(26) & 0x3fff;
      const h = buf.readUInt16LE(28) & 0x3fff;
      expect([w, h]).toEqual([827, 937]);
    }
    expect(getSkill(ids(2)).name).toBe('たいあたり');
    expect(getSkill(ids(3)).name).toBe('すてみタックル');
  });

  it('ゲーム内 ID は新しい固定 ID（仮カードの ID を使い回していない）', () => {
    const placeholders = [...MONSTERS, ...SKILLS].filter((c) => c.isPlaceholder).map((c) => c.id);
    for (const s of SORAMO_SKILLS) expect(placeholders).not.toContain(s.id);
    expect(SORAMO_SKILLS.map((s) => s.id)).toEqual(Array.from({ length: 16 }, (_, i) => `skl-soramo-${String(i + 1).padStart(2, '0')}`));
  });

  it('パックには入れていない（提供割合・価格は未承認）', () => {
    for (const p of PACKS) {
      expect(p.cardIds.some((id) => id.includes('soramo'))).toBe(false);
      expect(packCardRates(p).some((r) => r.cardId.includes('soramo'))).toBe(false);
    }
  });
});

describe('ソラモのモンスターカード', () => {
  it('ライフ 7（正式カードの絵の値）・枠色はクリーム（参照 JSON の値）・正式カードとバトル用の絵', () => {
    expect(SORAMO_MONSTER.life).toBe(7);
    expect(SORAMO_MONSTER.themeColor).toBe('#E4D2AC');
    expect(SORAMO_MONSTER.art?.file).toBe('soramo_official.webp');
    expect(SORAMO_MONSTER.battleArt?.file).toBe('soramo_battle.webp');
    for (const a of [SORAMO_MONSTER.art, SORAMO_MONSTER.battleArt]) expect(existsSync(`assets/images/cards/monsters/${a?.file}`)).toBe(true);
  });

  it('登録だけのモンスターはいない（ラズック 2026-10-23・ガウル 2026-10-24 は技が届いたので正式に）', () => {
    expect(REGISTERED_ONLY_MONSTERS).toEqual([]);
    expect(MONSTERS.filter((x) => ['ラズック', 'ガウル', 'ノビトン'].includes(x.name)).map((x) => x.id)).toEqual(['mon-lazuck', 'mon-gauul', 'mon-nobiton']);
  });
});

describe('テスト用：仮のカードをソラモとラズックに（2026-10-23 ユーザー指示）', () => {
  it('新しく始めたときのデッキはソラモ・ラズック・ソラモ＋両方の技で、正しい構成', () => {
    const deck = createStarterDeck();
    expect(deck.monsters).toEqual(['mon-soramo', 'mon-lazuck', 'mon-soramo']);
    expect(new Set(deck.skills.filter((id) => id.startsWith('skl-soramo-'))).size).toBe(16);
    expect(new Set(deck.skills.filter((id) => id.startsWith('skl-lazuck-'))).size).toBe(16);
    expect(validateDeck(deck, createNewSave().collection)).toEqual([]);
  });

  it('大会・ダンジョン・練習の相手は、ソラモとラズックの仮の編成で、デッキが組める', () => {
    const teams = [...Object.values(ENCOUNTERS).map((e) => e.monsters), ...TOURNAMENTS.flatMap((t) => t.rounds.map((r) => r.monsters))];
    for (const team of teams) {
      expect(team.every((id) => id === 'mon-soramo' || id === 'mon-lazuck')).toBe(true);
      expect(team).toContain('mon-soramo');
      expect(team).toContain('mon-lazuck');
      expect(validateDeck(buildAutoDeck(team))).toEqual([]);
    }
  });
});

/* ---------- 技の効果（バトル） ---------- */

const soramoDeck = createSoramoTestDeck();

function battle(first: Side = 'player'): BattleState {
  return createBattle({ name: 'P', deck: soramoDeck }, { name: 'O', deck: soramoDeck }, 7, first);
}

/** 手札とマナを差し替えた、攻撃の場面 */
function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}): BattleState {
  const s = battle();
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 10 }, () => ids(1)),
  });
  return { ...s, phase: 'main', active: 'player', manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const lifeOf = (s: BattleState, uid: string): number =>
  [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((m) => m.uid === uid)?.life ?? -1;

describe('ソラモの技の効果', () => {
  it('マナ0 の技（ひっかき）はマナなしで使え、ちから1のダメージ', () => {
    let s = scene({ player: [ids(1)] }, { player: 0 });
    expect(cardUsability(s, 'player', 'p0').usable).toBe(true);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(s.pending?.power).toBe(1);
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(lifeOf(s, 'o-m1')).toBe(6);
  });

  it('すてみタックル：当たったら自分のライフ−1。回避されたら反動なし', () => {
    let s = scene({ player: [ids(3)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(lifeOf(s, 'o-m1')).toBe(5);
    expect(lifeOf(s, 'p-m1')).toBe(6);

    let e = scene({ player: [ids(3)], opponent: [ids(14)] });
    e = applyAction(e, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    e = applyAction(e, { type: 'defend', side: 'opponent', cardUid: 'o0' });
    e = applyAction(e, { type: 'defend', side: 'opponent', cardUid: null });
    expect(lifeOf(e, 'o-m1')).toBe(7);
    expect(lifeOf(e, 'p-m1')).toBe(7);
  });

  it('まるまる（ちから技−3）はちから攻撃にだけ使え、しっぽガード（かしこさ技−3）はかしこさ攻撃にだけ使える', () => {
    let s = scene({ player: [ids(5)], opponent: [ids(11), ids(12)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' }); // しっぽアタック：ちから3
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(true);
    expect(cardUsability(s, 'opponent', 'o1').usable).toBe(false);
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'o0' });
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(lifeOf(s, 'o-m1')).toBe(7);

    let w = scene({ player: [ids(9)], opponent: [ids(11), ids(12)] });
    w = applyAction(w, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' }); // ソラモビーム：かしこさ4
    expect(cardUsability(w, 'opponent', 'o0').usable).toBe(false);
    w = applyAction(w, { type: 'defend', side: 'opponent', cardUid: 'o1' });
    w = applyAction(w, { type: 'defend', side: 'opponent', cardUid: null });
    expect(lifeOf(w, 'o-m1')).toBe(6);
  });

  it('ふんばる・星のまもり（攻撃のダメージ−3）はどちらの攻撃にも使え、星のまもりはマナ0', () => {
    let s = scene({ player: [ids(10)], opponent: [ids(13), ids(15)] }, { opponent: 2 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' }); // スターダストレイ：かしこさ6
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'o0' });
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'o1' });
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(lifeOf(s, 'o-m2')).toBe(7);
    expect(s.sides.opponent.manaPile).toHaveLength(0);
  });

  it('ひらりジャンプ・星影ステップ（回避）はどちらの攻撃もダメージ0', () => {
    for (const evade of [14, 16]) {
      let s = scene({ player: [ids(6)], opponent: [ids(evade)] });
      s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m3' }); // スターダイブ：ちから5
      s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'o0' });
      s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
      expect(lifeOf(s, 'o-m3')).toBe(7);
    }
  });

  it('吠える：選んだ相手モンスターの次のちから技のダメージ−1（使ったら消える。かしこさ技には効かない）', () => {
    let s = scene({ player: [ids(7)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(s.sides.opponent.monsters[0]?.weaken).toEqual({ stat: 'force', amount: 1 });
    // 相手の手番：o-m1 だけが動けるようにして、ちから2（連続ひっかき）を使う
    let o: BattleState = {
      ...s,
      active: 'opponent',
      sides: {
        ...s.sides,
        opponent: {
          ...s.sides.opponent,
          hand: [{ uid: 'x0', cardId: ids(9) }, { uid: 'x1', cardId: ids(4) }, { uid: 'x2', cardId: ids(4) }],
          monsters: s.sides.opponent.monsters.map((m) => (m.uid === 'o-m1' ? m : { ...m, acted: true })),
        },
      },
    };
    // かしこさ技では消えない
    o = applyAction(o, { type: 'useCard', side: 'opponent', cardUid: 'x0', targetUid: 'p-m1' });
    expect(o.pending?.power).toBe(4);
    o = applyAction(o, { type: 'defend', side: 'player', cardUid: null });
    expect(o.sides.opponent.monsters[0]?.weaken).toEqual({ stat: 'force', amount: 1 });
    // 次の手番でちから技を使うと1減って、消える
    o = { ...o, sides: { ...o.sides, opponent: { ...o.sides.opponent, monsters: o.sides.opponent.monsters.map((m) => (m.uid === 'o-m1' ? { ...m, acted: false } : m)) } } };
    o = applyAction(o, { type: 'useCard', side: 'opponent', cardUid: 'x1', targetUid: 'p-m2' });
    expect(o.pending?.power).toBe(1);
    expect(o.sides.opponent.monsters[0]?.weaken ?? null).toBeNull();
  });

  it('すなかけ：選んだ相手モンスターは次の手番に攻撃の技を使えない（攻撃でない技は使える）。その次は使える', () => {
    let s = scene({ player: [ids(8)], opponent: [ids(1), ids(7)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(s.sides.opponent.monsters[0]?.sealedTurn).toBe(s.turn + 1);
    // 相手の手番（o-m1 だけが動ける）
    const only1 = (st: BattleState): BattleState => ({
      ...st,
      sides: { ...st.sides, opponent: { ...st.sides.opponent, monsters: st.sides.opponent.monsters.map((m) => ({ ...m, acted: m.uid !== 'o-m1' })) } },
    });
    const next = only1({ ...s, turn: s.turn + 1, active: 'opponent' });
    expect(cardUsability(next, 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'このターンは攻撃できません（すなかけ）' });
    expect(cardUsability(next, 'opponent', 'o1').usable).toBe(true);
    // さらに次の相手の手番では攻撃できる
    const later = only1({ ...s, turn: s.turn + 3, active: 'opponent' });
    expect(cardUsability(later, 'opponent', 'o0').usable).toBe(true);
  });

  it('ソラモ同士で、相手の思考どうしが最後まで対戦できる（全種類の技を含むデッキ）', () => {
    for (const first of ['player', 'opponent'] as const) {
      let s = battle(first);
      let steps = 0;
      while (s.phase !== 'ended' && steps < 5000) {
        const side = actingSide(s);
        if (!side) break;
        const action = chooseAction(s, side);
        if (!action) break;
        const next = applyAction(s, action);
        expect(next).not.toBe(s);
        s = next;
        steps++;
      }
      expect(s.phase).toBe('ended');
    }
  });
});

describe('ソラモの技カードの面（表示）と日英', () => {
  it('右側のバーは種別ごとに1種類。数値のない技は右の数字を出さない。マナ0 は「0」', () => {
    const face = (n: number) => skillCardFace(getSkill(ids(n)));
    expect(face(1)).toMatchObject({ category: 'force', mana: 0, value: 1 });
    expect(face(9)).toMatchObject({ category: 'wisdom', mana: 3, value: 4 });
    expect(face(7)).toMatchObject({ category: 'special', value: null });
    expect(face(11)).toMatchObject({ category: 'defense', value: null });
    expect(face(14)).toMatchObject({ category: 'evade', value: null });
    expect(face(15)).toMatchObject({ category: 'defense', mana: 0, value: null });
  });

  it('日本語：技名・種別・説明はデータどおり（効果テキストはそのまま）', () => {
    setLanguage('ja');
    for (const s of SORAMO_SKILLS) {
      const f = skillCardFace(s);
      expect(f.title).toBe(s.name);
      expect(f.manaLabel).toBe('マナ');
      if (s.effectTextJa) {
        expect(f.description).toBe(s.effectTextJa);
        expect(describeSkill(s)).toContain(s.effectTextJa);
      }
    }
    expect(skillCardFace(getSkill(ids(11))).categoryLabel).toBe('防御');
    expect(skillCardFace(getSkill(ids(14))).categoryLabel).toBe('回避');
    expect(skillCardFace(getSkill(ids(7))).categoryLabel).toBe('特殊');
  });

  it('英語：技名・種別・説明が切り替わり、日本語が残らない（英語は仮訳）', () => {
    setLanguage('en');
    try {
      for (const s of [SORAMO_MONSTER, ...SORAMO_SKILLS]) expect(cardName(s)).not.toMatch(/[ぁ-んァ-ヶ一-龠]/);
      for (const s of SORAMO_SKILLS) {
        const f = skillCardFace(s);
        for (const text of [f.title, f.manaLabel, f.categoryLabel, f.description, describeSkill(s)]) {
          expect(text).not.toMatch(/[ぁ-んァ-ヶ一-龠]/);
        }
      }
      expect(skillCardFace(getSkill(ids(16))).categoryLabel).toBe('Dodge');
    } finally {
      setLanguage('ja');
    }
  });
});
