import { cardCatalog, skillsOf } from '../../data/cards.ts';
import { getDungeon } from '../../data/dungeons.ts';
import { DUNGEON_RUN, isRunDungeon, runConfig } from '../../data/dungeonRun.ts';
import { CHEST_RULES, dungeonMoney } from '../../data/economy.ts';
import { ITEM_RULES, type ItemId } from '../../data/items.ts';
import { addItem, canAddItem, consumeItem, itemCount, useItem, type UseItemResult } from '../items/items.ts';
import { nextRandom } from '../rng.ts';
import { addCards, addCoins, NO_RUN_EFFECTS, type Direction, type DungeonRun, type SaveData } from '../save/saveData.ts';
import { generateFloor, isWalkableTile, slide, type DungeonFloor, type FloorEntity, type Point } from './generate.ts';

/**
 * ランダム生成のダンジョンの挑戦（2026-10-26 試作。GB 版のダンジョンを参考に）。DOM に依存しない純粋関数。
 * - 見下ろしで1マスずつ動く。最初は真っ暗で、自分と隣のマス（viewRadius）だけ見える。見たマスは地図に残る
 * - 下りたら上り階段はない。最後の階にボス
 * - 通常のバトラーは話しかけると対戦。見えない番人は姿がなく、近づくと予兆、1歩ごとの抽選で対戦（戦ったあとはしばらく出ない）
 * - 勝つと相手のモンスターの技カードを1枚（画面が選んで渡す）。負けられる回数（maxLosses）負けると、
 *   街の入り口へ戻され、その挑戦で手に入れた技カードを失う。ボスを倒すとクリア
 * 中断して再開できるよう、状態はすべて save.dungeonRun に持つ
 * 道具（2026-10-27）の効き目：たいまつ（見える範囲）・魔除けの香（番人が出ない歩数）・遺跡の地図・身代わりのお守り（負けを1回なかったことに）・
 * 封印の小箱（追い出されても失わない1枚）・幸運のコイン（報酬を候補から選ぶ）・煙玉（番人から逃げる）。使うのは src/game/items/items.ts
 * 2026-10-27 指示書「ダンジョン7つ」：階の数・見える範囲・番人の確率・負けられる回数はダンジョンごと（src/data/dungeonRun.ts の RUN_DUNGEONS）。
 * 仕掛け：すべる床（move ですべる）・スイッチで開く扉（pressSwitch）
 */

/** 階の形を決めるもの（dungeonId が無ければ太古の遺跡） */
type FloorKey = Pick<DungeonRun, 'seed' | 'floor'> & { readonly dungeonId?: string };

/** そのダンジョンの階の数 */
export function floorsOf(dungeonId: string | undefined): number {
  return runConfig(dungeonId).floors;
}

/** そのダンジョンで負けられる回数（天の聖域は2回） */
export function maxLossesOf(dungeonId: string | undefined): number {
  return runConfig(dungeonId).maxLosses;
}

/** 扉が開いているか（機械の塔：その階でスイッチを押した） */
export function doorsOpen(run: Pick<DungeonRun, 'floor' | 'switchFloor'>): boolean {
  return run.switchFloor === run.floor;
}

/** 階の形（同じシード・階なら同じ。作り直しを減らすため、直近に作った階を覚えておく） */
const floorCache = new Map<string, DungeonFloor>();

export function runFloor(run: FloorKey): DungeonFloor {
  const c = runConfig(run.dungeonId);
  const key = `${run.dungeonId ?? ''}:${run.seed}:${run.floor}`;
  let f = floorCache.get(key);
  if (!f) {
    f = generateFloor(run.seed, run.floor, run.floor >= c.floors - 1, DUNGEON_RUN, c.gimmick);
    if (floorCache.size > 8) floorCache.clear();
    floorCache.set(key, f);
  }
  return f;
}

/** いまの見える範囲（ダンジョンごと。たいまつを使った階なら +1：炎の火山は 2 → 3） */
export function viewRadiusOf(run: Pick<DungeonRun, 'floor' | 'torchFloor'> & { readonly dungeonId?: string }): number {
  const base = runConfig(run.dungeonId).viewRadius;
  return run.torchFloor === run.floor ? base + (ITEM_RULES.torchViewRadius - DUNGEON_RUN.viewRadius) : base;
}

export function isLastFloor(run: Pick<DungeonRun, 'floor'> & { readonly dungeonId?: string }): boolean {
  return run.floor >= floorsOf(run.dungeonId) - 1;
}

