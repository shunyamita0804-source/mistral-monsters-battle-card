import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getMonster, getSkill, SKILLS } from '../src/data/cards.ts';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { runBattlerFace, RUN_DUNGEONS, runGuardianOpponent, runNpcOpponent } from '../src/data/dungeonRun.ts';
import { EXAM_OPPONENT } from '../src/data/introV2.ts';
import { NPC_BATTLE_ACTORS, npcActorOf, npcLine } from '../src/data/npcBattleLines.ts';
import { getStoryEvent } from '../src/data/storyEvents.ts';
import { TOURNAMENTS, tournamentOpponents, type OpponentDefinition } from '../src/data/tournaments.ts';
import { applyAction, createBattle, type BattleState, type PendingAttack } from '../src/game/battle/engine.ts';
import {
  attackLineKey,
  attackTalkOf,
  knockLineKey,
  midReactionAllowed,
  midReactionLimit,
  NPC_LINE_KEYS,
  npcLinePriority,
  resultLineKey,
  talkRoll,
} from '../src/game/battle/npcTalk.ts';
import { PETE_OPPONENT } from '../src/game/story/pete.ts';
import { cardName } from '../src/i18n/content.ts';

/**
 * NPC バトルセリフ 43 名（2026-11-05 第1弾。正本 design-parts/npc-battle-lines-20261105/data/npc_battle_lines.json）
 */
const SRC = JSON.parse(readFileSync('design-parts/npc-battle-lines-20261105/data/npc_battle_lines.json', 'utf8')) as {
  keys: { key: string }[];
  actors: { id: string; lines: Record<string, { text: string | null; status: string }> }[];
  extra_lines: Record<string, Record<string, { text: string; status: string; ace_monster?: string }>>;
};

describe('データ（正本と同じ）', () => {
  it('43名×13場面。日本語は正本と一字一句同じ。無言は ？？？ の7場面だけ', () => {
    expect(NPC_BATTLE_ACTORS).toHaveLength(43);
    expect(SRC.keys.map((k) => k.key)).toEqual([...NPC_LINE_KEYS]);
    let silent = 0;
    for (const src of SRC.actors) {
      const a = NPC_BATTLE_ACTORS.find((x) => x.id === src.id);
      expect(a, src.id).toBeDefined();
      for (const key of NPC_LINE_KEYS) {
        const line = a?.lines[key];
        expect(line?.ja, `${src.id} ${key}`).toBe(src.lines[key]?.text);
        expect(line?.status).toBe(src.lines[key]?.status);
        if (line?.ja === null) {
          silent++;
          expect(src.id).toBe('guardian');
          expect(line.en).toBeNull();
        } else {
          expect(line?.en, `${src.id} ${key} の英語（仮訳）`).toBeTruthy();
        }
      }
    }
    expect(silent).toBe(7);
  });

  it('切り札専用（8名×3本＋アウレリオの仮3本）・ガレスの再戦1本も正本と同じ', () => {
    let n = 0;
    for (const [id, extra] of Object.entries(SRC.extra_lines)) {
      const a = NPC_BATTLE_ACTORS.find((x) => x.id === id);
      for (const [key, v] of Object.entries(extra)) {
        expect(a?.extra?.[key as 'ace_attack_hit']?.ja, `${id} ${key}`).toBe(v.text);
        n++;
      }
    }
    expect(n).toBe(28);
    expect(NPC_BATTLE_ACTORS.find((a) => a.id === 'aurelio')?.extra?.ace_attack_hit?.status).toBe('provisional_ace_pending_replacement');
  });

  it('無言は吹き出しを出さない（null）。ガレスの未承認2本は出さない（今までの共通のひと言：undefined）', () => {
    const guardian = npcActorOf({ id: 'enc-run-guardian', face: 'guardian' });
    expect(guardian?.id).toBe('guardian');
    expect(npcLine(guardian, 'npc_attack_hit')).toBeNull();
    expect(npcLine(guardian, 'npc_win')).toEqual({ ja: '……終わりだ。', en: expect.any(String) });
    const gareth = npcActorOf(EXAM_OPPONENT);
    expect(gareth?.id).toBe('gareth');
    expect(npcLine(gareth, 'npc_knock_last')).toBeUndefined();
    expect(npcLine(gareth, 'npc_own_down_last')).toBeUndefined();
    expect(npcLine(gareth, 'start')?.ja).toBe('さあ、始めようか。落ち着いていこう。');
  });
});

