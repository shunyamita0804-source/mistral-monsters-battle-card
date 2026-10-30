import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSkill, MONSTERS, SKILLS } from '../src/data/cards.ts';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { PACKS } from '../src/data/economy.ts';
import soramoJson from '../src/data/official/soramo14_artv2_skills_OFFICIAL_20261026.json';
import { REGISTERED_ONLY_MONSTERS } from '../src/data/registeredMonsters.ts';
import { SORAMO_MONSTER, SORAMO_OLD_SKILL_IDS, SORAMO_SKILLS, SORAMO_STARTER, soramoSkillId } from '../src/data/soramo.ts';
import { TOURNAMENTS } from '../src/data/tournaments.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { actingSide, applyAction, cardUsability, createBattle, manaOf, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { skillCardFace, skillValueBadge, skillValueBadgeText } from '../src/game/cards/cardFace.ts';
import { buildAutoDeck, countCards, createStarterDeck, STARTER_SUPPORT_COUNT, STARTER_THIRD_SKILLS, validateDeck } from '../src/game/deck/deck.ts';
import { createNewSave } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { SKILL_CARD_TEXT } from '../src/data/skillCardText.ts';

const ids = (n: number): string => soramoSkillId(n);
const ORIGINAL = 'design-parts/cards-original/soramo14-artv2-20261026';
const sha256 = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