/** 見たマスに、いまの位置から見えるマスを足す */
export function reveal(explored: string, f: DungeonFloor, p: Point, radius: number = DUNGEON_RUN.viewRadius): string {
  const cells = (explored.length === f.width * f.height ? explored : '0'.repeat(f.width * f.height)).split('');
  for (let y = p.y - radius; y <= p.y + radius; y++) {
    for (let x = p.x - radius; x <= p.x + radius; x++) {
      if (x >= 0 && y >= 0 && x < f.width && y < f.height) cells[y * f.width + x] = '1';
    }
  }
  return cells.join('');
}

export function isExplored(run: DungeonRun, f: DungeonFloor, x: number, y: number): boolean {
  return run.explored[y * f.width + x] === '1';
}

/** いま見えているマスか（自分のまわり viewRadius） */
export function isVisible(run: DungeonRun, x: number, y: number, radius: number = DUNGEON_RUN.viewRadius): boolean {
  return Math.abs(x - run.x) <= radius && Math.abs(y - run.y) <= radius;
}

/** 新しく挑戦を始める（1階のスタート）。location は街の入り口のまま（戻されたときの場所） */
export function startRun(save: SaveData, dungeonId: string, seed: number): SaveData {
  const f = runFloor({ seed, floor: 0, dungeonId });
  const run: DungeonRun = {
    dungeonId,
    seed,
    floor: 0,
    x: f.start.x,
    y: f.start.y,
    dir: 'down',
    explored: reveal('', f, f.start, runConfig(dungeonId).viewRadius),
    defeated: [],
    opened: [],
    losses: 0,
    gained: [],
    cooldown: 0,
    rng: (seed ^ 0x2545f491) | 0,
    ...NO_RUN_EFFECTS,
  };
  return { ...save, activeDungeon: null, dungeonRun: run };
}

/** いまその階にいる（倒されていない・開いていても残る）もの */
export function activeEntities(run: DungeonRun, f: DungeonFloor): FloorEntity[] {
  return f.entities.filter((e) => !((e.kind === 'npc' || e.kind === 'guardian' || e.kind === 'boss') && run.defeated.includes(e.id)));
}

export function entityAt(run: DungeonRun, f: DungeonFloor, x: number, y: number): FloorEntity | undefined {
  return activeEntities(run, f).find((e) => e.x === x && e.y === y && e.kind !== 'guardian');
}

const STEP: Readonly<Record<Direction, Point>> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/** 向いている先のマス */
export function facingPoint(run: DungeonRun): Point {
  const d = STEP[run.dir];
  return { x: run.x + d.x, y: run.y + d.y };
}

export interface MoveResult {
  readonly run: DungeonRun;
  /** 通ったマス（すべる床では2マス以上。進めなかったときは空） */
  readonly path: readonly Point[];
  /** 1マス進んだか（壁・バトラー・宝箱の前では向きだけ変わる） */
  readonly moved: boolean;
  /** 下り階段の上に来た */
  readonly onStairs: boolean;
  /** 見えない番人の気配（近い） */
  readonly omen: boolean;
  /** 見えない番人が対戦を挑んできた */
  readonly guardian: FloorEntity | null;
}

/** 近くの見えない番人（上下左右のマス数の合計がいちばん小さいもの）と、その距離 */
export function nearestGuardian(run: DungeonRun, f: DungeonFloor): { guardian: FloorEntity; distance: number } | null {
  let best: { guardian: FloorEntity; distance: number } | null = null;
  for (const g of activeEntities(run, f).filter((e) => e.kind === 'guardian')) {
    const distance = Math.abs(g.x - run.x) + Math.abs(g.y - run.y);
    if (!best || distance < best.distance) best = { guardian: g, distance };
  }
  return best;
}

/**
 * 十字キーの1歩：向きを変え、通れれば1マス進む（氷の上ではぶつかるまですべる）。進んだら見たマスを広げ、見えない番人の抽選をする。
 * 氷の上（すべり始め・すべっている途中・止まった所）では番人の抽選をしない
 */