describe('対戦相手との結びつけ', () => {
  const tournamentOpps = TOURNAMENTS.flatMap((t) => [...tournamentOpponents(t)]);
  const byId = (id: string): OpponentDefinition => {
    const o = tournamentOpps.find((x) => x.id === id) ?? ENCOUNTERS[id];
    if (!o) throw new Error(id);
    return o;
  };

  it.each([
    ['e-1', 'noel'],
    ['e-2', 'viktor'],
    ['e-3', 'sienna'],
    ['d-1', 'dario'],
    ['d-2', 'isabella'],
    ['d-3', 'gordon'],
    ['c-gordon', 'gordon'],
    ['reg-sienna', 'sienna'],
    ['reg-dolf', 'dolf'],
    ['reg-leonard', 'leonard'],
    ['reg-greta', 'greta'],
    ['reg-julius', 'julius'],
    ['reg-camilla', 'camilla'],
    ['reg-alvin', 'alvin'],
    ['gen-tobias', 'tobias'],
    ['gen-marie', 'marie'],
    ['e-marie', 'marie'],
    ['gen-jean', 'jean'],
    ['gen-helena', 'helena'],
    ['gen-claude', 'claude'],
    ['gen-beatrice', 'beatrice'],
    ['gen-zara', 'zara'],
    ['gen-walter', 'walter'],
    ['enc-b3-boss', 'grant'],
    ['enc-forest-boss', 'sera'],
    ['enc-water-boss', 'lucia'],
    ['enc-ice-boss', 'ivan'],
    ['enc-fire-boss', 'balka'],
    ['enc-machine-boss', 'teo'],
    ['enc-holy-boss', 'aurelio'],
    ['enc-wind-boss', 'zephyra'],
    ['enc-thunder-boss', 'stella'],
  ])('%s → %s（いまのゲームの対戦相手）', (opponentId, actor) => {
    expect(npcActorOf(byId(opponentId))?.id).toBe(actor);
  });

  it('ガレス（exam-teacher）・ピート（town-pete）', () => {
    expect(npcActorOf(EXAM_OPPONENT)?.id).toBe('gareth');
    expect(npcActorOf(PETE_OPPONENT)?.id).toBe('pete');
  });

  it('ダンジョンの通常バトラー（ID は共通なので顔で）・見えない番人', () => {
    const want: Record<string, string> = {
      'battler-1': 'flora',
      'battler-2': 'oscar',
      'battler-3': 'kyle',
      'battler-pia': 'pia',
      'battler-hans': 'hans',
      'battler-zack': 'zack',
      'battler-otto': 'otto',
      'battler-mina': 'mina',
      'battler-niko': 'niko',
      'battler-luka': 'luka',
    };
    const seen = new Set<string>();
    for (const id of Object.keys(RUN_DUNGEONS)) {
      for (let i = 1; i <= 3; i++) {
        const o = runNpcOpponent(0, i, id);
        expect(o.face).toBe(runBattlerFace(i, id));
        const actor = npcActorOf(o)?.id;
        expect(actor, `${id} ${o.face}`).toBe(want[o.face as string]);
        seen.add(actor as string);
      }
      expect(npcActorOf(runGuardianOpponent(0, id))?.id).toBe('guardian');
    }
    expect(seen.size).toBe(10);
  });

  it('ミレイユはいまのゲームに対戦が無いので、どの対戦相手にも結びつかない（未接続）', () => {
    const all = [...tournamentOpps, ...Object.values(ENCOUNTERS), EXAM_OPPONENT, PETE_OPPONENT];
    expect(all.some((o) => npcActorOf(o)?.id === 'mireille')).toBe(false);
    // ミレイユのほかの42名は、どれかの対戦相手に結びつく
    const dungeonOpps = Object.keys(RUN_DUNGEONS).flatMap((id) => [1, 2, 3].map((i) => runNpcOpponent(0, i, id)).concat(runGuardianOpponent(0, id)));
    const reached = new Set([...all, ...dungeonOpps].map((o) => npcActorOf(o)?.id).filter(Boolean));
    expect(NPC_BATTLE_ACTORS.filter((a) => !reached.has(a.id)).map((a) => a.id)).toEqual(['mireille']);
  });

  it('切り札のある人：ボスの切り札（ace）が正本の切り札のモンスターと同じ', () => {
    const bosses: Record<string, string> = {
      grant: 'enc-b3-boss',
      sera: 'enc-forest-boss',
      lucia: 'enc-water-boss',
      ivan: 'enc-ice-boss',
      balka: 'enc-fire-boss',
      teo: 'enc-machine-boss',
      aurelio: 'enc-holy-boss',
      zephyra: 'enc-wind-boss',
      stella: 'enc-thunder-boss',
    };
    for (const [actor, boss] of Object.entries(bosses)) {
      const ace = ENCOUNTERS[boss]?.ace;
      expect(ace, boss).toBeTruthy();
      expect(cardName(getMonster(ace as string)), actor).toBe(SRC.extra_lines[actor]?.ace_attack_hit?.ace_monster);
    }
  });
});

