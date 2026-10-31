import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { getSkill, MONSTERS, SKILLS } from '../src/data/cards.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { DESUORU_COLOR, DESUORU_GACHA_RARE, DESUORU_MONSTER, DESUORU_MONSTER_ID, DESUORU_SKILLS, desuoruSkillId } from '../src/data/desuoru.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import desuoruJson from '../src/data/official/desuoru14_skills_OFFICIAL_20261031.json';
import { portraitFocus } from '../src/data/monsterPortraits.ts';
import { SKILL_CARD_TEXT } from '../src/data/skillCardText.ts';
import { soramoSkillId } from '../src/data/soramo.ts';
import { chooseAction, pickDiscardChoice } from '../src/game/battle/ai.ts';
import { applyAction, cardUsability, createBattle, defaultDiscardChoice, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage, t } from '../src/i18n/i18n.ts';

/**
 * デスオル（2026-10-31 指示書 AG「新しいモンスター『デスオル』（A ランク・見通す王）を入れて試遊する」）。
 * 新しい効果は 10 カラスのめ（discardChoice）だけ。ほかは今ある効果。裁定は docs/battle-rules.md「デスオルの効果の扱い」
 */

const des = (n: number): string => desuoruSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
const ORIGINAL_DIR = 'design-parts/cards-original/desuoru';

function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
}