export function move(run: DungeonRun, dir: Direction): MoveResult {
  const f = runFloor(run);
  const turned: DungeonRun = { ...run, dir };
  const d = STEP[dir];
  const path = slide(f.tiles, run, d.x, d.y, (x, y) => !!entityAt(run, f, x, y), doorsOpen(run));
  const end = path?.[path.length - 1];
  if (!path || !end) return { run: turned, path: [], moved: false, onStairs: false, omen: nearGuardian(turned, f), guardian: null };
  let explored = run.explored;
  for (const p of path) explored = reveal(explored, f, p, viewRadiusOf(run));
  let next: DungeonRun = { ...turned, x: end.x, y: end.y, explored };
  const onIce = f.tiles[run.y]?.[run.x] === 'i' || path.some((p) => f.tiles[p.y]?.[p.x] === 'i');
  // 見えない番人：魔除けの香が効いている間・戦ったあとの残り歩数があれば出ない。近くにいれば1歩ごとに抽選
  let guardian: FloorEntity | null = null;
  const incense = next.incenseSteps > 0;
  if (incense) next = { ...next, incenseSteps: next.incenseSteps - 1 };
  if (next.cooldown > 0) {
    next = { ...next, cooldown: next.cooldown - 1 };
  } else if (!incense && !onIce) {
    const near = nearestGuardian(next, f);
    if (near && near.distance <= DUNGEON_RUN.guardianEncounterRange) {
      const r = nextRandom(next.rng);
      next = { ...next, rng: r.seed };
      if (r.value < runConfig(run.dungeonId).guardianRate) guardian = near.guardian;
    }
  }
  const onStairs = !!f.stairs && f.stairs.x === end.x && f.stairs.y === end.y;
  return { run: next, path, moved: true, onStairs, omen: nearGuardian(next, f), guardian };
}

/** スイッチを調べた（機械の塔）：その階の扉が開く。もう開いていれば何もしない（opened: false） */
export function pressSwitch(run: DungeonRun): { run: DungeonRun; opened: boolean } {
  if (doorsOpen(run)) return { run, opened: false };
  return { run: { ...run, switchFloor: run.floor }, opened: true };
}

/** 見えない番人の予兆を出すか（近くにいて、戦ったあとの休みでなく、魔除けの香が効いていない） */
export function nearGuardian(run: DungeonRun, f: DungeonFloor): boolean {
  if (run.cooldown > 0 || run.incenseSteps > 0) return false;
  const near = nearestGuardian(run, f);
  return !!near && near.distance <= DUNGEON_RUN.guardianOmenRange;
}

/** ダンジョンの中で道具を使う（src/game/items/items.ts の useItem）。たいまつは使ったその場で、広がった範囲を見たことにする */
export function useDungeonItem(save: SaveData, id: ItemId, sealCard?: string): UseItemResult {
  const r = useItem(save, id, sealCard);
  const run = r.save.dungeonRun;
  if (r.status !== 'ok' || id !== 'torch' || !run) return r;
  const f = runFloor(run);
  return { ...r, save: { ...r.save, dungeonRun: { ...run, explored: reveal(run.explored, f, run, viewRadiusOf(run)) } } };
}

/** 下の階へ（上り階段はないので戻れない） */
export function descend(run: DungeonRun): DungeonRun {
  if (isLastFloor(run)) return run;
  const floor = run.floor + 1;
  const f = runFloor({ seed: run.seed, floor, dungeonId: run.dungeonId });
  // たいまつ・遺跡の地図は下りると切れる（使った階を覚えているので、別の階では効かない）
  return { ...run, floor, x: f.start.x, y: f.start.y, dir: 'down', explored: reveal('', f, f.start, viewRadiusOf({ ...run, floor })) };
}

/**
 * 【仮】宝箱の中身（2026-10-28 指示書「お金の入る側」。割合・道具・お金の範囲は src/data/economy.ts の CHEST_RULES・DUNGEON_MONEY）。
 * 中身は開けたときに、挑戦の種（seed）と宝箱の ID から決める（セーブとロードを繰り返しても選び直せない）。
 * - coins：お金。item：道具（持ちきれないときは coins のお金に替える）。card：ボスの切り札のモンスターの技カード
 */
export type ChestRoll =
  | { readonly kind: 'coins'; readonly coins: number }
  | { readonly kind: 'item'; readonly item: ItemId; readonly coins: number }
  | { readonly kind: 'card'; readonly card: string };

/** 文字列から決まった数を作る（FNV-1a） */
function hashText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

/** そのダンジョンのボスの切り札のモンスター（初回クリアでもらえるモンスターカード）の技カード */
export function bossTrumpSkills(dungeonId: string): string[] {
  const monster = (getDungeon(dungeonId)?.firstClearCards ?? []).find((c) => cardCatalog.get(c.cardId)?.kind === 'monster')?.cardId;
  return monster ? skillsOf(monster).map((k) => k.id) : [];
}

