import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BATTLE_CARDS } from '../src/data/battleCards.ts';
import { cardCatalog, getMonster, skillsOf } from '../src/data/cards.ts';
import { GACHA_SERIES } from '../src/data/economy.ts';
import { FORN_COLOR, FORN_MONSTER_ID, FORN_ROWS, fornArtFile } from '../src/data/forn.ts';
import { BOOSTERS } from '../src/data/introV2.ts';
import { PORTRAIT_FOCUS } from '../src/data/monsterPortraits.ts';
import ak from '../src/data/official/booster_contents_20261102_AK.json';
import al from '../src/data/official/booster_contents_20261102_AL.json';
import { AJ_SKILLS, MONSTER_HABITAT } from '../src/data/skillRebuildAJ.ts';
import { chooseAction, pickDrawToDiscard } from '../src/game/battle/ai.ts';
import {
  applyAction,
  cardUsability,
  createBattle,
  drawToPreview,
  incomingDamage,
  targetsFor,
  wardOf,
  type BattleMonster,
  type BattleState,
  type Side,
} from '../src/game/battle/engine.ts';
import { countCards } from '../src/game/deck/deck.ts';
import { boosterDeck } from '../src/game/story/introV2.ts';
import { cardName } from '../src/i18n/content.ts';
import { setLanguage } from '../src/i18n/i18n.ts';

/** 指示書 AL（2026-11-02）：フォルン。正本は src/data/official/forn12_skills_OFFICIAL_20261102.json、カードは src/data/skillRebuildAJ.ts の表 */

const ORIGINAL = 'design-parts/cards-original/forn';
const CAT: Record<string, string> = { ちから技: 'ち', かしこさ技: 'か', 特殊技: '特', 防御: '防' };
const fo = (n: number): string => `skl-forn-${String(n).padStart(2, '0')}`;