describe('デスオル：データ（届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  it('保管した JSON・CSV・バトル用の絵は ZIP の原本と同じバイト列', () => {
    for (const f of ['desuoru14_skills_OFFICIAL_20261031.json', 'desuoru14_skills_OFFICIAL_20261031.csv']) {
      expect(readFileSync(`src/data/official/${f}`).equals(readFileSync(`${ORIGINAL_DIR}/${f}`)), f).toBe(true);
    }
    expect(readFileSync('assets/images/cards/monsters/desuoru_battlecard.png').equals(readFileSync(`${ORIGINAL_DIR}/desuoru_battleart.png`))).toBe(true);
  });

  it('CSV の14行・JSON・ゲームのカードで、番号・名前・分類・マナ・ダメージ・効果がすべて一致する', () => {
    const CATEGORY = { ちから技: 'force', かしこさ技: 'wisdom', 特殊技: 'special', 防御技: 'defense', 回避技: 'evade' } as const;
    const rows = csvRows('src/data/official/desuoru14_skills_OFFICIAL_20261031.csv');
    expect(rows).toHaveLength(14);
    rows.forEach((row, i) => {
      const skill = DESUORU_SKILLS[i];
      const json = desuoruJson.skills[i];
      if (!skill || !json) throw new Error(String(i));
      expect(row[0]).toBe(String(json.no));
      expect(row[1]).toBe(json.name);
      expect(row[2]).toBe(json.category);
      expect(row[3]).toBe(String(json.mana));
      expect(row[4]).toBe(json.damage);
      expect(skill.id).toBe(des(i + 1));
      expect(json.id).toBe(skill.id);
      expect(skill.name).toBe(json.name);
      expect(skill.category).toBe(CATEGORY[json.category as keyof typeof CATEGORY]);
      expect(skill.cost).toBe(json.mana);
      expect(skill.stat?.value ?? '―').toBe(json.damage === '―' ? '―' : Number(json.damage));
      expect(skill.effectTextJa ?? 'なし').toBe(SKILL_CARD_TEXT[skill.id] ?? json.effect);
    });
  });

  it('指示書の表のとおり（技名・分類・マナ・ダメージ）と、今ある効果との対応', () => {
    const want: readonly [string, string, number, number | null][] = [
      ['いしづきでつく', 'force', 0, 1],
      ['てっこうのつめ', 'force', 1, 2],
      ['やみがらす', 'wisdom', 1, 2],
      ['しのささやき', 'wisdom', 2, 3],
      ['めいかいのかぜ', 'wisdom', 3, 4],
      ['しのゆびさし', 'wisdom', 4, 4],
      ['やみのやり', 'force', 5, 5],
      ['ヘルのもん', 'wisdom', 5, 7],
      ['にらみつける', 'special', 2, null],
      ['カラスのめ', 'special', 3, null],
      ['やみのころも', 'defense', 2, null],
      ['ルーンのまもり', 'defense', 2, null],
      ['マントでそらす', 'evade', 2, null],
      ['かげにとける', 'evade', 1, null],
    ];
    want.forEach(([name, category, cost, dmg], i) => {
      const s = getSkill(des(i + 1));
      expect(s.name).toBe(name);
      expect(s.category).toBe(category);
      expect(s.cost).toBe(cost);
      expect(s.stat?.value ?? null).toBe(dmg);
    });
    expect(getSkill(des(6)).effect).toEqual(getSkill('skl-gauul14-09').effect); // 回避されない（聖なる炎）
    expect(getSkill(des(7)).effect).toEqual(getSkill('skl-geol-02').effect); // 防御されない（いわくだき）
    expect(getSkill(des(9)).effect).toEqual(getSkill('skl-soramo14-09').effect); // すなかけ
    expect(getSkill(des(9)).effect).toEqual(getSkill('skl-gauul14-10').effect); // 威嚇
    expect(getSkill(des(10)).effect).toEqual({ type: 'discardChoice' });
    expect(getSkill(des(11)).effect).toEqual(getSkill('skl-kalshell-11').effect);
    expect(getSkill(des(12)).effect).toEqual(getSkill('skl-kalshell-12').effect);
    expect(getSkill(des(13)).effect).toEqual(getSkill('skl-kalshell-14').effect); // しおのステップ
    expect(getSkill(des(14)).effect).toEqual(getSkill('skl-serephine-14').effect); // ウェーブダンス
    for (const n of [1, 2, 3, 4, 5, 8]) expect(getSkill(des(n)).effect, String(n)).toEqual({ type: 'attack' });
  });

  it('モンスター：ライフ7・紺・ID mon-desuoru。内部ランク A（初めての A）。レアの枠は 08・10・14。枠の絵がある', () => {
    expect(DESUORU_MONSTER).toMatchObject({ id: 'mon-desuoru', life: 7, name: 'デスオル', isPlaceholder: false });
    expect(desuoruJson.monster_rank).toBe('A');
    expect(DESUORU_COLOR).toBe('#1E2B58');
    expect(DESUORU_GACHA_RARE).toEqual([des(8), des(10), des(14)]);
    expect(BATTLE_CARDS[DESUORU_MONSTER_ID]?.frame).toBe('desuoru');
    expect(existsSync('assets/images/ui/battlecard/frame_desuoru.png')).toBe(true);
    for (const size of ['normal', 'hand']) expect(existsSync(`assets/images/ui/skillcard_simple/frame_${size}_desuoru.webp`)).toBe(true);
  });

  it('ふつうの一覧に入り、図鑑の番号はハクランのあと（No.211〜225）', () => {
    expect(MONSTERS.some((m) => m.id === DESUORU_MONSTER_ID)).toBe(true);
    expect(SKILLS.filter((s) => s.monsterId === DESUORU_MONSTER_ID).map((s) => s.id)).toEqual(DESUORU_SKILLS.map((s) => s.id));
    const book = cardBookEntries();
    expect(book.find((e) => e.card.id === 'skl-hakuran-14')?.no).toBe(210);
    expect(book.find((e) => e.card.id === DESUORU_MONSTER_ID)?.no).toBe(211);
    expect(book.find((e) => e.card.id === des(14))?.no).toBe(225);
  });

  it('絵：技14枚・正式モンスターカード。原本は無改変で保管（パックの窓の絵は gacha-20261029/ にも）', () => {
    for (let n = 1; n <= 14; n++) {
      const nn = String(n).padStart(2, '0');
      expect(getSkill(des(n)).art?.file).toBe(`desuoru_sk_${nn}.webp`);
      expect(existsSync(`assets/images/cards/skills/desuoru_sk_${nn}.webp`)).toBe(true);
      expect(existsSync(`${ORIGINAL_DIR}/desuoru_sk_${nn}.png`)).toBe(true);
    }
    expect(DESUORU_MONSTER.art?.file).toBe('desuoru_official.webp');
    for (const f of ['desuoru_official_monstercard_LIFE7.png', 'desuoru_original_approved.png', 'desuoru_3view_approved.png', 'pack_art_desuoru.png', 'AG_instruction_ja.md']) {
      expect(existsSync(`${ORIGINAL_DIR}/${f}`), f).toBe(true);
    }
    expect(readFileSync('design-parts/gacha-20261029/pack_art/pack_art_desuoru.png').equals(readFileSync(`${ORIGINAL_DIR}/pack_art_desuoru.png`))).toBe(true);
    for (const f of ['art/pack_desuoru.png', 'shop/shop_pack_desuoru.png', 'shop/shop_card_desuoru.png']) expect(existsSync(`design-parts/gacha-20261029/${f}`), f).toBe(true);
    expect(existsSync('assets/images/ui/gacha/pack_desuoru.webp')).toBe(true);
    expect(existsSync('assets/images/ui/gacha/panel_desuoru.webp')).toBe(true);
  });

  it('対戦のアイコンの切り抜き：顔は絵の上のほう', () => {
    expect(portraitFocus(DESUORU_MONSTER_ID).y).toBeLessThan(0.4);
  });

  it('英語の名前（仮訳）', () => {
    setLanguage('en');
    try {
      expect(cardName(DESUORU_MONSTER_ID)).toBe('Desuoru');
      expect(cardName(des(10))).toBe("Raven's Eye");
      expect(cardName(des(14))).toBe('Melt into Shadow');
    } finally {
      setLanguage('ja');
    }
  });

  it('パックの色（pack_tint.py。暗い色のしかた）・パックの絵・販売機の窓・枠の色の表にデスオルがある。ショップの棚の絵には入れない', () => {
    expect(readFileSync('tools/design/pack_tint.py', 'utf8')).toContain("'desuoru': '#1E2B58'");
    expect(readFileSync('tools/design/gacha_series_build.py', 'utf8')).toMatch(/PACKS = \[.*'hakuran', 'desuoru'(, '[a-z]+')*\]/);
    expect(readFileSync('tools/design/gacha_panel_build.py', 'utf8')).toContain("'desuoru': (");
    expect(readFileSync('tools/design/shop_goods_20261030.py', 'utf8')).not.toContain("'desuoru'");
    for (const f of ['tools/art/skillcard_simple_build.py', 'tools/art/skillcard_v3_build.py']) expect(readFileSync(f, 'utf8')).toContain("'desuoru': '#1E2B58'");
  });
});