/** 宝箱の中身を決める（同じダンジョン・seed・宝箱の ID なら、いつも同じ） */
export function rollChest(dungeonId: string, seed: number, chestId: string): ChestRoll {
  let rng = nextRandom(hashText(`${dungeonId}:${seed}:${chestId}`)).seed;
  const next = (): number => {
    const r = nextRandom(rng);
    rng = r.seed;
    return r.value;
  };
  const kindRoll = next() * 100;
  const [min, max] = dungeonMoney(dungeonId).chest;
  const steps = Math.floor((max - min) / CHEST_RULES.coinStep) + 1;
  const coins = min + Math.floor(next() * steps) * CHEST_RULES.coinStep;
  const pick = next();
  const { coins: coinRate, item: itemRate } = CHEST_RULES.rates;
  if (kindRoll < coinRate) return { kind: 'coins', coins };
  if (kindRoll < coinRate + itemRate) return { kind: 'item', item: CHEST_RULES.items[Math.floor(pick * CHEST_RULES.items.length)] as ItemId, coins };
  const skills = bossTrumpSkills(dungeonId);
  if (skills.length === 0) return { kind: 'coins', coins };
  return { kind: 'card', card: skills[Math.floor(pick * skills.length)] as string };
}

/** 宝箱を開けたときに手に入れたもの（道具が持ちきれずにお金に替えたときは overflowItem） */
export type ChestContent =
  | { readonly kind: 'coins'; readonly coins: number; readonly overflowItem?: ItemId }
  | { readonly kind: 'item'; readonly item: ItemId }
  | { readonly kind: 'card'; readonly card: string };

/**
 * 宝箱を開ける（1度だけ）。中身（rollChest）を手に入れる：お金・道具はそのまま持ち物に（3回負けて戻されてもなくさない）。
 * 技カードは勝ってもらった技カードと同じ扱い（この挑戦の獲得に入れる。戻されたら失う。封印の小箱で守れる）
 */
export function openRunChest(save: SaveData, chestId: string): { save: SaveData; opened: boolean; content: ChestContent | null } {
  const run = save.dungeonRun;
  if (!run || run.opened.includes(chestId)) return { save, opened: false, content: null };
  const roll = rollChest(run.dungeonId, run.seed, chestId);
  const opened: DungeonRun = { ...run, opened: [...run.opened, chestId] };
  if (roll.kind === 'card') {
    return { save: { ...addCards(save, [{ cardId: roll.card, count: 1 }]), dungeonRun: { ...opened, gained: [...opened.gained, roll.card] } }, opened: true, content: roll };
  }
  if (roll.kind === 'item' && canAddItem(save, roll.item)) {
    return { save: { ...addItem(save, roll.item), dungeonRun: opened }, opened: true, content: { kind: 'item', item: roll.item } };
  }
  const content: ChestContent = roll.kind === 'item' ? { kind: 'coins', coins: roll.coins, overflowItem: roll.item } : roll;
  return { save: { ...addCoins(save, roll.coins), dungeonRun: opened }, opened: true, content };
}

export type BattleTargetKind = 'npc' | 'guardian' | 'boss';

export interface RunVictory {
  readonly save: SaveData;
  /** ボスを倒してクリアした */
  readonly cleared: boolean;
  readonly firstClear: boolean;
  /** もらったお金（バトラー・番人は1勝ごとのお金、ボスはクリアのお金。src/data/economy.ts の DUNGEON_MONEY） */
  readonly coins: number;
  /** クリアでもらったカード（初めてのクリアだけ。仮のジオル） */
  readonly clearCards: readonly { cardId: string; count: number }[];
}

/**
 * 対戦に勝った：相手を倒したことにし、技カード（card。画面が相手のモンスターの技から選ぶ）を所持カードに足して、この挑戦の獲得に記録する。
 * お金（2026-10-28 指示書「お金の入る側」）：バトラー・見えない番人は1勝ごとのお金をその場で所持金に入れる（幸運のコインで選ぶ勝ちも同じ）。
 * 見えない番人なら、しばらく番人が出てこない。ボスならクリア（挑戦を終える。ボスのお金と、初めてのときのカード）
 */