describe('ソラモ14技：正式データ（2026-10-26 Art Ver.2。届いた JSON・CSV を無改変で置き、ゲームはその JSON を読む）', () => {
  it('保管した JSON・CSV は ZIP の原本と同じ。絵14枚は照合表（SHA-256・827×937）どおり', () => {
    expect(readFileSync('src/data/official/soramo14_artv2_skills_OFFICIAL_20261026.json').equals(readFileSync(`${ORIGINAL}/02_SKILL_DATA/Soramo_14Skills_ArtV2_Starter16_UTF8.json`))).toBe(true);
    expect(readFileSync('src/data/official/soramo14_artv2_skills_OFFICIAL_20261026.csv').equals(readFileSync(`${ORIGINAL}/02_SKILL_DATA/Soramo_14Skills_ArtV2_Starter16_UTF8_BOM.csv`))).toBe(true);
    const manifest = JSON.parse(readFileSync(`${ORIGINAL}/04_QA/IMAGE_VALIDATION_MANIFEST_UTF8.json`, 'utf8')) as { skill_number: number; name: string; filename: string; size: number[]; sha256: string }[];
    expect(manifest).toHaveLength(14);
    for (const m of manifest) {
      const buf = readFileSync(`${ORIGINAL}/01_SKILL_IMAGES/${m.filename}`);
      expect(sha256(buf)).toBe(m.sha256);
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([827, 937]);
      expect(m.size).toEqual([827, 937]);
      expect(getSkill(ids(m.skill_number)).name).toBe(m.name);
    }
  }, 30000);

  it('番号・技名・分類・マナ・ダメージ・効果が、CSV の14行と JSON とゲームのカードですべて一致する', () => {
    const csv = readFileSync(`${ORIGINAL}/02_SKILL_DATA/Soramo_14Skills_ArtV2_Starter16_UTF8_BOM.csv`, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).slice(1);
    expect(csv).toHaveLength(14);
    const CAT = { strength: 'force', intelligence: 'wisdom', special: 'special', defense: 'defense', dodge: 'evade' } as const;
    csv.forEach((line, i) => {
      const [no, id, monster, name, category, mana, damage, effect, copies, image, artVersion] = line.split(',');
      const j = soramoJson[i];
      expect(j).toEqual({
        id,
        number: Number(no),
        monster,
        name,
        category,
        mana: Number(mana),
        damage: damage === '' ? null : Number(damage),
        effect,
        image,
        starter_copies: Number(copies),
        art_version: artVersion,
      });
      expect(artVersion).toBe('2');
      const s = getSkill(ids(Number(no)));
      expect(s.id).toBe(`skl-soramo14-${String(no).padStart(2, '0')}`);
      expect(s.designId).toBe(id);
      expect(s.name).toBe(name);
      expect(s.category).toBe(CAT[category as keyof typeof CAT]);
      expect(s.cost).toBe(Number(mana));
      expect(s.stat?.value ?? null).toBe(damage === '' ? null : Number(damage));
      expect(s.effectTextJa ?? '').toBe(SKILL_CARD_TEXT[s.id] ?? effect);
      expect(s.monsterId).toBe('mon-soramo');
      expect(s.isPlaceholder).toBe(false);
      expect(s.availability).toBe(Number(copies) > 0 ? 'initial' : 'collect');
    });
    expect(SORAMO_SKILLS).toHaveLength(14);
  });

  it('性能の一覧（動き）', () => {
    expect(SORAMO_SKILLS.map((s) => [s.name, s.cost, s.stat?.value ?? null, s.effect])).toEqual([
      ['ひっかき', 0, 1, { type: 'attack' }],
      ['連続ひっかき', 1, 1, { type: 'attack' }],
      ['たいあたり', 2, 2, { type: 'attack' }],
      ['しっぽアタック', 3, 3, { type: 'attack' }],
      ['スターダイブ', 4, 4, { type: 'attack' }],
      ['ソラモビーム', 2, 3, { type: 'attack' }],
      ['スターダストレイ', 4, 4, { type: 'attack' }],
      ['スターフォール', 5, 5, { type: 'attack' }],
      ['すなかけ', 2, null, { type: 'seal' }],
      ['吠える', 2, null, { type: 'discardRandom' }],
      ['まるまる', 1, null, { type: 'defense', reduce: 3, against: 'force' }],
      ['星のまもり', 1, null, { type: 'defense', reduce: 3, against: 'wisdom' }],
      ['ひらりジャンプ', 2, null, { type: 'evade', against: 'all', minCost: 2 }],
      ['星影ステップ', 2, null, { type: 'evade', against: 'all' }],
    ]);
  });

  it('絵は届いた Art Ver.2 の PNG（827×937）を1バイトも変えずに使う。14件すべて JSON の image と番号で対応。それまでの絵は置いていない', () => {
    for (const row of soramoJson) {
      const s = getSkill(ids(row.number));
      const nn = String(row.number).padStart(2, '0');
      expect(row.image).toBe(`01_SKILL_IMAGES/Soramo_Skill_${nn}.png`);
      expect(s.art?.file).toBe(`sor14v2_sk_${nn}.png`);
      const game = readFileSync(`assets/images/cards/skills/${s.art?.file}`);
      expect(game.equals(readFileSync(`${ORIGINAL}/${row.image}`))).toBe(true);
      expect([game.readUInt32BE(16), game.readUInt32BE(20)]).toEqual([827, 937]);
      // それまでの絵（2026-10-25）は外した
      expect(existsSync(`assets/images/cards/skills/sor14_sk_${nn}.png`)).toBe(false);
    }
  });

  it('旧16技（skl-soramo-01〜16）はゲームから削除。旧ソラモの絵（sor_sk_*.webp）も置いていない', () => {
    for (const id of SORAMO_OLD_SKILL_IDS) expect(SKILLS.some((s) => s.id === id)).toBe(false);
    expect(SKILLS.filter((s) => s.monsterId === 'mon-soramo')).toHaveLength(14);
    for (let n = 1; n <= 16; n++) expect(existsSync(`assets/images/cards/skills/sor_sk_${String(n).padStart(2, '0')}.webp`)).toBe(false);
  });

  it('パックには入れていない（入手方法・排出率は未定）', () => {
    for (const p of PACKS) expect(p.cardIds.some((id) => id.startsWith('skl-soramo14-'))).toBe(false);
  });
});

