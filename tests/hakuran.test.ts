import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { getSkill, MONSTERS, SKILLS } from '../src/data/cards.ts';
import { cardBookEntries } from '../src/data/cardNumbers.ts';
import { DUNGEONS, ENCOUNTERS } from '../src/data/dungeons.ts';
import { GACHA_SERIES, gachaSeenFlag } from '../src/data/economy.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import hakuranJson from '../src/data/official/hakuran14_skills_OFFICIAL_20261031.json';
import { HAKURAN_COLOR, HAKURAN_GACHA_RARE, HAKURAN_MONSTER, HAKURAN_MONSTER_ID, HAKURAN_PLAYTEST_16, HAKURAN_SKILLS, hakuranSkillId } from '../src/data/hakuran.ts';
import { portraitFocus } from '../src/data/monsterPortraits.ts';
import { SKILL_CARD_TEXT } from '../src/data/skillCardText.ts';
import { soramoSkillId } from '../src/data/soramo.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, cardUsability, createBattle, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { availableGachaSeriesFor } from '../src/game/economy/gachaSeries.ts';
import { createNewSave, type SaveData } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/**
 * ハクラン（2026-10-31 指示書 AF「新しいモンスター『ハクラン』（雷の高原の切り札・麒麟）を入れて試遊する」）。
 * 新しい決まりは無い：回避されない（ガウルの聖なる炎と同じ）・マナ0の攻撃（フルーネのつたはたきと同じ）・今ある防御と回避。
 * 裁定は docs/battle-rules.md「ハクランの効果の扱い」
 */

const hak = (n: number): string => hakuranSkillId(n);
const sor = (n: number): string => soramoSkillId(n);
const ORIGINAL_DIR = 'design-parts/cards-original/hakuran';
const base = (): SaveData => createNewSave(new Date('2026-10-31T00:00:00Z'), 'balance');

function csvRows(path: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(','));
}