// 自分：デスオル（p-m1 ライフ7）・ソラモ（p-m2）・ノビトン（p-m3）。相手も同じ（o-m1〜3）
const MONS = [DESUORU_MONSTER_ID, 'mon-soramo', 'mon-nobiton'];

function scene(hand: Partial<Record<Side, string[]>>, active: Side = 'player', oppMana = 10): BattleState {
  const deck = { monsters: [...MONS], skills: Array.from({ length: 60 }, () => sor(1)) };
  const s = createBattle({ name: 'P', deck }, { name: 'O', deck }, 11, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: k === 'opponent' ? oppMana : 10 }, () => sor(1)),
    deck: Array.from({ length: 40 }, () => sor(2)),
  });
  return { ...s, turn: 3, phase: 'main', active, manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const monster = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};

function attackWith(attack: string, guard: string, target = 'o-m1'): { usable: boolean; reason: string | null; after: BattleState } {
  let s = scene({ player: [attack] });
  s = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: [{ uid: 'g0', cardId: guard }] } } };
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: target });
  const u = cardUsability(s, 'opponent', 'g0');
  let after = s.phase === 'defense' ? applyAction(s, { type: 'defend', side: 'opponent', cardUid: u.usable ? 'g0' : null }) : s;
  if (after.phase === 'defense') after = applyAction(after, { type: 'defend', side: 'opponent', cardUid: null });
  return { usable: u.usable, reason: u.reason, after };
}

