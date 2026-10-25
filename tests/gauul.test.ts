import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSkill, MONSTERS, SKILLS, skillsOf } from '../src/data/cards.ts';
import { PACKS } from '../src/data/economy.ts';
import { GAUUL_MONSTER, GAUUL_SKILLS, gauulSkillId } from '../src/data/gauul.ts';
import { LAZUCK_CROSS_GUARD_ID, LAZUCK_ITAZURA_ID, lazuckSkillId } from '../src/data/lazuck.ts';
import evasionJson from '../src/data/official/evasion_LATEST_20261024.json';
import gauulJson from '../src/data/official/gauul_cards_OFFICIAL_20261024.json';
import { soramoSkillId } from '../src/data/soramo.ts';
import { chooseAction } from '../src/game/battle/ai.ts';
import { applyAction, attackPower, cardUsability, createBattle, type BattleMonster, type BattleState, type Side } from '../src/game/battle/engine.ts';
import { skillCardFace } from '../src/game/cards/cardFace.ts';
import { validateDeck } from '../src/game/deck/deck.ts';
import { BACKUP_FORMAT, parseBackup } from '../src/game/save/backup.ts';
import { createNewSave, normalizeSave, SAVE_VERSION } from '../src/game/save/saveData.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

const gau = (n: number): string => gauulSkillId(n);
const laz = (n: number): string => lazuckSkillId(n);
const sor = (n: number): string => soramoSkillId(n);

describe('ガウル16技：正式データ（2026-10-24 承認。正本 JSON を無改変で導入）', () => {
  it('技名・マナ・ダメージ・種別・効果テキスト・区分が JSON とすべて一致する。初期8・収集8', () => {
    expect(gauulJson.monster_life).toBe(6);
    expect(GAUUL_SKILLS).toHaveLength(16);
    for (const o of gauulJson.skill_cards) {
      const s = getSkill(gau(o.number));
      expect(s.designId).toBe(o.design_id);
      expect(s.name).toBe(o.name_ja);
      expect(s.cost).toBe(o.mana);
      expect(s.stat?.value ?? null).toBe(o.damage);
      expect(s.category).toBe(o.category);
      expect(s.effectTextJa).toBe(o.effect_text_ja);
      expect(s.availability).toBe(o.availability);
      expect(s.monsterId).toBe('mon-gauul');
      expect(s.isPlaceholder).toBe(false);
      expect(s.rarity).toBeNull();
    }
    expect(GAUUL_SKILLS.filter((s) => s.availability === 'initial').map((s) => s.designId)).toEqual(
      ['01', '02', '06', '07', '09', '11', '12', '15'].map((n) => `GAU-SK-${n}`),
    );
    expect(GAUUL_SKILLS.filter((s) => s.availability === 'collect')).toHaveLength(8);
    expect(new Set(GAUUL_SKILLS.map((s) => s.id)).size).toBe(16);
  });

  it('モンスター：ライフ 6・枠色オレンジ・それまで登録のみだった正式カードとバトル用の絵。ランクは画面に出さない', () => {
    expect(GAUUL_MONSTER.id).toBe('mon-gauul');
    expect(GAUUL_MONSTER.life).toBe(6);
    expect(GAUUL_MONSTER.themeColor).toBe('#E68A46');
    expect(GAUUL_MONSTER.art?.file).toBe('gauul_official.webp');
    expect(GAUUL_MONSTER.battleArt?.file).toBe('gauul_battle.webp');
    expect(MONSTERS.filter((m) => m.id === 'mon-gauul')).toHaveLength(1);
  });

  it('原本 PNG 16枚は届いたものと同じ（SHA-256・大きさ）で、番号と技名が合う。ゲーム用の絵は縦横比を変えずに幅 827', () => {
    const manifest = JSON.parse(readFileSync('design-parts/cards-original/gauul/ASSET_SHA256.json', 'utf8')) as {
      number: number;
      name: string;
      file: string;
      width: number;
      height: number;
      sha256: string;
    }[];
    expect(manifest).toHaveLength(16);
    for (const m of manifest) {
      const buf = readFileSync(`design-parts/cards-original/gauul/${m.file}`);
      expect(createHash('sha256').update(buf).digest('hex')).toBe(m.sha256);
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([m.width, m.height]);
      expect(m.file.startsWith(`${String(m.number).padStart(2, '0')}_${m.name}.`)).toBe(true);
      expect(getSkill(gau(m.number)).name).toBe(m.name);
      const art = readFileSync(`assets/images/cards/skills/gau_sk_${String(m.number).padStart(2, '0')}.webp`);
      const [w, h] = [art.readUInt16LE(26) & 0x3fff, art.readUInt16LE(28) & 0x3fff];
      expect(w).toBe(827);
      expect(h).toBe(Math.round((m.height * 827) / m.width));
    }
    // ラズックの「いたずら」の原本は JPEG のまま（PNG と偽らない）
    expect(readdirSync('design-parts/cards-original/lazuck')).toEqual(['Razuk_Itazura_Approved_USER_IMAGE.jpeg']);
    expect(readFileSync('design-parts/cards-original/lazuck/Razuk_Itazura_Approved_USER_IMAGE.jpeg').subarray(0, 2).toString('hex')).toBe('ffd8');
    expect(existsSync('assets/images/cards/skills/laz_sk_itazura.webp')).toBe(true);
    // 原本の大きな画像を全部読んで照合するので、重いときでも時間切れにならないよう余裕を持たせる
  }, 30000);

  it('パック・スターター・相手の編成にはまだ入れていない（配る枚数・敵の編成は未定）', () => {
    for (const p of PACKS) expect(p.cardIds.some((id) => id.includes('gauul'))).toBe(false);
    expect(createNewSave().deck.monsters).not.toContain('mon-gauul');
  });

  it('日本語は効果テキストのまま。英語は仮訳で、日本語が残らない', () => {
    setLanguage('ja');
    expect(skillCardFace(getSkill(gau(14))).description).toBe('必要マナ2以上のかしこさ技を回避');
    expect(skillCardFace(getSkill(gau(15))).title).toBe('はばたき');
    setLanguage('en');
    expect(cardName(GAUUL_MONSTER)).toBe('Gaul');
    for (const s of GAUUL_SKILLS) {
      expect(cardName(s)).not.toMatch(/[ぁ-んァ-ン一-龯]/);
      expect(skillCardFace(s).description).not.toMatch(/[ぁ-んァ-ン一-龯]/);
    }
    setLanguage('ja');
  });
});

