import { cardCatalog, monsterId, skillId, skillsOf, supportId, SUPPORTS } from '../../data/cards.ts';
import { LAZUCK_OLD16_IDS, LAZUCK_STARTER, lazuckSkillId } from '../../data/lazuck.ts';
import { NOBITON_STARTER } from '../../data/nobiton.ts';
import { SORAMO_OLD_SKILL_IDS, SORAMO_STARTER, SORAMO_TEAM } from '../../data/soramo.ts';
import { TEST_TEAM } from '../../data/testTeams.ts';
import { DECK_RULES } from '../../data/rules.ts';
import { skillCategory } from '../cards/cardTypes.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';

export interface Deck {
  readonly monsters: readonly string[];
  readonly skills: readonly string[];
}

/** カードIDごとの枚数 */
export type CardCounts = Readonly<Record<string, number>>;

export function countCards(ids: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

/** デッキ編集の表の1行：攻撃（ちから・かしこさ）・守り（防御・回避）・計の枚数（特殊とサポートは計だけに入る） */
export interface RoleCounts {
  readonly atk: number;
  readonly guard: number;
  readonly total: number;
}

export function countRoles(ids: readonly string[]): RoleCounts {
  let atk = 0;
  let guard = 0;
  for (const id of ids) {
    const card = cardCatalog.get(id);
    if (card?.kind !== 'skill') continue;
    const c = skillCategory(card);
    if (c === 'force' || c === 'wisdom') atk++;
    else if (c === 'defense' || c === 'evade') guard++;
  }
  return { atk, guard, total: ids.length };
}

export type DeckIssueCode =
  | 'monsterCount'
  | 'duplicateMonster'
  | 'unknownCard'
  | 'notMonster'
  | 'notSkill'
  | 'skillCount'
  | 'tooManyCopies'
  | 'notCompatible'
  | 'notOwned';

export interface DeckIssue {
  readonly code: DeckIssueCode;
  readonly message: string;
}

/**
 * デッキの構成チェック。collection を渡すと所持枚数も確認する。
 * ルールの値は src/data/rules.ts（仮ルール）。
 */
export function validateDeck(deck: Deck, collection?: CardCounts): DeckIssue[] {
  const issues: DeckIssue[] = [];
  const nameOf = (id: string): string => cardName(id);

  if (deck.monsters.length !== DECK_RULES.monsterCount) {
    issues.push({
      code: 'monsterCount',
      message: t('deck.issue.monsterCount', { n: DECK_RULES.monsterCount, current: deck.monsters.length }),
    });
  }
  if (!DECK_RULES.allowDuplicateMonsters && new Set(deck.monsters).size !== deck.monsters.length) {
    issues.push({ code: 'duplicateMonster', message: t('deck.issue.duplicateMonster') });
  }
  for (const id of deck.monsters) {
    const card = cardCatalog.get(id);
    if (!card) issues.push({ code: 'unknownCard', message: t('deck.issue.unknownCard', { id }) });
    else if (card.kind !== 'monster') issues.push({ code: 'notMonster', message: t('deck.issue.notMonster', { name: cardName(card) }) });
  }

  if (deck.skills.length !== DECK_RULES.skillCount) {
    issues.push({
      code: 'skillCount',
      message: t('deck.issue.deckCount', { n: DECK_RULES.skillCount, current: deck.skills.length }),
    });
  }
  const skillCounts = countCards(deck.skills);
  for (const [id, count] of Object.entries(skillCounts)) {
    const card = cardCatalog.get(id);
    if (!card) {
      issues.push({ code: 'unknownCard', message: t('deck.issue.unknownCard', { id }) });
      continue;
    }
    if (card.kind === 'monster') {
      issues.push({ code: 'notSkill', message: t('deck.issue.notSkill', { name: cardName(card) }) });
      continue;
    }
    if (count > DECK_RULES.maxCopies) {
      issues.push({
        code: 'tooManyCopies',
        message: t('deck.issue.tooMany', { name: cardName(card), n: DECK_RULES.maxCopies, current: count }),
      });
    }
    // サポートはどのモンスターのデッキにも入れられる。技はデッキのモンスターの適合技だけ
    if (card.kind === 'skill' && !deck.monsters.includes(card.monsterId)) {
      issues.push({ code: 'notCompatible', message: t('deck.issue.notCompatible', { name: cardName(card) }) });
    }
  }

  if (collection) {
    const all = countCards([...deck.monsters, ...deck.skills]);
    for (const [id, count] of Object.entries(all)) {
      const owned = collection[id] ?? 0;
      if (owned < count) {
        issues.push({ code: 'notOwned', message: t('deck.issue.notOwned', { name: nameOf(id), owned, count }) });
      }
    }
  }
  return issues;
}

export function isDeckValid(deck: Deck, collection?: CardCounts): boolean {
  return validateDeck(deck, collection).length === 0;
}

/**
 * 新しく始めたときのデッキ（仮）：仮モンスターA〜C と、それぞれの技1〜6 を3枚ずつ（54枚）＋仮サポート6枚＝60枚。
 * 同じカードは3枚までなので、技だけでは60枚に届かない分をサポートで埋める。
 */
export const STARTER_MONSTER_KEYS = ['a', 'b', 'c'] as const;
const STARTER_SKILL_NUMBERS = [1, 2, 3, 4, 5, 6] as const;
const STARTER_SUPPORTS = [1, 2, 4] as const;
const STARTER_SUPPORT_COPIES = 2;

export function createPlaceholderStarterDeck(): Deck {
  const skills: string[] = [];
  for (const key of STARTER_MONSTER_KEYS) {
    for (const no of STARTER_SKILL_NUMBERS) {
      for (let i = 0; i < DECK_RULES.maxCopies; i++) skills.push(skillId(key, no));
    }
  }
  for (const no of STARTER_SUPPORTS) {
    for (let i = 0; i < STARTER_SUPPORT_COPIES; i++) skills.push(supportId(no));
  }
  return { monsters: STARTER_MONSTER_KEYS.map(monsterId), skills };
}

/**
 * 【古いセーブの変換用・2026-10-23】ソラモのデッキ（そのときのユーザー指示「技の発動を見るため、仮のカードはすべてソラモに」）。
 * ソラモ3体＋旧ソラモの技16種を3枚ずつ（48枚）＋仮サポート1〜6を2枚ずつ（12枚）＝60枚。
 * 旧ソラモの技（skl-soramo-01〜16）は 2026-10-25 に削除したので、セーブの version 6・7 の変換と、その見分けにだけ使う
 */
const TEST_SORAMO_SUPPORT_COPIES = 2;
export function createSoramoTestDeck(): Deck {
  const skills: string[] = [];
  for (const id of SORAMO_OLD_SKILL_IDS) {
    for (let i = 0; i < DECK_RULES.maxCopies; i++) skills.push(id);
  }
  for (const card of SUPPORTS) {
    for (let i = 0; i < TEST_SORAMO_SUPPORT_COPIES && skills.length < DECK_RULES.skillCount; i++) skills.push(card.id);
  }
  return { monsters: [...SORAMO_TEAM], skills };
}

/**
 * 【古いセーブの変換用・2026-10-23〜24】ソラモとラズックのデッキ（そのときのユーザー指示「仮置きで、ソラモしかいない所にラズックも出して」）。
 * 旧ソラモの技を使うので、セーブの version 7 の変換と、その見分けにだけ使う（新しいデッキは createStarterDeck）。
 * ソラモ・ラズック・ソラモ（TEST_TEAM）＋両方の技16種を1枚ずつ（32枚）＋両方の技01〜08をもう1枚ずつ（16枚）＋仮サポート1〜6を2枚ずつ（12枚）＝60枚。
 * 2026-10-24：ラズックの16種はクロスガードの代わりにいたずら（クロスガードは退役）
 * 正式なスターターデッキの内訳は未承認（これは技を試すための仮の組み合わせ）
 */
const TEST_EXTRA_COPY_UPTO = 8;
export function createMixedTestDeck(): Deck {
  const both = [SORAMO_OLD_SKILL_IDS, LAZUCK_OLD16_IDS];
  const skills: string[] = both.flat();
  // もう1枚ずつ入れるのは、元の番号 01〜08 の技（2026-10-24 にラズックの表示の順が変わっても、ID で同じカードを選ぶ）
  const extra = new Set(Array.from({ length: TEST_EXTRA_COPY_UPTO }, (_, i) => [SORAMO_OLD_SKILL_IDS[i] as string, lazuckSkillId(i + 1)]).flat());
  for (const list of both) skills.push(...list.filter((id) => extra.has(id)));
  for (const card of SUPPORTS) {
    for (let i = 0; i < TEST_SORAMO_SUPPORT_COPIES && skills.length < DECK_RULES.skillCount; i++) skills.push(card.id);
  }
  return { monsters: [...TEST_TEAM], skills };
}

/** 初期デッキの3体目の技の枚数・サポートの枚数（2026-10-25 ユーザー指示：3体分の技45枚＋サポート15枚＝60枚。ソラモ16枚・ラズック16枚） */
export const STARTER_THIRD_SKILLS = 13;
export const STARTER_SUPPORT_COUNT = 15;

/**
 * 新しく始めたときのデッキ（2026-10-26 改訂）。
 * - ソラモ16枚：正式（02・03・04・07・09・10・11・13 を2枚ずつ。src/data/soramo.ts の SORAMO_STARTER）
 * - ラズック16枚：正式（2026-10-26。src/data/lazuck.ts の LAZUCK_STARTER）
 * - 3体目の技13枚・サポート15枚：**未確定**。3体目は決まっていないので、それまでの仮の編成（ソラモ・ラズック・ソラモ）の3体目（ソラモ）の技を【仮】で入れる：
 *   初期配布に入っていないソラモの技を1枚ずつ → 足りない分は初期配布の技をもう1枚ずつ（同じカード3枚まで）。サポートは仮サポート1〜6を順に3枚まで（15枚）
 */
export function createStarterDeck(): Deck {
  const soramo = SORAMO_STARTER.flatMap((s) => Array<string>(s.copies).fill(s.id));
  const lazuck = LAZUCK_STARTER.flatMap((s) => Array<string>(s.copies).fill(s.id));
  const third = TEST_TEAM[2] as string;
  const used = countCards([...soramo, ...lazuck]);
  const pool = skillsOf(third).map((s) => s.id);
  const extra: string[] = [];
  for (const id of [...pool.filter((id) => !used[id]), ...pool.filter((id) => used[id])]) {
    if (extra.length >= STARTER_THIRD_SKILLS) break;
    if ((used[id] ?? 0) < DECK_RULES.maxCopies) {
      used[id] = (used[id] ?? 0) + 1;
      extra.push(id);
    }
  }
  const supports: string[] = [];
  for (let round = 0; round < DECK_RULES.maxCopies && supports.length < STARTER_SUPPORT_COUNT; round++) {
    for (const card of SUPPORTS) if (supports.length < STARTER_SUPPORT_COUNT) supports.push(card.id);
  }
  return { monsters: [...TEST_TEAM], skills: [...soramo, ...lazuck, ...extra, ...supports] };
}

/** 旧スターター（仮モンスターA〜C）と同じ内容の所持カード（テスト用） */
export function createPlaceholderStarterCollection(): Record<string, number> {
  const deck = createPlaceholderStarterDeck();
  return countCards([...deck.monsters, ...deck.skills]);
}

/** 新しく始めたときの所持カード（スターターデッキと同じ内容） */
export function createStarterCollection(): Record<string, number> {
  const deck = createStarterDeck();
  // ノビトンの初期配布16枚（2026-10-26 ユーザー指示）：所持カードにだけ入れる（初期デッキ60枚には入れない・モンスターカード本体は配らない）
  const nobiton = NOBITON_STARTER.flatMap((s) => Array<string>(s.copies).fill(s.id));
  return countCards([...deck.monsters, ...deck.skills, ...nobiton]);
}

/** NPC のデッキに入れる仮サポート（各2枚） */
const NPC_SUPPORTS = [1, 2, 4, 5].map(supportId);
const NPC_SUPPORT_COPIES = 2;

/**
 * NPC（ダンジョンの敵・大会の相手）用のデッキを自動で組む。
 * 仮サポートを少し入れ、残りはモンスターの適合技を順番に、上限枚数を超えないように入れて60枚にする。
 */
export function buildAutoDeck(monsters: readonly string[]): Deck {
  const pool = monsters.flatMap((m) => skillsOf(m).map((s) => s.id));
  const skills: string[] = pool.length === 0 ? [] : NPC_SUPPORTS.flatMap((id) => Array<string>(NPC_SUPPORT_COPIES).fill(id));
  const counts: Record<string, number> = countCards(skills);
  if (pool.length === 0) return { monsters, skills };
  let i = 0;
  while (skills.length < DECK_RULES.skillCount && i < pool.length * DECK_RULES.maxCopies) {
    const id = pool[i % pool.length] as string;
    if ((counts[id] ?? 0) < DECK_RULES.maxCopies) {
      counts[id] = (counts[id] ?? 0) + 1;
      skills.push(id);
    }
    i++;
  }
  // 適合技だけで60枚に届かないとき（技の少ないモンスターなど）は、サポートを上限まで足して埋める
  for (const card of SUPPORTS) {
    while (skills.length < DECK_RULES.skillCount && (counts[card.id] ?? 0) < DECK_RULES.maxCopies) {
      counts[card.id] = (counts[card.id] ?? 0) + 1;
      skills.push(card.id);
    }
  }
  return { monsters, skills };
}

/**
 * 所持カードから、指定モンスター3体で組める一番近いデッキを自動で作る（デッキ編集の「おまかせ」）。
 * 適合技を先に入れ、足りない分を持っているサポートで埋める。それでも足りなければ60枚に満たないデッキを返す（画面側で不足を表示）。
 */
export function buildDeckFromCollection(monsters: readonly string[], collection: CardCounts): Deck {
  return topUpDeck({ monsters, skills: [] }, collection);
}

/**
 * デッキの技・サポートが足りないとき、持っているカードで足す（入っているカードはそのまま。2026-10-24：クロスガードの削除で抜けた分を埋める）。
 * 持っているカードが足りなければ、足りないまま返す
 */
export function topUpDeck(deck: Deck, collection: CardCounts): Deck {
  const skills = [...deck.skills];
  const used: Record<string, number> = countCards(skills);
  // 安い技・攻撃を優先しすぎないよう、番号順に1枚ずつ巡回して入れる（適合技 → サポートの順）
  const fill = (candidates: readonly { readonly id: string }[]): void => {
    let added = true;
    while (skills.length < DECK_RULES.skillCount && added) {
      added = false;
      for (const s of candidates) {
        if (skills.length >= DECK_RULES.skillCount) break;
        const n = used[s.id] ?? 0;
        if (n < DECK_RULES.maxCopies && n < (collection[s.id] ?? 0)) {
          used[s.id] = n + 1;
          skills.push(s.id);
          added = true;
        }
      }
    }
  };
  fill([...new Set(deck.monsters)].flatMap((m) => skillsOf(m)));
  fill(SUPPORTS);
  return { monsters: deck.monsters, skills };
}
