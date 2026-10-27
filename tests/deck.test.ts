import { describe, expect, it } from 'vitest';
import { cardCatalog, monsterId, SKILLS, skillId, supportId } from '../src/data/cards.ts';
import { skillCategory } from '../src/game/cards/cardTypes.ts';
import { ENCOUNTERS } from '../src/data/dungeons.ts';
import { TOURNAMENTS } from '../src/data/tournaments.ts';
import { DECK_RULES } from '../src/data/rules.ts';
import {
  buildAutoDeck,
  buildDeckFromCollection,
  countCards,
  countRoles,
  createPlaceholderStarterCollection,
  createPlaceholderStarterDeck,
  createStarterCollection,
  createStarterDeck,
  INITIAL_DISTRIBUTION,
  validateDeck,
} from '../src/game/deck/deck.ts';

describe('デッキ構成チェック（仮ルール）', () => {
  it('スターターデッキはモンスター3体・山札60枚（同じカードは3枚まで）で、所持カードで組める', () => {
    const deck = createPlaceholderStarterDeck();
    expect(deck.monsters).toHaveLength(3);
    expect(deck.skills).toHaveLength(60);
    expect(DECK_RULES.maxCopies).toBe(3);
    expect(Math.max(...Object.values(countCards(deck.skills)))).toBeLessThanOrEqual(3);
    expect(validateDeck(deck, createPlaceholderStarterCollection())).toEqual([]);
  });

  it('ダンジョン・大会のすべての相手のデッキが正しい構成になる', () => {
    const teams = [...Object.values(ENCOUNTERS).map((e) => e.monsters), ...TOURNAMENTS.flatMap((t) => t.rounds.map((o) => o.monsters))];
    expect(teams.length).toBeGreaterThan(0);
    for (const monsters of teams) expect(validateDeck(buildAutoDeck(monsters))).toEqual([]);
  });

  it('枚数不足・モンスター数・重複モンスターを検出する', () => {
    const deck = createPlaceholderStarterDeck();
    const codes = (d: Parameters<typeof validateDeck>[0]) => validateDeck(d).map((i) => i.code);
    expect(codes({ ...deck, skills: deck.skills.slice(1) })).toContain('skillCount');
    expect(codes({ ...deck, monsters: deck.monsters.slice(1) })).toContain('monsterCount');
    // 同じモンスターの重複は、2026-10-23 からテスト用に「可」（ソラモ3体のデッキのため。DECK_RULES.allowDuplicateMonsters）
    expect(DECK_RULES.allowDuplicateMonsters).toBe(true);
    expect(codes({ ...deck, monsters: [monsterId('a'), monsterId('a'), monsterId('b')] })).not.toContain('duplicateMonster');
  });

  it('上限を超える同名カードと、適合しない技を検出する', () => {
    const deck = createPlaceholderStarterDeck();
    const skills = [...deck.skills];
    skills[4] = skillId('a', 1); // a-2 の1枚を a-1 に替えて a-1 を5枚にする
    skills[59] = skillId('d', 1); // デッキにいないモンスターの技
    const codes = validateDeck({ ...deck, skills }).map((i) => i.code);
    expect(codes).toContain('tooManyCopies');
    expect(codes).toContain('notCompatible');
  });

  it('所持枚数を超えるデッキを検出する', () => {
    const collection = { ...createPlaceholderStarterCollection(), [skillId('a', 1)]: 2 };
    expect(validateDeck(createPlaceholderStarterDeck(), collection).map((i) => i.code)).toContain('notOwned');
  });

  it('NPC 用の自動デッキは正しい構成になる（仮サポートも入る）', () => {
    const deck = buildAutoDeck(['e', 'f', 'g'].map(monsterId));
    expect(validateDeck(deck)).toEqual([]);
    expect(Math.max(...Object.values(countCards(deck.skills)))).toBeLessThanOrEqual(DECK_RULES.maxCopies);
    expect(deck.skills.some((id) => cardCatalog.get(id)?.kind === 'support')).toBe(true);
  });

  it('サポートはどのモンスターのデッキにも入れられる。モンスターカードは山札に入れられない', () => {
    const deck = createPlaceholderStarterDeck();
    const skills = [...deck.skills];
    skills[0] = supportId(1);
    expect(validateDeck({ ...deck, skills })).toEqual([]);
    skills[1] = monsterId('a');
    expect(validateDeck({ ...deck, skills }).map((i) => i.code)).toContain('notSkill');
  });

  it('おまかせ構築は、適合技が足りなければ持っているサポートで埋める', () => {
    const collection = { ...createPlaceholderStarterCollection(), [supportId(1)]: 4, [supportId(2)]: 4 };
    const monsters = [monsterId('a'), monsterId('b'), monsterId('d')]; // d の技は持っていない
    const deck = buildDeckFromCollection(monsters, collection);
    expect(deck.skills.filter((id) => id.startsWith('sup-'))).toHaveLength(8);
  });

  it('所持カードからのおまかせ構築', () => {
    const collection = createPlaceholderStarterCollection();
    const deck = buildDeckFromCollection(createPlaceholderStarterDeck().monsters, collection);
    expect(validateDeck(deck, collection)).toEqual([]);
    const short = buildDeckFromCollection([monsterId('a'), monsterId('b'), monsterId('d')], collection);
    expect(short.skills.length).toBeLessThan(60);
  });
});