/* ---------- バトル ---------- */

// 自分：ガウル（m1）・ラズック（m2）・ソラモ（m3）。相手も同じ
const deck = { monsters: ['mon-gauul', 'mon-lazuck', 'mon-soramo'], skills: Array.from({ length: 60 }, () => sor(1)) };

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

/** player が target に attack を使い、守備側（opponent）の guard の使用可否を返す */
function guardUsable(attack: string, target: string, guard: string): { usable: boolean; reason: string | null } {
  let s = scene({ player: [attack], opponent: [guard] });
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: target });
  expect(s.phase).toBe('defense');
  return cardUsability(s, 'opponent', 'o0');
}

/** player が攻撃し、opponent が guards を使ったあとの、狙われたモンスターのライフ */
function lifeAfter(attack: string, target: string, guards: string[]): number {
  let s = scene({ player: [attack], opponent: guards });
  s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: target });
  guards.forEach((_, i) => {
    s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: `o${i}` });
  });
  if (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'opponent', cardUid: null });
  return monster(s, target).life;
}

describe('ガウルの技の効果', () => {
  it('03 烈風の翼・08 聖なる炎は回避されない（条件の合う回避でも不可）が、防御はできる', () => {
    for (const atk of [gau(3), gau(8)]) {
      expect(getSkill(atk).effect).toEqual({ type: 'attack', undodgeable: true });
      // 回避：ガウル16（条件なし）・ラズック16（条件なし）・ソラモ14（条件なし）
      expect(guardUsable(atk, 'o-m1', gau(16))).toEqual({ usable: false, reason: 'この攻撃は回避できません' });
      expect(guardUsable(atk, 'o-m2', laz(16)).usable).toBe(false);
      expect(guardUsable(atk, 'o-m3', sor(14)).usable).toBe(false);
      // 防御は使える：火炎の羽衣（かしこさ−3）
      expect(guardUsable(atk, 'o-m1', gau(12)).usable).toBe(true);
    }
    expect(lifeAfter(gau(3), 'o-m1', [gau(12)])).toBe(6); // 2 − 3 → 0
    expect(lifeAfter(gau(8), 'o-m1', [gau(12)])).toBe(5); // 4 − 3 → 1
  });

  it('09 熱風の威嚇：選んだ相手の次回のかしこさ技だけ −1（ちから技は変わらない）。使ったら消える。使わなくても次のターンが終われば消える', () => {
    let s = scene({ player: [gau(9)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(monster(s, 'o-m1').weaken).toEqual({ stat: 'wisdom', amount: 1, untilTurn: s.turn + 1 });
    expect(attackPower(s, getSkill(gau(7)), monster(s, 'o-m1'))).toBe(2); // 炎の羽ばたき かしこさ3 → 2
    expect(attackPower(s, getSkill(gau(2)), monster(s, 'o-m1'))).toBe(2); // かぎづめ ちから2 のまま
    expect(attackPower(s, getSkill(gau(7)), monster(s, 'o-m2'))).toBe(3); // ほかのモンスターは変わらない
    const opponentTurnAt = (turn: number): BattleState => ({
      ...s,
      turn,
      active: 'opponent',
      sides: {
        ...s.sides,
        opponent: {
          ...s.sides.opponent,
          hand: [{ uid: 'x0', cardId: gau(7) }, { uid: 'x1', cardId: gau(7) }],
          monsters: s.sides.opponent.monsters.map((m) => ({ ...m, acted: m.uid !== 'o-m1' })),
        },
      },
    });
    // 相手の次のターン：1回目のかしこさ技は −1、使ったら消える
    const used = applyAction(opponentTurnAt(s.turn + 1), { type: 'useCard', side: 'opponent', cardUid: 'x0', targetUid: 'p-m1' });
    expect(used.pending?.power).toBe(2);
    expect(monster(used, 'o-m1').weaken ?? null).toBeNull();
    // 次のターンにかしこさ技を使わなかったら、そのあとのターンでは効かない
    const later = opponentTurnAt(s.turn + 3);
    expect(attackPower(later, getSkill(gau(7)), monster(later, 'o-m1'))).toBe(3);
    expect(applyAction(later, { type: 'useCard', side: 'opponent', cardUid: 'x0', targetUid: 'p-m1' }).pending?.power).toBe(3);
  });

  it('11 翼ガード（ちから−3）・12 火炎の羽衣（かしこさ−3）・13 炎の壁（両方−3）。0 未満にならない。種類が違えば使えない', () => {
    expect(lifeAfter(gau(5), 'o-m1', [gau(11)])).toBe(5); // スパイラルダイブ 4 − 3
    expect(lifeAfter(gau(2), 'o-m1', [gau(11)])).toBe(6); // 2 − 3 → 0
    expect(lifeAfter(gau(10), 'o-m1', [gau(12)])).toBe(3); // フレアビーム 6 − 3
    expect(lifeAfter(gau(5), 'o-m1', [gau(13)])).toBe(5);
    expect(lifeAfter(gau(10), 'o-m1', [gau(13)])).toBe(3);
    expect(guardUsable(gau(10), 'o-m1', gau(11)).usable).toBe(false);
    expect(guardUsable(gau(5), 'o-m1', gau(12)).usable).toBe(false);
  });

  it('14 火花すり抜け：必要マナ1のかしこさ技は避けられず、2以上は避けられ、ちから技は避けられない', () => {
    expect(guardUsable(gau(6), 'o-m1', gau(14))).toEqual({ usable: false, reason: '必要マナ2以上の攻撃にしか使えません' }); // 火の粉 マナ1
    expect(guardUsable(gau(7), 'o-m1', gau(14)).usable).toBe(true); // 炎の羽ばたき マナ2（境目）
    expect(lifeAfter(gau(7), 'o-m1', [gau(14)])).toBe(6);
    expect(lifeAfter(gau(10), 'o-m1', [gau(14)])).toBe(6);
    expect(guardUsable(gau(5), 'o-m1', gau(14)).usable).toBe(false); // ちから技
  });

  it('15 はばたき：必要マナ1のちから技は避けられず、2以上は避けられ、かしこさ技は避けられない', () => {
    expect(guardUsable(gau(1), 'o-m1', gau(15)).usable).toBe(false); // つつく マナ1
    expect(guardUsable(gau(2), 'o-m1', gau(15)).usable).toBe(true); // かぎづめ マナ2（境目）
    expect(lifeAfter(gau(2), 'o-m1', [gau(15)])).toBe(6);
    expect(guardUsable(gau(7), 'o-m1', gau(15)).usable).toBe(false); // かしこさ技
  });

  it('16 灼熱の飛翔：必要マナ0・1も含むちから/かしこさ技を回避（回避されない攻撃は除く）', () => {
    expect(guardUsable(laz(1), 'o-m1', gau(16)).usable).toBe(true); // ひっかき マナ0
    expect(guardUsable(gau(1), 'o-m1', gau(16)).usable).toBe(true);
    expect(guardUsable(gau(6), 'o-m1', gau(16)).usable).toBe(true);
    expect(lifeAfter(laz(1), 'o-m1', [gau(16)])).toBe(6);
    expect(guardUsable(laz(4), 'o-m1', gau(16)).usable).toBe(false); // みだれづめ（回避されない）
  });

  it('必要マナの判定は攻撃カードの印字の値で、攻撃側の残りマナには左右されない', () => {
    // 攻撃側のマナをちょうど使い切っても（残り0）、マナ2の攻撃は「必要マナ2以上」
    let s = scene({ player: [gau(7)], opponent: [gau(14)] }, { player: 2 });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(s.sides.player.manaPile).toHaveLength(0);
    expect(cardUsability(s, 'opponent', 'o0').usable).toBe(true);
  });

  it('相手の思考（AI）は使えない回避を選ばない', () => {
    let s = scene({ player: [gau(6)], opponent: [gau(14)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', targetUid: 'o-m1' });
    expect(chooseAction(s, 'opponent')).toEqual({ type: 'defend', side: 'opponent', cardUid: null });
  });
});

describe('回避の改訂（2026-10-24）', () => {
  // ソラモの2件（旧14・16）は、2026-10-25 のソラモ14技（13 ひらりジャンプ・14 星影ステップ）に置き換わった（tests/soramo.test.ts）
  it('ラズック・ガウルの回避6件の動きは承認 JSON（evasion_LATEST）の条件と同じ', () => {
    const ids: Record<string, (n: number) => string> = { lazuck: laz, gauul: gau };
    const updates = evasionJson.updates.filter((u) => u.monster !== 'soramo');
    expect(updates).toHaveLength(6);
    for (const u of updates) {
      const s = getSkill((ids[u.monster] as (n: number) => string)(u.skill_number));
      expect(s.name).toBe(u.name_ja);
      expect(s.cost).toBe(u.mana);
      expect(s.effectTextJa).toBe(u.effect_text_ja);
      const against = u.against.length === 2 ? 'all' : u.against[0];
      expect(s.effect).toEqual(u.min_incoming_attack_required_mana ? { type: 'evade', against, minCost: u.min_incoming_attack_required_mana } : { type: 'evade', against });
    }
  });

  it('ソラモの回避（13 ひらりジャンプ・14 星影ステップ）も同じきまりで動く', () => {
    expect(guardUsable(gau(6), 'o-m3', sor(13)).usable).toBe(false); // マナ1 は避けられない
    expect(guardUsable(gau(7), 'o-m3', sor(13)).usable).toBe(true); // マナ2 は避けられる
    expect(guardUsable(laz(1), 'o-m3', sor(14)).usable).toBe(true); // マナ0 も避けられる
  });
});

describe('ラズックのいたずら（2026-10-24）', () => {
  const itazura = getSkill(LAZUCK_ITAZURA_ID);

  it('特殊・マナ2・相手を選ばない。表示は 11', () => {
    expect(itazura.category).toBe('special');
    expect(itazura.cost).toBe(2);
    expect(itazura.displayNo).toBe(11);
    expect(itazura.effect).toEqual({ type: 'handToDeck' });
    expect(itazura.availability).toBe('collect');
  });

  const useItazura = (opponentHand: string[]): BattleState => {
    const s = scene({ player: [LAZUCK_ITAZURA_ID], opponent: opponentHand });
    return applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0' });
  };

  it('相手の手札が複数：1枚が相手の山札に戻り、山札がシャッフルされる。補充はしない', () => {
    const before = scene({ player: [LAZUCK_ITAZURA_ID], opponent: [gau(1), gau(2), gau(3)] });
    const after = useItazura([gau(1), gau(2), gau(3)]);
    expect(after.sides.opponent.hand).toHaveLength(2);
    expect(after.sides.opponent.deck).toHaveLength(before.sides.opponent.deck.length + 1);
    const returned = [gau(1), gau(2), gau(3)].find((id) => !after.sides.opponent.hand.some((c) => c.cardId === id));
    expect(after.sides.opponent.deck).toContain(returned);
    expect(after.seed).not.toBe(before.seed);
    expect(after.sides.player.manaPile).toHaveLength(8); // マナ2を払った
    expect(after.phase).toBe('main');
  });

  it('相手の手札が1枚：その1枚が戻り、手札は0枚', () => {
    const after = useItazura([gau(5)]);
    expect(after.sides.opponent.hand).toEqual([]);
    expect(after.sides.opponent.deck).toContain(gau(5));
  });

  it('相手の手札が0枚：「相手は手札がありません」と出て使えない（2026-10-24 ユーザー決定）', () => {
    const before = scene({ player: [LAZUCK_ITAZURA_ID], opponent: [] });
    expect(cardUsability(before, 'player', 'p0')).toEqual({ usable: false, reason: '相手は手札がありません' });
    expect(applyAction(before, { type: 'useCard', side: 'player', cardUid: 'p0' })).toBe(before);
  });

  it('戻したカードは、相手の次のドローで引かれることがある（山札のどこかに入る）', () => {
    const after = useItazura([gau(10)]);
    const pos = after.sides.opponent.deck.indexOf(gau(10));
    expect(pos).toBeGreaterThanOrEqual(0);
    expect(after.sides.opponent.deck.filter((id) => id === gau(10))).toHaveLength(1);
  });

  it('相手の思考（AI）は、相手の手札が2枚以上あるときに使う', () => {
    const s: BattleState = { ...scene({ opponent: [LAZUCK_ITAZURA_ID], player: [gau(1), gau(2)] }), active: 'opponent' };
    const action = chooseAction(s, 'opponent');
    expect(action).toEqual({ type: 'useCard', side: 'opponent', cardUid: 'o0' });
  });
});

describe('クロスガードの削除と旧セーブ（version 8）', () => {
  /** version 7 のセーブ（新しいデッキのいたずら〔2枚〕をクロスガードに替え、クロスガードを2枚持っている） */
  const oldSave = () => {
    const save = createNewSave();
    const deckSkills = save.deck.skills.map((id) => (id === LAZUCK_ITAZURA_ID ? LAZUCK_CROSS_GUARD_ID : id));
    const collection: Record<string, number> = { ...save.collection, [LAZUCK_CROSS_GUARD_ID]: 2 };
    delete collection[LAZUCK_ITAZURA_ID];
    return { ...save, version: 7, deck: { ...save.deck, skills: deckSkills }, collection };
  };

  it('所持・デッキからクロスガードが消え、デッキの抜けた分は持っているカードで埋まる（代わりのカードは配らない）', () => {
    // デッキに入れていない予備のカード（連続ひっかき・たいあたりをもう1枚ずつ）を持っている
    const save = oldSave();
    expect(save.deck.skills.filter((id) => id === LAZUCK_CROSS_GUARD_ID)).toHaveLength(2);
    const loaded = normalizeSave(JSON.parse(JSON.stringify({ ...save, collection: { ...save.collection, [sor(2)]: 3, [sor(3)]: 3 } })));
    if (!loaded) throw new Error('読み込めない');
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.collection[LAZUCK_CROSS_GUARD_ID]).toBeUndefined();
    expect(loaded.collection[LAZUCK_ITAZURA_ID]).toBeUndefined();
    expect(loaded.deck.skills).not.toContain(LAZUCK_CROSS_GUARD_ID);
    expect(loaded.deck.skills).toHaveLength(60);
    expect(validateDeck(loaded.deck, loaded.collection)).toEqual([]);
  });

  it('埋める予備のカードがなければ、デッキは足りないまま（デッキ編集で直す。カードは配らない）', () => {
    const loaded = normalizeSave(JSON.parse(JSON.stringify(oldSave())));
    if (!loaded) throw new Error('読み込めない');
    expect(loaded.deck.skills).toHaveLength(58);
    expect(loaded.deck.skills).not.toContain(LAZUCK_CROSS_GUARD_ID);
    expect(validateDeck(loaded.deck, loaded.collection).length).toBeGreaterThan(0);
  });

  it('クロスガードの入ったバックアップも読み込める（読み込むときに外す）', () => {
    const text = JSON.stringify({ format: BACKUP_FORMAT, formatVersion: 1, exportedAt: null, save: oldSave() });
    const result = parseBackup(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save.deck.skills).not.toContain(LAZUCK_CROSS_GUARD_ID);
  });

  it('クロスガードはカードの一覧にない', () => {
    expect(SKILLS.some((s) => s.id === LAZUCK_CROSS_GUARD_ID)).toBe(false);
    expect(skillsOf('mon-lazuck')).toHaveLength(16);
  });
});