describe('10 カラスのめ（新しい効果 discardChoice）', () => {
  it('相手を選ばずに使う。選んだ1枚が相手の捨て札へ。相手は補充しない。記録の帯に出る', () => {
    const s = scene({ player: [des(10)], opponent: [sor(1), sor(4), 'skl-desuoru-07'] });
    const after = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', choice: 'o1' });
    expect(after.sides.opponent.hand.map((c) => c.uid)).toEqual(['o0', 'o2']);
    expect(after.sides.opponent.discard.at(-1)).toBe(sor(4));
    expect(after.sides.player.manaPile).toHaveLength(10 - 3);
    expect(after.crowEye).toMatchObject({ chooser: 'player', cardId: sor(4) });
    expect(JSON.stringify(after.log.at(-1))).toContain(t('battle.log.discardChoice', { player: 'O', card: cardName(sor(4)) }));
    expect(monster(after, 'p-m1').acted).toBe(true);
  });

  it('相手の手札が0枚なら使えない（理由「相手は手札がありません」。吠えると同じ）', () => {
    const s = scene({ player: [des(10)] });
    const u = cardUsability(s, 'player', 'p0');
    expect(u.usable).toBe(false);
    expect(u.reason).toBe(t('battle.ng.noOpponentHand'));
    expect(u.reason).toBe(cardUsability(scene({ player: ['skl-soramo14-10'] }), 'player', 'p0').reason);
  });

  it('選んだカードの指定が無いとき（試遊）は、CPU の決まった選び方の1枚', () => {
    const s = scene({ player: [des(10)], opponent: [sor(11), sor(1), 'skl-soramo14-07'] });
    const after = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(after.sides.opponent.discard.at(-1)).toBe(defaultDiscardChoice(s, 'player')?.cardId);
  });

  it('CPU の選び方（A・B）：① 倒せる攻撃（払えるもの・いちばん大きいもの）→ ② いちばん大きい攻撃 → ③ 条件の無い回避 → ④ 防御', () => {
    // 相手（victim）＝player。CPU（opponent）が選ぶ。自分（CPU）のデスオルのライフ7
    const big = 'skl-soramo14-08'; // スターフォール級の大技（ソラモの技で、ダメージの大きいもの）
    const kill = (lifes: number, oppMana: number, hand: string[]) => {
      let s = scene({ player: hand }, 'opponent');
      s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, manaPile: Array.from({ length: oppMana }, () => sor(1)) }, opponent: { ...s.sides.opponent, monsters: s.sides.opponent.monsters.map((m) => ({ ...m, life: lifes })) } } };
      return defaultDiscardChoice(s, 'opponent')?.cardId;
    };
    const attacks = [sor(1), sor(4), big].map((id) => getSkill(id)).sort((a, b) => (b.stat?.value ?? 0) - (a.stat?.value ?? 0));
    const strongest = attacks[0]?.id;
    expect(kill(7, 10, [sor(11), sor(1), sor(4), big])).toBe(strongest);
    // 払えるマナが少ないと、払える中で倒せるもの（ライフ1なら ひっかく〔ソラモ01〕でも倒せる）
    const cheapKill = kill(1, getSkill(sor(1)).cost, [sor(1), big]);
    expect(getSkill(cheapKill ?? '').cost).toBeLessThanOrEqual(getSkill(sor(1)).cost);
    // 攻撃が無ければ条件の無い回避、無ければ防御
    expect(kill(7, 10, [sor(11), 'skl-desuoru-14', 'skl-desuoru-13'])).toBe('skl-desuoru-14');
    expect(kill(7, 10, ['skl-desuoru-13', sor(11)])).toBe(sor(11));
  });

  it('CPU が使う時：相手を倒せる攻撃が無く、相手の手札が3枚以上（2枚なら使わない）。choice を付ける', () => {
    const hand3 = [sor(1), sor(4), sor(11)];
    const s = scene({ opponent: [des(10)], player: hand3 }, 'opponent');
    const a = chooseAction(s, 'opponent', 'normal', 'A');
    expect(a).toMatchObject({ type: 'useCard', cardUid: 'o0' });
    expect(a && 'choice' in a ? a.choice : null).toBe(pickDiscardChoice(s, 'opponent', 'A'));
    const s2 = scene({ opponent: [des(10)], player: hand3.slice(0, 2) }, 'opponent');
    expect(chooseAction(s2, 'opponent', 'normal', 'A')).not.toMatchObject({ cardUid: 'o0' });
    // 倒せる攻撃があるときは攻撃が先
    let s3 = scene({ opponent: [des(10), des(2)], player: hand3 }, 'opponent');
    s3 = { ...s3, sides: { ...s3.sides, player: { ...s3.sides.player, monsters: s3.sides.player.monsters.map((m) => ({ ...m, life: 1 })) } } };
    expect(chooseAction(s3, 'opponent', 'normal', 'A')).toMatchObject({ cardUid: 'o1' });
  });

  it('腕前 C はランダムに1枚（相手の手札のどれか）', () => {
    const s = scene({ opponent: [des(10)], player: [sor(1), sor(4), sor(11), 'skl-soramo14-13'] }, 'opponent');
    const pick = pickDiscardChoice(s, 'opponent', 'C');
    expect(s.sides.player.hand.some((c) => c.uid === pick)).toBe(true);
  });

  it('画面：プレイヤーの選ぶ窓（やめるは無い）と、CPU のふきだし（記録の帯と同じカード）', () => {
    const src = readFileSync('src/ui/screens/battleScreen.ts', 'utf8');
    const block = src.slice(src.indexOf('const pickCrowEye'), src.indexOf('/* ---------- 手札を指でなぞる'));
    expect(block).toContain('closeOnBackdrop: false');
    expect(block).toContain("t('battle.crow.confirm')");
    expect(block).not.toContain('battle.pick.cancel');
    expect(src).toContain("t('battle.talk.crowEye'");
  });
});