export function winRunBattle(save: SaveData, target: { kind: BattleTargetKind; id: string }, card: string | null): RunVictory {
  const run = save.dungeonRun;
  if (!run) return { save, cleared: false, firstClear: false, coins: 0, clearCards: [] };
  let next: SaveData = card ? addCards(save, [{ cardId: card, count: 1 }]) : save;
  const updated: DungeonRun = {
    ...run,
    defeated: run.defeated.includes(target.id) ? run.defeated : [...run.defeated, target.id],
    gained: card ? [...run.gained, card] : run.gained,
    cooldown: target.kind === 'guardian' ? DUNGEON_RUN.guardianCooldownSteps : run.cooldown,
  };
  const money = dungeonMoney(run.dungeonId);
  if (target.kind !== 'boss') return { save: { ...addCoins(next, money.win), dungeonRun: updated }, cleared: false, firstClear: false, coins: money.win, clearCards: [] };
  const record = next.dungeons[run.dungeonId] ?? { openedChests: [], bossDefeated: false, clears: 0 };
  const firstClear = !record.bossDefeated;
  const coins = firstClear ? money.bossFirst : money.bossRepeat;
  const clearCards = firstClear ? (getDungeon(run.dungeonId)?.firstClearCards ?? []) : [];
  next = addCards(addCoins(next, coins), clearCards);
  next = {
    ...next,
    dungeonRun: null,
    dungeons: { ...next.dungeons, [run.dungeonId]: { ...record, bossDefeated: true, clears: record.clears + 1 } },
  };
  return { save: next, cleared: true, firstClear, coins, clearCards };
}

/**
 * 幸運のコインが効いているときの勝ち（バトラー・番人）：相手を倒したことにして、報酬は候補（choices）から選ぶのを待つ（rewardChoice）。
 * コインの効き目はここで終わる。選ぶのは chooseRunReward
 */
export function winRunBattleChoosing(save: SaveData, target: { kind: BattleTargetKind; id: string }, choices: readonly string[]): SaveData {
  const r = winRunBattle(save, target, null);
  const run = r.save.dungeonRun;
  if (!run || r.cleared) return r.save;
  return { ...r.save, dungeonRun: { ...run, luckyCoin: false, rewardChoice: [...choices] } };
}

/** 幸運のコインの候補から1枚選んだ：所持カードに足して、この挑戦の獲得に記録する */
export function chooseRunReward(save: SaveData, card: string): SaveData {
  const run = save.dungeonRun;
  if (!run?.rewardChoice || !run.rewardChoice.includes(card)) return save;
  return { ...addCards(save, [{ cardId: card, count: 1 }]), dungeonRun: { ...run, rewardChoice: null, gained: [...run.gained, card] } };
}

/** 幸運のコインで報酬を選ぶか（効いていて、ボスでなく、別々の候補が2枚以上ある） */
export function usesLuckyCoin(run: DungeonRun | null, kind: BattleTargetKind, candidates: readonly string[]): boolean {
  return !!run?.luckyCoin && kind !== 'boss' && new Set(candidates).size >= ITEM_RULES.luckyCoinChoices;
}

/** 候補から別々のカードを n 枚えらぶ（random は 0 以上 1 未満を返す関数） */
export function pickRewardChoices(candidates: readonly string[], n: number, random: () => number): string[] {
  const pool = [...new Set(candidates)];
  const picked: string[] = [];
  while (picked.length < n && pool.length > 0) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0] as string);
  return picked;
}

/**
 * 煙玉で見えない番人から逃げる：煙玉を1つ使い、番人と戦ったときと同じく、しばらく番人が出ない。
 * 負けの回数は増えず、カードはもらえず、番人は倒したことにならない。煙玉を持っていなければ何もしない（null）
 */
export function escapeGuardian(save: SaveData): SaveData | null {
  const run = save.dungeonRun;
  if (!run || itemCount(save, 'smokeBall') <= 0) return null;
  return { ...consumeItem(save, 'smokeBall'), dungeonRun: { ...run, cooldown: DUNGEON_RUN.guardianCooldownSteps } };
}

export interface RunDefeat {
  readonly save: SaveData;
  /** 負けられる回数に達して、街の入り口へ戻された */
  readonly expelled: boolean;
  /** 戻されて失った技カード */
  readonly lostCards: readonly string[];
  /** あと何回負けられるか（戻されたら 0） */
  readonly lossesLeft: number;
  /** 身代わりのお守りが身代わりになった（負けの回数は増えていない） */
  readonly charmSaved: boolean;
  /** 封印の小箱で守って、戻されても失わなかった技カード */
  readonly keptCard: string | null;
}