describe('場面の判定（表示用。ルールは変えない）', () => {
  const ATTACK = SKILLS.find((k) => k.effect.type === 'attack' && !('halfOnEvade' in k.effect && k.effect.halfOnEvade))?.id as string;
  const HALF = SKILLS.find((k) => k.effect.type === 'attack' && 'halfOnEvade' in k.effect && k.effect.halfOnEvade)?.id as string;
  const DEFENSE = SKILLS.find((k) => k.effect.type === 'defense')?.id as string;
  const EVADE = SKILLS.find((k) => k.effect.type === 'evade')?.id as string;
  const MONS = ['mon-soramo', 'mon-lazuck', 'mon-nobiton'];

  /** attacker の o-m1／p-m1 が相手の1体目を狙う攻撃を、responses で守ったあと */
  function resolve(attacker: 'player' | 'opponent', responses: string[], power = 3, cardId = ATTACK, targetLife?: number): { before: BattleState; after: BattleState } {
    const deck = { monsters: MONS, skills: Array.from({ length: 60 }, () => ATTACK) };
    const s0 = createBattle({ name: 'P', deck }, { name: 'O', deck }, 7, 'player');
    const target = attacker === 'player' ? 'o-m1' : 'p-m1';
    const defender = attacker === 'player' ? 'opponent' : 'player';
    const pending: PendingAttack = { attacker, userUid: attacker === 'player' ? 'p-m1' : 'o-m1', targetUid: target, cardId, stat: getSkill(cardId).stat ?? { type: 'force' } as never, power, responses } as unknown as PendingAttack;
    let s: BattleState = { ...s0, turn: 3, active: attacker, phase: 'defense', pending };
    if (targetLife !== undefined) {
      s = { ...s, sides: { ...s.sides, [defender]: { ...s.sides[defender], monsters: s.sides[defender].monsters.map((m) => (m.uid === target ? { ...m, life: targetLife } : m)) } } };
    }
    const after = applyAction(s, { type: 'defend', side: defender, cardUid: null });
    return { before: s, after };
  }

  it('命中（ライフが減った）：NPC の攻撃＝npc_attack_hit・主人公の攻撃＝player_attack_hit', () => {
    const a = attackTalkOf(...Object.values(resolve('opponent', [])) as [BattleState, BattleState]);
    expect(a?.kind).toBe('hit');
    expect(a && attackLineKey(a)).toBe('npc_attack_hit');
    expect(a?.userCardId).toBe('mon-soramo');
    const b = attackTalkOf(...Object.values(resolve('player', [])) as [BattleState, BattleState]);
    expect(b && attackLineKey(b)).toBe('player_attack_hit');
  });

  it('防御成功（0 にした）・回避成功。守ったのは攻撃されなかった側', () => {
    const d = attackTalkOf(...Object.values(resolve('player', [DEFENSE], 1)) as [BattleState, BattleState]);
    expect(d?.kind).toBe('defended');
    expect(d && attackLineKey(d)).toBe('npc_defense_success');
    const e = attackTalkOf(...Object.values(resolve('opponent', [EVADE])) as [BattleState, BattleState]);
    expect(e?.kind).toBe('evaded');
    expect(e && attackLineKey(e)).toBe('player_evade_success');
  });

  it('防御で減らしただけ（ライフが減った）は命中。半分の回避（回避されても半分）も命中で「無傷」とは言わない', () => {
    const d = attackTalkOf(...Object.values(resolve('player', [DEFENSE], 6)) as [BattleState, BattleState]);
    expect(d?.kind).toBe('hit');
    if (HALF) {
      const h = attackTalkOf(...Object.values(resolve('player', [EVADE], 4, HALF)) as [BattleState, BattleState]);
      expect(h?.kind).toBe('hit');
    }
  });

  it('威力0で守りも無い・攻撃が解決していない操作は何も言わない', () => {
    expect(attackTalkOf(...Object.values(resolve('player', [], 0)) as [BattleState, BattleState])).toBeNull();
    const { before } = resolve('player', []);
    expect(attackTalkOf(before, before)).toBeNull();
  });

  it('倒した攻撃は knockedOut（撃破のひと言を優先して、命中のひと言は出さない）', () => {
    const k = attackTalkOf(...Object.values(resolve('opponent', [], 3, ATTACK, 1)) as [BattleState, BattleState]);
    expect(k?.knockedOut).toBe(true);
  });

  it('撃破：残りの数で4つ。最後の1体が倒れて決着したら null（勝ち・負けのひと言）', () => {
    expect(knockLineKey('player', [{ life: 0 }, { life: 3 }, { life: 3 }])).toBe('npc_knock');
    expect(knockLineKey('player', [{ life: 0 }, { life: 0 }, { life: 3 }])).toBe('npc_knock_last');
    expect(knockLineKey('opponent', [{ life: 0 }, { life: 3 }, { life: 3 }])).toBe('npc_own_down');
    expect(knockLineKey('opponent', [{ life: 0 }, { life: 0 }, { life: 3 }])).toBe('npc_own_down_last');
    expect(knockLineKey('opponent', [{ life: 0 }, { life: 0 }, { life: 0 }])).toBeNull();
  });

  it('決着：主人公が勝った＝NPC の負けのひと言（npc_lose）・NPC が勝った＝勝ちのひと言（npc_win）。正本の場面名もそのとおり', () => {
    expect(resultLineKey('player')).toBe('npc_lose');
    expect(resultLineKey('opponent')).toBe('npc_win');
    const labels = Object.fromEntries((JSON.parse(readFileSync('design-parts/npc-battle-lines-20261105/data/npc_battle_lines.json', 'utf8')) as { keys: { key: string; label: string }[] }).keys.map((k) => [k.key, k.label]));
    expect(labels.npc_win).toBe('NPC勝利');
    expect(labels.npc_lose).toBe('NPC敗北');
  });

  it('強さの順：決着・切り札の最後 ＞ 切り札の撃破（続く）＞ 撃破・始め ＞ 途中の反応', () => {
    expect(npcLinePriority('ace_down_final')).toBe(npcLinePriority('npc_lose'));
    expect(npcLinePriority('npc_lose')).toBeGreaterThan(npcLinePriority('ace_down_continue'));
    expect(npcLinePriority('ace_down_continue')).toBeGreaterThan(npcLinePriority('npc_own_down'));
    expect(npcLinePriority('npc_knock_last')).toBeGreaterThan(npcLinePriority('npc_attack_hit'));
    expect(npcLinePriority('ace_attack_hit')).toBe(npcLinePriority('npc_attack_hit'));
  });

  it('途中の反応：1手番に1回・1試合の上限（ふつう3・少なめ2・多め4）。同じ種なら同じ', () => {
    expect(midReactionLimit('noel')).toBe(3);
    expect(midReactionLimit('guardian')).toBe(2);
    expect(midReactionLimit('pete')).toBe(4);
    expect(midReactionAllowed({ used: 0, limit: 3, turn: 2, lastTurn: 2, roll: 0 })).toBe(false);
    expect(midReactionAllowed({ used: 3, limit: 3, turn: 4, lastTurn: 2, roll: 0 })).toBe(false);
    expect(midReactionAllowed({ used: 1, limit: 3, turn: 4, lastTurn: 2, roll: 0.2 })).toBe(true);
    expect(talkRoll(5, 1)).toBe(talkRoll(5, 1));
    const rolls = Array.from({ length: 400 }, (_, i) => talkRoll(123, i));
    const half = rolls.filter((r) => r < 0.5).length;
    expect(half).toBeGreaterThan(150);
    expect(half).toBeLessThan(250);
  });
});

describe('ピート', () => {
  it('M05 の一人称は「俺」（2026-11-05 ユーザー指示）', () => {
    const texts = getStoryEvent('M05').steps.flatMap((s) => (s.kind === 'line' ? [s.line.text.ja] : []));
    expect(texts).toContain('見てくれよ、これが俺のお気に入り、プカリム！');
    expect(texts.join('')).not.toContain('ぼく');
  });
});