describe('ハクラン：データ（届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  it('保管した JSON・CSV・バトル用の絵は ZIP の原本と同じバイト列', () => {
    for (const f of ['hakuran14_skills_OFFICIAL_20261031.json', 'hakuran14_skills_OFFICIAL_20261031.csv']) {
      expect(readFileSync(`src/data/official/${f}`).equals(readFileSync(`${ORIGINAL_DIR}/${f}`)), f).toBe(true);
    }
    expect(readFileSync('assets/images/cards/monsters/hakuran_battlecard.png').equals(readFileSync(`${ORIGINAL_DIR}/hakuran_battleart.png`))).toBe(true);
  });

  it('AF2 で直す前の JSON・CSV は _v1_20261031 として残す（LIFE 6・ひづめげり 2・てんをかける 4）', () => {
    const v1 = JSON.parse(readFileSync(`${ORIGINAL_DIR}/hakuran14_skills_OFFICIAL_20261031_v1_20261031.json`, 'utf8'));
    expect(v1.life).toBe(6);
    expect(v1.skills[3].damage).toBe('2');
    expect(v1.skills[8].damage).toBe('4');
    expect(csvRows(`${ORIGINAL_DIR}/hakuran14_skills_OFFICIAL_20261031_v1_20261031.csv`)[3]?.[4]).toBe('2');
    expect(hakuranJson.life).toBe(7);
  });

  it('CSV の14行・JSON・ゲームのカードで、番号・名前・分類・マナ・ダメージ・効果がすべて一致する', () => {
    const CATEGORY = { ちから技: 'force', かしこさ技: 'wisdom', 防御技: 'defense', 回避技: 'evade' } as const;
    const rows = csvRows('src/data/official/hakuran14_skills_OFFICIAL_20261031.csv');
    expect(rows).toHaveLength(14);
    rows.forEach((row, i) => {
      const skill = HAKURAN_SKILLS[i];
      const json = hakuranJson.skills[i];
      if (!skill || !json) throw new Error(String(i));
      expect(row[0]).toBe(String(json.no));
      expect(row[1]).toBe(json.name);
      expect(row[2]).toBe(json.category);
      expect(row[3]).toBe(String(json.mana));
      expect(row[4]).toBe(json.damage);
      expect(row[5]).toBe(json.effect);
      expect(skill.id).toBe(hak(i + 1));
      expect(json.id).toBe(skill.id);
      expect(skill.name).toBe(json.name);
      expect(skill.category).toBe(CATEGORY[json.category as keyof typeof CATEGORY]);
      expect(skill.cost).toBe(json.mana);
      expect(skill.stat?.value ?? '―').toBe(json.damage === '―' ? '―' : Number(json.damage));
      expect(skill.effectTextJa ?? 'なし').toBe(SKILL_CARD_TEXT[skill.id] ?? json.effect);
    });
  });

  it('指示書の表のとおり（技名・分類・マナ・ダメージ・回避されない・レア）', () => {
    const want: readonly [string, string, number, number | null, boolean][] = [
      ['ひづめならし', 'force', 0, 1, false],
      ['つのでこづく', 'force', 1, 1, true],
      ['くもだま', 'wisdom', 1, 1, false],
      ['ひづめげり', 'force', 2, 3, false], // 2026-10-31 指示書 AF2：ダメージ 2→3
      ['みぬくひとみ', 'wisdom', 2, 2, true],
      ['くもをける', 'force', 3, 3, false],
      ['つのつき', 'force', 3, 3, true],
      ['らいうん', 'wisdom', 4, 3, true],
      ['てんをかける', 'force', 4, 5, false], // 2026-10-31 指示書 AF2：ダメージ 4→5
      ['せいなるいかずち', 'wisdom', 5, 5, true],
      ['くものころも', 'defense', 2, null, false],
      ['ひらりとはねる', 'evade', 2, null, false],
      ['くもがくれ', 'evade', 2, null, false],
      ['かすみのあゆみ', 'evade', 2, null, false],
    ];
    want.forEach(([name, category, cost, dmg, undodgeable], i) => {
      const s = getSkill(hak(i + 1));
      expect(s.name).toBe(name);
      expect(s.category).toBe(category);
      expect(s.cost).toBe(cost);
      expect(s.stat?.value ?? null).toBe(dmg);
      expect(s.effect.type === 'attack' && !!s.effect.undodgeable, name).toBe(undodgeable);
      // 回避されない以外の新しい効果は無い（攻撃は undodgeable だけ）
      if (s.effect.type === 'attack') expect(Object.keys(s.effect).filter((k) => k !== 'type' && k !== 'undodgeable'), name).toEqual([]);
    });
  });

  it('カードに書く短い文：回避されないは JSON の文のまま。11〜14 は今の言い方', () => {
    for (const n of [2, 5, 7, 8, 10]) expect(getSkill(hak(n)).effectTextJa).toBe('回避されない');
    expect(getSkill(hak(11)).effectTextJa).toBe(getSkill('skl-serephine-11').effectTextJa);
    expect(getSkill(hak(12)).effectTextJa).toBe('ちから技を回避');
    expect(getSkill(hak(13)).effectTextJa).toBe('かしこさ技を回避');
    expect(getSkill(hak(14)).effectTextJa).toBe(getSkill('skl-tsumuji-14').effectTextJa);
    for (const n of [1, 3, 4, 6, 9]) expect(getSkill(hak(n)).effectTextJa ?? null).toBe(null);
  });

  it('モンスター：ライフ7（2026-10-31 指示書 AF2 で 6→7）・青緑（ティール）・ID mon-hakuran。内部ランク B。レアの枠は 08・10・14。枠の絵がある', () => {
    expect(HAKURAN_MONSTER).toMatchObject({ id: 'mon-hakuran', life: 7, name: 'ハクラン', isPlaceholder: false });
    expect(hakuranJson.monster_rank).toBe('B');
    expect(HAKURAN_COLOR).toBe('#237C7A');
    expect(HAKURAN_GACHA_RARE).toEqual([hak(8), hak(10), hak(14)]);
    expect(BATTLE_CARDS[HAKURAN_MONSTER_ID]?.frame).toBe('hakuran');
    expect(existsSync('assets/images/ui/battlecard/frame_hakuran.png')).toBe(true);
    for (const size of ['normal', 'hand']) expect(existsSync(`assets/images/ui/skillcard_simple/frame_${size}_hakuran.webp`)).toBe(true);
  });

  it('ふつうの一覧に入り、図鑑の番号はシシエンのあと（No.196〜210）', () => {
    expect(MONSTERS.some((m) => m.id === HAKURAN_MONSTER_ID)).toBe(true);
    expect(SKILLS.filter((s) => s.monsterId === HAKURAN_MONSTER_ID).map((s) => s.id)).toEqual(HAKURAN_SKILLS.map((s) => s.id));
    const book = cardBookEntries();
    expect(book.find((e) => e.card.id === 'skl-shishien-14')?.no).toBe(195);
    expect(book.find((e) => e.card.id === HAKURAN_MONSTER_ID)?.no).toBe(196);
    expect(book.find((e) => e.card.id === hak(14))?.no).toBe(210);
  });

  it('絵：技14枚・正式モンスターカード。原本は無改変で保管（パックの窓の絵は gacha-20261029/ にも）', () => {
    for (let n = 1; n <= 14; n++) {
      const nn = String(n).padStart(2, '0');
      expect(getSkill(hak(n)).art?.file).toBe(`hakuran_sk_${nn}.webp`);
      expect(existsSync(`assets/images/cards/skills/hakuran_sk_${nn}.webp`)).toBe(true);
      expect(existsSync(`${ORIGINAL_DIR}/hakuran_sk_${nn}.png`)).toBe(true);
    }
    expect(HAKURAN_MONSTER.art?.file).toBe('hakuran_official.webp');
    expect(existsSync('assets/images/cards/monsters/hakuran_official.webp')).toBe(true);
    // 2026-10-31 指示書 AF2 の追加：LIFE 7 の版（ゲームの hakuran_official.webp はこちらから作る）。LIFE6 の版も残す
    for (const f of ['hakuran_official_monstercard_LIFE6.png', 'hakuran_official_monstercard_LIFE7.png', 'AF2_card_ja.md', 'hakuran_original_approved.png', 'hakuran_3view_approved.png', 'pack_art_hakuran.png', 'AF_instruction_ja.md']) {
      expect(existsSync(`${ORIGINAL_DIR}/${f}`), f).toBe(true);
    }
    expect(readFileSync('design-parts/gacha-20261029/pack_art/pack_art_hakuran.png').equals(readFileSync(`${ORIGINAL_DIR}/pack_art_hakuran.png`))).toBe(true);
    for (const f of ['art/pack_hakuran.png', 'shop/shop_pack_hakuran.png', 'shop/shop_card_hakuran.png']) expect(existsSync(`design-parts/gacha-20261029/${f}`), f).toBe(true);
    expect(existsSync('assets/images/ui/gacha/pack_hakuran.webp')).toBe(true);
    expect(existsSync('assets/images/ui/gacha/panel_hakuran.webp')).toBe(true);
  });

  it('対戦のアイコンの切り抜き：顔は絵の上のほうの真ん中より右', () => {
    const f = portraitFocus(HAKURAN_MONSTER_ID);
    expect(f.x).toBeGreaterThan(0.5);
    expect(f.y).toBeLessThan(0.5);
  });

  it('英語の名前（仮訳）', () => {
    setLanguage('en');
    try {
      expect(cardName(HAKURAN_MONSTER_ID)).toBe('Hakuran');
      expect(cardName(hak(10))).toBe('Holy Lightning');
      expect(cardName(hak(14))).toBe('Mist Step');
    } finally {
      setLanguage('ja');
    }
  });

  it('パックの色（pack_tint.py）・パックの絵・販売機の窓・枠の色の表にハクランがある。ショップの棚の絵には入れない（ユーザー決定 2026-10-31）', () => {
    expect(readFileSync('tools/design/pack_tint.py', 'utf8')).toContain("'hakuran': '#237C7A'");
    expect(readFileSync('tools/design/gacha_series_build.py', 'utf8')).toMatch(/PACKS = \[.*'shishien', 'hakuran'(, '[a-z]+')*\]/);
    expect(readFileSync('tools/design/gacha_panel_build.py', 'utf8')).toContain("'hakuran': (");
    expect(readFileSync('tools/design/shop_goods_20261030.py', 'utf8')).not.toContain("'hakuran'");
    for (const f of ['tools/art/skillcard_simple_build.py', 'tools/art/skillcard_v3_build.py']) expect(readFileSync(f, 'utf8')).toContain("'hakuran': '#237C7A'");
    // 2026-10-31 指示書 AF2：モンスターカードの枠とパックの縁はハクランだけ暗く（シシエンの暗い色と同じしかた）
    expect(readFileSync('tools/art/battle_card_frame.py', 'utf8')).toContain("FORCE_DARK = {'hakuran'}");
    expect(readFileSync('tools/design/pack_tint.py', 'utf8')).toContain("DEEPER = {'hakuran': 0.12}");
  });

  it('試遊用の16枚（Claude の仮）：レア以外の11種を1枚ずつ＋安い攻撃5種の2枚目。レアは入れない', () => {
    expect(HAKURAN_PLAYTEST_16.reduce((n, x) => n + x.copies, 0)).toBe(16);
    for (const rare of HAKURAN_GACHA_RARE) expect(HAKURAN_PLAYTEST_16.some((x) => x.id === rare)).toBe(false);
    const normal = HAKURAN_SKILLS.filter((s) => !HAKURAN_GACHA_RARE.includes(s.id)).map((s) => s.id);
    expect(normal).toHaveLength(11);
    for (const id of normal) expect(HAKURAN_PLAYTEST_16.some((x) => x.id === id), id).toBe(true);
    expect(HAKURAN_PLAYTEST_16.filter((x) => x.copies === 2).map((x) => x.id)).toEqual([1, 2, 3, 4, 5].map(hak));
  });
});