describe('フォルンのデータ（届いた JSON のとおり）', () => {
  it('JSON・CSV は届いたものを無改変で置いた', () => {
    for (const f of ['forn12_skills_OFFICIAL_20261102.json', 'forn12_skills_OFFICIAL_20261102.csv']) {
      expect(readFileSync(`src/data/official/${f}`).equals(readFileSync(`${ORIGINAL}/${f}`)), f).toBe(true);
    }
  });

  it('LIFE 7・地上・濃いオリーブ #7A8B3C。名前はフォルン', () => {
    const m = getMonster(FORN_MONSTER_ID);
    expect(m.name).toBe('フォルン');
    expect(m.life).toBe(7);
    expect(m.habitat).toBe('ground');
    expect(MONSTER_HABITAT[FORN_MONSTER_ID]).toBe('ground');
    expect(FORN_COLOR).toBe('#7A8B3C');
    expect(m.themeColor).toBe('#7A8B3C');
    expect(m.isPlaceholder).toBe(false);
    expect(m.art?.file).toBe('forn_official.webp');
  });

  it('技12枚：名前・分類・マナ・ダメージ・レア・箱の枚数は JSON のとおり。ID は skl-forn-01〜12', () => {
    const rows = AJ_SKILLS[FORN_MONSTER_ID] ?? [];
    expect(rows).toHaveLength(12);
    FORN_ROWS.forEach((j, i) => {
      const r = rows[i];
      if (!r) throw new Error(String(i));
      expect(r.id).toBe(fo(j.no));
      expect(r.id).toBe(j.id);
      expect(r.name).toBe(j.name);
      expect(r.cat).toBe(CAT[j.category]);
      expect(r.mana).toBe(j.mana);
      const attack = r.cat === 'ち' || r.cat === 'か';
      expect(r.damage).toBe(attack ? Number(j.damage_or_value) : null);
      expect(!!r.rare).toBe(j.gacha_slot === 'レア');
      expect(r.box ?? 0).toBe(j.box_copies);
      expect(r.art).toBe(fornArtFile(j.no));
    });
    expect(rows.reduce((n, r) => n + (r.box ?? 0), 0)).toBe(16);
    expect(skillsOf(FORN_MONSTER_ID).map((k) => k.displayNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('効果：6 おいかぜ・7 そなえのふえ（新）・8 すなかけ・9 もりのたより（新）・10／11 防御 −3・12 かばう', () => {
    const eff = (n: number) => (AJ_SKILLS[FORN_MONSTER_ID] ?? [])[n - 1]?.effect;
    expect(eff(6)).toEqual({ type: 'tailwind', amount: 1 });
    expect(eff(7)).toEqual({ type: 'ward', reduce: 1 });
    expect(eff(8)).toEqual({ type: 'seal' });
    expect(eff(9)).toEqual({ type: 'drawTo', hand: 5 });
    expect(eff(10)).toEqual({ type: 'defense', reduce: 3, against: 'force' });
    expect(eff(11)).toEqual({ type: 'defense', reduce: 3, against: 'wisdom' });
    expect(eff(12)).toEqual({ type: 'cover' });
  });

  it('絵・枠・バトル用カード・アイコンの切り抜き・英語（仮訳）', () => {
    for (let n = 1; n <= 12; n++) expect(readFileSync(`assets/images/cards/skills/${fornArtFile(n)}`).toString('ascii', 8, 12)).toBe('WEBP');
    expect(readFileSync('assets/images/cards/monsters/forn_battlecard.png').equals(readFileSync(`${ORIGINAL}/forn_battleart.png`))).toBe(true);
    for (const f of ['ui/battlecard/frame_forn.png', 'ui/skillcard_simple/frame_normal_forn.webp', 'ui/skillcard_simple/frame_hand_forn.webp', 'ui/gacha/pack_forn.webp', 'ui/gacha/panel_forn.webp']) {
      expect(existsSync(`assets/images/${f}`), f).toBe(true);
    }
    expect(BATTLE_CARDS[FORN_MONSTER_ID]?.frame).toBe('forn');
    expect(PORTRAIT_FOCUS[FORN_MONSTER_ID]).toBeDefined();
    setLanguage('en');
    expect(cardName(FORN_MONSTER_ID)).toBe('Forn');
    expect(cardName(fo(9))).toBe('Forest Tidings');
    setLanguage('ja');
  });

  it('ガチャのシリーズ：リリルのあと。レアの枠はそうこうげき・そなえのふえ・もりのたより・みがわりのふえ。unlockFlag は無し', () => {
    const ids = GACHA_SERIES.map((s) => s.id);
    expect(ids.indexOf('forn')).toBe(ids.indexOf('lilil') + 1);
    const s = GACHA_SERIES.find((x) => x.id === 'forn');
    expect(s?.rareSkillNames).toEqual(['そうこうげき', 'そなえのふえ', 'もりのたより', 'みがわりのふえ']);
    expect(s?.unlockFlag).toBeUndefined();
  });
});

describe('最初の箱「蒼海の守り」（指示書 AL：ミュロル・カルシェル・フォルン）', () => {
  it('新しい版の資料は蒼海だけ違う（ノビトンの16枚 → フォルンの16枚）。前の版（AK）は残す', () => {
    const g3 = al.booster_groups.find((g) => g.booster_key === 'booster-3');
    const old3 = ak.booster_groups.find((g) => g.booster_key === 'booster-3');
    expect(g3?.monsters).toEqual(['ミュロル', 'カルシェル', 'フォルン']);
    expect(old3?.monsters).toEqual(['ミュロル', 'カルシェル', 'ノビトン']);
    expect(g3?.support_cards).toEqual(old3?.support_cards);
    expect(g3?.card_rows.filter((r) => r.monster !== 'フォルン')).toEqual(old3?.card_rows.filter((r) => r.monster !== 'ノビトン'));
    for (const key of ['booster-1', 'booster-2']) {
      expect(al.booster_groups.find((g) => g.booster_key === key)).toEqual(ak.booster_groups.find((g) => g.booster_key === key));
    }
  });

  it('フォルンの16枚：ひづめキック2・つのでつく2・ねいろだま2・ふえのしらべ2・はげましのふえ2・そなえのふえ1・こもりうた2・もこもこガード2・かんむりのまもり1', () => {
    const c = countCards(boosterDeck('booster-3').skills);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => c[fo(n)] ?? 0)).toEqual([2, 2, 2, 2, 0, 2, 1, 2, 0, 2, 1, 0]);
    expect(Object.keys(c).some((id) => id.startsWith('skl-nobiton-'))).toBe(false);
    expect(boosterDeck('booster-3').monsters).toEqual(['mon-myurol', 'mon-kalshell', 'mon-forn']);
    const b = BOOSTERS.find((x) => x.key === 'booster-3');
    expect(b?.art).toBe('booster_soukai');
    expect(b?.formerMonsters).toEqual(['mon-myurol', 'mon-kalshell', 'mon-nobiton']);
    // 烈火にはノビトンが残る（指示書は「どの最初の箱にもいなくなる」と書いているが、烈火の中身は変えていない）
    expect(BOOSTERS.find((x) => x.key === 'booster-2')?.monsters).toContain('mon-nobiton');
  });
});

/* ---------- 対戦 ---------- */

// 自分：フォルン・ソラモ・ガウル。相手：カルシェル・ソラモ・ガウル
const pDeck = { monsters: ['mon-forn', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, (_, i) => (i % 2 ? 'skl-soramo14-03' : 'skl-soramo14-07')) };
const oDeck = { monsters: ['mon-kalshell', 'mon-soramo', 'mon-gauul'], skills: Array.from({ length: 60 }, () => 'skl-soramo14-01') };
const ATTACK = 'skl-soramo14-03'; // たいあたり（ちから2）
const WISDOM = 'skl-soramo14-07'; // スターダストレイ（かしこさ4）

function scene(hand: Partial<Record<Side, string[]>>, mana: Partial<Record<Side, number>> = {}, deckLeft?: number): BattleState {
  const s = createBattle({ name: 'P', deck: pDeck }, { name: 'O', deck: oDeck }, 7, 'player');
  const side = (k: Side) => ({
    ...s.sides[k],
    hand: (hand[k] ?? []).map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana[k] ?? 12 }, () => 'skl-soramo14-01'),
    ...(k === 'player' && deckLeft !== undefined ? { deck: s.sides.player.deck.slice(0, deckLeft) } : {}),
  });
  return { ...s, phase: 'main', active: 'player', manaConvertLimit: null, sides: { player: side('player'), opponent: side('opponent') } };
}
const mon = (s: BattleState, uid: string): BattleMonster => {
  const m = [...s.sides.player.monsters, ...s.sides.opponent.monsters].find((x) => x.uid === uid);
  if (!m) throw new Error(uid);
  return m;
};
function opponentTurn(s: BattleState, hand: string[], turns = 1): BattleState {
  return {
    ...s,
    turn: s.turn + turns,
    phase: 'main',
    active: 'opponent',
    pending: null,
    sides: { ...s.sides, opponent: { ...s.sides.opponent, hand: hand.map((cardId, i) => ({ uid: `x${i}`, cardId })), monsters: s.sides.opponent.monsters.map((m) => ({ ...m, acted: false })) } },
  };
}
/** 相手 o-m2（ソラモ）が card で target を攻撃し、守り guards（手札の uid）を使って受けたあとのライフ */
function hit(s0: BattleState, card: string, target: string, guards: string[] = []): number {
  let s = applyAction(opponentTurn(s0, [card]), { type: 'useCard', side: 'opponent', cardUid: 'x0', userUid: 'o-m2', targetUid: target });
  for (const g of guards) s = applyAction(s, { type: 'defend', side: 'player', cardUid: g });
  if (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'player', cardUid: null });
  return mon(s, target).life;
}