describe('初期配布（2026-10-25 ユーザー確定）', () => {
  it('ソラモ16枚＝02・03・04・07・09・10・11・13 を2枚ずつ。01・05・06・08・12・14 は初期配布0枚（登録はある）', () => {
    expect(SORAMO_STARTER).toEqual([2, 3, 4, 7, 9, 10, 11, 13].map((n) => ({ id: ids(n), copies: 2 })));
    expect(SORAMO_STARTER.reduce((n, s) => n + s.copies, 0)).toBe(16);
    // 初期デッキの先頭16枚がソラモの初期配布（そのあとの3体目の13枚は【仮】。下のテスト）
    const counts = countCards(createStarterDeck().skills.slice(0, 16));
    for (const n of [1, 5, 6, 8, 12, 14]) {
      expect(counts[ids(n)] ?? 0).toBe(0);
      expect(getSkill(ids(n)).name).toBeTruthy();
    }
    for (const n of [2, 3, 4, 7, 9, 10, 11, 13]) expect(counts[ids(n)]).toBe(2);
  });

  it('初期デッキ60枚＝ソラモ16＋ラズック16（2026-10-26 正式）＋3体目13（未確定・仮。2026-10-30 指示書 V から3体目はプカリム）＋サポート15（未確定・仮）。そのまま使える', () => {
    const deck = createStarterDeck();
    expect(deck.monsters).toEqual(['mon-soramo', 'mon-lazuck', 'mon-pukarim']);
    expect(deck.skills).toHaveLength(60);
    expect(deck.skills.slice(0, 16)).toEqual(SORAMO_STARTER.flatMap((s) => Array<string>(s.copies).fill(s.id)));
    expect(deck.skills.filter((id) => id.startsWith('skl-lazuck-'))).toHaveLength(16);
    expect(deck.skills.slice(32, 32 + STARTER_THIRD_SKILLS).every((id) => id.startsWith('skl-pukarim-'))).toBe(true);
    expect(deck.skills.filter((id) => id.startsWith('sup-'))).toHaveLength(STARTER_SUPPORT_COUNT);
    expect(Math.max(...Object.values(countCards(deck.skills)))).toBeLessThanOrEqual(3);
    expect(validateDeck(deck, createNewSave().collection)).toEqual([]);
  });
});

describe('ソラモのモンスターカード', () => {
  it('ライフ 7・枠色はクリーム・正式カードとバトル用の絵', () => {
    expect(SORAMO_MONSTER.life).toBe(7);
    expect(SORAMO_MONSTER.themeColor).toBe('#E4D2AC');
    for (const a of [SORAMO_MONSTER.art, SORAMO_MONSTER.battleArt]) expect(existsSync(`assets/images/cards/monsters/${a?.file}`)).toBe(true);
  });

  it('登録だけのモンスターはいない', () => {
    expect(REGISTERED_ONLY_MONSTERS).toEqual([]);
    expect(MONSTERS.filter((x) => ['ラズック', 'ガウル', 'ノビトン'].includes(x.name)).map((x) => x.id)).toEqual(['mon-lazuck', 'mon-gauul', 'mon-nobiton']);
  });

  it('大会・ダンジョン・練習の相手は、ソラモとラズックの仮の編成で、デッキが組める', () => {
    const teams = [...Object.values(ENCOUNTERS).map((e) => e.monsters), ...TOURNAMENTS.flatMap((t) => t.rounds.map((r) => r.monsters))];
    for (const team of teams) expect(validateDeck(buildAutoDeck(team))).toEqual([]);
  });
});

/* ---------- 技の効果（バトル） ---------- */

const deck = { monsters: ['mon-soramo', 'mon-soramo', 'mon-soramo'], skills: Array.from({ length: 60 }, () => ids(1)) };