// 自分：ハクラン（p-m1 ライフ7）・ソラモ（p-m2）・ノビトン（p-m3）。相手も同じ（o-m1〜3）
const MONS = [HAKURAN_MONSTER_ID, 'mon-soramo', 'mon-nobiton'];

function scene(hand: Partial<Record<Side, string[]>>, active: Side = 'player', turn = 3, opponentMonsters: readonly string[] = MONS): BattleState {
  const deck = { monsters: [...MONS], skills: Array.from({ length: 60 }, () => sor(1)) };
  const s = createBattle({ name: 'P', deck }, { name: 'O', deck: { ...deck, monsters: [...opponentMonsters] } }, 11, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: 10 }, () => sor(1)),
    deck: Array.from({ length: 40 }, () => sor(2)),
  });
  return { ...s, turn, phase: 'main', active, manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const monster = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};

/** 自分の attack（手札 p0）を相手 target に。相手は手札 g0 の guard を出そうとする（出せるかと理由・出したあと〔出せなければ守らない〕を返す） */
function attackWith(attack: string, guard: string | null, target = 'o-m1', opponentMonsters: readonly string[] = MONS): { usable: boolean; reason: string | undefined; after: BattleState } {
  let s = scene({ player: [attack] }, 'player', 3, opponentMonsters);
  if (guard) s = { ...s, sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: [{ uid: 'g0', cardId: guard }] } } };
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: target });
  const u = guard ? cardUsability(s, 'opponent', 'g0') : { usable: false, reason: undefined };
  let after = s.phase === 'defense' ? applyAction(s, { type: 'defend', side: 'opponent', cardUid: u.usable ? 'g0' : null }) : s;
  if (after.phase === 'defense') after = applyAction(after, { type: 'defend', side: 'opponent', cardUid: null });
  return { usable: u.usable, reason: 'reason' in u ? (u.reason as string | undefined) : undefined, after };
}