/**
 * 対戦に負けた：負けた回数を1つ増やす（見えない番人なら、しばらく番人が出てこない）。
 * 負けられる回数に達したら、この挑戦で手に入れた技カードを所持カードから外し、挑戦を終える（位置は街の入り口のまま）
 */
export function loseRunBattle(save: SaveData, target: { kind: BattleTargetKind; id: string }): RunDefeat {
  const run = save.dungeonRun;
  if (!run) return { save, expelled: false, lostCards: [], lossesLeft: 0, charmSaved: false, keptCard: null };
  const cooldown = target.kind === 'guardian' ? DUNGEON_RUN.guardianCooldownSteps : run.cooldown;
  // 身代わりのお守り：負けの回数を増やさずにお守りが消える
  if (run.charm) {
    return {
      save: { ...save, dungeonRun: { ...run, charm: false, cooldown } },
      expelled: false,
      lostCards: [],
      lossesLeft: maxLossesOf(run.dungeonId) - run.losses,
      charmSaved: true,
      keptCard: null,
    };
  }
  const losses = run.losses + 1;
  if (losses < maxLossesOf(run.dungeonId)) {
    const updated: DungeonRun = { ...run, losses, cooldown };
    return { save: { ...save, dungeonRun: updated }, expelled: false, lostCards: [], lossesLeft: maxLossesOf(run.dungeonId) - losses, charmSaved: false, keptCard: null };
  }
  // 封印の小箱で守った1枚は失わない（同じカードを2枚以上手に入れていても、守るのは1枚）。道具は失わない（save.items はそのまま）
  const lost = [...run.gained];
  const keep = run.sealedCard !== null ? lost.indexOf(run.sealedCard) : -1;
  const keptCard = keep >= 0 ? (lost.splice(keep, 1)[0] as string) : null;
  const collection: Record<string, number> = { ...save.collection };
  for (const id of lost) {
    const n = (collection[id] ?? 0) - 1;
    if (n > 0) collection[id] = n;
    else delete collection[id];
  }
  return { save: { ...save, collection, dungeonRun: null }, expelled: true, lostCards: lost, lossesLeft: 0, charmSaved: false, keptCard };
}

/**
 * ボスに勝ったときにもらう技カードの候補。ふつうは相手が使っていたモンスターの技（rewardCandidates）。
 * 切り札の報酬のダンジョン（dungeons.ts の trumpReward：太古の遺跡）は、初めてのクリアでは無し（祭壇のモンスターカードだけ）、2回目からは切り札のモンスターの技
 */
export function bossRewardCandidates(save: SaveData, dungeonId: string, monsterIds: readonly string[]): string[] {
  if (!getDungeon(dungeonId)?.trumpReward) return rewardCandidates(monsterIds, skillsOf);
  return save.dungeons[dungeonId]?.bossDefeated ? bossTrumpSkills(dungeonId) : [];
}

/** 勝ったときにもらう技カードの候補（相手が使っていたモンスターの技） */
export function rewardCandidates(monsterIds: readonly string[], skillsOf: (monsterId: string) => readonly { id: string }[]): string[] {
  return [...new Set(monsterIds)].flatMap((m) => skillsOf(m).map((s) => s.id));
}

/** 対戦の相手が通れないもの（バトラー・ボス）か */
export function isBattler(e: FloorEntity): boolean {
  return e.kind === 'npc' || e.kind === 'boss';
}

/**
 * 読み込んだ挑戦を確かめる（壊れたセーブ・数値を変えたあとのセーブでも遊べるように）。
 * 知らないダンジョンなら挑戦をやめる（null）。階が多すぎれば最後の階、立っている所が床でなければその階のスタートへ
 */
export function sanitizeRun(run: DungeonRun): DungeonRun | null {
  if (!isRunDungeon(run.dungeonId)) return null;
  const floor = Math.min(run.floor, floorsOf(run.dungeonId) - 1);
  const f = runFloor({ seed: run.seed, floor, dungeonId: run.dungeonId });
  const fixed: DungeonRun = { ...run, floor, losses: Math.min(run.losses, maxLossesOf(run.dungeonId) - 1) };
  const onFloor = isWalkableTile(f.tiles[fixed.y]?.[fixed.x], doorsOpen(fixed)) && !entityAt(fixed, f, fixed.x, fixed.y);
  const at = onFloor && floor === run.floor ? { x: fixed.x, y: fixed.y } : f.start;
  return { ...fixed, x: at.x, y: at.y, explored: reveal(floor === run.floor ? fixed.explored : '', f, at, viewRadiusOf(fixed)) };
}
