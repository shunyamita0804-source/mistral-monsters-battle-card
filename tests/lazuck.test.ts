import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardCatalog, getSkill, MONSTERS, skillsOf } from '../src/data/cards.ts';
import { PACKS } from '../src/data/economy.ts';
import { battleCardOf } from '../src/data/battleCards.ts';
import {
  LAZUCK14_ROWS,
  LAZUCK_CROSS_GUARD_ID,
  LAZUCK_ITAZURA_ID,
  LAZUCK_MONSTER,
  LAZUCK_REMOVED_14_IDS,
  LAZUCK_SKILLS,
  LAZUCK_STARTER,
  lazuckSkillId,
} from '../src/data/lazuck.ts';
import type { SkillCard } from '../src/game/cards/cardTypes.ts';
import officialJson from '../src/data/official/lazuck_cards_OFFICIAL.json';
import latestJson from '../src/data/official/lazuck_cards_LATEST_20261024.json';
import { soramoSkillId } from '../src/data/soramo.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import {
  actingSide,
  applyAction,
  attackPower,
  cardUsability,
  createBattle,
  targetsFor,
  type BattleMonster,
  type BattleState,
  type Side,
} from '../src/game/battle/engine.ts';
import { skillCardFace } from '../src/game/cards/cardFace.ts';
import { createSoramoTestDeck, createStarterDeck, validateDeck } from '../src/game/deck/deck.ts';
import { packCardRates } from '../src/game/economy/gacha.ts';
import { createNewSave, migrate, normalizeSave } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';
import { SKILL_CARD_TEXT } from '../src/data/skillCardText.ts';

const laz = (n: number): string => lazuckSkillId(n);
const sor = (n: number): string => soramoSkillId(n);

const lazImport = (n: number): string => (LAZUCK_SKILLS[n - 1] as SkillCard).id;
const ORIGINAL_DIR = 'design-parts/cards-original/lazuck14-20261026';