describe('回避されない（02・05・07・08・10）：ガウルの聖なる炎と同じ', () => {
  it('どの回避でも避けられない（条件の合う回避でも不可・理由の文が出る）。当たってダメージどおり', () => {
    for (const n of [2, 5, 7, 8, 10]) {
      expect(getSkill(hak(n)).effect).toEqual({ type: 'attack', undodgeable: true });
      for (const guard of [hak(12), hak(13), hak(14)]) {
        const r = attackWith(hak(n), guard);
        expect(r.usable, `${n} ${guard}`).toBe(false);
        expect(monster(r.after, 'o-m1').life, `${n} ${guard}`).toBe(7 - (getSkill(hak(n)).stat?.value ?? 0));
      }
      const r = attackWith(hak(n), hak(14));
      expect(r.reason).toBeTruthy();
    }
  });

  it('防御はできる（くものころも −2）', () => {
    for (const n of [2, 5, 7, 8, 10]) {
      const r = attackWith(hak(n), hak(11));
      expect(r.usable, String(n)).toBe(true);
      expect(monster(r.after, 'o-m1').life, String(n)).toBe(7 - Math.max(0, (getSkill(hak(n)).stat?.value ?? 0) - 2));
    }
  });

  it('回避されない攻撃でないものは、条件の合う回避でよけられる', () => {
    for (const [n, guard] of [[1, hak(12)], [4, hak(12)], [6, hak(14)], [9, hak(14)], [3, hak(13)]] as const) {
      const r = attackWith(hak(n), guard);
      expect(r.usable, String(n)).toBe(true);
      expect(monster(r.after, 'o-m1').life, String(n)).toBe(7);
    }
  });
});