describe('デッキ編集の表の枚数（攻撃・守り・計）', () => {
  it('ちから・かしこさは攻撃、防御・回避は守り、特殊とサポートは計だけに入る', () => {
    const pick = (cats: readonly string[]): string => SKILLS.find((s) => cats.includes(skillCategory(s)))!.id;
    const ids = [pick(['force']), pick(['wisdom']), pick(['defense']), pick(['evade']), pick(['special']), supportId(1)];
    expect(countRoles(ids)).toEqual({ atk: 2, guard: 2, total: 6 });
    expect(countRoles([])).toEqual({ atk: 0, guard: 0, total: 0 });
  });
});

describe('初期配布96枚と初期デッキ60枚（別の仕様）', () => {
  it('初期配布は全6体×16枚＝96枚。どれも正式の技カードで、そのモンスターの技だけ', () => {
    expect(INITIAL_DISTRIBUTION.map((d) => d.monsterId)).toEqual(['mon-soramo', 'mon-lazuck', 'mon-nobiton', 'mon-myurol', 'mon-kalshell', 'mon-gauul']);
    for (const d of INITIAL_DISTRIBUTION) {
      expect(d.cards.reduce((n, c) => n + c.copies, 0)).toBe(16);
      for (const c of d.cards) {
        const s = SKILLS.find((k) => k.id === c.id);
        expect(s?.monsterId).toBe(d.monsterId);
        expect(s?.isPlaceholder).toBe(false);
        expect(s?.availability).toBe('initial');
      }
    }
    expect(INITIAL_DISTRIBUTION.flatMap((d) => d.cards).reduce((n, c) => n + c.copies, 0)).toBe(96);
  });

  it('新しく始めたときの所持カードは、初期配布96枚と初期デッキ60枚の両方がそろう（モンスターカード本体は初期デッキの3体だけ）', () => {
    const owned = createStarterCollection();
    for (const c of INITIAL_DISTRIBUTION.flatMap((d) => d.cards)) expect(owned[c.id] ?? 0).toBeGreaterThanOrEqual(c.copies);
    const deck = createStarterDeck();
    expect(deck.skills).toHaveLength(60);
    expect(validateDeck(deck, owned)).toEqual([]);
    expect(Object.keys(owned).filter((id) => id.startsWith('mon-')).sort()).toEqual([...new Set(deck.monsters)].sort());
  });
});