describe('ラズック正式14技（2026-10-26。正本 JSON を無改変で導入）', () => {
  it('置いた JSON は届いたものと同じ。14技・番号順は攻撃01〜07→特殊08〜10→防御11〜12→回避13〜14・初期配布は16枚', () => {
    expect(readFileSync('src/data/official/lazuck14_skills_OFFICIAL_20261026.json').equals(readFileSync(`${ORIGINAL_DIR}/01_RAZUK_FINAL_14_SKILLS_STARTER16.json`))).toBe(true);
    expect(LAZUCK14_ROWS.map((r) => r.number)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(LAZUCK14_ROWS.map((r) => r.category)).toEqual([
      ...Array(5).fill('force'),
      'wisdom',
      'wisdom',
      'special',
      'special',
      'special',
      'defense',
      'defense',
      'evade',
      'evade',
    ]);
    expect(LAZUCK14_ROWS.map((r) => r.initial_copies)).toEqual([3, 3, 0, 0, 3, 0, 0, 2, 2, 0, 1, 1, 1, 0]);
    expect(LAZUCK_STARTER.reduce((n, s) => n + s.copies, 0)).toBe(16);
  });

  it('技名・マナ・ダメージ・分類・効果の文・表示の番号・区分が JSON とすべて一致する。初期0枚の技も収集できるカードとして残す', () => {
    expect(LAZUCK_SKILLS).toHaveLength(14);
    expect(skillsOf('mon-lazuck').map((s) => s.id)).toEqual(LAZUCK_SKILLS.map((s) => s.id));
    for (const r of LAZUCK14_ROWS) {
      const s = LAZUCK_SKILLS[r.number - 1] as SkillCard;
      expect(s.name).toBe(r.name_ja);
      expect(s.cost).toBe(r.mana);
      expect(s.stat?.value ?? null).toBe(r.damage);
      expect(s.category).toBe(r.category);
      expect(s.effectTextJa).toBe(SKILL_CARD_TEXT[s.id] ?? r.effect_ja);
      expect(s.displayNo).toBe(r.number);
      expect(s.availability).toBe(r.initial_copies > 0 ? 'initial' : 'collect');
      expect(s.monsterId).toBe('mon-lazuck');
      expect(s.isPlaceholder).toBe(false);
      expect(cardCatalog.get(s.id)).toBe(s);
    }
  });

  it('ゲーム内 ID は、それまでの同じ名前の技の ID のまま（表示の番号が変わっても入れ替えない）。旧05 の ID はしっぷうタックルに使わない', () => {
    for (const s of LAZUCK_SKILLS) {
      const before = latestJson.skill_cards.find((l) => l.name_ja === s.name);
      expect(before, s.name).toBeDefined();
      expect(s.id).toBe(before?.game_id.startsWith('NEW_') ? LAZUCK_ITAZURA_ID : before?.game_id);
    }
    expect(lazImport(5)).toBe(laz(6)); // しっぷうタックル（旧06）
    expect(lazImport(13)).toBe(laz(15)); // シャドウスリップ（旧15）
    expect(new Set(LAZUCK_SKILLS.map((s) => s.id)).size).toBe(14);
  });

  it('しっぽアタック（旧05）・ミラージュダッシュ（旧16）・クロスガード（旧13）はカードの一覧・パック・初期デッキにない', () => {
    for (const id of [...LAZUCK_REMOVED_14_IDS, LAZUCK_CROSS_GUARD_ID]) {
      expect(cardCatalog.get(id)).toBeUndefined();
      expect(createStarterDeck().skills).not.toContain(id);
      for (const p of PACKS) expect(p.cardIds).not.toContain(id);
    }
    // ソラモにも同じ名前の「しっぽアタック」があるので、ラズックの技だけを見る
    expect(skillsOf('mon-lazuck').some((s) => s.name === 'しっぽアタック' || s.name === 'ミラージュダッシュ')).toBe(false);
    expect(LAZUCK_SKILLS.some((s) => s.art?.file === 'laz_sk_05.webp')).toBe(false);
  });

  it('絵は laz14_sk_01〜14.png（届いた 827×937 の PNG を1バイトも変えずに置いた。番号どおり）', () => {
    for (const s of LAZUCK_SKILLS) {
      const no = String(s.displayNo).padStart(2, '0');
      expect(s.art?.file).toBe(`laz14_sk_${no}.png`);
      const buf = readFileSync(`assets/images/cards/skills/${s.art?.file}`);
      expect(buf.equals(readFileSync(`${ORIGINAL_DIR}/02_FINAL_ART_01-14/Razuk_ArtV2_Skill_${no}.png`))).toBe(true);
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([827, 937]);
    }
  });

  it('枠は紫：技カードの枠（全分類・2つの大きさ）とバトル用カードの枠がある。技の種類の色・マナの色は共通のまま', () => {
    for (const size of ['normal', 'hand']) expect(existsSync(`assets/images/ui/skillcard_simple/frame_${size}_lazuck.webp`)).toBe(true);
    expect(battleCardOf('mon-lazuck')).toMatchObject({ art: 'lazuck_battlecard.png', frame: 'lazuck' });
    expect(existsSync('assets/images/ui/battlecard/frame_lazuck.png')).toBe(true);
    expect(readFileSync('assets/images/cards/monsters/lazuck_battlecard.png').equals(readFileSync(`${ORIGINAL_DIR}/08_BATTLE_MONSTER_CARD_ASSETS/02_Razuk_Battle_800x920_RGBA.png`))).toBe(true);
  });

  it('初期デッキのラズックは16枚（ひっかき3・かみつき3・しっぷうタックル3・ちょうはつ2・ダストキック2・しっぽいなし1・シャドウガード1・シャドウスリップ1）', () => {
    const lazuck = createStarterDeck().skills.filter((id) => id.startsWith('skl-lazuck-'));
    expect(lazuck).toHaveLength(16);
    const counts: Record<string, number> = {};
    for (const id of lazuck) counts[id] = (counts[id] ?? 0) + 1;
    expect(counts).toEqual({ [laz(1)]: 3, [laz(2)]: 3, [laz(6)]: 3, [laz(7)]: 2, [laz(8)]: 2, [laz(11)]: 1, [laz(12)]: 1, [laz(15)]: 1 });
  });

  it('パックには入れていない（入手方法・排出率は未定）', () => {
    for (const p of PACKS) {
      expect(p.cardIds.some((id) => id.includes('lazuck'))).toBe(false);
      expect(packCardRates(p).some((r) => r.cardId.includes('lazuck'))).toBe(false);
    }
  });

  it('モンスター：ライフ 6・正式カードとバトル用の絵', () => {
    expect(LAZUCK_MONSTER.id).toBe('mon-lazuck');
    expect(LAZUCK_MONSTER.life).toBe(6);
    for (const a of [LAZUCK_MONSTER.art, LAZUCK_MONSTER.battleArt]) expect(existsSync(`assets/images/cards/monsters/${a?.file}`)).toBe(true);
    expect(MONSTERS.filter((m) => m.id === 'mon-lazuck')).toHaveLength(1);
    expect(officialJson.monster_game_id).toBe('mon-lazuck');
  });
});

/* ---------- 技の効果（バトル） ---------- */

// 両方とも ソラモ（m1）・ラズック（m2）・ソラモ（m3）。2026-10-25 からはソラモ14技の初期デッキ
// 技の決まりを試す場面：ソラモ・ラズック・ソラモ（2026-10-30 指示書 V で初期デッキは3体ともちがうモンスターになったが、ここは対戦の決まりだけを見るので前の並びのまま）
const mixedDeck = { ...createStarterDeck(), monsters: ['mon-soramo', 'mon-lazuck', 'mon-soramo'] };

function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}): BattleState {
  const s = createBattle({ name: 'P', deck: mixedDeck }, { name: 'O', deck: mixedDeck }, 7, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 10 }, () => sor(1)),
  });
  return { ...s, phase: 'main', active: 'player', manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}