describe('そなえのふえ（新しい効果）', () => {
  it('フォルン以外の味方だけ選べる。かけた味方は次の相手の手番、受けるダメージ−1（ちから技・かしこさ技どちらも）', () => {
    const s0 = scene({ player: [fo(7)] });
    expect(targetsFor(s0, 'player', cardCatalog.get(fo(7)) as never).map((m) => m.uid)).toEqual(['p-m2', 'p-m3']);
    const s = applyAction(s0, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: 'p-m2' });
    expect(mon(s, 'p-m2').ward).toEqual({ reduce: 1, untilTurn: s.turn + 1 });
    const life = mon(s, 'p-m2').life;
    expect(hit(s, ATTACK, 'p-m2')).toBe(life - 1); // 2 → 1
    expect(hit(s, WISDOM, 'p-m2')).toBe(life - 3); // 4 → 3
    // かけていない味方はそのまま
    expect(hit(s, ATTACK, 'p-m3')).toBe(mon(s, 'p-m3').life - 2);
    // 次の次の相手の手番では効かない
    expect(wardOf(opponentTurn(s, [], 3), mon(s, 'p-m2'))).toBe(0);
  });

  it('防御で減らしたあとに −1（0 より下にしない）。重ねない（2回かけても −1）', () => {
    let s = scene({ player: [fo(7), fo(7)] });
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: 'p-m2' });
    const again = applyAction({ ...s, sides: { ...s.sides, player: { ...s.sides.player, monsters: s.sides.player.monsters.map((m) => ({ ...m, acted: false })) } } }, { type: 'useCard', side: 'player', cardUid: 'p1', userUid: 'p-m1', targetUid: 'p-m2' });
    expect(mon(again, 'p-m2').ward?.reduce).toBe(1);
    // ソラモの星のまもり（−3）で 4 → 1、そのあと −1 → 0
    const guarded = { ...s, sides: { ...s.sides, player: { ...s.sides.player, hand: [{ uid: 'g0', cardId: 'skl-soramo14-12' }] } } };
    let a = applyAction(opponentTurn(guarded, [WISDOM]), { type: 'useCard', side: 'opponent', cardUid: 'x0', userUid: 'o-m2', targetUid: 'p-m2' });
    a = applyAction(a, { type: 'defend', side: 'player', cardUid: 'g0' });
    expect(a.pending ? incomingDamage(a, a.pending) : -1).toBe(0);
  });

  it('倒れたら消える。かけられる味方がいなければ使えない', () => {
    const s0 = scene({ player: [fo(7)] });
    const lone: BattleState = { ...s0, sides: { ...s0.sides, player: { ...s0.sides.player, monsters: s0.sides.player.monsters.map((m) => (m.uid === 'p-m1' ? m : { ...m, life: 0 })) } } };
    const u = cardUsability(lone, 'player', 'p0');
    expect(u.usable).toBe(false);
    expect(u.reason).toContain('そなえのふえ');
    let s = applyAction(s0, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: 'p-m3' });
    s = { ...s, sides: { ...s.sides, player: { ...s.sides.player, monsters: s.sides.player.monsters.map((m) => (m.uid === 'p-m3' ? { ...m, life: 1 } : m)) } } };
    let k = applyAction(opponentTurn(s, [WISDOM]), { type: 'useCard', side: 'opponent', cardUid: 'x0', userUid: 'o-m2', targetUid: 'p-m3' });
    if (k.phase === 'defense') k = applyAction(k, { type: 'defend', side: 'player', cardUid: null });
    expect(mon(k, 'p-m3').life).toBe(0);
    expect(mon(k, 'p-m3').ward ?? null).toBeNull();
  });
});

