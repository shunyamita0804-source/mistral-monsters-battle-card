import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cardCatalog, getSkill, MONSTERS, SKILLS, skillsOf } from '../src/data/cards.ts';
import { PACKS } from '../src/data/economy.ts';
import { LAZUCK_CROSS_GUARD_ID, LAZUCK_ITAZURA_ID, LAZUCK_MONSTER, LAZUCK_SKILLS, lazuckSkillId } from '../src/data/lazuck.ts';
import type { SkillCard } from '../src/game/cards/cardTypes.ts';
import officialJson from '../src/data/official/lazuck_cards_OFFICIAL.json';
import latestJson from '../src/data/official/lazuck_cards_LATEST_20261024.json';
import mappingJson from '../src/data/official/lazuck_order_mapping_20261024.json';
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
import { createMixedTestDeck, createSoramoTestDeck, createStarterDeck, validateDeck } from '../src/game/deck/deck.ts';
import { packCardRates } from '../src/game/economy/gacha.ts';
import { createNewSave, migrate, normalizeSave } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

const laz = (n: number): string => lazuckSkillId(n);
const sor = (n: number): string => soramoSkillId(n);

describe('ラズック16技：正式データ（正本 JSON を無改変で導入）', () => {
  it('置いた JSON は届いたものと同じ。1枚ずつの区分は初期10・収集6（全体方針の8/8とは食い違い。そのまま保持）', () => {
    expect(officialJson.skill_cards).toHaveLength(16);
    expect(officialJson.monster_game_id).toBe('mon-lazuck');
    expect(officialJson.skill_cards.filter((c) => c.availability === 'initial').map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 11, 14]);
    expect(officialJson.skill_cards.filter((c) => c.availability === 'collect').map((c) => c.number)).toEqual([9, 10, 12, 13, 15, 16]);
  });

  it('2026-10-24 改訂：技名・マナ・ダメージ・種別・効果テキスト・区分・表示の番号が LATEST の JSON とすべて一致する。ID・絵・デザイン ID は元のまま', () => {
    expect(LAZUCK_SKILLS).toHaveLength(16);
    expect(LAZUCK_SKILLS.map((s) => s.displayNo)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    for (const l of latestJson.skill_cards) {
      const s = LAZUCK_SKILLS[l.ordinal - 1] as SkillCard;
      const itazura = l.game_id.startsWith('NEW_');
      expect(s.id).toBe(itazura ? LAZUCK_ITAZURA_ID : l.game_id);
      expect(s.name).toBe(l.name_ja);
      expect(s.cost).toBe(l.mana);
      expect(s.stat?.value ?? null).toBe(l.damage);
      expect(s.category).toBe(l.category);
      expect(s.effectTextJa).toBe(l.effect_text_ja);
      expect(s.availability).toBe(l.availability);
      expect(s.monsterId).toBe('mon-lazuck');
      expect(s.isPlaceholder).toBe(false);
      expect(s.rarity).toBeNull();
      // 恒久 ID・絵・デザイン ID は、元の JSON の同じ ID のカードのまま（並べ替えで取り違えない）
      const original = officialJson.skill_cards.find((o) => o.game_id === l.game_id);
      if (itazura) {
        expect(original).toBeUndefined();
        expect(s.designId).toBeUndefined();
        expect(s.art?.file).toBe('laz_sk_itazura.webp');
      } else {
        expect(s.designId).toBe(original?.design_id);
        expect(s.art?.file).toBe(original?.game_asset_webp);
        expect(s.name).toBe(original?.name_ja);
      }
    }
    // 表示 07〜13 の対応（旧09→07、旧10→08、旧07→09、旧08→10、新11、旧11→12、旧12→13）
    expect(LAZUCK_SKILLS.slice(6, 13).map((s) => s.id)).toEqual([laz(9), laz(10), laz(7), laz(8), LAZUCK_ITAZURA_ID, laz(11), laz(12)]);
    expect(mappingJson.map((m) => (m.persistent_id.startsWith('NEW_') ? LAZUCK_ITAZURA_ID : m.persistent_id))).toEqual(LAZUCK_SKILLS.map((s) => s.id));
    // 区分は初期10・収集6のまま（いたずらはクロスガードの収集枠）
    expect(LAZUCK_SKILLS.filter((s) => s.availability === 'initial')).toHaveLength(10);
  });

  it('旧13 クロスガードはゲームから削除（2026-10-24 ユーザー決定）。新しいデッキはいたずら入り', () => {
    expect(cardCatalog.get(LAZUCK_CROSS_GUARD_ID)).toBeUndefined();
    expect(LAZUCK_SKILLS.map((s) => s.id)).not.toContain(LAZUCK_CROSS_GUARD_ID);
    expect(skillsOf('mon-lazuck')).toHaveLength(16);
    expect(createMixedTestDeck().skills).not.toContain(LAZUCK_CROSS_GUARD_ID);
    expect(createMixedTestDeck().skills).toContain(LAZUCK_ITAZURA_ID);
    expect(LAZUCK_ITAZURA_ID).not.toMatch(/^skl-lazuck-\d+$/);
  });

  it('ゲームでの動きは JSON の effect_logic_spec と同じ意味', () => {
    // 回避14〜16は 2026-10-24 の改訂でマナ・条件が変わった（下の回避のテスト）。旧13 クロスガードはゲームから削除
    for (const o of officialJson.skill_cards.filter((c) => c.number < 13)) {
      const spec = o.effect_logic_spec as Record<string, unknown>;
      const e = getSkill(laz(o.number)).effect as Record<string, unknown>;
      expect(e.type).toBe(spec.type);
      for (const key of ['undodgeable', 'reduce', 'against', 'stat', 'amount']) if (key in spec) expect(e[key], `${o.design_id} ${key}`).toBe(spec[key]);
      if (spec.duration === 'nextTargetOwnerTurn' && spec.type === 'weaken') expect(e.duration).toBe('nextTurn');
      // みだれづめは「回避されない」だけ。防御まで禁止しない
      if (o.number === 4) expect(e.unblockable).toBeUndefined();
    }
  });

  it('数値のある攻撃はちから/かしこさだけ。マナ0 は 0 のまま（ひっかき・ダストキック）', () => {
    for (const s of LAZUCK_SKILLS) expect(s.stat !== null).toBe(s.category === 'force' || s.category === 'wisdom');
    expect(LAZUCK_SKILLS.filter((s) => s.cost === 0).map((s) => s.designId)).toEqual(['LAZ-SK-01', 'LAZ-SK-08']);
  });

  it('絵は laz_sk_01〜16（827×937）', () => {
    for (const s of LAZUCK_SKILLS) {
      const path = `assets/images/cards/skills/${s.art?.file}`;
      expect(existsSync(path)).toBe(true);
      const buf = readFileSync(path);
      expect(buf.toString('ascii', 12, 16)).toBe('VP8 ');
      expect([buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff]).toEqual([827, 937]);
    }
  });

  it('ID は新しい固定 ID で、ほかと重ならない。パックには入れていない', () => {
    const others = [...MONSTERS, ...SKILLS].filter((c) => !c.id.includes('lazuck')).map((c) => c.id);
    for (const s of LAZUCK_SKILLS) expect(others).not.toContain(s.id);
    for (const p of PACKS) {
      expect(p.cardIds.some((id) => id.includes('lazuck'))).toBe(false);
      expect(packCardRates(p).some((r) => r.cardId.includes('lazuck'))).toBe(false);
    }
  });

  it('モンスター：ライフ 6・枠色は青紫（参照 JSON の値）・登録済みの正式カードとバトル用の絵', () => {
    expect(LAZUCK_MONSTER.id).toBe('mon-lazuck');
    expect(LAZUCK_MONSTER.life).toBe(6);
    expect(LAZUCK_MONSTER.themeColor).toBe('#7775B8');
    for (const a of [LAZUCK_MONSTER.art, LAZUCK_MONSTER.battleArt]) expect(existsSync(`assets/images/cards/monsters/${a?.file}`)).toBe(true);
    expect(MONSTERS.filter((m) => m.id === 'mon-lazuck')).toHaveLength(1);
  });
});