function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}): BattleState {
  const s = createBattle({ name: 'P', deck }, { name: 'O', deck }, 7, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 10 }, () => ids(1)),
  });
  return { ...s, phase: 'main', active: 'player', manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const lifeOf = (s: BattleState, uid: string): number => [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((m) => m.uid === uid)?.life ?? -1;

/** player が o-m1 に attack を使い、opponent が guards を使ったあと */
function attackWith(attack: string, guards: string[], mana: Partial<Record<Side, number>> = {}): BattleState {
  let s = applyAction(scene({ player: [attack], opponent: guards }, mana), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
  guards.forEach((_, i) => {
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: `o${i}` });
  });
  if (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
  return s;
}

function underAttack(attack: string, guards: string[]): BattleState {
  return applyAction(scene({ player: [attack], opponent: guards }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
}

describe('ソラモ14技：効果（細かい裁定は docs/battle-rules.md「正式カード（ソラモ14技）」）', () => {
  it('01〜08 攻撃：書かれたダメージがそのまま入り、マナを払う。ひっかきはマナ0', () => {
    const dmg = [1, 1, 2, 3, 4, 3, 4, 5];
    dmg.forEach((d, i) => {
      const s = attackWith(ids(i + 1), []);
      expect(lifeOf(s, 'o-m1')).toBe(7 - d);
      expect(manaOf(s.sides.player)).toBe(10 - getSkill(ids(i + 1)).cost);
    });
    expect(cardUsability(scene({ player: [ids(1)] }, { player: 0 }), 'player', 'p0').usable).toBe(true);
  });

  it('09 すなかけ：選んだ相手モンスターは次の手番に攻撃の技を使えない', () => {
    const s = applyAction(scene({ player: [ids(9)] }), { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    const m = s.sides.opponent.monsters.find((x) => x.uid === 'o-m1');
    expect(m?.sealedTurn).toBe(s.turn + 1);
  });

  it('10 吠える：相手の手札からランダムに1枚が相手の捨て札へ（補充なし）。相手の手札がなければ使えない', () => {
    const before = scene({ player: [ids(10)], opponent: [ids(3), ids(5), ids(11)] });
    const s = applyAction(before, { type: 'useCard', side: 'player', cardUid: 'p0' });
    expect(s.sides.opponent.hand).toHaveLength(2);
    expect(s.sides.opponent.discard).toHaveLength(1);
    const gone = s.sides.opponent.discard[0] as string;
    expect([ids(3), ids(5), ids(11)]).toContain(gone);
    expect(s.sides.opponent.deck).toEqual(before.sides.opponent.deck);
    expect(manaOf(s.sides.player)).toBe(8);
    expect(s.log.at(-1)?.text).toContain('捨て札にした');
    expect(cardUsability(scene({ player: [ids(10)] }), 'player', 'p0')).toMatchObject({ usable: false, reason: '相手は手札がありません' });
  });

  it('11 まるまる：ちから技だけ−3。12 星のまもり：かしこさ技だけ−3（0未満にならない）', () => {
    expect(lifeOf(attackWith(ids(5), [ids(11)]), 'o-m1')).toBe(6);
    expect(lifeOf(attackWith(ids(2), [ids(11)]), 'o-m1')).toBe(7);
    expect(lifeOf(attackWith(ids(8), [ids(12)]), 'o-m1')).toBe(5);
    expect(cardUsability(underAttack(ids(6), [ids(11)]), 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'かしこさ攻撃には使えません' });
    expect(cardUsability(underAttack(ids(3), [ids(12)]), 'opponent', 'o0')).toMatchObject({ usable: false, reason: 'ちから攻撃には使えません' });
  });

  it('13 ひらりジャンプ：攻撃カードの必要マナが2以上のちから・かしこさ技を回避（1以下には使えない）', () => {
    expect(lifeOf(attackWith(ids(3), [ids(13)]), 'o-m1')).toBe(7);
    expect(lifeOf(attackWith(ids(6), [ids(13)]), 'o-m1')).toBe(7);
    expect(cardUsability(underAttack(ids(2), [ids(13)]), 'opponent', 'o0')).toMatchObject({ usable: false, reason: '必要マナ2以上の攻撃にしか使えません' });
    expect(cardUsability(underAttack(ids(1), [ids(13)]), 'opponent', 'o0').usable).toBe(false);
  });

  it('14 星影ステップ：消費マナに関係なく、ちから・かしこさ技を回避', () => {
    for (const n of [1, 2, 6, 8]) expect(lifeOf(attackWith(ids(n), [ids(14)]), 'o-m1')).toBe(7);
  });

  it('数値の欄：攻撃＝ダメージ、防御＝−3、回避＝「回避」、特殊（すなかけ・吠える）＝「効果」', () => {
    setLanguage('ja');
    expect(SORAMO_SKILLS.map((s) => skillValueBadgeText(skillValueBadge(s)))).toEqual(['1', '1', '2', '3', '4', '3', '4', '5', '効果', '効果', '-3', '-3', '回避', '回避']);
  });

  it('ソラモ同士で、相手の思考どうしが最後まで対戦できる（14種すべてを含むデッキ）', () => {
    const skills = [...Array.from({ length: 42 }, (_, i) => ids((i % 14) + 1)), ...Array.from({ length: 18 }, (_, i) => ids((i % 3) + 1))];
    const d = { monsters: ['mon-soramo', 'mon-soramo', 'mon-soramo'], skills };
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
    }
  });
});

describe('ソラモの技カードの面と日英', () => {
  it('日本語は効果の文のまま、英語は仮訳で日本語が残らない', () => {
    setLanguage('ja');
    expect(skillCardFace(getSkill(ids(10))).description).toBe('相手の手札からランダムに1枚を捨てさせる');
    setLanguage('en');
    for (const s of SORAMO_SKILLS) {
      expect(cardName(s)).not.toMatch(/[ぁ-んァ-ン一-龯]/);
      expect(skillCardFace(s).description).not.toMatch(/[ぁ-んァ-ン一-龯]/);
    }
    expect(cardName(getSkill(ids(8)))).toBe('Starfall');
    setLanguage('ja');
  });
});