const lifeOf = (s: BattleState, uid: string): number =>
  [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((m) => m.uid === uid)?.life ?? -1;
const monster = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};

/** 相手の手番にする（手札を差し替え、only に入っているモンスターだけが動ける） */
function opponentTurn(s: BattleState, turn: number, hand: string[], only?: string[]): BattleState {
  return {
    ...s,
    turn,
    phase: 'main',
    active: 'opponent',
    pending: null,
    sides: {
      ...s.sides,
      opponent: {
        ...s.sides.opponent,
        hand: hand.map((cardId, i) => ({ uid: `x${i}`, cardId })),
        monsters: s.sides.opponent.monsters.map((m) => ({ ...m, acted: only ? !only.includes(m.uid) : false })),
      },
    },
  };
}

/** player が攻撃し、opponent が guards を順に使って守備を終えたあとの、狙われたモンスターのライフ */
function attackAndGuard(attack: string, target: string, guards: string[]): BattleState {
  let s = scene({ player: [attack], opponent: guards });
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: target });
  guards.forEach((_, i) => {
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: `o${i}` });
  });
  return applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
}

describe('ラズックの技の効果（正式14技。ID は同じ名前の技のまま：シャドウスリップ＝laz(15)・しっぷうタックル＝laz(6)）', () => {
  it('みだれづめ（回避されない）：回避は使えないが、防御は使える', () => {
    let s = scene({ player: [laz(4)], opponent: [laz(14), laz(15), laz(11)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(s.pending?.power).toBe(2);
    expect(cardUsability(s, 'opponent', 'o0')).toMatchObject({ usable: false });
    expect(cardUsability(s, 'opponent', 'o1')).toMatchObject({ usable: false });
    expect(cardUsability(s, 'opponent', 'o2').usable).toBe(true);
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'o2' });
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(lifeOf(s, 'o-m2')).toBe(6); // みだれづめ 2 − しっぽいなし 3 → 0
  });

  it('6 トリックショット・7 シャドウバースト：2026-10-29 夜の数字（2マナ2・3マナ4）。効果の文・絵は同じ', () => {
    expect([getSkill(laz(9)).cost, getSkill(laz(9)).stat?.value]).toEqual([2, 2]);
    expect([getSkill(laz(10)).cost, getSkill(laz(10)).stat?.value]).toEqual([3, 4]);
    // 元の版（2026-10-26）は残す
    const old = JSON.parse(readFileSync('src/data/official/lazuck14_skills_OFFICIAL_20261026.json', 'utf8')) as { skill_cards: { number: number; mana: number; damage: number }[] };
    expect(old.skill_cards.filter((r) => r.number === 6 || r.number === 7).map((r) => [r.mana, r.damage])).toEqual([[2, 3], [4, 5]]);
  });

  it('11 しっぽいなし（マナ2・ちから技だけ−3）・12 シャドウガード（マナ2・かしこさ技だけ−3）。0 未満にならない', () => {
    expect([getSkill(laz(11)).cost, getSkill(laz(12)).cost]).toEqual([2, 2]);
    expect(getSkill(laz(11)).effect).toEqual({ type: 'defense', reduce: 3, against: 'force' });
    expect(getSkill(laz(12)).effect).toEqual({ type: 'defense', reduce: 3, against: 'wisdom' });
    // とびかかり：ちから3 → 0、シャドウバースト：かしこさ4 → 1、トリックショット：かしこさ2 → 0（2026-10-29 夜の数字）
    expect(lifeOf(attackAndGuard(laz(3), 'o-m2', [laz(11)]), 'o-m2')).toBe(6);
    expect(lifeOf(attackAndGuard(laz(10), 'o-m2', [laz(12)]), 'o-m2')).toBe(5);
    expect(lifeOf(attackAndGuard(laz(9), 'o-m2', [laz(12)]), 'o-m2')).toBe(6);
    // 効かない種類の攻撃には使えない
    let s = scene({ player: [laz(10)], opponent: [laz(11)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(false);
    s = scene({ player: [laz(3)], opponent: [laz(12)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(false);
  });

  it('13 シャドウスリップ（マナ2）：相手の消費マナ2以上のちから技・かしこさ技を回避。マナ0〜1 の攻撃は回避しない', () => {
    expect(getSkill(laz(15)).cost).toBe(2);
    expect(lifeOf(attackAndGuard(laz(10), 'o-m2', [laz(15)]), 'o-m2')).toBe(6); // シャドウバースト（マナ3・かしこさ）
    expect(lifeOf(attackAndGuard(laz(3), 'o-m2', [laz(15)]), 'o-m2')).toBe(6); // とびかかり（マナ2・ちから）＝境目の2は回避できる
    for (const cheap of [laz(1), laz(2)]) {
      // ひっかき（マナ0）・かみつき（マナ1）には使えず、理由が出る
      let s = scene({ player: [cheap], opponent: [laz(15)] });
      s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
      expect(cardUsability(s, 'opponent', 'o0')).toEqual({ usable: false, reason: '必要マナ2以上の攻撃にしか使えません' });
    }
  });

  it('14 フェイントステップ（マナ2）：相手のちから技・かしこさ技を、消費マナに関係なく回避（マナ0 も高いマナも）', () => {
    expect(getSkill(laz(14)).cost).toBe(2);
    expect(getSkill(laz(14)).effect).toEqual({ type: 'evade', against: 'all' });
    expect(lifeOf(attackAndGuard(laz(1), 'o-m2', [laz(14)]), 'o-m2')).toBe(6); // ひっかき（マナ0・ちから）
    expect(lifeOf(attackAndGuard(laz(6), 'o-m2', [laz(14)]), 'o-m2')).toBe(6); // しっぷうタックル（マナ4・ちから）
    expect(lifeOf(attackAndGuard(laz(10), 'o-m2', [laz(14)]), 'o-m2')).toBe(6); // シャドウバースト（マナ3・かしこさ）
    expect(lifeOf(attackAndGuard(laz(9), 'o-m2', [laz(14)]), 'o-m2')).toBe(6); // トリックショット（マナ2・かしこさ）
  });

  it('ダストキック：選んだ相手の次の手番だけ、ちから技のダメージ−1（かしこさ技・ほかのモンスターは変わらない）。マナ0 で使える', () => {
    let s = scene({ player: [laz(8)] }, { player: 0 });
    expect(cardUsability(s, 'player', 'p0').usable).toBe(true);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(monster(s, 'o-m1').weakenTurn).toEqual({ stat: 'force', amount: 1, turn: s.turn + 1 });
    // 次に使うまで弱める効果（weaken）とは別のしくみ
    expect(monster(s, 'o-m1').weaken ?? null).toBeNull();
    const next = opponentTurn(s, s.turn + 1, []);
    expect(attackPower(next, getSkill(sor(3)), monster(next, 'o-m1'))).toBe(1); // たいあたり：ちから2 → 1
    expect(attackPower(next, getSkill(sor(7)), monster(next, 'o-m1'))).toBe(4); // スターダストレイ：かしこさ4 のまま
    expect(attackPower(next, getSkill(sor(3)), monster(next, 'o-m3'))).toBe(2);
    expect(attackPower(next, getSkill(sor(1)), monster(next, 'o-m1'))).toBe(0); // ひっかき：ちから1 → 0（0 未満にならない）
    // 使っても消えず、その手番の間は効く。手番が過ぎたら効かない
    let used = applyAction(opponentTurn(s, s.turn + 1, [sor(3), sor(3)], ['o-m1']), { type: 'useCard', side: 'opponent', cardUid: 'x0', targetUid: 'p-m1' });
    expect(used.pending?.power).toBe(1);
    used = applyAction(used, { type: 'defend', side: 'player', cardUid: null });
    expect(monster(used, 'o-m1').weakenTurn?.turn).toBe(s.turn + 1);
    const later = opponentTurn(s, s.turn + 3, []);
    expect(attackPower(later, getSkill(sor(3)), monster(later, 'o-m1'))).toBe(2);
  });

  it('ちょうはつ：選んだ相手モンスターは次の手番、ラズックにしか攻撃できない（ほかの相手モンスターは自由）', () => {
    let s = scene({ player: [laz(7)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(monster(s, 'o-m1').taunt).toEqual({ monsterId: 'mon-lazuck', turn: s.turn + 1 });
    const next = opponentTurn(s, s.turn + 1, [sor(3)]);
    const attack = getSkill(sor(3));
    // 攻撃できる相手：ちょうはつされた o-m1 はラズック（p-m2）だけ、o-m3 は全員
    expect(targetsFor(next, 'opponent', attack, monster(next, 'o-m1')).map((m) => m.uid)).toEqual(['p-m2']);
    expect(targetsFor(next, 'opponent', attack, monster(next, 'o-m3')).map((m) => m.uid)).toEqual(['p-m1', 'p-m2', 'p-m3']);
    // o-m1 を指定してソラモを狙っても使えない。指定しなければ、攻撃できる o-m3 が使う
    expect(applyAction(next, { type: 'useCard', side: 'opponent', cardUid: 'x0', userUid: 'o-m1', targetUid: 'p-m1' })).toBe(next);
    const byM3 = applyAction(next, { type: 'useCard', side: 'opponent', cardUid: 'x0', targetUid: 'p-m1' });
    expect(byM3.pending?.userUid).toBe('o-m3');
    // 特殊の技（すなかけ）は限らない
    expect(targetsFor(next, 'opponent', getSkill(sor(9)), monster(next, 'o-m1'))).toHaveLength(3);
    // 次の次の相手の手番では元どおり
    const later = opponentTurn(s, s.turn + 3, [sor(3)]);
    expect(targetsFor(later, 'opponent', attack, monster(later, 'o-m1'))).toHaveLength(3);
  });

  it('ちょうはつ：相手の思考も従う（o-m1 だけ動けるなら、ラズックを攻撃する）', () => {
    let s = scene({ player: [laz(7)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    // p-m1 のライフを1にして、ふつうなら倒しに行く場面にする
    const weak = { ...s, sides: { ...s.sides, player: { ...s.sides.player, monsters: s.sides.player.monsters.map((m) => (m.uid === 'p-m1' ? { ...m, life: 1 } : m)) } } };
    const next = opponentTurn(weak, s.turn + 1, [sor(3), sor(5)], ['o-m1']);
    const action = chooseAction(next, 'opponent');
    expect(action).toMatchObject({ type: 'useCard', targetUid: 'p-m2' });
  });

  it('【暫定】ちょうはつ：相手の場にラズックがいなければ（倒れたら）制限なし', () => {
    let s = scene({ player: [laz(7)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    const down = { ...s, sides: { ...s.sides, player: { ...s.sides.player, monsters: s.sides.player.monsters.map((m) => (m.uid === 'p-m2' ? { ...m, life: 0 } : m)) } } };
    const next = opponentTurn(down, s.turn + 1, [sor(3)]);
    expect(targetsFor(next, 'opponent', getSkill(sor(3)), monster(next, 'o-m1')).map((m) => m.uid)).toEqual(['p-m1', 'p-m3']);
  });

  it('ソラモとラズックの混ざったデッキで、相手の思考どうしが最後まで対戦できる', () => {
    for (const first of ['player', 'opponent'] as const) {
      let s = createBattle({ name: 'P', deck: mixedDeck }, { name: 'O', deck: mixedDeck }, 11, first);
      let steps = 0;
      while (s.phase !== 'ended' && steps < 6000) {
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

describe('ラズックの技カードの面と日英', () => {
  it('日本語：カードに書く短い文（skillCardText.ts）。回避に余計な但し書きを足さない', () => {
    setLanguage('ja');
    expect(skillCardFace(getSkill(laz(14))).description).toBe('マナに関係なく、ちから技・かしこさ技を回避');
    expect(skillCardFace(getSkill(laz(15))).description).toBe('マナ2以上のちから技・かしこさ技を回避');
    expect(skillCardFace(getSkill(laz(7))).value).toBeNull();
    expect(skillCardFace(getSkill(laz(8))).mana).toBe(0);
  });

  it('英語（仮訳）：技名・説明が切り替わる', () => {
    setLanguage('en');
    expect(cardName(getSkill(laz(4)))).toBe('Fury Claws');
    expect(cardName(LAZUCK_MONSTER)).toBe('Lazuck');
    expect(skillCardFace(getSkill(laz(7))).description).toMatch(/Lazuck/);
    for (const s of LAZUCK_SKILLS) expect(skillCardFace(s).description).not.toMatch(/[ぁ-んァ-ン一-龯]/);
    setLanguage('ja');
  });
});

describe('テスト用の編成とセーブ（version 7）', () => {
  it('新しいセーブのデッキはソラモとラズック（2026-10-25 からはソラモ14技の初期デッキ）で、そのまま使える', () => {
    const save = createNewSave();
    expect(save.deck).toEqual(createStarterDeck());
    expect(validateDeck(save.deck, save.collection)).toEqual([]);
  });

  it('version 6 で配ったソラモのデッキのままなら、初期デッキに替わり、カードを受け取る（旧ソラモの技は version 9 で削除）', () => {
    const v6 = { ...createNewSave(), version: 6, deck: createSoramoTestDeck(), collection: { 'mon-soramo': 3, 'skl-soramo-01': 5, [sor(2)]: 4 } };
    const save = normalizeSave(v6);
    if (!save) throw new Error('save');
    expect(save.deck).toEqual(createStarterDeck());
    expect(save.collection['mon-lazuck']).toBe(1);
    expect(save.collection[laz(1)]).toBe(3); // 初期デッキ（2026-10-26 からラズックの初期配布で3枚）
    expect(save.collection[sor(2)]).toBe(4); // 持っていた枚数は減らさない
    expect(save.collection['skl-soramo-01']).toBeUndefined();
    expect(validateDeck(save.deck, save.collection)).toEqual([]);
  });

  it('自分で組み直したデッキは組み直したまま（カードだけ受け取る。旧ソラモの技だけ外れる）', () => {
    const custom = { monsters: ['mon-soramo', 'mon-soramo', 'mon-soramo'], skills: createSoramoTestDeck().skills.slice(0, 59).concat('sup-1') };
    const v6 = { ...createNewSave(), version: 6, deck: custom };
    const migrated = migrate(v6);
    const deck = migrated?.deck as { monsters: string[]; skills: string[] };
    expect(deck.monsters).toEqual(custom.monsters);
    expect(deck.skills).toContain('sup-1');
    expect(deck.skills.some((id) => id.startsWith('skl-soramo-'))).toBe(false);
    // version 7 で受け取ったミラージュダッシュ（旧16）は、version 11（2026-10-26）で外れる
    expect((migrated?.collection as Record<string, number>)[laz(16)]).toBeUndefined();
    expect((migrated?.collection as Record<string, number>)[laz(14)]).toBe(1);
  });
});

describe('正式14技への置き換えと旧セーブ（version 11・2026-10-26）', () => {
  /** version 10 のセーブ：旧05 しっぽアタック・旧16 ミラージュダッシュを持ち、デッキにも2枚ずつ入れている */
  const oldSave = (spare: boolean) => {
    const save = createNewSave();
    const kept = save.deck.skills.slice(0, 56);
    const own: Record<string, number> = {};
    for (const id of [...save.deck.monsters, ...(spare ? save.deck.skills : kept)]) own[id] = (own[id] ?? 0) + 1;
    return {
      ...save,
      version: 10,
      deck: { ...save.deck, skills: [...kept, laz(5), laz(5), laz(16), laz(16)] },
      collection: { ...own, [laz(5)]: 3, [laz(16)]: 2 },
    };
  };

  it('所持・デッキから旧05・旧16が消え、ほかの技は同じ ID なので枚数はそのまま。抜けた分は持っているカードで埋まる', () => {
    const loaded = normalizeSave(JSON.parse(JSON.stringify(oldSave(true))));
    if (!loaded) throw new Error('読み込めない');
    expect(loaded.collection[laz(5)]).toBeUndefined();
    expect(loaded.collection[laz(16)]).toBeUndefined();
    expect(loaded.collection[laz(1)]).toBe(3);
    expect(loaded.deck.skills).not.toContain(laz(5));
    expect(loaded.deck.skills).not.toContain(laz(16));
    expect(loaded.deck.skills).toHaveLength(60);
    expect(validateDeck(loaded.deck, loaded.collection)).toEqual([]);
  });

  it('埋める予備のカードがなければ、デッキは足りないまま（デッキ編集で直す。代わりのカードは配らない）', () => {
    const loaded = normalizeSave(JSON.parse(JSON.stringify(oldSave(false))));
    if (!loaded) throw new Error('読み込めない');
    expect(loaded.deck.skills).toHaveLength(56);
    expect(validateDeck(loaded.deck, loaded.collection).length).toBeGreaterThan(0);
  });
});