/* ---------- 技の効果（バトル） ---------- */

// 両方とも ソラモ（m1）・ラズック（m2）・ソラモ（m3）。2026-10-25 からはソラモ14技の初期デッキ
const mixedDeck = createStarterDeck();

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

describe('ラズックの技の効果', () => {
  it('みだれづめ（回避されない）：回避は使えないが、防御は使える', () => {
    let s = scene({ player: [laz(4)], opponent: [laz(14), laz(16), laz(11)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(s.pending?.power).toBe(2);
    expect(cardUsability(s, 'opponent', 'o0')).toMatchObject({ usable: false });
    expect(cardUsability(s, 'opponent', 'o1')).toMatchObject({ usable: false });
    expect(cardUsability(s, 'opponent', 'o2').usable).toBe(true);
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: 'o2' });
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
    expect(lifeOf(s, 'o-m2')).toBe(6); // みだれづめ 2 − しっぽいなし 3 → 0
  });

  it('しっぽいなし（ちから−3）・シャドウガード（かしこさ−4）。0 未満にならない', () => {
    // とびかかり：ちから3、シャドウバースト：かしこさ5
    expect(lifeOf(attackAndGuard(laz(3), 'o-m2', [laz(11)]), 'o-m2')).toBe(6);
    expect(lifeOf(attackAndGuard(laz(10), 'o-m2', [laz(12)]), 'o-m2')).toBe(5);
    // 効かない種類の攻撃には使えない
    let s = scene({ player: [laz(10)], opponent: [laz(11)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(false);
    s = scene({ player: [laz(3)], opponent: [laz(12)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(false);
  });

  it('2026-10-24 改訂：フェイントステップ（マナ2・ちから技）・シャドウスリップ（マナ2・必要マナ2以上のちから/かしこさ）・ミラージュダッシュ（マナ2・条件なし）', () => {
    expect([14, 15, 16].map((n) => getSkill(laz(n)).cost)).toEqual([2, 2, 2]);
    expect(getSkill(laz(14)).effect).toEqual({ type: 'evade', against: 'force' });
    expect(getSkill(laz(15)).effect).toEqual({ type: 'evade', against: 'all', minCost: 2 });
    expect(getSkill(laz(16)).effect).toEqual({ type: 'evade', against: 'all' });
    expect(lifeOf(attackAndGuard(laz(3), 'o-m2', [laz(14)]), 'o-m2')).toBe(6);
    expect(lifeOf(attackAndGuard(laz(10), 'o-m2', [laz(15)]), 'o-m2')).toBe(6); // シャドウバースト（マナ4・かしこさ）
    expect(lifeOf(attackAndGuard(laz(3), 'o-m2', [laz(15)]), 'o-m2')).toBe(6); // とびかかり（マナ2・ちから）＝境目の2は回避できる
    expect(lifeOf(attackAndGuard(laz(3), 'o-m2', [laz(16)]), 'o-m2')).toBe(6);
    expect(lifeOf(attackAndGuard(laz(10), 'o-m2', [laz(16)]), 'o-m2')).toBe(6);
    // フェイントステップはかしこさ技には使えない
    let s = scene({ player: [laz(10)], opponent: [laz(14)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(false);
    // シャドウスリップは必要マナ1の攻撃（かみつき）には使えず、理由が出る
    s = scene({ player: [laz(2)], opponent: [laz(15)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m2' });
    expect(cardUsability(s, 'opponent', 'o0')).toEqual({ usable: false, reason: '必要マナ2以上の攻撃にしか使えません' });
    // ミラージュダッシュは必要マナ0の攻撃（ひっかき）も回避できる
    expect(lifeOf(attackAndGuard(laz(1), 'o-m2', [laz(16)]), 'o-m2')).toBe(6);
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
  it('日本語：効果テキストはそのまま。回避に余計な但し書きを足さない', () => {
    setLanguage('ja');
    expect(skillCardFace(getSkill(laz(14))).description).toBe('ちから技を回避');
    expect(skillCardFace(getSkill(laz(15))).description).toBe('必要マナ2以上のちから技・かしこさ技を回避');
    expect(skillCardFace(getSkill(laz(16))).description).toBe('ちから技・かしこさ技を回避');
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
    expect(save.collection[laz(1)]).toBe(2);
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
    expect((migrated?.collection as Record<string, number>)[laz(16)]).toBe(1);
  });
});