describe('ほかの技（今ある効果）', () => {
  it('07 やみのやり：防御のカードは使えない（回避はできる）', () => {
    const blocked = attackWith(des(7), 'skl-soramo14-11', 'o-m2');
    expect(blocked.usable).toBe(false);
    expect(blocked.reason).toBe(t('battle.ng.unblockable'));
    expect(monster(blocked.after, 'o-m2').life).toBe(monster(scene({}), 'o-m2').life - 5);
  });

  it('06 しのゆびさし：回避されない（防御はできる）', () => {
    const r = attackWith(des(6), des(14));
    expect(r.usable).toBe(false);
    expect(r.reason).toBe(t('battle.ng.undodgeable'));
    expect(attackWith(des(6), des(12)).usable).toBe(true);
  });

  it('14 かげにとける：マナ1で、ちから技・かしこさ技をマナに関係なく回避（いしづきでつく〔マナ0〕も）', () => {
    for (const atk of [des(1), des(5), des(8)]) {
      const r = attackWith(atk, des(14));
      expect(r.usable, atk).toBe(true);
      expect(monster(r.after, 'o-m1').life, atk).toBe(7);
    }
  });

  it('13 マントでそらす：消費マナ2以上のちから技だけ回避（いしづきでつく〔マナ0〕・てっこうのつめ〔マナ1〕はよけられない）', () => {
    expect(attackWith(des(1), des(13)).usable).toBe(false);
    expect(attackWith(des(2), des(13)).usable).toBe(false);
    expect(attackWith(des(7), des(13)).usable).toBe(true);
    expect(attackWith(des(3), des(13)).usable).toBe(false);
  });

  it('09 にらみつける：選んだ相手1体は、次の手番に攻撃技を使えない（すなかけと同じ）', () => {
    let s = scene({ player: [des(9)], opponent: [sor(1)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(monster(s, 'o-m2').sealedTurn).toBe(s.turn + 1);
  });
});

describe('手に入れ方（まだ無い）', () => {
  it('どのダンジョン・相手・箱にも入っていない', () => {
    expect(JSON.stringify({ DUNGEONS, ENCOUNTERS, BOOSTERS })).not.toContain('desuoru');
  });

  it('ガチャのシリーズ：ハクランのあとに1行（desuoru-unlocked）。今のゲームでは並ばない。デスオルを持てば並ぶ', () => {
    const ids = GACHA_SERIES.map((s) => s.id);
    expect(ids.indexOf('desuoru')).toBe(ids.indexOf('hakuran') + 1);
    expect(GACHA_SERIES.find((s) => s.id === 'desuoru')).toEqual({
      id: 'desuoru',
      monsterId: 'mon-desuoru',
      rareSkillNames: ['ヘルのもん', 'カラスのめ', 'かげにとける'],
      unlockFlag: 'desuoru-unlocked',
    });
    const b = createNewSave(new Date('2026-10-31T00:00:00Z'), 'balance');
    expect(availableGachaSeriesFor(b).map((s) => s.id)).not.toContain('desuoru');
    expect(availableGachaSeriesFor({ ...b, collection: { ...b.collection, [DESUORU_MONSTER_ID]: 1 } }).map((s) => s.id)).toContain('desuoru');
  });

  it("src のどこにも desuoru-unlocked を立てる所は無い（GACHA_SERIES の1行だけ）", () => {
    const files = readdirSync('src', { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts'));
    expect(files.filter((f) => readFileSync(`src/${f}`, 'utf8').includes("'desuoru-unlocked'"))).toEqual(['data/economy.ts']);
  });
});