describe('01 ひづめならし：マナ0の攻撃（フルーネのつたはたきと同じ扱い）', () => {
  it('マナ0で使える。「消費マナ2以上」の回避（カルシェルのよけ）ではよけられない。ひづめげり（マナ2）はよけられる', () => {
    expect(getSkill(hak(1)).cost).toBe(0);
    expect(getSkill(hak(1)).cost).toBe(getSkill('skl-flune-01').cost);
    expect(getSkill('skl-kalshell-14').effect).toEqual({ type: 'evade', against: 'force', minCost: 2 });
    // 相手の先頭はカルシェル（ライフ8。カルシェルの技はカルシェルが使う）
    const KAL = ['mon-kalshell', 'mon-soramo', 'mon-nobiton'];
    const zero = attackWith(hak(1), 'skl-kalshell-14', 'o-m1', KAL);
    expect(zero.usable).toBe(false);
    expect(monster(zero.after, 'o-m1').life).toBe(8 - 1);
    const two = attackWith(hak(4), 'skl-kalshell-14', 'o-m1', KAL);
    expect(two.usable).toBe(true);
    expect(monster(two.after, 'o-m1').life).toBe(8);
  });
});

describe('守り（11〜14）：今ある防御・回避と同じ', () => {
  it('11＝ミストヴェール・12＝すいっとよける・13＝ゆらりとかわす・14＝ウェーブダンス', () => {
    for (const n of [11, 12, 13, 14]) expect(getSkill(hak(n)).effect, String(n)).toEqual(getSkill(`skl-serephine-${n}`).effect);
    expect(attackWith(hak(3), hak(12)).usable).toBe(false);
    expect(attackWith(hak(4), hak(13)).usable).toBe(false);
    expect(monster(attackWith(hak(9), hak(11)).after, 'o-m1').life).toBe(7 - (5 - 2));
  });
});

describe('相手の CPU：今の思考のまま（回避されない攻撃は少し強い攻撃として先に選ぶ）', () => {
  it('同じ威力なら、回避されない攻撃（つのつき）をふつうの攻撃（くもをける）より先に使う', () => {
    let picked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s0 = scene({ opponent: [hak(6), hak(7)] }, 'opponent');
      const s = { ...s0, seed, sides: { ...s0.sides, player: { ...s0.sides.player, monsters: s0.sides.player.monsters.map((m) => ({ ...m, life: 6 })) } } };
      const a = chooseAction(s, 'opponent', 'normal', 'B');
      if (a?.type === 'useCard' && a.cardUid === 'o1') picked++;
    }
    expect(picked).toBeGreaterThan(10);
  });
});

describe('手に入れ方（2026-11-01 指示書 AH から雷の高原。それまではまだ無かった）', () => {
  it('雷の高原（dungeon-09）の祭壇とボスのステラだけに入っている。箱には入っていない', () => {
    expect(DUNGEONS.filter((d) => JSON.stringify(d).includes('hakuran')).map((d) => d.id)).toEqual(['dungeon-09']);
    expect(Object.keys(ENCOUNTERS).filter((id) => JSON.stringify(ENCOUNTERS[id]).includes('hakuran'))).toEqual(['enc-thunder-boss']);
    expect(JSON.stringify(BOOSTERS)).not.toContain('hakuran');
  });

  it('ガチャのシリーズ：シシエンのあとに1行（thunder-boss-beaten）。今のゲームでは並ばない。ハクランを持てば並ぶ', () => {
    const ids = GACHA_SERIES.map((s) => s.id);
    expect(ids.indexOf('hakuran')).toBe(ids.indexOf('shishien') + 1);
    expect(GACHA_SERIES.find((s) => s.id === 'hakuran')).toEqual({
      id: 'hakuran',
      monsterId: 'mon-hakuran',
      rareSkillNames: ['らいうん', 'せいなるいかずち', 'かすみのあゆみ'],
      unlockFlag: 'thunder-boss-beaten',
    });
    const b = base();
    expect(availableGachaSeriesFor(b).map((s) => s.id)).not.toContain('hakuran');
    const flagged = { ...b, storyFlags: [...b.storyFlags, 'thunder-boss-beaten'] };
    expect(availableGachaSeriesFor(flagged).map((s) => s.id)).not.toContain('hakuran');
    const owned = { ...b, collection: { ...b.collection, [HAKURAN_MONSTER_ID]: 1 } };
    expect(availableGachaSeriesFor(owned).map((s) => s.id)).toContain('hakuran');
    expect(gachaSeenFlag('hakuran')).toBeTruthy();
  });

  it('thunder-boss-beaten は GACHA_SERIES と、雷の高原のボスに勝った記録（dungeons.ts の STELLA_BEATEN_FLAG）だけ', () => {
    const files = readdirSync('src', { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts'));
    const users = files.filter((f) => readFileSync(`src/${f}`, 'utf8').includes("'thunder-boss-beaten'"));
    expect(users.sort()).toEqual(['data/dungeons.ts', 'data/economy.ts']);
    expect(readFileSync('src/data/economy.ts', 'utf8').match(/'thunder-boss-beaten'/g)).toHaveLength(1);
  });
});