describe('もりのたより（新しい効果）', () => {
  it('手札が5枚になるまで引き、選んだ1枚を捨てる（引いた札も選べる。uid は窓で見せたとおり）', () => {
    const s0 = scene({ player: [fo(9), 'skl-soramo14-01'] });
    const preview = drawToPreview(s0, 'player', 'p0');
    expect(preview).toHaveLength(5);
    expect(preview[0]?.uid).toBe('p1');
    const drawnUid = preview[4]?.uid ?? '';
    const s = applyAction(s0, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', choice: drawnUid });
    expect(s.sides.player.hand.map((c) => c.uid)).toEqual(preview.filter((c) => c.uid !== drawnUid).map((c) => c.uid));
    expect(s.sides.player.hand).toHaveLength(4);
    expect(s.sides.player.deck).toHaveLength(s0.sides.player.deck.length - 4);
    expect(s.sides.player.discard).toContain(preview[4]?.cardId);
    expect(s.sides.player.discard).toContain(fo(9));
  });

  it('使ったあとの手札がすでに5枚以上なら使えない（理由の文を出す）。4枚なら使える', () => {
    const full = scene({ player: [fo(9), 'a', 'b', 'c', 'd', 'e'].map((x) => (x.length === 1 ? 'skl-soramo14-01' : x)) });
    const u = cardUsability(full, 'player', 'p0');
    expect(u.usable).toBe(false);
    expect(u.reason).toBe('手札がもう5枚以上あるので使えません');
    const four = scene({ player: [fo(9), 'skl-soramo14-01', 'skl-soramo14-01', 'skl-soramo14-01', 'skl-soramo14-01'] });
    expect(cardUsability(four, 'player', 'p0').usable).toBe(true);
  });

  it('山札が足りなければ引けるだけ引く（山札切れの負けにはしない）', () => {
    const s0 = scene({ player: [fo(9)] }, {}, 2);
    const s = applyAction(s0, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1' });
    expect(s.phase).not.toBe('ended');
    expect(s.winner).toBeNull();
    expect(s.sides.player.deck).toHaveLength(0);
    expect(s.sides.player.hand).toHaveLength(1); // 2枚引いて1枚捨てた
  });
});

describe('みがわりのふえ・はげましのふえ・こもりうた（今ある効果）', () => {
  it('みがわりのふえ：味方への攻撃をフォルンが代わりに受ける', () => {
    const s0 = scene({ player: [fo(12)] });
    let s = applyAction(opponentTurn(s0, [ATTACK]), { type: 'useCard', side: 'opponent', cardUid: 'x0', userUid: 'o-m2', targetUid: 'p-m2' });
    s = applyAction(s, { type: 'defend', side: 'player', cardUid: 'p0' });
    if (s.phase === 'defense') s = applyAction(s, { type: 'defend', side: 'player', cardUid: null });
    expect(mon(s, 'p-m2').life).toBe(getMonster('mon-soramo').life);
    expect(mon(s, 'p-m1').life).toBe(7 - 2);
  });

  it('はげましのふえ：フォルン以外の味方に、次のターンの攻撃＋1。こもりうた：相手1体は次の攻撃を行えない', () => {
    let s = scene({ player: [fo(6), fo(8)] });
    expect(targetsFor(s, 'player', cardCatalog.get(fo(6)) as never).map((m) => m.uid)).toEqual(['p-m2', 'p-m3']);
    s = applyAction(s, { type: 'useCard', side: 'player', cardUid: 'p0', userUid: 'p-m1', targetUid: 'p-m2' });
    expect(mon(s, 'p-m2').tailwind).toEqual({ amount: 1, turn: s.turn + 2 });
  });
});

/* ---------- CPU（フォルンだけ） ---------- */

// CPU（opponent）：フォルン・ソラモ・ガウル。プレイヤー：カルシェル・ソラモ・ガウル
function cpuScene(o: { hand: string[]; mana?: number; foeMana?: number; lives?: Record<string, number>; deck?: number }): BattleState {
  const s = createBattle({ name: 'P', deck: oDeck }, { name: 'O', deck: pDeck }, 11, 'opponent');
  const fix = (k: Side, hand: string[], mana: number) => ({
    ...s.sides[k],
    hand: hand.map((cardId, i) => ({ uid: `${k[0]}${i}`, cardId })),
    manaPile: Array.from({ length: mana }, () => 'skl-soramo14-01'),
    monsters: s.sides[k].monsters.map((m) => ({ ...m, acted: false, ...(o.lives && m.uid in o.lives ? { life: o.lives[m.uid] } : {}) })),
    ...(k === 'opponent' && o.deck !== undefined ? { deck: s.sides[k].deck.slice(0, o.deck) } : {}),
  });
  return { ...s, turn: 5, phase: 'main', active: 'opponent', manaConvertLimit: null, sides: { player: fix('player', [], o.foeMana ?? 6), opponent: fix('opponent', o.hand, o.mana ?? 6) } };
}
const used = (s: BattleState, a: ReturnType<typeof chooseAction>): string | null =>
  a?.type === 'useCard' ? (s.sides.opponent.hand.find((h) => h.uid === a.cardUid)?.cardId ?? null) : null;

describe('CPU のフォルン（指示書 AL）', () => {
  it('もりのたより：手札が2枚以下で山札が10枚以上なら、攻撃より先に使う（捨てる1枚も選ぶ）。山札が少なければ使わない', () => {
    const s = cpuScene({ hand: [fo(9), 'skl-soramo14-03'] });
    const a = chooseAction(s, 'opponent', 'normal', 'A');
    expect(used(s, a)).toBe(fo(9));
    expect(a?.type === 'useCard' ? a.choice : undefined).toBe(pickDrawToDiscard(s, 'opponent', 'o0', 'normal', 'A'));
    expect(drawToPreview(s, 'opponent', 'o0').map((c) => c.uid)).toContain(a?.type === 'useCard' ? a.choice : '');
    const thin = cpuScene({ hand: [fo(9), 'skl-soramo14-03'], deck: 5 });
    expect(used(thin, chooseAction(thin, 'opponent', 'normal', 'A'))).not.toBe(fo(9));
  });

  it('そなえのふえ：相手の攻撃で倒されそうで、−1 で助かる味方がいれば攻撃より先にかける', () => {
    // 相手（プレイヤー）のマナ3：払えるいちばん強い攻撃はクラッシュクロー・ファイアボールの 4。CPU のソラモ（o-m2）はライフ4 → −1 で助かる
    const s = cpuScene({ hand: [fo(7), 'skl-soramo14-03'], lives: { 'o-m2': 4 }, foeMana: 3 });
    const a = chooseAction(s, 'opponent', 'normal', 'A');
    expect(used(s, a)).toBe(fo(7));
    expect(a?.type === 'useCard' ? a.targetUid : null).toBe('o-m2');
    // 相手のマナ4ならフレアレイ（6）が払えるので、−1 で助かるのはライフ6のガウル（o-m3）
    const big = cpuScene({ hand: [fo(7), 'skl-soramo14-03'], lives: { 'o-m2': 4 }, foeMana: 4 });
    const b = chooseAction(big, 'opponent', 'normal', 'A');
    expect(b?.type === 'useCard' ? b.targetUid : null).toBe('o-m3');
  });

  it('こもりうた：いちばん強い攻撃を持つ相手へ（攻撃のあと。攻撃の技が無ければすぐ）', () => {
    const s = cpuScene({ hand: [fo(8)] });
    const a = chooseAction(s, 'opponent', 'normal', 'A');
    expect(used(s, a)).toBe(fo(8));
    // 相手はカルシェル・ソラモ・ガウル。いちばん強い攻撃（技の最大ダメージ）はカルシェルのシェルブレイカー 6
    expect(a?.type === 'useCard' ? a.targetUid : null).toBe('p-m1');
  });

  it('みがわりのふえ：狙われた味方のライフが半分以下で、フォルンが倒れないなら代わりに受ける', () => {
    const base = cpuScene({ hand: [fo(12)], lives: { 'o-m2': 3 } });
    // プレイヤーの手番にして、プレイヤーのソラモ（p-m2）が CPU のソラモ（o-m2）を たいあたり
    const atk: BattleState = { ...base, active: 'player', sides: { ...base.sides, player: { ...base.sides.player, hand: [{ uid: 'q0', cardId: ATTACK }] } } };
    const s = applyAction(atk, { type: 'useCard', side: 'player', cardUid: 'q0', userUid: 'p-m2', targetUid: 'o-m2' });
    expect(s.phase).toBe('defense');
    expect(chooseAction(s, 'opponent', 'normal', 'A')).toEqual({ type: 'defend', side: 'opponent', cardUid: 'o0' });
    // ライフが多ければ使わない（2ダメージで倒れない）
    const full = applyAction({ ...atk, sides: { ...atk.sides, opponent: { ...atk.sides.opponent, monsters: atk.sides.opponent.monsters.map((m) => ({ ...m, life: m.maxLife })) } } }, { type: 'useCard', side: 'player', cardUid: 'q0', userUid: 'p-m2', targetUid: 'o-m2' });
    const b = chooseAction(full, 'opponent', 'normal', 'A');
    expect(b).not.toEqual({ type: 'defend', side: 'opponent', cardUid: 'o0' });
  });
});
