import { cardCatalog, getMonster, getPlayCard, getSkill } from '../../data/cards.ts';
import { OVERDRIVE_CHOICE, OVERDRIVE_COMBO_ID, OVERDRIVE_IDS } from '../../data/gearos.ts';
import { BATTLE_RULES } from '../../data/rules.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import {
  guardAgainst,
  guardMaxCost,
  guardMinCost,
  guardReduction,
  skillValue,
  statLabel,
  targetsEnemy,
  type Habitat,
  type PlayCard,
  type SkillCard,
  type StatType,
  type SupportCard,
} from '../cards/cardTypes.ts';
import type { Deck } from '../deck/deck.ts';
import { nextInt, nextRandom, shuffle } from '../rng.ts';

/**
 * カードバトルのルール（DOM 非依存の純粋関数）。
 *
 * 【仮実装】指示書の構成（双方モンスター3体・ライフ・手札・マナ・攻撃/防御・対象選択・使用不可状態・
 * ターン進行・勝敗）に沿っているが、数値と細部は src/data/rules.ts の仮ルール。正式ルール資料が届いたら合わせる。
 */
export type Side = 'player' | 'opponent';

/** 陣営の呼び名（いまの言語。「あなた」「相手」） */
export function sideLabel(side: Side): string {
  return t(`battle.side.${side}`);
}

export function otherSide(side: Side): Side {
  return side === 'player' ? 'opponent' : 'player';
}

export interface BattleMonster {
  readonly uid: string;
  readonly cardId: string;
  readonly maxLife: number;
  readonly life: number;
  /** このターンに技を使ったか */
  readonly acted: boolean;
  /**
   * 次に使う stat の技のダメージを amount 減らす（正式：吠える）。使ったら消える。
   * untilTurn があれば、その手番が過ぎたら効かない（正式：ガウルの熱風の威嚇「次のターンまで」）
   */
  readonly weaken?: { readonly stat: StatType; readonly amount: number; readonly untilTurn?: number } | null;
  /** この手番（turn）の間は攻撃の技を使えない（正式：すなかけ） */
  readonly sealedTurn?: number | null;
  /** この手番（turn）の間だけ、stat の技のダメージを amount 減らす（正式：ラズックのダストキック。吠えると違い、使っても消えず、手番が過ぎたら効かない） */
  readonly weakenTurn?: { readonly stat: StatType; readonly amount: number; readonly turn: number } | null;
  /** この手番（turn）の間は、monsterId の種類のモンスターにしか攻撃できない（正式：ラズックのちょうはつ） */
  readonly taunt?: { readonly monsterId: string; readonly turn: number } | null;
  /** この手番（turn）の間は技を使えない（攻撃も特殊も。正式：ノビトンのまきつく「次ターン行動不可」2026-10-25。守備のカードは使える） */
  readonly stunnedTurn?: number | null;
  /** 行動不可を付けた技の印（'frozen'＝ヒョウズクの技で凍った。null・無し＝まきつく。印の絵を分けるだけで、決まりは同じ。2026-10-30 指示書 X） */
  readonly stunMark?: 'frozen' | null;
  /**
   * 受ける against の技のダメージを reduce 減らす。untilTurn の手番が終わるまで（正式：ミュロルのしめったはだ 2026-10-25。
   * 使った手番を含む2手番＝相手の次の手番まで）。重ねがけはしない
   */
  readonly shield?: { readonly against: StatType | 'all'; readonly reduce: number; readonly untilTurn: number } | null;
  /** この手番（turn）の間は攻撃の技の対象にならない（正式：カルシェルのすなをほる「次のターン攻撃対象にならない」2026-10-27） */
  readonly hiddenTurn?: number | null;
  /** 次に使う攻撃技のダメージ＋（試遊中：プカリムのほっぺにためる 2026-10-28）。使うまで続く。攻撃技を使ったら・倒れたら消える */
  readonly charge?: number | null;
  /** とおぼえ（ロウガ 指示書 BL）：charge がこの手番の終わりまでで消える（期限つき）。ほっぺにためるは null（使うまで続く） */
  readonly chargeUntil?: number | null;
  /**
   * はねやすめ（フギン 2026-11-06 指示書 BM）の印：このあとこのモンスターが回避の技を1回使うとき、その技のマナが0。
   * 使ったら消える。期限なし。重ねない。倒れたら消える
   */
  readonly featherRest?: boolean | null;
  /**
   * 攻撃技のダメージ＋amount（プカリムのおいかぜ。2026-10-29 ユーザー指示でカードの文のとおりに）。効くのは turn の手番（かけた側の次の自分の手番）だけ。
   * その手番にそのモンスターが攻撃技を1回使ったら消え、使わなくてもその手番が終わったら効かない。倒れたら消える
   */
  readonly tailwind?: { readonly amount: number; readonly turn: number } | null;
  /** そなえのふえ（フォルン 2026-11-02 指示書 AL）：untilTurn の手番が終わるまで、受ける攻撃のダメージ−reduce（ちから技・かしこさ技どちらも）。倒れたら消える */
  readonly ward?: { readonly reduce: number; readonly untilTurn: number } | null;
  /** この手番（turn）に受ける次の攻撃1回を回避できない（試遊中：ジオルのじならし 2026-10-29）。攻撃を1回受けたら・倒れたら消える */
  readonly pinTurn?: number | null;
  /**
   * 効く手番（turn。かけた側の次の自分の手番）に最初に使うかしこさ技1回だけダメージ2倍（試遊中：ジオルのエネルギーをためる 2026-10-29）。
   * かしこさ技を使ったら消え、使わなくてもその手番が終わったら効かない。倒れたら消える。ちから技では消えない
   */
  readonly energy?: { readonly turn: number } | null;
  /**
   * 竜のまなざし（2026-11-05 指示書 AX：タイラント）：効く手番（turn。かけた側の次の自分の手番）に、このモンスターが最初に使う攻撃1回は回避されない。
   * 攻撃を使ったら消え、使わなくてもその手番が終わったら効かない。重ねない。倒れたら消える
   */
  readonly dragonGaze?: { readonly turn: number } | null;
  /** 竜のちから（2026-11-05 指示書 AX：タイラント）：竜のまなざしと同じ形で、最初に使う攻撃1回は防御されない（かばうも使えない） */
  readonly dragonMight?: { readonly turn: number } | null;
  /** このターン（turn）に次に使う攻撃技のダメージ＋amount（2026-10-30 指示書 Y：声援）。攻撃を1回使うか、ターンが終わったら効かない。倒れたら消える */
  readonly cheer?: { readonly amount: number; readonly turn: number } | null;
  /**
   * 効く手番（turn。かけた側の次の自分の手番）の間、このモンスターの攻撃技の消費マナ−discount（正式：ツムジのかぜのり 2026-10-30）。
   * 0より下にはならない。重ねない。その手番が終わったら効かない。倒れたら消える
   */
  readonly windRide?: { readonly discount: number; readonly turn: number } | null;
  /**
   * この手番（turn）に、続けて使える技（cardId）をもう1回使える（正式：ツムジの Wひっかき 2026-10-30）。
   * 「1体1ターン1回」のただ1つの例外：その手番の最初の技が続けて使える技のときに付き、2回目を使ったら消える（1ターンに最大2回）
   */
  readonly chain?: { readonly turn: number; readonly cardId: string } | null;
  /**
   * ひきずりこむ（2026-11-06 指示書 BK：クロシオ）：untilTurn の手番が終わるまで、このモンスターは水中（habitatOf）。
   * 使った側の次の自分の手番の終わりまで（みちしおと同じ数え方）。重ねない（もう一度当たったら期限を数え直す）。
   * 場のカードより強い（場が地上・空中でも水中のまま）。悪い状態（おはらいで消せる・まよけのふだで防ぐ）。倒れたら消える
   */
  readonly dragUnder?: { readonly untilTurn: number } | null;
  /**
   * おたけび（2026-11-07 指示書 BP：ベニオウ）：untilTurn の手番が終わるまで、このモンスターが次に使うちから技のダメージ2倍。
   * ちから技を使ったら消える（かしこさ技では消えない）。重ねない（期限を数え直す）。倒れたら消える
   */
  readonly roar?: { readonly untilTurn: number } | null;
  /**
   * おにのいあつ（2026-11-07 指示書 BP：ベニオウ）：untilTurn の手番が終わるまで、このモンスターは回避の技を使えない（防御は使える）。
   * 悪い状態（おはらいで消せる・まよけのふだの間はつかない）。重ねない（期限を数え直す）。倒れたら消える
   */
  readonly menace?: { readonly untilTurn: number } | null;
}

export interface HandCard {
  readonly uid: string;
  readonly cardId: string;
}

export interface BattleSide {
  readonly name: string;
  readonly monsters: readonly BattleMonster[];
  /** 山札（先頭が一番上） */
  readonly deck: readonly string[];
  readonly hand: readonly HandCard[];
  readonly discard: readonly string[];
  /** マナにしたカード（積んだ順。先頭が一番古い）。マナの量＝枚数 */
  readonly manaPile: readonly string[];
  /** このターンに使ったサポートの回数（回数制限のまとまりごと）。ターン開始で空に戻す */
  readonly turnUsage: Readonly<Record<string, number>>;
  /**
   * まよけのふだ（2026-11-05 指示書 BH：クヨウ）：untilTurn の手番が終わるまで、この側の味方全員に悪い状態（badStatusKinds）がつかない。
   * 使った手番＋次の相手の手番。重ねて使っても延びない。クヨウが倒れても残る
   */
  readonly wardCharm?: { readonly untilTurn: number } | null;
  /**
   * しゅうちゅう（2026-11-07 指示書 BQ：ステラード）：untilTurn の手番が終わるまで、この側はマナを減らす効果を受けない。
   * プレイヤー全体にかかる（使ったモンスター ownerUid が倒れても残る。印は ownerUid のモンスター〔倒れていれば生きている味方〕に出す）
   */
  readonly focus?: { readonly untilTurn: number; readonly ownerUid: string } | null;
}

/**
 * 場（場の枠は1つだけ。2026-11-01 指示書 AJ の追加その3・ユーザー決定）。サポートの場のカード（重い空気・守りの陣 など）も、みちしおの水中も、
 * これから入れる場のカード（場を地上・空中・水中にする など）も同じ1つの枠を使い、新しい場が出たら前の場は上書きされる（期限もそこから数え直す）。
 * 場の種類と効果は cardId のカード（サポートの場のカード、または みちしお などの技）から、だれが出したかは owner
 */
export interface FieldCard {
  /** 場を出したカード（サポートの場のカード、またはみちしお などの技） */
  readonly cardId: string;
  /** だれが出したか */
  readonly owner: Side;
  /** 場の居場所（場全体をその居場所として扱う。みちしお＝水中）。無ければ居場所は変えない */
  readonly habitat?: Habitat;
  /** 期限：この手番の終わりまで（無ければ、ほかの場に上書きされるまで続く） */
  readonly untilTurn?: number;
}

/** いまのマナの量 */
export function manaOf(side: BattleSide): number {
  return side.manaPile.length;
}

/** 守備待ちの攻撃 */
export interface PendingAttack {
  readonly attacker: Side;
  readonly userUid: string;
  readonly targetUid: string;
  readonly cardId: string;
  readonly stat: StatType;
  /** 攻撃の威力（場の全体カードの増減を反映した値） */
  readonly power: number;
  /** 守備側がこの攻撃に使ったカード（使った順）。守備がすべて終わってからまとめてダメージを計算する */
  readonly responses: readonly string[];
  /** この攻撃は回避されない（試遊中：ほっぺにためているときのぷはーっ。カードの「回避されない」とは別に、使ったときの状態で決まる） */
  readonly undodgeable?: boolean;
  /** いま狙われているモンスターは、じならしでこの攻撃を回避できない（試遊中：ジオル 2026-10-29。狙われたモンスターが変わったら決め直す） */
  readonly pinned?: boolean;
  /** 相手全体への攻撃（試遊中：ジオルの地ひびき）で、このあとに守りの順が来る相手（uid。左から順） */
  readonly queue?: readonly string[];
  /** かばうで狙いが変わったとき、もとの狙われたモンスター（uid。試遊中：ジオルのかばう） */
  readonly coveredFrom?: string;
  /** みがわり（2026-11-05 指示書 BH：クヨウ）で代わりに受けたとき、受けるダメージをさらに減らす量（守りのあとに引く。0 未満にしない） */
  readonly coverReduce?: number;
  /** エネルギーをためるで2倍になった攻撃（記録・試遊の数え用） */
  readonly energized?: boolean;
  /** 竜のまなざし（指示書 AX）がかかった攻撃：回避されない（相手全員への攻撃なら、どの相手にも） */
  readonly dragonGaze?: boolean;
  /** 竜のちから（指示書 AX）がかかった攻撃：防御されない（かばうも使えない。相手全員への攻撃なら、どの相手にも） */
  readonly dragonMight?: boolean;
  /**
   * 相手全体への攻撃で、相手がいま空中かどうかで威力が変わるとき（おおたつまき 2026-11-02 指示書 AS）：空中でない相手・空中の相手への威力。
   * 相手が替わるたびに、その相手の居場所で power を決め直す（使ったときの状態で計算した値）
   */
  readonly allPower?: { readonly base: number; readonly air: number };
}

/** main＝技を使う（攻撃）、defense＝相手の防御待ち、mana＝攻撃のあとのマナ化 */
export type BattlePhase = 'main' | 'defense' | 'mana' | 'ended';
export type BattleWinner = Side | 'draw';

export interface LogEntry {
  readonly turn: number;
  readonly text: string;
}

/**
 * 効果音を鳴らすきっかけ（ルール上の結果が確定した瞬間に1件ずつ記録する。画面は seq で「まだ鳴らしていない分」だけ鳴らす）
 * - manaSpend：マナを支払った（1回の支払いで1件。何枚でも1件）
 * - manaConvert：手札のカードをマナにした（マナ化。1枚につき1件）
 * - manaGain：山札からマナが増えた（手札5枚のときのドロー・カードの効果。1回で1件）
 * - evade：回避が成功してダメージ0が確定した
 * - hit：攻撃が命中してダメージを与えた（strong＝強攻撃。いまは仮に「必要マナ3以上の技」）
 * - recoil：技の反動で使ったモンスターのライフが減った（正式：すてみタックル）
 * 防御でダメージ0になったときは記録しない（防御の音は未承認のため無音）
 */
export type BattleFxKind = 'manaSpend' | 'manaConvert' | 'manaGain' | 'evade' | 'hitNormal' | 'hitStrong' | 'recoil';
export interface BattleFx {
  readonly seq: number;
  readonly kind: BattleFxKind;
  readonly side: Side;
}

/** 強攻撃（命中の音を「強」にする）とみなす必要マナ。仮の基準（ユーザー指定 2026-10-22。正式な技が決まったら見直す） */
export const STRONG_ATTACK_COST = 3;

export interface BattleState {
  readonly seed: number;
  /** 手番の通し番号（1から） */
  readonly turn: number;
  readonly active: Side;
  readonly first: Side;
  readonly phase: BattlePhase;
  readonly pending: PendingAttack | null;
  readonly sides: Readonly<Record<Side, BattleSide>>;
  /** 場（場の枠は1つだけ。サポートの場のカード・みちしおの水中など。なければ null） */
  readonly field: FieldCard | null;
  readonly winner: BattleWinner | null;
  /** knockout＝3体KO、deckOut＝引くべきカードを引けなかった（山札切れ） */
  readonly endReason: 'knockout' | 'deckOut' | null;
  /** このターンにあと何枚マナにできるか（null＝制限なし。先攻1ターン目だけ制限あり） */
  readonly manaConvertLimit: number | null;
  readonly log: readonly LogEntry[];
  readonly nextUid: number;
  /** 効果音のきっかけ（新しい順に最大20件だけ残す） */
  readonly fx: readonly BattleFx[];
  readonly fxSeq: number;
  /**
   * 手札の確認（正式：ノビトンの不思議な嗅覚 2026-10-25）。viewer が cardIds（相手の手札）を見た。
   * 画面は seq が変わったときだけ表を見せる（手札そのものは動かさない。ふだん相手の手札は裏向きのまま）
   */
  readonly reveal?: { readonly seq: number; readonly viewer: Side; readonly cardIds: readonly string[] } | null;
  /** カラスのめ（2026-10-31 指示書 AG）で最後に捨てさせたカード（画面が CPU のふきだしで知らせる。seq で同じものを2度出さない） */
  readonly crowEye?: { readonly seq: number; readonly chooser: Side; readonly cardId: string } | null;
  /**
   * システムチェック（2026-11-05 指示書 AX：ギアロス）。viewer が自分の山札の上（cardIds。上から順）を見た。使った人の画面だけが表を見せる
   * （相手の画面には「山札の上を確かめた」の記録だけ）。山札は動かさない
   */
  readonly deckPeek?: { readonly seq: number; readonly viewer: Side; readonly cardIds: readonly string[] } | null;
}

export type BattleAction =
  | {
      readonly type: 'useCard';
      readonly side: Side;
      readonly cardUid: string;
      /** 技を使うモンスター（省略時は使えるモンスターを自動で選ぶ。サポートには不要） */
      readonly userUid?: string;
      /** 対象（攻撃：相手モンスター、回復：味方モンスター） */
      readonly targetUid?: string;
      /** 選んだカード（2026-10-30 指示書 Y：思い出の箱＝捨て札の技カードの ID、風まかせ＝山札に戻す手札の uid） */
      readonly choice?: string;
    }
  /** note（2026-10-30 指示書 Z）：腕前 C の CPU が守れるのに守らなかったとき 'misguard'（2026-10-31 指示書 AB から記録には書かず、画面が相手のセリフをふきだしで出す。src/data/cpuLines.ts） */
  | { readonly type: 'defend'; readonly side: Side; readonly cardUid: string | null; readonly note?: 'misguard' }
  /** 攻撃を終えてマナ化へ進む。note：腕前 C の CPU が攻撃を見送ったとき 'hesitate'（2026-10-30 指示書 Z。2026-10-31 指示書 AB から記録には書かず、画面が相手のセリフをふきだしで出す） */
  | { readonly type: 'endAttack'; readonly side: Side; readonly note?: 'hesitate' }
  /** マナ化：手札1枚をマナにする（マナ化の間は何回でも） */
  | { readonly type: 'convertToMana'; readonly side: Side; readonly cardUid: string }
  | { readonly type: 'endTurn'; readonly side: Side };

export interface CombatantSetup {
  readonly name: string;
  readonly deck: Deck;
  /** ライフ倍率（敵の強さ調整・仮） */
  readonly lifeScale?: number;
  /**
   * 最初の手札に必ず1枚入れるカード（このうちのどれか1枚。2026-11-05 ユーザー決定：テオの α・β・γ。ボスだけの決まり）。
   * シャッフルしたあと、山札でいちばん上に近い1枚を山札のいちばん上へ動かすだけ（山札の枚数は変えない）
   */
  readonly openingAny?: readonly string[];
}

/* ---------- 開始 ---------- */

function makeMonsters(prefix: string, ids: readonly string[], scale: number): BattleMonster[] {
  return ids.map((cardId, i) => {
    const maxLife = Math.max(1, Math.round(getMonster(cardId).life * scale));
    return { uid: `${prefix}-m${i + 1}`, cardId, maxLife, life: maxLife, acted: false };
  });
}

function drawCards(side: BattleSide, count: number, nextUid: number): { side: BattleSide; nextUid: number; drawn: number } {
  const n = Math.max(0, Math.min(count, side.deck.length));
  const drawnIds = side.deck.slice(0, n);
  let uid = nextUid;
  const hand = [...side.hand, ...drawnIds.map((cardId) => ({ uid: `c${uid++}`, cardId }))];
  return { side: { ...side, deck: side.deck.slice(n), hand }, nextUid: uid, drawn: n };
}

export function createBattle(
  player: CombatantSetup,
  opponent: CombatantSetup,
  seed: number,
  first?: Side,
): BattleState {
  let s = seed;
  const pShuffle = shuffle(player.deck.skills, s);
  s = pShuffle.seed;
  const oShuffle = shuffle(opponent.deck.skills, s);
  s = oShuffle.seed;
  const opening = (items: string[], ids: readonly string[] | undefined): string[] => {
    const i = ids && ids.length > 0 ? items.findIndex((id) => ids.includes(id)) : -1;
    return i <= 0 ? items : [items[i] as string, ...items.slice(0, i), ...items.slice(i + 1)];
  };
  pShuffle.items = opening(pShuffle.items, player.openingAny);
  oShuffle.items = opening(oShuffle.items, opponent.openingAny);
  let firstSide = first;
  if (!firstSide) {
    const r = nextRandom(s);
    s = r.seed;
    firstSide = r.value < 0.5 ? 'player' : 'opponent';
  }
  const base = (setup: CombatantSetup, prefix: string, deck: string[]): BattleSide => ({
    name: setup.name,
    monsters: makeMonsters(prefix, setup.deck.monsters, setup.lifeScale ?? 1),
    deck,
    hand: [],
    discard: [],
    manaPile: [],
    turnUsage: {},
  });
  const sides: Record<Side, BattleSide> = { player: base(player, 'p', pShuffle.items), opponent: base(opponent, 'o', oShuffle.items) };
  // PS版：最初に手札を引くのは先攻だけ。後攻は自分の最初のドローで5枚引く
  const dealt = drawCards(sides[firstSide], BATTLE_RULES.initialHand, 1);
  sides[firstSide] = dealt.side;
  const uid = dealt.nextUid;
  // 先攻1ターン目（PS版）：攻撃はなく、すぐマナ化。マナにできるのは決まった枚数まで
  return {
    seed: s,
    turn: 1,
    active: firstSide,
    first: firstSide,
    phase: 'mana',
    pending: null,
    sides,
    field: null,
    winner: null,
    endReason: null,
    manaConvertLimit: BATTLE_RULES.firstTurnManaLimit,
    log: [
      { turn: 1, text: t(`battle.log.start.${firstSide}`) },
      { turn: 1, text: t('battle.log.firstTurnMana', { n: BATTLE_RULES.firstTurnManaLimit }) },
    ],
    nextUid: uid,
    fx: [],
    fxSeq: 0,
  };
}

/* ---------- 参照用 ---------- */

export function aliveMonsters(side: BattleSide): BattleMonster[] {
  return side.monsters.filter((m) => m.life > 0);
}

export function findMonster(state: BattleState, uid: string): { side: Side; monster: BattleMonster } | null {
  for (const side of ['player', 'opponent'] as const) {
    const monster = state.sides[side].monsters.find((m) => m.uid === uid);
    if (monster) return { side, monster };
  }
  return null;
}

export function findHandCard(state: BattleState, side: Side, cardUid: string): HandCard | undefined {
  return state.sides[side].hand.find((c) => c.uid === cardUid);
}

/**
 * その技を使えるモンスター（適合・生存・未行動・まきつくで止められていない。攻撃の技は、すなかけで封じられていないこと）。
 * 続けて使える技（ツムジの Wひっかき）は、この手番にその技を1回だけ使ったモンスターも使える（chainReady）
 */
export function availableUsers(state: BattleState, side: Side, skill: SkillCard): BattleMonster[] {
  const attack = skill.effect.type === 'attack';
  return state.sides[side].monsters.filter(
    (m) =>
      m.cardId === skill.monsterId &&
      m.life > 0 &&
      (!m.acted || chainReady(state, m, skill)) &&
      m.stunnedTurn !== state.turn &&
      !(attack && m.sealedTurn === state.turn) &&
      // ふくつのいちげき（ステラード 指示書 BQ）：LIFE が lowLifeMax 以下のモンスターだけ使える
      !(skill.effect.type === 'attack' && skill.effect.lowLifeMax !== undefined && m.life > skill.effect.lowLifeMax),
  );
}

/** このモンスターが、この手番に続けてもう1回 skill を使えるか（Wひっかき → Wひっかき。1ターンに最大2回） */
export function chainReady(state: BattleState, m: BattleMonster, skill: SkillCard): boolean {
  return skill.effect.type === 'attack' && !!skill.effect.chain && m.chain?.turn === state.turn && m.chain.cardId === skill.id;
}

/** 使うモンスターにかかっている「この手番の攻撃技の消費マナ−」（かぜのり。効く手番のときだけ。かけた同じ手番には効かない） */
export function windRideOf(state: BattleState, user: BattleMonster | undefined): number {
  const w = user?.windRide;
  return w && user.life > 0 && state.turn === w.turn ? w.discount : 0;
}

/** その技を user が使うときの消費マナ（かぜのりで攻撃技は−1。0より下にはならない） */
export function skillCost(state: BattleState, skill: SkillCard, user?: BattleMonster): number {
  return skill.effect.type === 'attack' ? Math.max(0, skill.cost - windRideOf(state, user)) : skill.cost;
}

/** 手札のその技を、いま使えるモンスターのだれかが使うときのいちばん少ない消費マナ（使えるモンスターがいなければカードのマナ） */
export function handSkillCost(state: BattleState, side: Side, skill: SkillCard): number {
  if (isGuardSkill(skill)) return guardCost(state, skill, side);
  const users = availableUsers(state, side, skill);
  return users.length === 0 ? skill.cost : Math.min(...users.map((u) => skillCost(state, skill, u)));
}

export interface Usability {
  readonly usable: boolean;
  readonly reason: string | null;
}

const NO: (reason: string) => Usability = (reason) => ({ usable: false, reason });
const YES: Usability = { usable: true, reason: null };

/** サポートの残り使用回数（制限なしなら null） */
export function supportUsesLeft(state: BattleState, side: Side, card: SupportCard): number | null {
  if (!card.limitGroup || card.limitPerTurn === undefined) return null;
  return card.limitPerTurn - (state.sides[side].turnUsage[card.limitGroup] ?? 0);
}

function supportUsability(state: BattleState, side: Side, card: SupportCard): Usability {
  if (state.phase === 'defense') return NO(t('battle.ng.defenseOnly'));
  if (state.active !== side) return NO(t('battle.ng.opponentTurn'));
  if (state.phase === 'mana') return NO(t('battle.ng.manaPhase'));
  if (manaOf(state.sides[side]) < card.cost) return NO(t('battle.ng.noMana'));
  const left = supportUsesLeft(state, side, card);
  if (left !== null && left <= 0) return NO(t('battle.ng.usedThisTurn'));
  if (card.effect.type === 'heal' && aliveMonsters(state.sides[side]).length === 0) return NO(t('battle.ng.noHealTarget'));
  // 2026-10-30 指示書 Y：サポートカード フェーズ1
  const s = state.sides[side];
  switch (card.effect.type) {
    case 'stone':
      if (attackableMonsters(state, otherSide(side)).length === 0) return NO(t('battle.ng.noAttackTarget'));
      break;
    case 'recall':
      if (recallChoices(state, side).length === 0) return NO(t('battle.ng.noRecall'));
      if (s.hand.length - 1 >= BATTLE_RULES.maxHand) return NO(t('battle.ng.handFull'));
      break;
    case 'swap':
      if (s.hand.length <= 1) return NO(t('battle.ng.noHandToReturn'));
      break;
    case 'manaDrain':
      if (manaOf(state.sides[otherSide(side)]) <= 0) return NO(t('battle.ng.noOpponentMana'));
      break;
    case 'cheer':
      if (cheerTargets(state, side).length === 0) return NO(t('battle.ng.noCheerTarget'));
      break;
    case 'clearField':
      // しずめの祈り（指示書 AQ）：場に何も無いとき（みちしおの期限が過ぎたあとも）は使えない
      if (!activeField(state)) return NO(t('battle.ng.noField'));
      break;
    default:
      break;
  }
  return YES;
}

/** 思い出の箱で選べるカード（自分の捨て札の技カード。同じカードは1つにまとめる。捨て札の順） */
export function recallChoices(state: BattleState, side: Side): string[] {
  return [...new Set(state.sides[side].discard.filter((id) => cardCatalog.get(id)?.kind === 'skill'))];
}

/** 声援をかけられる味方（生きていて、このターンまだ動いていない） */
export function cheerTargets(state: BattleState, side: Side): BattleMonster[] {
  return aliveMonsters(state.sides[side]).filter((m) => !m.acted);
}

/** 手札のカードを今使えるか（使用不可状態の表示に使う） */
export function cardUsability(state: BattleState, side: Side, cardUid: string): Usability {
  if (state.phase === 'ended') return NO(t('battle.ng.ended'));
  const hand = findHandCard(state, side, cardUid);
  if (!hand) return NO(t('battle.ng.notInHand'));
  const card = getPlayCard(hand.cardId);
  if (card.kind === 'support') return supportUsability(state, side, card);
  const skill = card;
  const owner = state.sides[side].monsters.filter((m) => m.cardId === skill.monsterId);
  if (owner.length === 0) return NO(t('battle.ng.noOwner'));
  if (owner.every((m) => m.life <= 0)) return NO(t('battle.ng.ownerDown'));

  if (state.phase === 'defense') {
    const pending = state.pending;
    if (!pending || pending.attacker === side) return NO(t('battle.ng.waitDefense'));
    const type = skill.effect.type;
    if (type !== 'defense' && type !== 'evade' && type !== 'cover') return NO(t('battle.ng.defenseOnly'));
    // かばう：狙われたほかの味方の代わりに受ける（狙われたモンスターのカードでなくてよい）
    if (type === 'cover') return coverUsability(state, side, skill, pending);
    // みがわり（クヨウ 指示書 BH の直し・ユーザー決定）：代わりに受けた攻撃には、クヨウの防御・回避を重ねて使えない（−2 だけで完結する守り）
    if (pending.coverReduce) return NO(t('battle.ng.standInDone'));
    // 守備に使えるのは、狙われたモンスターの防御・回避カードだけ
    const target = state.sides[side].monsters.find((m) => m.uid === pending.targetUid);
    if (!target || target.cardId !== skill.monsterId) return NO(t('battle.ng.notTarget'));
    const against = guardAgainst(skill);
    if (against !== 'all' && against !== pending.stat) return NO(t('battle.ng.wrongStat', { stat: statLabel(pending.stat) }));
    const attackCard = attackCardOf(pending.cardId);
    if (type === 'defense' && (unblockableAgainst(state, attackCard, target) || pending.dragonMight)) return NO(t('battle.ng.unblockable'));
    // 「回避されない」攻撃は、回避の条件が合っていても回避できない（防御はできる）。水中・空中の相手には回避できない攻撃も（指示書 AJ）
    if (type === 'evade' && (undodgeableAgainst(state, attackCard, target) || pending.undodgeable || pending.dragonGaze)) return NO(t('battle.ng.undodgeable'));
    // じならしをかけられたモンスターは、この手番の次の攻撃1回を回避できない（防御はできる）
    if (type === 'evade' && pending.pinned) return NO(t('battle.ng.pinned'));
    // おにのいあつ（ベニオウ 指示書 BP）：期限の間は回避の技を使えない（防御はできる）。だれの攻撃でも
    if (type === 'evade' && isMenaced(state, target)) return NO(t('battle.ng.menaced'));
    // 「必要マナ2以上の〜を回避」「消費マナ3以上の〜ダメージ−4」「消費マナ2以下の〜を回避」：
    // 受ける攻撃カードに印字された必要マナで判定（いまのマナの残りではない）
    const minCost = guardMinCost(skill);
    if (minCost > 0 && attackCard.cost < minCost) return NO(t('battle.ng.evadeMinCost', { n: minCost }));
    const maxCost = guardMaxCost(skill);
    if (maxCost !== null && attackCard.cost > maxCost) return NO(t('battle.ng.maxCost', { n: maxCost }));
    if (manaOf(state.sides[side]) < guardCost(state, skill, side)) return NO(t('battle.ng.noMana'));
    return YES;
  }

  if (state.active !== side) return NO(t('battle.ng.opponentTurn'));
  if (state.phase === 'mana') return NO(t('battle.ng.manaPhase'));
  if (skill.effect.type === 'defense' || skill.effect.type === 'evade' || skill.effect.type === 'cover') return NO(t('battle.ng.defenseOnAttack'));
  // じならし：1ターンに1回（2026-10-29 指示書）
  if (skill.effect.type === 'pin' && (state.sides[side].turnUsage[PIN_USAGE] ?? 0) >= 1) return NO(t('battle.ng.usedThisTurn'));
  // いたずら・不思議な嗅覚：相手の手札がないときは使えない（いたずらは 2026-10-24 ユーザー指示。嗅覚も同じ扱い）
  if ((skill.effect.type === 'handToDeck' || skill.effect.type === 'discardRandom' || skill.effect.type === 'discardChoice' || skill.effect.type === 'revealHand') && state.sides[otherSide(side)].hand.length === 0) {
    return NO(t('battle.ng.noOpponentHand'));
  }
  // みちしお（セレフィーン 2026-10-29）：山札が足りないときは使えない（灰色。使って負けにはしない）
  if (skill.effect.type === 'mana' && skill.effect.amount !== undefined && state.sides[side].deck.length < skill.effect.amount) return NO(t('battle.ng.noDeck'));
  // 考える：このカードのほかに戻す手札がないときは使えない
  if (skill.effect.type === 'redrawHand' && state.sides[side].hand.length <= 1) return NO(t('battle.ng.noHandToReturn'));
  // システムチェンジ（ギアロス 指示書 AX）：このカードのほかに手札がないときは使えない。システムチェック：山札が0枚なら使えない
  if (skill.effect.type === 'systemChange' && state.sides[side].hand.length <= 1) return NO(t('battle.ng.noHandToReturn'));
  if (skill.effect.type === 'systemCheck' && state.sides[side].deck.length === 0) return NO(t('battle.ng.noDeck'));
  // ちえのささやき（フギン 指示書 BM の直し・ユーザー決定）：山札が0枚なら使えない（暗くして選べない）
  if (skill.effect.type === 'searchEvade' && state.sides[side].deck.length === 0) return NO(t('battle.ng.noDeck'));
  // ぜんちぜんのう（ノウス 指示書 BN）：ちえのささやきと同じく、山札が0枚なら使えない
  if (skill.effect.type === 'searchAny' && state.sides[side].deck.length === 0) return NO(t('battle.ng.noDeck'));
  // ときをすいとる（ノウス 指示書 BO・ユーザー決定）：相手の山札が0枚なら使えない（灰色。CPU も使わない）
  if (skill.effect.type === 'millDeck' && state.sides[otherSide(side)].deck.length === 0) return NO(t('battle.ng.noOpponentDeck'));
  // おいかぜ：かけられる味方（使ったモンスターと同じ種類以外で、生きている）がいないときは使えない
  if (skill.effect.type === 'tailwind' && tailwindTargets(state, side, skill).length === 0) return NO(t('battle.ng.noTailwindTarget'));
  // そなえのふえ（フォルン 指示書 AL）：かけられる味方（フォルン以外で、生きている）がいないときは使えない
  if (skill.effect.type === 'ward' && tailwindTargets(state, side, skill).length === 0) return NO(t('battle.ng.noWardTarget'));
  // 最後の審判（ラディエル 指示書 BI）：このカードのほかに自分の手札も相手の手札も無いときは使えない（戻す手札が無い）
  if (skill.effect.type === 'lastJudgment' && state.sides[side].hand.length <= 1 && state.sides[otherSide(side)].hand.length === 0) return NO(t('battle.ng.noHandsToReturn'));
  // 天の恵み（ラディエル 指示書 BI）：自分の捨て札が0枚なら使えない（理由を画面に出す）
  if (skill.effect.type === 'heavenGrace' && state.sides[side].discard.length === 0) return NO(t('battle.ng.noDiscard'));
  // おはらい（クヨウ 指示書 BH）：悪い状態のある味方も、ライフの減った味方もいないときは使えない（理由を画面に出す）
  if (skill.effect.type === 'purify' && purifyTargets(state, side).length === 0) return NO(t('battle.ng.noPurifyTarget'));
  // もりのたより（フォルン 指示書 AL）：使ったあとの手札がすでに hand 枚以上なら使えない
  if (skill.effect.type === 'drawTo' && state.sides[side].hand.length - 1 >= skill.effect.hand) return NO(t('battle.ng.handEnough', { n: skill.effect.hand }));
  // かぜのり（ツムジ）が効いていれば、攻撃技の消費マナ−1
  if (manaOf(state.sides[side]) < handSkillCost(state, side, skill)) return NO(t('battle.ng.noMana'));
  // ふくつのいちげき（ステラード 指示書 BQ）：使えるモンスターの LIFE が条件より多いときは理由を出す
  const lowLife = skill.effect.type === 'attack' ? skill.effect.lowLifeMax : undefined;
  if (lowLife !== undefined && owner.some((m) => m.life > 0 && !m.acted) && !owner.some((m) => m.life > 0 && m.life <= lowLife)) {
    return NO(t('battle.ng.lowLifeOnly', { n: lowLife }));
  }
  if (availableUsers(state, side, skill).length === 0) {
    // まきつくで止められている・すなかけで攻撃を封じられているだけのとき
    const stunned = owner.some((m) => m.life > 0 && !m.acted && m.stunnedTurn === state.turn);
    if (stunned) return NO(t('battle.ng.stunned'));
    const sealed = owner.some((m) => m.life > 0 && !m.acted && m.sealedTurn === state.turn);
    return NO(t(sealed && skill.effect.type === 'attack' ? 'battle.ng.sealed' : 'battle.ng.acted'));
  }
  if (targetsEnemy(skill) && aliveMonsters(state.sides[otherSide(side)]).length === 0) {
    return NO(t('battle.ng.noAttackTarget'));
  }
  // すなをほる：相手が全員隠れていれば攻撃の技は使えない
  if (skill.effect.type === 'attack' && attackableMonsters(state, otherSide(side)).length === 0) return NO(t('battle.ng.allHidden'));
  // 「地上の相手だけ」（急降下アタック・地ひびき）：地上の相手がいなければ使えない（空中・水中の相手、場が水中のとき）
  if (skill.effect.type === 'attack' && skill.effect.groundOnly && targetsFor(state, side, skill).length === 0) return NO(t('battle.ng.groundOnly'));
  // 「空中の相手には使えない」（あしばらい 指示書 BQ）：空中でない相手がいなければ使えない（灰色）
  if (skill.effect.type === 'attack' && skill.effect.notAir && targetsFor(state, side, skill).length === 0) return NO(t('battle.ng.notAir'));
  // 「水中の相手だけ」（おおうずしお 指示書 BK）：水中の相手がいなければ使えない（灰色）
  if (skill.effect.type === 'attack' && skill.effect.waterOnly && targetsFor(state, side, skill).length === 0) return NO(t('battle.ng.waterOnly'));
  return YES;
}

/**
 * オーバードライブの3枚コンボ（ギアロス 2026-11-05 指示書 AX）をいま使えるか：攻撃の手番で、α・β・γ の3枚がそろって手札にあり、
 * ギアロスがこのターンまだ技を使っていなくて（まきつく・すなかけで止められていない）、マナ5を払え、攻撃できる相手がいるとき
 */
export function overdriveUsability(state: BattleState, side: Side): Usability {
  if (state.phase !== 'main' || state.active !== side) return NO(t('battle.ng.opponentTurn'));
  const hand = state.sides[side].hand;
  if (!OVERDRIVE_IDS.every((id) => hand.some((c) => c.cardId === id))) return NO(t('battle.ng.overdriveCards'));
  const combo = getSkill(OVERDRIVE_COMBO_ID);
  const users = availableUsers(state, side, combo);
  if (users.length === 0) return NO(t('battle.ng.acted'));
  if (manaOf(state.sides[side]) < Math.min(...users.map((u) => skillCost(state, combo, u)))) return NO(t('battle.ng.noMana'));
  if (attackableMonsters(state, otherSide(side)).length === 0) return NO(t('battle.ng.allHidden'));
  return YES;
}

/** 手札の α・β・γ（3枚コンボで捨てる3枚。それぞれ手札の左から最初の1枚） */
export function overdriveHandCards(state: BattleState, side: Side): HandCard[] {
  const hand = state.sides[side].hand;
  return OVERDRIVE_IDS.map((id) => hand.find((c) => c.cardId === id)).filter((c): c is HandCard => !!c);
}

/** じならしの回数を数える turnUsage のキー（1ターンに1回） */
const PIN_USAGE = 'skill:pin';

/** かばうで代わりに受けるモンスター（狙われたモンスター以外の、生きている同じ種類〔ジオル〕。左から） */
export function coverUser(state: BattleState, side: Side, skill: SkillCard): BattleMonster | undefined {
  const targetUid = state.pending?.targetUid;
  return aliveMonsters(state.sides[side]).find((m) => m.cardId === skill.monsterId && m.uid !== targetUid);
}

/**
 * かばうを使えるか（試遊中：ジオル 2026-10-29）。ジオル以外の味方が攻撃で狙われていて、ジオルが生きていて、マナが足りるとき。
 * 「防御されない」攻撃・相手全体への攻撃には使えない。1回の攻撃に1回だけで、狙われた味方がほかの守りを使う前（最初の守り）だけ【Claude の裁定】
 */
function coverUsability(state: BattleState, side: Side, skill: SkillCard, pending: PendingAttack): Usability {
  const attack = attackCardOf(pending.cardId).effect;
  const targeted = state.sides[side].monsters.find((m) => m.uid === pending.targetUid);
  if (unblockableAgainst(state, attackCardOf(pending.cardId), targeted) || pending.dragonMight) return NO(t('battle.ng.unblockable'));
  if (attack.type === 'attack' && attack.allTargets) return NO(t('battle.ng.coverAllTargets'));
  if (pending.coveredFrom) return NO(t('battle.ng.coverOnce'));
  if (pending.responses.length > 0) return NO(t('battle.ng.coverFirst'));
  const target = state.sides[side].monsters.find((m) => m.uid === pending.targetUid);
  if (!target || target.cardId === skill.monsterId) return NO(t('battle.ng.coverSelf'));
  if (!coverUser(state, side, skill)) return NO(t('battle.ng.ownerDown'));
  if (manaOf(state.sides[side]) < guardCost(state, skill)) return NO(t('battle.ng.noMana'));
  return YES;
}

/**
 * ちょうはつで、このモンスターがこの手番に攻撃できる相手が限られているなら、その種類（モンスター ID）。限られていなければ null。
 * 【要仕様確定】相手の場にその種類（ラズック）が1体も生きていなければ、制限なしとした（対戦が止まらないように）。
 * ラズックが複数いれば、どのラズックにも攻撃できる
 */
export function tauntRestriction(state: BattleState, side: Side, user: BattleMonster): string | null {
  const taunt = user.taunt;
  if (!taunt || taunt.turn !== state.turn) return null;
  // すなをほるで隠れているラズックは数えない（攻撃できるラズックがいなければ制限なし）
  return attackableMonsters(state, otherSide(side)).some((m) => m.cardId === taunt.monsterId) ? taunt.monsterId : null;
}

/** 攻撃の技の対象にできるモンスター（生きていて、すなをほるで隠れていない） */
export function attackableMonsters(state: BattleState, side: Side): BattleMonster[] {
  return aliveMonsters(state.sides[side]).filter((m) => m.hiddenTurn !== state.turn);
}

/** いまの場（期限が過ぎていれば null） */
export function activeField(state: BattleState): FieldCard | null {
  const f = state.field;
  return f && (f.untilTurn === undefined || state.turn <= f.untilTurn) ? f : null;
}

/** 場のサポートカード（場がサポートの場のカードのときだけ。みちしお などの技の場なら null） */
export function fieldSupport(state: BattleState): SupportCard | null {
  const f = activeField(state);
  const card = f ? cardCatalog.get(f.cardId) : undefined;
  return card && card.kind === 'support' ? card : null;
}

/** 場が全体を変えている居場所（無ければ null） */
export function fieldHabitat(state: BattleState): Habitat | null {
  return activeField(state)?.habitat ?? null;
}

/** 場が水中か（みちしおの期限の手番の終わりまで。2026-11-01 指示書 AJ） */
export function isTideActive(state: BattleState): boolean {
  return fieldHabitat(state) === 'water';
}

/**
 * モンスターのいまの居場所（いま扱われている居場所。居場所の無い仮モンスターは null）。
 * 居場所で決まる技（急降下・地ひびき・あらし・みちしお／タイダルクラッシュ・ルナタイド・オーシャンウェーブ・うずまきショット・おおたつまき）は、
 * すべてここ（と、場の居場所の fieldHabitat）で判定する。生まれつきの居場所（MonsterCard.habitat）を直接見ない（2026-11-02 指示書 AQ で確かめた）。
 * 場が居場所を変えていれば全員その居場所：みちしお＝水中・まいあがる風＝空中・しずまる大地＝地上（場の枠は1つなので、いちばん新しい場だけが効く）
 */
export function habitatOf(state: BattleState, monster: BattleMonster | undefined): Habitat | null {
  if (!monster) return null;
  const base = getMonster(monster.cardId).habitat ?? null;
  // ひきずりこむ（クロシオ 指示書 BK）：その子だけの状態。場のカードより強い（場が地上・空中でも水中のまま）
  if (base && isDraggedUnder(state, monster)) return 'water';
  // 場が居場所を変えていれば、全員その居場所（みちしお＝水中・まいあがる風＝空中・しずまる大地＝地上）
  const field = fieldHabitat(state);
  return base && field ? field : base;
}

/** ひきずりこむ（クロシオ 指示書 BK）で、いま水中にされているか（期限の手番の終わりまで・生きているとき） */
export function isDraggedUnder(state: BattleState, monster: BattleMonster | undefined): boolean {
  const d = monster?.dragUnder;
  return !!d && monster.life > 0 && state.turn <= d.untilTurn;
}

/** その攻撃は、この相手には防御されないか（カードの「防御されない」・水中の相手への「防御されない」） */
export function unblockableAgainst(state: BattleState, card: SkillCard, target: BattleMonster | undefined): boolean {
  const e = card.effect;
  return e.type === 'attack' && (!!e.unblockable || (!!e.unblockableVsWater && habitatOf(state, target) === 'water'));
}

/** その攻撃は、この相手には回避されないか（カードの「回避されない」・水中／空中の相手への「回避できない」。ためているときのぷはーっは pending.undodgeable） */
export function undodgeableAgainst(state: BattleState, card: SkillCard, target: BattleMonster | undefined): boolean {
  const e = card.effect;
  if (e.type !== 'attack') return false;
  const where = habitatOf(state, target);
  return !!e.undodgeable || (!!e.undodgeableVsWater && where === 'water') || (!!e.undodgeableVsAir && where === 'air');
}

/** 倒れている味方の数（ししゃのたむけ。使ったモンスターの側） */
export function fallenAllies(state: BattleState, user: BattleMonster | undefined): number {
  const side = user ? findMonster(state, user.uid)?.side : undefined;
  return side ? state.sides[side].monsters.filter((m) => m.life <= 0).length : 0;
}

/** 死のレクイエムで倒れるモンスター（ライフ1以下で生きている、使ったモンスター以外。味方も相手も） */
export function requiemVictims(state: BattleState, userUid: string): BattleMonster[] {
  return [...state.sides.player.monsters, ...state.sides.opponent.monsters].filter((m) => m.uid !== userUid && m.life > 0 && m.life <= 1);
}

/**
 * 悪い状態（2026-11-05 指示書 BH：おはらいで消す・まよけのふだで防ぐもの）。相手の技で味方に付いた、いま効いているもの：
 * sealed＝攻撃できない（すなかけ・威嚇・こもりうた・すなけむり）・stunned＝行動できない／凍る（まきつく・こおりのいき・ふぶき）・
 * weaken＝技のダメージ−（ダストキック・吠える・熱風の威嚇）・taunt＝おびきよせ（決まった相手しか狙えない）・
 * pinned＝回避できない（ジオルのじならし。BH の直しで足した・ユーザー決定）・
 * dragged＝水中にされている（クロシオのひきずりこむ。2026-11-06 指示書 BK・ユーザー決定）。
 * 自分の技で付いた良い状態（ためている・エネルギー・おいかぜ・しめったはだ など）は入らない
 */
export type BadStatusKind = 'sealed' | 'stunned' | 'weaken' | 'taunt' | 'pinned' | 'dragged' | 'menaced';

export function badStatusKinds(state: BattleState, m: BattleMonster | undefined): BadStatusKind[] {
  if (!m || m.life <= 0) return [];
  const out: BadStatusKind[] = [];
  if (m.sealedTurn != null && m.sealedTurn >= state.turn) out.push('sealed');
  if (m.stunnedTurn != null && m.stunnedTurn >= state.turn) out.push('stunned');
  const weak = (m.weaken && (m.weaken.untilTurn === undefined || m.weaken.untilTurn >= state.turn)) || (m.weakenTurn && m.weakenTurn.turn >= state.turn);
  if (weak) out.push('weaken');
  if (m.taunt && m.taunt.turn >= state.turn) out.push('taunt');
  if (m.pinTurn != null && m.pinTurn >= state.turn) out.push('pinned');
  if (isDraggedUnder(state, m)) out.push('dragged');
  if (isMenaced(state, m)) out.push('menaced');
  return out;
}

/** おはらいで選べる味方（生きていて、悪い状態があるか、ライフが減っている味方。使ったモンスター自身も選べる。BH の直し） */
export function purifyTargets(state: BattleState, side: Side): BattleMonster[] {
  return aliveMonsters(state.sides[side]).filter((m) => badStatusKinds(state, m).length > 0 || m.life < m.maxLife);
}

/** しゅうちゅう（ステラード 指示書 BQ）が、いま side に効いているか（使った手番から、使った側の次の自分の手番の終わりまで） */
export function focusActive(state: BattleState, side: Side): boolean {
  const f = state.sides[side].focus;
  return !!f && state.turn <= f.untilTurn;
}

/** まよけのふだが、いま side の味方に効いているか（使った手番から、次の相手の手番の終わりまで） */
export function wardCharmActive(state: BattleState, side: Side): boolean {
  const w = state.sides[side].wardCharm;
  return !!w && state.turn <= w.untilTurn;
}

/**
 * 対象を選ぶ必要があるカードなら、選べる対象を返す。
 * 攻撃の技は、ちょうはつで相手が限られていればそれに従う。user を渡さなければ、使えるモンスターのだれかが攻撃できる相手すべて。
 * 【要仕様確定】ちょうはつが限るのは攻撃の技だけ（特殊の技・防御・回避・サポートは限らない）
 */
export function targetsFor(state: BattleState, side: Side, card: PlayCard, user?: BattleMonster): BattleMonster[] {
  if (card.kind === 'skill' && targetsEnemy(card)) {
    if (card.effect.type !== 'attack') return aliveMonsters(state.sides[otherSide(side)]);
    // 攻撃の技は、すなをほるで隠れている相手を選べない。「地上の相手だけ」は、いま地上の相手だけ（場が水中なら選べない）。
    // 「水中の相手だけ」（クロシオのおおうずしお 指示書 BK）は、いま水中の相手だけ（生まれつき水中・ひきずりこむ・みちしお）
    const ground = card.effect.groundOnly;
    const water = card.effect.waterOnly;
    // 「空中の相手には使えない」（あしばらい 指示書 BQ）：いま空中の相手は選べない
    const notAir = card.effect.notAir;
    const enemies = attackableMonsters(state, otherSide(side)).filter((m) => (!ground || habitatOf(state, m) === 'ground') && (!water || habitatOf(state, m) === 'water') && (!notAir || habitatOf(state, m) !== 'air'));
    const users = user ? [user] : availableUsers(state, side, card);
    return enemies.filter((e) =>
      users.some((u) => {
        const only = tauntRestriction(state, side, u);
        return only === null || e.cardId === only;
      }),
    );
  }
  // 回復（薬草）・いやしのみつ（フルーネ。使ったモンスターも選べる）：生きている味方（倒れた味方は選べない）
  if (card.effect.type === 'heal' || card.effect.type === 'healAlly') return aliveMonsters(state.sides[side]);
  // 投石（2026-10-30 指示書 Y）：すなをほるで隠れていない相手（ちょうはつの制限は受けない）。声援：まだ動いていない味方
  if (card.kind === 'support' && card.effect.type === 'stone') return attackableMonsters(state, otherSide(side));
  if (card.kind === 'support' && card.effect.type === 'cheer') return cheerTargets(state, side);
  if (card.kind === 'skill' && (card.effect.type === 'tailwind' || card.effect.type === 'ward')) return tailwindTargets(state, side, card);
  // おはらい（クヨウ 指示書 BH）：悪い状態のある味方（クヨウ自身も）
  if (card.kind === 'skill' && card.effect.type === 'purify') return purifyTargets(state, side);
  return [];
}

/** おいかぜ・そなえのふえをかけられる味方（生きていて、使ったモンスターと同じ種類〔プカリム・フォルン〕でない） */
export function tailwindTargets(state: BattleState, side: Side, skill: SkillCard): BattleMonster[] {
  return aliveMonsters(state.sides[side]).filter((m) => m.cardId !== skill.monsterId);
}

/**
 * 攻撃のカード（守りの判定・ダメージ・攻撃に付いた効果に使う）。投石（2026-10-30 指示書 Y）はサポートだが、
 * ちから技（マナ＝カードのマナ・ダメージ value・効果なし）として扱う。使うモンスターはいない
 */
export function attackCardOf(cardId: string): SkillCard {
  const card = getPlayCard(cardId);
  if (card.kind === 'skill') return card;
  const value = card.effect.type === 'stone' ? card.effect.value : 0;
  return { kind: 'skill', id: card.id, name: card.name, rarity: card.rarity, isPlaceholder: false, monsterId: '', cost: card.cost, category: 'force', stat: { type: 'force', value }, effect: { type: 'attack' } } as SkillCard;
}

/** 声援（2026-10-30 指示書 Y）：このターンの、次の攻撃技のダメージ＋ */
export function cheerOf(state: BattleState, user: BattleMonster | undefined): number {
  const c = user?.cheer;
  return c && user.life > 0 && c.turn === state.turn ? c.amount : 0;
}

/** 場のカード「守りの陣」（2026-10-30 指示書 Y）：防御・回避のカードの必要マナを減らす量（場に無ければ 0） */
export function guardDiscountOf(state: BattleState): number {
  const e = fieldSupport(state)?.effect;
  return e?.type === 'guardDiscount' ? e.value : 0;
}

/** 守りのカード（防御・回避・かばう）か */
const isGuardSkill = (skill: SkillCard): boolean => skill.effect.type === 'defense' || skill.effect.type === 'evade' || skill.effect.type === 'cover';

/**
 * 守りのカードの必要マナ（守りの陣が場にあれば−。0より下にならない）。
 * side を渡すと、はねやすめ（フギン 指示書 BM）も見る：そのカードの持ち主（守る手番では狙われたモンスター）に印があれば、回避のマナは0
 */
export function guardCost(state: BattleState, skill: SkillCard, side?: Side): number {
  if (!isGuardSkill(skill)) return skill.cost;
  if (side && featherRestOwner(state, side, skill)) return 0;
  return Math.max(0, skill.cost - guardDiscountOf(state));
}

/**
 * はねやすめ（フギン 指示書 BM）の印で、この回避の技のマナが0になるモンスター（無ければ undefined）。
 * 守る手番では狙われたモンスターだけ（守りに使えるのは狙われたモンスターのカードだけ）。それ以外（手札の表示）は、印のある同じ種類の味方
 */
export function featherRestOwner(state: BattleState, side: Side, skill: SkillCard): BattleMonster | undefined {
  if (skill.effect.type !== 'evade') return undefined;
  const pending = state.phase === 'defense' ? state.pending : null;
  const pool = state.sides[side].monsters.filter((m) => m.cardId === skill.monsterId && m.life > 0 && !!m.featherRest);
  if (pending && pending.attacker !== side) return pool.find((m) => m.uid === pending.targetUid);
  return pool[0];
}

/** 使うモンスターがためている「次の攻撃技のダメージ＋」（ほっぺにためる） */
export function chargeOf(user: BattleMonster | undefined): number {
  return user && user.life > 0 ? (user.charge ?? 0) : 0;
}

/** 使うモンスターにかかっている「次のターンの攻撃技のダメージ＋」（おいかぜ。効く手番〔turn〕のときだけ。かけた同じ手番には効かない） */
export function tailwindOf(state: BattleState, user: BattleMonster | undefined): number {
  const w = user?.tailwind;
  return w && user.life > 0 && state.turn === w.turn ? w.amount : 0;
}

/** おにのいあつ（ベニオウ 指示書 BP）で、いま回避の技を使えないか（期限の手番の終わりまで。倒れていれば false） */
export function isMenaced(state: BattleState, monster: BattleMonster | undefined): boolean {
  const m = monster?.menace;
  return !!m && monster.life > 0 && state.turn <= m.untilTurn;
}

/** おたけび（ベニオウ 指示書 BP）で、この攻撃（ちから技）のダメージが2倍になるか（期限の手番の終わりまで） */
export function roarOf(state: BattleState, user: BattleMonster | undefined, skill: SkillCard): boolean {
  const r = user?.roar;
  return !!r && user.life > 0 && state.turn <= r.untilTurn && skill.effect.type === 'attack' && skill.stat?.type === 'force';
}

/** いかり（ベニオウ 指示書 BP）で、この技のダメージに足す量（使うモンスターの LIFE が最大 LIFE の半分以下のときだけ。ほかは 0） */
export function rageBonusOf(skill: SkillCard, user: BattleMonster | undefined): number {
  const e = skill.effect;
  return e.type === 'attack' && e.rageBonus && user && user.life > 0 && user.life * 2 <= user.maxLife ? e.rageBonus : 0;
}

/** じならしで、この手番に受ける次の攻撃を回避できないか（倒れていれば false） */
export function isPinned(state: BattleState, monster: BattleMonster | undefined): boolean {
  return !!monster && monster.life > 0 && monster.pinTurn === state.turn;
}

/** エネルギーをためるで、この攻撃（かしこさ技）のダメージが2倍になるか（効く手番で、まだかしこさ技を使っていないとき） */
export function energyOf(state: BattleState, user: BattleMonster | undefined, skill: SkillCard): boolean {
  const e = user?.energy;
  return !!e && user.life > 0 && state.turn === e.turn && skill.effect.type === 'attack' && skill.stat?.type === 'wisdom';
}

/** 竜のまなざし（指示書 AX）で、この手番に user が使う攻撃が回避されないか（効く手番で、まだ攻撃を使っていないとき） */
export function dragonGazeOf(state: BattleState, user: BattleMonster | undefined): boolean {
  const g = user?.dragonGaze;
  return !!g && user.life > 0 && state.turn === g.turn;
}

/** 竜のちから（指示書 AX）で、この手番に user が使う攻撃が防御されないか（効く手番で、まだ攻撃を使っていないとき） */
export function dragonMightOf(state: BattleState, user: BattleMonster | undefined): boolean {
  const m = user?.dragonMight;
  return !!m && user.life > 0 && state.turn === m.turn;
}

/** 場の全体カードによる、その能力の攻撃のダメージの増減 */
export function fieldModifier(state: BattleState, stat: StatType): number {
  const e = fieldSupport(state)?.effect;
  if (!e || e.type !== 'field') return 0;
  return e.stat === 'all' || e.stat === stat ? e.modifier : 0;
}

/** 使うモンスターにかかっている「次の技のダメージ−」（吠える・熱風の威嚇）。その技の種類に効き、期限（untilTurn）が過ぎていないときだけ */
export function weakenOf(state: BattleState, user: BattleMonster | undefined, skill: SkillCard): number {
  const w = user?.weaken;
  if (!w || (w.untilTurn !== undefined && state.turn > w.untilTurn)) return 0;
  return skill.stat && w.stat === skill.stat.type ? w.amount : 0;
}

/** 使うモンスターにかかっている「この手番の技のダメージ−」（ダストキック）。この手番で、その技の種類に効くときだけ */
export function weakenTurnOf(state: BattleState, user: BattleMonster | undefined, skill: SkillCard): number {
  const w = user?.weakenTurn;
  return w && w.turn === state.turn && skill.stat && w.stat === skill.stat.type ? w.amount : 0;
}

/**
 * 攻撃の威力（場の増減と、使うモンスターへの「吠える」「ダストキック」「ほっぺにためる」「おいかぜ」「エネルギーをためる」を反映。0未満にはならない）。
 * エネルギーをためるの2倍は「カードのダメージ」にかけ、ほかの＋・−はそのあとに足す（2026-10-29 指示書。防御の軽減はさらにそのあと）
 */
export function attackPower(state: BattleState, skill: SkillCard, user?: BattleMonster, target?: BattleMonster): number {
  if (!skill.stat) return 0;
  // 2倍（エネルギーをためる・場が水中のタイダルクラッシュ）はカードのダメージにかける。両方なら4倍【要確認：指示書 AJ】
  const water = skill.effect.type === 'attack' && skill.effect.doubleInWater && isTideActive(state);
  // うずまきショット（指示書 AQ）：ねらった相手がいま空中なら、技そのもののダメージに＋（2倍があれば＋込みのダメージにかける）
  // いかり・おたけび（ベニオウ 指示書 BP）：いかりの＋は技そのもののダメージに足し、おたけびの2倍は＋込みのダメージにかける（ほかの増減はそのあと）
  const base = (skill.stat.value + airBonusAgainst(state, skill, target) + rageBonusOf(skill, user)) * (energyOf(state, user, skill) ? 2 : 1) * (water ? 2 : 1) * (roarOf(state, user, skill) ? 2 : 1);
  // ししゃのたむけ：倒れている味方1体につき＋（使った瞬間に数える）
  const fallen = skill.effect.type === 'attack' && skill.effect.fallenAllyBonus ? skill.effect.fallenAllyBonus * fallenAllies(state, user) : 0;
  const boost = chargeOf(user) + tailwindOf(state, user) + cheerOf(state, user) + fallen;
  return Math.max(0, base + boost + fieldModifier(state, skill.stat.type) - weakenOf(state, user, skill) - weakenTurnOf(state, user, skill));
}

/**
 * うずまきショット（ウズリオ 指示書 AQ）：ねらった相手がいま空中なら、技そのもののダメージに足す量（ほかは 0）。
 * 相手を渡さなければ 0（相手を決めていない見積もり）。相手が空中かは habitatOf（場のカードで変わった居場所も同じ扱い）
 */
export function airBonusAgainst(state: BattleState, skill: SkillCard, target: BattleMonster | undefined): number {
  const e = skill.effect;
  return e.type === 'attack' && e.airBonus && target && habitatOf(state, target) === 'air' ? e.airBonus : 0;
}

/** その攻撃が、使うモンスターの今の状態で「回避されない」か（ぷはーっ：ためているとき） */
export function undodgeableNow(skill: SkillCard, user: BattleMonster | undefined): boolean {
  return skill.effect.type === 'attack' && (!!skill.effect.undodgeable || (!!skill.effect.undodgeableWhenCharged && chargeOf(user) > 0));
}

/** 手札をマナにできるか（攻撃のあとのマナ化の間だけ。枚数の制限なし） */
export function canConvertToMana(state: BattleState, side: Side): boolean {
  return (
    state.phase === 'mana' &&
    state.active === side &&
    state.sides[side].hand.length > 0 &&
    (state.manaConvertLimit === null || state.manaConvertLimit > 0)
  );
}

/* ---------- 進行 ---------- */

function addLog(state: BattleState, text: string): BattleState {
  return { ...state, log: [...state.log, { turn: state.turn, text }] };
}

function addFx(state: BattleState, kind: BattleFxKind, side: Side): BattleState {
  const seq = (state.fxSeq ?? 0) + 1;
  return { ...state, fxSeq: seq, fx: [...(state.fx ?? []), { seq, kind, side }].slice(-20) };
}

function updateSide(state: BattleState, side: Side, patch: Partial<BattleSide>): BattleState {
  return { ...state, sides: { ...state.sides, [side]: { ...state.sides[side], ...patch } } };
}

function updateMonster(state: BattleState, uid: string, patch: Partial<BattleMonster>): BattleState {
  const found = findMonster(state, uid);
  if (!found) return state;
  const monsters = state.sides[found.side].monsters.map((m) => (m.uid === uid ? { ...m, ...patch } : m));
  return updateSide(state, found.side, { monsters });
}

function removeFromHand(state: BattleState, side: Side, cardUid: string): BattleState {
  const s = state.sides[side];
  const card = s.hand.find((c) => c.uid === cardUid);
  if (!card) return state;
  return updateSide(state, side, {
    hand: s.hand.filter((c) => c.uid !== cardUid),
    discard: [...s.discard, card.cardId],
  });
}

/** マナを支払う。支払ったカードはマナから捨て札へ移す（呼ぶ前に足りることを確認しておく） */
function payMana(state: BattleState, side: Side, cost: number): BattleState {
  const s = state.sides[side];
  const n = Math.max(0, Math.min(cost, s.manaPile.length));
  const oldest = BATTLE_RULES.manaPayOrder === 'oldest';
  const paid = oldest ? s.manaPile.slice(0, n) : s.manaPile.slice(s.manaPile.length - n);
  const manaPile = oldest ? s.manaPile.slice(n) : s.manaPile.slice(0, s.manaPile.length - n);
  const next = updateSide(state, side, { manaPile, discard: [...s.discard, ...paid] });
  return n > 0 ? addFx(next, 'manaSpend', side) : next;
}

const nameOf = (cardId: string): string => cardName(cardId);

function checkKnockout(state: BattleState): BattleState {
  const pAlive = aliveMonsters(state.sides.player).length;
  const oAlive = aliveMonsters(state.sides.opponent).length;
  if (pAlive > 0 && oAlive > 0) return state;
  // 双方が同時に全滅したら攻撃側（いまの手番の側）の勝ち。引き分けにはならない
  const winner: Side = pAlive === 0 && oAlive === 0 ? state.active : pAlive === 0 ? 'opponent' : 'player';
  const ended: BattleState = { ...state, phase: 'ended', pending: null, winner, endReason: 'knockout' };
  return addLog(ended, t(`battle.log.win.${winner}`));
}

/** 引くべきカードを引けなかった側の負け */
function loseByDeckOut(state: BattleState, loser: Side): BattleState {
  const winner = otherSide(loser);
  const ended: BattleState = { ...state, phase: 'ended', pending: null, winner, endReason: 'deckOut' };
  return addLog(ended, t(`battle.log.deckOut.${loser}`));
}

function applyDamage(state: BattleState, targetUid: string, damage: number): BattleState {
  const found = findMonster(state, targetUid);
  if (!found) return state;
  const life = Math.max(0, found.monster.life - damage);
  // 倒れたら、ほっぺにためた分・おいかぜ・じならし・エネルギーをためる・かぜのり・Wひっかきの続きは消える
  let next = updateMonster(state, targetUid, life === 0 ? { life, charge: null, chargeUntil: null, featherRest: null, tailwind: null, ward: null, pinTurn: null, energy: null, dragonGaze: null, dragonMight: null, windRide: null, chain: null, cheer: null, dragUnder: null, roar: null, menace: null } : { life });
  next = addLog(next, t(life === 0 ? 'battle.log.damageDown' : 'battle.log.damage', { name: nameOf(found.monster.cardId), n: damage }));
  return checkKnockout(next);
}

/**
 * 守備がすべて終わったあとのダメージ計算。
 * 回避が1枚でもあれば0（「回避しても半分」の攻撃なら半分・端数切り捨て）。なければ防御の合計だけ減らす。
 * 反射・無効などは正式カードが決まってから足す。
 */
export function pendingDamage(pending: PendingAttack): number {
  const cards = pending.responses.map(getSkill);
  const reduction = cards.filter((c) => c.effect.type === 'defense').reduce((sum, c) => sum + guardReduction(c), 0);
  if (cards.some((c) => c.effect.type === 'evade')) {
    // 回避されても半分（指示書 AJ）：回避されたら元の値の半分（切り捨て）、防御もあればそこから防御を引く
    const attack = attackCardOf(pending.cardId).effect;
    return attack.type === 'attack' && attack.halfOnEvade ? Math.max(0, Math.floor(pending.power / 2) - reduction) : 0;
  }
  return Math.max(0, pending.power - reduction);
}

/** monster にかかっている「受ける stat の技のダメージ−」の量（正式：ミュロルのしめったはだ。期限が過ぎていれば 0。2026-11-02 指示書 AL からフォルンのそなえのふえも足す） */
export function shieldOf(state: BattleState, monster: BattleMonster | undefined, stat: StatType): number {
  const sh = monster?.shield;
  const own = !sh || state.turn > sh.untilTurn ? 0 : sh.against === 'all' || sh.against === stat ? sh.reduce : 0;
  return own + wardOf(state, monster);
}

/** そなえのふえ（フォルン 2026-11-02 指示書 AL）で、monster が受ける攻撃のダメージを減らす量（期限が過ぎていれば・倒れていれば 0）。しめったはだと同じ順で引く */
export function wardOf(state: BattleState, monster: BattleMonster | undefined): number {
  const w = monster?.ward;
  return w && monster.life > 0 && state.turn <= w.untilTurn ? w.reduce : 0;
}

/**
 * 守備のあとに実際に受けるダメージ（pendingDamage から、狙われたモンスターのしめったはだの分を引く。0未満にならない）。
 * 防御カードの合計と同じく、引いてから最後に0で止める
 */
export function incomingDamage(state: BattleState, pending: PendingAttack): number {
  const target = findMonster(state, pending.targetUid)?.monster;
  // みがわり（クヨウ 指示書 BH）：代わりに受けたダメージをさらに −（しめったはだ・そなえのふえと同じく、守りのあとに引く）
  return Math.max(0, pendingDamage(pending) - shieldOf(state, target, pending.stat) - (pending.coverReduce ?? 0));
}

function resolvePending(state: BattleState): BattleState {
  const pending = state.pending;
  if (!pending) return state;
  const next: BattleState = { ...state, phase: 'main', pending: null };
  const damage = incomingDamage(state, pending);
  const target = findMonster(state, pending.targetUid);
  const evaded = pending.responses.some((id) => getSkill(id).effect.type === 'evade');
  // 相手のライフが実際に減った量（倒しすぎた分は入らない。フラワードレインの回復に使う）
  const lost = Math.min(damage, target?.monster.life ?? 0);
  let withFx = next;
  if (damage > 0) withFx = addFx(next, hitKind(pending.cardId), pending.attacker);
  else if (evaded) withFx = addFx(next, 'evade', target?.side ?? otherSide(pending.attacker));
  // じならしは、攻撃を1回受けたら消える（当たっても・守っても）
  const after = clearPin(applyDamage(withFx, pending.targetUid, damage), pending.targetUid);
  const recoiled = damage > 0 ? selfDamageOnHit(after, pending.cardId, pending.userUid) : evaded ? selfDamageOnEvade(after, pending.cardId, pending.userUid) : after;
  const drained = evaded ? recoiled : drainHeal(recoiled, pending.cardId, pending.userUid, lost);
  const done = evaded ? drained : attackRiders(drained, pending.cardId, pending.attacker, pending.targetUid);
  return nextAllTarget(done, pending);
}

/** じならしを消す（その手番に攻撃を1回受けた） */
function clearPin(state: BattleState, uid: string): BattleState {
  const m = findMonster(state, uid)?.monster;
  return m?.pinTurn != null ? updateMonster(state, uid, { pinTurn: null }) : state;
}

/**
 * 相手全体への攻撃（地ひびき）：1体の守りとダメージが終わったら、次の相手（まだ生きている・隠れていない）の守りへ。
 * 威力は使ったときのまま（ほっぺにためる・おいかぜ などは使ったときに1回だけ数える）。全員終わったら攻撃の手番に戻る
 */
function nextAllTarget(state: BattleState, done: PendingAttack): BattleState {
  if (!done.queue || state.phase === 'ended') return state;
  const rest = done.queue.filter((uid) => {
    const m = findMonster(state, uid)?.monster;
    return !!m && m.life > 0 && m.hiddenTurn !== state.turn;
  });
  const [nextUid, ...more] = rest;
  if (!nextUid) return state;
  const target = findMonster(state, nextUid)?.monster;
  const { pinned: _p, coveredFrom: _c, coverReduce: _r, ...base } = done;
  // おおたつまき（指示書 AS）：次の相手がいま空中なら空中の威力、そうでなければふつうの威力
  const power = base.allPower ? (habitatOf(state, target) === 'air' ? base.allPower.air : base.allPower.base) : base.power;
  const pending: PendingAttack = { ...base, power, targetUid: nextUid, responses: [], queue: more, ...(isPinned(state, target) ? { pinned: true } : {}) };
  return { ...state, phase: 'defense', pending };
}

/** きしのとつげき（ステラード 指示書 BQ）：回避されたとき、使ったモンスターの LIFE−selfDamageOnEvade（反動で倒れてよい）。勝負がついたあとは何もしない */
function selfDamageOnEvade(state: BattleState, skillId: string, userUid: string): BattleState {
  const e = attackCardOf(skillId).effect;
  if (e.type !== 'attack' || !e.selfDamageOnEvade || state.phase === 'ended') return state;
  const user = findMonster(state, userUid);
  if (!user || user.monster.life <= 0) return state;
  const next = addLog(addFx(state, 'recoil', user.side), t('battle.log.chargeEvaded', { name: nameOf(user.monster.cardId), n: e.selfDamageOnEvade }));
  return applyDamage(next, userUid, e.selfDamageOnEvade);
}

/**
 * 技が当たったときの反動（正式：すてみタックル「技が当たった場合、自分のライフ−1」）。
 * 【要仕様確定】「当たった」はダメージが1以上のときとした（回避・防御で0のときは反動なし）。勝負がついたあとは何もしない
 */
function selfDamageOnHit(state: BattleState, skillId: string, userUid: string): BattleState {
  const e = attackCardOf(skillId).effect;
  if (e.type !== 'attack' || !e.selfDamageOnHit || state.phase === 'ended') return state;
  const user = findMonster(state, userUid);
  if (!user || user.monster.life <= 0) return state;
  const next = addLog(addFx(state, 'recoil', user.side), t('battle.log.recoil', { name: nameOf(user.monster.cardId), n: e.selfDamageOnHit }));
  return applyDamage(next, userUid, e.selfDamageOnHit);
}

/**
 * フラワードレイン（正式：フルーネ 2026-10-29）：攻撃のあと、相手のライフが実際に減った量（lost）だけ、使ったモンスターのライフを回復する。
 * 最大ライフ（その対戦での最大。ボスの lifeScale がかかっていればその値）を超えない。0 なら何もしない。勝負がついたあと・使ったモンスターが倒れていれば何もしない
 */
function drainHeal(state: BattleState, skillId: string, userUid: string, lost: number): BattleState {
  const e = attackCardOf(skillId).effect;
  if (e.type !== 'attack' || !e.drain || lost <= 0 || state.phase === 'ended') return state;
  const user = findMonster(state, userUid)?.monster;
  if (!user || user.life <= 0 || user.life >= user.maxLife) return state;
  return healMonster(state, user, lost);
}

/** 命中の音の種類（強攻撃は仮に必要マナ STRONG_ATTACK_COST 以上の技） */
function hitKind(skillId: string): BattleFxKind {
  return attackCardOf(skillId).cost >= STRONG_ATTACK_COST ? 'hitStrong' : 'hitNormal';
}

/**
 * ターン開始とドローステップ。
 * 手札が5枚より少なければ5枚まで引く。5枚あれば山札の一番上を1枚そのままマナにする。
 * どちらも山札が足りなければ、その時点で負け。
 */
function startTurn(state: BattleState, side: Side): BattleState {
  const s = state.sides[side];
  // すなかけの「攻撃できない」は手番の番号（sealedTurn）で決まるので、過ぎた手番のものは何もしなくても効かない
  const monsters = s.monsters.map((m) => ({ ...m, acted: false }));
  let next: BattleState = { ...state, active: side, phase: 'main', manaConvertLimit: null };
  next = addLog(updateSide(next, side, { monsters, turnUsage: {} }), t(`battle.log.turn.${side}`));
  // 場の期限が過ぎたら、場はなくなる（みちしお：使った側の次の自分の手番が終わったら、場の水が引く。指示書 AJ の追加その3）
  if (state.field?.untilTurn !== undefined && state.turn > state.field.untilTurn) {
    next = { ...next, field: null };
    if (state.field.habitat === 'water') next = addLog(next, t('battle.log.tideEnd'));
  }
  // とおぼえ（ロウガ 指示書 BL）：期限の手番が過ぎても攻撃しなかったら、＋は消える
  for (const k of ['player', 'opponent'] as const) {
    for (const m of next.sides[k].monsters) {
      // おたけび（ベニオウ 指示書 BP）：期限の手番が過ぎてもちから技を使わなかったら消える。おにのいあつは期限が過ぎたら消す（記録なし）
      if (m.roar && state.turn > m.roar.untilTurn) {
        next = updateMonster(next, m.uid, { roar: null });
        if (m.life > 0) next = addLog(next, t('battle.log.roarFaded', { name: nameOf(m.cardId) }));
      }
      if (m.menace && state.turn > m.menace.untilTurn) next = updateMonster(next, m.uid, { menace: null });
      if (m.chargeUntil != null && state.turn > m.chargeUntil) {
        next = updateMonster(next, m.uid, { charge: null, chargeUntil: null });
        if (m.life > 0 && m.charge) next = addLog(next, t('battle.log.howlFaded', { name: nameOf(m.cardId) }));
      }
    }
  }
  const need = BATTLE_RULES.refillHandTo - s.hand.length;
  if (need > 0) {
    if (s.deck.length < need) return loseByDeckOut(next, side);
    const drawn = drawCards(next.sides[side], need, next.nextUid);
    return updateSide({ ...next, nextUid: drawn.nextUid }, side, drawn.side);
  }
  const top = s.deck[0];
  if (top === undefined) return loseByDeckOut(next, side);
  next = updateSide(next, side, { deck: s.deck.slice(1), manaPile: [...s.manaPile, top] });
  return addLog(addFx(next, 'manaGain', side), t('battle.log.fullHandMana', { n: BATTLE_RULES.refillHandTo }));
}

/**
 * 行動を適用する。ルール上できない行動は無視して state をそのまま返す
 * （UI の二重タップや AI の誤りで状態が壊れないようにする）。
 */
export function applyAction(state: BattleState, action: BattleAction): BattleState {
  if (state.phase === 'ended') return state;
  switch (action.type) {
    case 'useCard':
      return useCard(state, action.side, action.cardUid, action.userUid, action.targetUid, action.choice);
    case 'defend':
      return defend(state, action.side, action.cardUid);
    case 'endAttack': {
      if (state.phase !== 'main' || state.active !== action.side) return state;
      return addLog({ ...state, phase: 'mana' }, t(`battle.log.manaPhase.${action.side}`));
    }
    case 'convertToMana': {
      if (!canConvertToMana(state, action.side)) return state;
      const s = state.sides[action.side];
      const card = s.hand.find((c) => c.uid === action.cardUid);
      if (!card) return state;
      const limit = state.manaConvertLimit;
      const next = updateSide({ ...state, manaConvertLimit: limit === null ? null : limit - 1 }, action.side, {
        hand: s.hand.filter((c) => c.uid !== action.cardUid),
        manaPile: [...s.manaPile, card.cardId],
      });
      return addLog(
        addFx(next, 'manaConvert', action.side),
        t('battle.log.convert', { side: sideLabel(action.side), card: nameOf(card.cardId), n: manaOf(next.sides[action.side]) }),
      );
    }
    case 'endTurn': {
      if (state.phase !== 'mana' || state.active !== action.side) return state;
      return startTurn({ ...state, turn: state.turn + 1 }, otherSide(action.side));
    }
  }
}

function useCard(
  state: BattleState,
  side: Side,
  cardUid: string,
  userUid: string | undefined,
  targetUid: string | undefined,
  choice?: string,
): BattleState {
  if (state.phase !== 'main') return state;
  if (!cardUsability(state, side, cardUid).usable) return state;
  const hand = findHandCard(state, side, cardUid);
  if (!hand) return state;
  const handCard = getPlayCard(hand.cardId);
  // オーバードライブの3枚コンボ（ギアロス 指示書 AX）：α・β・γ のどれかを choice 'overdrive' で使うと、3枚まとめてコンボの攻撃1回
  const combo = choice === OVERDRIVE_CHOICE && OVERDRIVE_IDS.includes(handCard.id);
  if (combo && !overdriveUsability(state, side).usable) return state;
  const card = combo ? getSkill(OVERDRIVE_COMBO_ID) : handCard;
  if (card.kind === 'support') return useSupport(state, side, cardUid, card, targetUid, choice);
  const skill = card;
  const users = availableUsers(state, side, skill);
  // 使うモンスターの指定がなければ、選んだ相手に攻撃できるモンスター（ちょうはつで限られていないもの）を選ぶ
  // みずあび（自分を回復）は、指定がなければライフの一番減っているモンスターが使う（同じモンスターが2体以上いるとき）
  const selfHealer = skill.effect.type === 'healSelf' ? [...users].sort((a, b) => a.life - a.maxLife - (b.life - b.maxLife))[0] : undefined;
  // かぜのり（消費マナ−1）が効いているモンスターを先に
  const byCost = [...users].sort((a, b) => skillCost(state, skill, a) - skillCost(state, skill, b));
  const user = userUid
    ? users.find((m) => m.uid === userUid)
    : (selfHealer ?? (targetUid ? byCost.find((u) => targetsFor(state, side, skill, u).some((m) => m.uid === targetUid)) : undefined) ?? byCost[0]);
  if (!user) return state;
  const cost = skillCost(state, skill, user);
  if (manaOf(state.sides[side]) < cost) return state;

  const targets = targetsFor(state, side, skill, user);
  let target: BattleMonster | undefined;
  // 相手全体への攻撃（地ひびき）は相手を選ばない。攻撃できる相手の左から順に守りを聞く
  const allTargets = skill.effect.type === 'attack' && !!skill.effect.allTargets;
  if (allTargets) {
    target = targets[0];
    if (!target) return state;
  } else if (targetsEnemy(skill) || skill.effect.type === 'heal' || skill.effect.type === 'healAlly' || skill.effect.type === 'tailwind' || skill.effect.type === 'ward' || skill.effect.type === 'purify') {
    target = targetUid ? targets.find((m) => m.uid === targetUid) : undefined;
    if (!target) return state;
  }

  let next = combo ? overdriveHandCards(state, side).reduce((x, c) => removeFromHand(x, side, c.uid), state) : removeFromHand(state, side, cardUid);
  next = payMana(next, side, cost);
  // Wひっかき：その手番の最初の技なら、もう1回続けて使える印を付ける。2回目を使ったら印を消す（3回目は使えない）
  const chained = user.acted;
  const chain = !chained && skill.effect.type === 'attack' && skill.effect.chain ? { turn: state.turn, cardId: skill.id } : null;
  next = updateMonster(next, user.uid, { acted: true, chain });
  next = addLog(next, combo ? t('battle.log.overdrive', { name: nameOf(user.cardId) }) : t('battle.log.skill', { name: nameOf(user.cardId), skill: cardName(skill) }));
  if (chained) next = addLog(next, t('battle.log.chain', { name: nameOf(user.cardId), skill: cardName(skill) }));
  if (cost < skill.cost) next = addLog(next, t('battle.log.windRideCost', { name: nameOf(user.cardId), n: cost }));

  switch (skill.effect.type) {
    case 'attack': {
      if (!target || !skill.stat) return state;
      // うずまきショットの＋は、ねらった相手で決める（かばうで代わっても変えない）。
      // 相手全体への攻撃（地ひびき・おおたつまき）：おおたつまき（指示書 AS）は、相手ごとにいま空中かどうかで威力を決める（allPower）
      const power = attackPower(state, skill, user, target);
      const airBonus = allTargets ? 0 : airBonusAgainst(state, skill, target);
      const airTarget = allTargets && skill.effect.airBonus ? targets.find((m) => airBonusAgainst(state, skill, m) > 0) : undefined;
      const allPower = allTargets && skill.effect.airBonus ? { base: attackPower(state, skill, user), air: airTarget ? attackPower(state, skill, user, airTarget) : attackPower(state, skill, user) + skill.effect.airBonus } : undefined;
      const energized = energyOf(state, user, skill);
      const undodgeable = undodgeableNow(skill, user) && !skill.effect.undodgeable;
      // いかり・おたけび（ベニオウ 指示書 BP）：おたけびはちから技を使ったら消える（当たっても・守られても・回避されても）
      const rage = rageBonusOf(skill, user);
      const roared = roarOf(state, user, skill);
      if (rage > 0) next = addLog(next, t('battle.log.rage', { name: nameOf(user.cardId), n: rage }));
      if (roared) next = addLog(updateMonster(next, user.uid, { roar: null }), t('battle.log.roarDouble', { name: nameOf(user.cardId) }));
      // 吠える（次の技のダメージ−）は、その種類の技を使ったら消える
      if (weakenOf(state, user, skill) > 0) next = updateMonster(next, user.uid, { weaken: null });
      // ほっぺにためる・おいかぜは、攻撃技を使ったら消える（当たっても・守られても・回避されても）。おいかぜは効く手番に使ったときだけ消える
      if (user.charge) next = updateMonster(next, user.uid, { charge: null, chargeUntil: null });
      if (tailwindOf(state, user) > 0) next = updateMonster(next, user.uid, { tailwind: null });
      // 声援：攻撃技を1回使ったら消える
      if (cheerOf(state, user) > 0) next = updateMonster(next, user.uid, { cheer: null });
      // エネルギーをためる：効く手番の最初のかしこさ技で消える（ちから技では消えない）
      if (energized) next = addLog(updateMonster(next, user.uid, { energy: null }), t('battle.log.energyDouble', { name: nameOf(user.cardId) }));
      // 竜のまなざし・竜のちから（指示書 AX）：効く手番の最初の攻撃で消える（ちから技・かしこさ技どちらでも）
      const gaze = dragonGazeOf(state, user);
      const might = dragonMightOf(state, user);
      if (gaze) next = addLog(updateMonster(next, user.uid, { dragonGaze: null }), t('battle.log.dragonGazeUsed', { name: nameOf(user.cardId) }));
      if (might) next = addLog(updateMonster(next, user.uid, { dragonMight: null }), t('battle.log.dragonMightUsed', { name: nameOf(user.cardId) }));
      if (undodgeable) next = addLog(next, t('battle.log.chargedUndodgeable', { name: nameOf(user.cardId) }));
      if (allTargets) next = addLog(next, t('battle.log.allTargets', { name: nameOf(user.cardId) }));
      if (airBonus > 0) next = addLog(next, t('battle.log.airBonus', { n: airBonus }));
      // 防御も回避もできない攻撃は、守備を待たずにダメージ（竜のまなざし・竜のちからで両方そろったときも。相手全員への攻撃は1体ずつ守りの順を回す）
      if ((skill.effect.unblockable || might) && (skill.effect.undodgeable || gaze) && !allTargets) {
        // しめったはだ（受けるダメージ−）は守備のカードではないので、防御できない攻撃にも効く【要仕様確定】
        const dealt = Math.max(0, power - shieldOf(state, target, skill.stat.type));
        const lost = Math.min(dealt, target.life);
        const hit = clearPin(applyDamage(dealt > 0 ? addFx(next, hitKind(skill.id), side) : next, target.uid, dealt), target.uid);
        return attackRiders(drainHeal(dealt > 0 ? selfDamageOnHit(hit, skill.id, user.uid) : hit, skill.id, user.uid, lost), skill.id, side, target.uid);
      }
      return {
        ...next,
        phase: 'defense',
        pending: {
          attacker: side,
          userUid: user.uid,
          targetUid: target.uid,
          cardId: skill.id,
          stat: skill.stat.type,
          power,
          responses: [],
          ...(undodgeable ? { undodgeable: true } : {}),
          ...(isPinned(state, target) ? { pinned: true } : {}),
          ...(allTargets ? { queue: targets.slice(1).map((m) => m.uid) } : {}),
          ...(energized ? { energized: true } : {}),
          ...(gaze ? { dragonGaze: true } : {}),
          ...(might ? { dragonMight: true } : {}),
          ...(allPower ? { allPower } : {}),
        },
      };
    }
    case 'heal':
      return target ? healMonster(next, target, skillValue(skill)) : state;
    case 'healSelf': {
      // みずあび：使ったモンスター自身を回復（最大ライフまで）
      const self = findMonster(next, user.uid)?.monster;
      return self ? healMonster(next, self, skill.effect.amount) : state;
    }
    case 'healAlly': {
      // いやしのみつ：選んだ味方1体（使ったモンスターも選べる）を回復（最大ライフまで）。使ったモンスターを選んだときは、払ったあとの今の状態で
      const ally = target ? findMonster(next, target.uid)?.monster : undefined;
      return ally ? healMonster(next, ally, skill.effect.amount) : state;
    }
    case 'shield': {
      // しめったはだ：使った手番（turn）を含めて turns 手番のあいだ。重ねがけはせず、もう一度使ったら期限だけ新しく
      const e = skill.effect;
      next = updateMonster(next, user.uid, { shield: { against: e.against, reduce: e.reduce, untilTurn: state.turn + e.turns - 1 } });
      const stat = e.against === 'all' ? t('card.stat.all') : statLabel(e.against);
      return addLog(next, t('battle.log.shield', { name: nameOf(user.cardId), stat, n: e.reduce }));
    }
    case 'mana':
      // みちしお（セレフィーン）：amount 枚。使えるのは山札が足りるときだけ（skillUsability）
      return deckToMana(next, side, skill.effect.amount ?? skillValue(skill));
    case 'draw':
      return drawByEffect(next, side, skillValue(skill));
    case 'weaken': {
      // 【要仕様確定】重ねがけはしない（すでにかかっていても同じ量のまま）
      if (!target) return state;
      // まよけのふだ（クヨウ 指示書 BH）：相手の味方全員に悪い状態がつかない
      if (wardCharmActive(next, otherSide(side))) return wardCharmBlocked(next, target);
      const e = skill.effect;
      if (e.duration === 'nextTurn') {
        // ダストキック：相手の次の手番（turn + 1）の間だけ。手番が過ぎたら何もしなくても効かない
        next = updateMonster(next, target.uid, { weakenTurn: { stat: e.stat, amount: e.amount, turn: state.turn + 1 } });
        return addLog(next, t('battle.log.weakenTurn', { name: nameOf(target.cardId), stat: statLabel(e.stat), n: e.amount }));
      }
      if (e.duration === 'nextUseByNextTurn') {
        // 熱風の威嚇：次にその種類の技を使ったら消える。使わなくても、相手の次の手番（turn + 1）が過ぎたら効かない
        next = updateMonster(next, target.uid, { weaken: { stat: e.stat, amount: e.amount, untilTurn: state.turn + 1 } });
        return addLog(next, t('battle.log.weakenTurn', { name: nameOf(target.cardId), stat: statLabel(e.stat), n: e.amount }));
      }
      next = updateMonster(next, target.uid, { weaken: { stat: e.stat, amount: e.amount } });
      return addLog(next, t('battle.log.weaken', { name: nameOf(target.cardId), stat: statLabel(e.stat), n: e.amount }));
    }
    case 'seal': {
      // 相手の次の手番（turn + 1）の間、攻撃の技を使えない
      if (!target) return state;
      // しんぱんのせんこく（ラディエル 指示書 BI）：あわせて相手のマナ−manaDrain（0 未満にしない）。マナは悪い状態ではないので、まよけのふだが効いていても減る
      const drain = skill.effect.manaDrain ?? 0;
      if (wardCharmActive(next, otherSide(side))) {
        next = wardCharmBlocked(next, target);
      } else {
        next = updateMonster(next, target.uid, { sealedTurn: state.turn + 1 });
        next = addLog(next, t('battle.log.seal', { name: nameOf(target.cardId) }));
      }
      return drain > 0 ? drainMana(next, side, drain) : next;
    }
    case 'taunt': {
      // ちょうはつ：相手の次の手番（turn + 1）の間、使ったモンスターと同じ種類にしか攻撃できない
      if (!target) return state;
      if (wardCharmActive(next, otherSide(side))) return wardCharmBlocked(next, target);
      next = updateMonster(next, target.uid, { taunt: { monsterId: user.cardId, turn: state.turn + 1 } });
      return addLog(next, t('battle.log.taunt', { name: nameOf(target.cardId), only: nameOf(user.cardId) }));
    }
    case 'hide': {
      // すなをほる：相手の次の手番（turn + 1）の間、使ったモンスターは攻撃の技の対象にならない
      next = updateMonster(next, user.uid, { hiddenTurn: state.turn + 1 });
      return addLog(next, t('battle.log.hide', { name: nameOf(user.cardId) }));
    }
    case 'charge': {
      // ほっぺにためる：次の攻撃技のダメージ＋amount。重ねない（もう一度使っても amount のまま）
      // とおぼえ（ロウガ 指示書 BL）：期限つき（使った側の次の自分の手番の終わりまで）。重ねない（もう一度使ったら期限を数え直す）
      if (skill.effect.untilNextTurn) {
        next = updateMonster(next, user.uid, { charge: skill.effect.amount, chargeUntil: state.turn + 2 });
        return addLog(next, t('battle.log.howl', { name: nameOf(user.cardId), n: skill.effect.amount }));
      }
      next = updateMonster(next, user.uid, { charge: skill.effect.amount, chargeUntil: null });
      return addLog(next, t('battle.log.charge', { name: nameOf(user.cardId), n: skill.effect.amount }));
    }
    case 'tailwind': {
      // おいかぜ：選んだ味方の、次の自分の手番（turn + 2）の攻撃技のダメージ＋amount（2026-10-29 カードの文のとおり。かけた同じ手番には効かない）。
      // 重ねない（もう一度かけたら、効く手番だけ新しく）
      if (!target) return state;
      next = updateMonster(next, target.uid, { tailwind: { amount: skill.effect.amount, turn: state.turn + 2 } });
      return addLog(next, t('battle.log.tailwind', { name: nameOf(target.cardId), n: skill.effect.amount }));
    }
    case 'pin': {
      // じならし：選んだ相手は、この手番に受ける次の攻撃1回を回避できない。1ターンに1回（turnUsage で数える）
      if (!target) return state;
      // まよけのふだ（クヨウ 指示書 BH の直し）：回避できない も悪い状態。1ターンに1回の数には入れる（使ったので）
      if (wardCharmActive(next, otherSide(side))) {
        const used = next.sides[side].turnUsage;
        return wardCharmBlocked(updateSide(next, side, { turnUsage: { ...used, [PIN_USAGE]: (used[PIN_USAGE] ?? 0) + 1 } }), target);
      }
      next = updateMonster(next, target.uid, { pinTurn: state.turn });
      const usage = next.sides[side].turnUsage;
      next = updateSide(next, side, { turnUsage: { ...usage, [PIN_USAGE]: (usage[PIN_USAGE] ?? 0) + 1 } });
      return addLog(next, t('battle.log.pin', { name: nameOf(target.cardId) }));
    }
    case 'energy': {
      // エネルギーをためる：次の自分の手番（turn + 2）に最初に使うかしこさ技1回だけ2倍。重ねない（もう一度使ったら効く手番だけ新しく）
      next = updateMonster(next, user.uid, { energy: { turn: state.turn + 2 } });
      return addLog(next, t('battle.log.energy', { name: nameOf(user.cardId) }));
    }
    case 'dragonGaze': {
      // 竜のまなざし（指示書 AX）：次の自分の手番（turn + 2）に最初に使う攻撃1回は回避されない。重ねない（もう一度使ったら効く手番だけ新しく）
      next = updateMonster(next, user.uid, { dragonGaze: { turn: state.turn + 2 } });
      return addLog(next, t('battle.log.dragonGaze', { name: nameOf(user.cardId) }));
    }
    case 'dragonMight': {
      // 竜のちから（指示書 AX）：次の自分の手番（turn + 2）に最初に使う攻撃1回は防御されない。重ねない
      next = updateMonster(next, user.uid, { dragonMight: { turn: state.turn + 2 } });
      return addLog(next, t('battle.log.dragonMight', { name: nameOf(user.cardId) }));
    }
    case 'windRide': {
      // かぜのり：次の自分の手番（turn + 2）の間、使ったモンスターの攻撃技の消費マナ−discount。重ねない（もう一度使ったら効く手番だけ新しく）
      next = updateMonster(next, user.uid, { windRide: { discount: skill.effect.discount, turn: state.turn + 2 } });
      return addLog(next, t('battle.log.windRide', { name: nameOf(user.cardId), n: skill.effect.discount }));
    }
    case 'tide': {
      // みちしお（指示書 AJ の追加その3）：使った側の次の自分の手番（turn + 2）の終わりまで場が水中。場の枠は1つで、前の場は上書き（期限もここから数え直す）
      next = setField(next, { cardId: skill.id, owner: side, habitat: 'water', untilTurn: state.turn + 2 });
      return addLog(next, t('battle.log.tide', { name: nameOf(user.cardId) }));
    }
    case 'requiem':
      return requiem(next, user.uid);
    case 'handToDeck':
      return handToDeck(next, otherSide(side));
    case 'discardRandom':
      return discardRandom(next, otherSide(side));
    case 'discardChoice':
      return discardChoice(next, side, choice);
    case 'ward': {
      // そなえのふえ（フォルン 指示書 AL）：選んだ味方が、次の相手の手番（turn + 1）が終わるまで受ける攻撃のダメージ−reduce。重ねない（かけ直すと期限だけ新しく）
      if (!target) return state;
      next = updateMonster(next, target.uid, { ward: { reduce: skill.effect.reduce, untilTurn: state.turn + 1 } });
      return addLog(next, t('battle.log.ward', { name: nameOf(target.cardId), n: skill.effect.reduce }));
    }
    case 'purify': {
      // おはらい（クヨウ 指示書 BH）：選んだ味方の悪い状態をすべて消し（攻撃できない・行動できない／凍る・技のダメージ−・おびきよせ・回避できない）、
      // ライフ＋heal（もとの LIFE まで。BH の直し）。悪い状態が無ければ消す記録は出さない
      if (!target) return state;
      const had = badStatusKinds(next, target).length > 0;
      next = updateMonster(next, target.uid, { sealedTurn: null, stunnedTurn: null, stunMark: null, weaken: null, weakenTurn: null, taunt: null, pinTurn: null, dragUnder: null, menace: null });
      if (had) next = addLog(next, t('battle.log.purify', { name: nameOf(target.cardId) }));
      const after = findMonster(next, target.uid)?.monster;
      const heal = skill.effect.heal ?? 0;
      return after && heal > 0 && after.life < after.maxLife ? healMonster(next, after, heal) : next;
    }
    case 'wardCharm': {
      // まよけのふだ（クヨウ 指示書 BH）：次の相手の手番（turn + 1）が終わるまで、味方全員に悪い状態がつかない。重ねても延びない
      const until = Math.max(state.turn + 1, wardCharmActive(next, side) ? (next.sides[side].wardCharm?.untilTurn ?? 0) : 0);
      next = updateSide(next, side, { wardCharm: { untilTurn: until } });
      return addLog(next, t('battle.log.wardCharm', { side: sideLabel(side) }));
    }
    case 'lastJudgment':
      return lastJudgment(next, side);
    case 'heavenGrace': {
      // 天の恵み（ラディエル 指示書 BI）：使う前の捨て札の新しい順から count 枚をマナに（このカードと払ったマナは入らない）。山札は減らさない
      const before = state.sides[side].discard;
      const k = Math.min(skill.effect.count, before.length);
      const picked = before.slice(before.length - k);
      const now = next.sides[side];
      next = updateSide(next, side, { discard: [...before.slice(0, before.length - k), ...now.discard.slice(before.length)], manaPile: [...now.manaPile, ...picked.reverse()] });
      return addLog(k > 0 ? addFx(next, 'manaGain', side) : next, t('battle.log.heavenGrace', { n: k }));
    }
    case 'drawTo':
      return drawToHand(next, side, skill.effect.hand, choice);
    case 'searchEvade':
      return searchEvade(next, side, choice);
    case 'searchAny':
      return searchAny(next, side, choice);
    case 'focus':
      // しゅうちゅう（ステラード 指示書 BQ）：使った側の次の自分の手番の終わりまで。重ねない（期限を数え直す）
      next = updateSide(next, side, { focus: { untilTurn: state.turn + 2, ownerUid: user.uid } });
      return addLog(next, t('battle.log.focus'));
    case 'roar':
      // おたけび（ベニオウ 指示書 BP）：使った側の次の自分の手番の終わりまで。重ねない（期限を数え直す）
      next = updateMonster(next, user.uid, { roar: { untilTurn: state.turn + 2 } });
      return addLog(next, t('battle.log.roar', { name: nameOf(user.cardId) }));
    case 'menace': {
      // おにのいあつ（ベニオウ 指示書 BP）：選んだ相手は、使った側の次の自分の手番の終わりまで回避できない。悪い状態（まよけのふだの間はつかない）
      if (!target) return state;
      if (wardCharmActive(next, otherSide(side))) return wardCharmBlocked(next, target);
      next = updateMonster(next, target.uid, { menace: { untilTurn: state.turn + 2 } });
      return addLog(next, t('battle.log.menace', { name: nameOf(target.cardId) }));
    }
    case 'millDeck':
      return millDeck(next, side, skill.effect.count);
    case 'featherRest': {
      // はねやすめ（フギン 指示書 BM）：使ったモンスターに印。重ねない（印が付いていても1回分のまま）
      next = updateMonster(next, user.uid, { featherRest: true });
      return addLog(next, t('battle.log.featherRest', { name: nameOf(user.cardId) }));
    }
    case 'redrawHand':
      return redrawHand(next, side);
    case 'systemChange':
      return systemChange(next, side, choice);
    case 'systemCheck': {
      // システムチェック（指示書 AX）：山札の上から count 枚まで、使った人だけが見る（山札は動かさない）
      const cardIds = next.sides[side].deck.slice(0, skill.effect.count);
      next = { ...next, deckPeek: { seq: (next.deckPeek?.seq ?? 0) + 1, viewer: side, cardIds } };
      return addLog(next, t('battle.log.systemCheck', { side: sideLabel(side), n: cardIds.length }));
    }
    case 'revealHand':
      return revealHand(next, side);
    case 'defense':
    case 'evade':
    case 'cover':
      return state;
  }
}

/** まよけのふだ（クヨウ 指示書 BH）が悪い状態を防いだ（記録だけ。技のマナ・カードは使ったまま） */
function wardCharmBlocked(state: BattleState, target: BattleMonster): BattleState {
  return addLog(state, t('battle.log.wardCharmBlocked', { name: nameOf(target.cardId) }));
}

/**
 * 場の枠に新しい場を出す（場の枠は1つだけ。前の場は上書き。2026-11-01 指示書 AJ の追加その3）。
 * 前の場がサポートの場のカードなら、出した側の捨て札へ（今までどおり）。みちしお の水中なら水が引く（技のカードは使ったときに捨て札へ行っている）
 */
function setField(state: BattleState, field: FieldCard): BattleState {
  let next = state;
  const old = activeField(state);
  if (old) {
    const oldCard = cardCatalog.get(old.cardId);
    if (oldCard?.kind === 'support') {
      const owner = next.sides[old.owner];
      next = updateSide(next, old.owner, { discard: [...owner.discard, old.cardId] });
      next = addLog(next, t('battle.log.fieldDiscard', { card: nameOf(old.cardId) }));
    } else if (old.habitat === 'water') {
      next = addLog(next, t('battle.log.tideEnd'));
    }
  } else if (state.field) {
    // 期限の過ぎた場が残っていた（ふつうは手番の始めに消える）
    const oldCard = cardCatalog.get(state.field.cardId);
    if (oldCard?.kind === 'support') next = updateSide(next, state.field.owner, { discard: [...next.sides[state.field.owner].discard, state.field.cardId] });
  }
  return { ...next, field };
}

/**
 * しずめの祈り（指示書 AQ）：場を空にする。場のサポートの場のカードは出した人の捨て札へ。みちしおの水中なら、水がすぐ引く（居場所もすぐ戻る）
 */
function clearField(state: BattleState): BattleState {
  const old = activeField(state);
  if (!old) return state;
  let next: BattleState = { ...state, field: null };
  const oldCard = cardCatalog.get(old.cardId);
  if (oldCard?.kind === 'support') {
    next = updateSide(next, old.owner, { discard: [...next.sides[old.owner].discard, old.cardId] });
    next = addLog(next, t('battle.log.fieldCleared', { card: nameOf(old.cardId) }));
    return addLog(next, t('battle.log.fieldDiscard', { card: nameOf(old.cardId) }));
  }
  next = addLog(next, t('battle.log.fieldCleared', { card: nameOf(old.cardId) }));
  return old.habitat === 'water' ? addLog(next, t('battle.log.tideEnd')) : next;
}

/**
 * 死のレクイエム（指示書 AJ：デスオル）：ライフ1以下の、使ったモンスター以外のモンスター（味方も相手も）をすべて倒す。特殊技なので守れない。
 * 倒れた数を記録に書く。両方が全滅したら、いまの手番の側の勝ち（checkKnockout。使ったデスオルは残るので、ふつうは起きない）
 */
function requiem(state: BattleState, userUid: string): BattleState {
  const victims = requiemVictims(state, userUid);
  let next = state;
  for (const m of victims) {
    next = updateMonster(next, m.uid, { life: 0, charge: null, chargeUntil: null, featherRest: null, tailwind: null, ward: null, pinTurn: null, energy: null, dragonGaze: null, dragonMight: null, windRide: null, chain: null, cheer: null, dragUnder: null, roar: null, menace: null });
  }
  next = addLog(next, victims.length > 0 ? t('battle.log.requiem', { n: victims.length, names: victims.map((m) => nameOf(m.cardId)).join(t('common.listSeparator')) }) : t('battle.log.requiemNone'));
  return checkKnockout(next);
}

/**
 * 考える（正式：ノビトン 2026-10-25）：使ったカードを除いた自分の手札をすべて山札へ戻してシャッフルし、戻した枚数だけ引く。
 * 戻す手札がないときは使えない（cardUsability）
 */
function redrawHand(state: BattleState, side: Side): BattleState {
  const s = state.sides[side];
  const n = s.hand.length;
  if (n === 0) return state;
  const mixed = shuffle([...s.deck, ...s.hand.map((c) => c.cardId)], state.seed);
  const emptied = updateSide({ ...state, seed: mixed.seed }, side, { hand: [], deck: mixed.items });
  return drawUpToMax(emptied, side, n, (drawn) => t('battle.log.redrawHand', { side: sideLabel(side), n: drawn }));
}

/**
 * システムチェンジ（ギアロス 2026-11-05 指示書 AX）：自分の手札から1枚（choice＝uid）を自分の山札のいちばん下に戻す → 山札の上から1枚引く → 山札をシャッフル。
 * 戻した札をすぐ引き直さないように「いちばん下」に入れる【要確認】。指定が無い・手札に無いときは defaultSystemChange（CPU・試遊）。
 * 引く札は必ずある（戻した札が山札に入るので、山札切れの負けにはならない）
 */
function systemChange(state: BattleState, side: Side, choice: string | undefined): BattleState {
  const s = state.sides[side];
  const card = s.hand.find((c) => c.uid === choice) ?? defaultSystemChange(state, side);
  if (!card) return state;
  let next = updateSide(state, side, { hand: s.hand.filter((c) => c.uid !== card.uid), deck: [...s.deck, card.cardId] });
  const drawn = drawCards(next.sides[side], 1, next.nextUid);
  next = updateSide({ ...next, nextUid: drawn.nextUid }, side, drawn.side);
  const mixed = shuffle([...next.sides[side].deck], next.seed);
  next = updateSide({ ...next, seed: mixed.seed }, side, { deck: mixed.items });
  return addLog(next, t('battle.log.systemChange', { side: sideLabel(side) }));
}

/**
 * システムチェンジで戻す1枚の決まった選び方（指定が無いとき：CPU・試遊）：いま使えない札（守りの札を除く。マナが足りない・届く相手がいない）のうち必要マナのいちばん多いもの。
 * 無ければ必要マナのいちばん多い札（守りの札は後回し）
 */
export function defaultSystemChange(state: BattleState, side: Side): HandCard | undefined {
  const hand = state.sides[side].hand.filter((c) => getPlayCard(c.cardId).effect.type !== 'systemChange');
  const guard = (c: HandCard): boolean => {
    const k = getPlayCard(c.cardId);
    return k.kind === 'skill' && (k.effect.type === 'defense' || k.effect.type === 'evade' || k.effect.type === 'cover');
  };
  const cost = (c: HandCard): number => getPlayCard(c.cardId).cost;
  const mana = manaOf(state.sides[side]);
  const stuck = hand.filter((c) => !guard(c) && (cost(c) > mana || !cardUsability(state, side, c.uid).usable));
  const pool = stuck.length > 0 ? stuck : hand.filter((c) => !guard(c)).length > 0 ? hand.filter((c) => !guard(c)) : hand;
  return [...pool].sort((a, b) => cost(b) - cost(a))[0];
}

/**
 * 最後の審判（ラディエル 2026-11-05 指示書 BI）：使った側 → 相手 の順に、それぞれ
 * ① 手札をすべて自分の山札のいちばん下に戻す → ② 戻した枚数と同じ枚数を山札の上から引く → ③ 山札をシャッフル（この順番。先にシャッフルしない）。
 * 戻した札が山札に入るので、引く枚数が足りないことは無い（山札切れの負けにはならない）。使った最後の審判のカードは先に捨て札へ行っている
 */
function lastJudgment(state: BattleState, side: Side): BattleState {
  let next = state;
  for (const who of [side, otherSide(side)] as const) {
    const s = next.sides[who];
    const n = s.hand.length;
    next = updateSide(next, who, { hand: [], deck: [...s.deck, ...s.hand.map((c) => c.cardId)] });
    const drawn = drawCards(next.sides[who], n, next.nextUid);
    next = updateSide({ ...next, nextUid: drawn.nextUid }, who, drawn.side);
    const mixed = shuffle([...next.sides[who].deck], next.seed);
    next = updateSide({ ...next, seed: mixed.seed }, who, { deck: mixed.items });
  }
  return addLog(next, t('battle.log.lastJudgment'));
}

/**
 * 不思議な嗅覚（正式：ノビトン 2026-10-25）：相手の手札をすべて確認する。手札は動かさず、画面に表を見せる（state.reveal）。
 * 相手の手札がないときは使えない（cardUsability）
 */
function revealHand(state: BattleState, side: Side): BattleState {
  const other = otherSide(side);
  const cardIds = state.sides[other].hand.map((c) => c.cardId);
  const next: BattleState = { ...state, reveal: { seq: (state.reveal?.seq ?? 0) + 1, viewer: side, cardIds } };
  return addLog(next, t('battle.log.revealHand', { side: sideLabel(side), other: sideLabel(other), n: cardIds.length }));
}

/** 相手（side の反対）のマナを n 減らす（0 より下にはならない）。減らしたカードは捨て札へ */
function drainMana(state: BattleState, side: Side, n: number): BattleState {
  const victim = otherSide(side);
  // しゅうちゅう（ステラード 指示書 BQ）：期限の間は、マナを減らす効果を受けない
  if (focusActive(state, victim)) return addLog(state, t('battle.log.focusBlocked'));
  const before = manaOf(state.sides[victim]);
  const next = payMana(state, victim, n);
  const lost = before - manaOf(next.sides[victim]);
  return addLog(next, t('battle.log.manaDrain', { side: sideLabel(victim), n: lost }));
}

/** からっぽのつぼ（ノウス 指示書 BN・BO）：相手（side の反対）のマナを 0 に。減らしたカードは捨て札へ */
function emptyMana(state: BattleState, side: Side): BattleState {
  const victim = otherSide(side);
  if (focusActive(state, victim)) return addLog(state, t('battle.log.focusBlocked'));
  const before = manaOf(state.sides[victim]);
  if (before === 0) return addLog(state, t('battle.log.manaAlreadyZero', { side: sideLabel(victim) }));
  return addLog(payMana(state, victim, before), t('battle.log.manaZero', { side: sideLabel(victim) }));
}

/**
 * 攻撃に付いた効果（正式：ノビトン 2026-10-25。くしゃみ・ダウナーミストの「相手マナ−」、まきつくの「対象は次ターン行動不可」）。
 * 【要仕様確定】回避されなければ発動する（防御でダメージが0になっても発動。回避されたら発動しない）。勝負がついたあとは何もしない
 */
function attackRiders(state: BattleState, skillId: string, attacker: Side, targetUid: string): BattleState {
  const e = attackCardOf(skillId).effect;
  if (e.type !== 'attack' || state.phase === 'ended') return state;
  let next = state;
  if (e.manaDrain) next = drainMana(next, attacker, e.manaDrain);
  // からっぽのつぼ（ノウス 指示書 BN）：相手のマナを 0 に（くしゃみと同じ減らし方）。記録は「〇〇のマナが0になった。」・もともと0なら「〇〇のマナはもう0だった。」（指示書 BO）
  if (e.manaZero) next = emptyMana(next, attacker);
  if (e.stunTarget) {
    const target = findMonster(next, targetUid);
    if (target && target.monster.life > 0 && wardCharmActive(next, target.side)) {
      // まよけのふだ（クヨウ 指示書 BH）：ダメージは受けるが、行動できない・凍るはつかない
      next = wardCharmBlocked(next, target.monster);
    } else if (target && target.monster.life > 0) {
      next = updateMonster(next, targetUid, { stunnedTurn: state.turn + 1, stunMark: e.stunMark ?? null });
      next = addLog(next, t('battle.log.stun', { name: nameOf(target.monster.cardId) }));
    }
  }
  if (e.sealTarget) {
    // よみのまなざし（フギン 指示書 BM）：当たったら（防御でダメージが減っても）相手の次の手番は攻撃できない（すなかけと同じ印）。まよけのふだの間はつかない
    const target = findMonster(next, targetUid);
    if (target && target.monster.life > 0 && wardCharmActive(next, target.side)) {
      next = wardCharmBlocked(next, target.monster);
    } else if (target && target.monster.life > 0) {
      next = updateMonster(next, targetUid, { sealedTurn: state.turn + 1 });
      next = addLog(next, t('battle.log.seal', { name: nameOf(target.monster.cardId) }));
    }
  }
  if (e.dragUnder) {
    // ひきずりこむ（クロシオ 指示書 BK）：当たったら（防御でダメージが減っても）水中に。期限は使った側の次の自分の手番の終わり（みちしおと同じ）。
    // 重ねない（数え直す）。まよけのふだの間はつかない。倒れた相手にはつけない
    const target = findMonster(next, targetUid);
    if (target && target.monster.life > 0 && wardCharmActive(next, target.side)) {
      next = wardCharmBlocked(next, target.monster);
    } else if (target && target.monster.life > 0) {
      next = updateMonster(next, targetUid, { dragUnder: { untilTurn: state.turn + 2 } });
      next = addLog(next, t('battle.log.dragUnder', { name: nameOf(target.monster.cardId) }));
    }
  }
  return next;
}

/**
 * 吠える（正式：ソラモ14技 2026-10-25）「相手の手札からランダムに1枚を捨てさせる」：side の手札からランダムに1枚を、その捨て札へ。補充はしない。
 * 手札が0枚のときは使えない（cardUsability。いたずらと同じ）
 */
function discardRandom(state: BattleState, side: Side): BattleState {
  const s = state.sides[side];
  if (s.hand.length === 0) return state;
  const pick = nextInt(state.seed, s.hand.length);
  const card = s.hand[pick.value] as HandCard;
  const next = updateSide({ ...state, seed: pick.seed }, side, { hand: s.hand.filter((c) => c.uid !== card.uid), discard: [...s.discard, card.cardId] });
  return addLog(next, t('battle.log.discardRandom', { player: s.name, card: nameOf(card.cardId) }));
}

/**
 * カラスのめ（正式：デスオル 2026-10-31 指示書 AG）「相手の手札をすべて見て、1枚選んで捨てさせる」：
 * side が相手の手札から選んだ1枚（choice＝相手の手札の uid）を、相手の捨て札へ。相手は補充しない。
 * 選んだカードが手札に無い・指定が無いとき（試遊・テスト）は、CPU と同じ選び方（ai.ts の pickDiscardChoice と同じ順）の1枚。
 * 相手の手札が0枚なら使えない（cardUsability。吠えると同じ）。捨てたカードは記録の帯に出し、画面に知らせる（state.crowEye）
 */
function discardChoice(state: BattleState, side: Side, choice: string | undefined): BattleState {
  const victim = otherSide(side);
  const s = state.sides[victim];
  if (s.hand.length === 0) return state;
  const card = s.hand.find((c) => c.uid === choice) ?? defaultDiscardChoice(state, side);
  if (!card) return state;
  const next: BattleState = {
    ...updateSide(state, victim, { hand: s.hand.filter((c) => c.uid !== card.uid), discard: [...s.discard, card.cardId] }),
    crowEye: { seq: (state.crowEye?.seq ?? 0) + 1, chooser: side, cardId: card.cardId },
  };
  return addLog(next, t('battle.log.discardChoice', { player: s.name, card: nameOf(card.cardId) }));
}

/**
 * もりのたより（フォルン 2026-11-02 指示書 AL）で、使ったあとに手札がどうなるか（このカードを除いた手札＋山札から引く札。引いたときに付く uid のまま）。
 * 画面はこれを並べて捨てる1枚を選ばせ、CPU（ai.ts）はこれでいちばん要らない札を選ぶ。山札が足りなければ引けるだけ
 */
export function drawToPreview(state: BattleState, side: Side, cardUid: string): HandCard[] {
  const card = findHandCard(state, side, cardUid);
  const effect = card ? getPlayCard(card.cardId).effect : null;
  const size = effect?.type === 'drawTo' ? effect.hand : 0;
  const s = state.sides[side];
  const hand = s.hand.filter((c) => c.uid !== cardUid);
  const n = Math.max(0, Math.min(size - hand.length, s.deck.length));
  return [...hand, ...s.deck.slice(0, n).map((cardId, i) => ({ uid: `c${state.nextUid + i}`, cardId }))];
}

/**
 * もりのたより（フォルン 2026-11-02 指示書 AL）：手札が size 枚になるまで山札から引く（山札が足りなければ引けるだけ。山札切れの負けにはしない。
 * 手札の上限〔9〕を超えることは無い）。そのあと手札から1枚（choice＝uid）を捨て札へ。指定が無い・手札に無いときは defaultSelfDiscard
 */
function drawToHand(state: BattleState, side: Side, size: number, choice: string | undefined): BattleState {
  const s = state.sides[side];
  const room = Math.max(0, Math.min(size, BATTLE_RULES.maxHand) - s.hand.length);
  const drawn = drawCards(s, room, state.nextUid);
  let next = updateSide({ ...state, nextUid: drawn.nextUid }, side, drawn.side);
  next = addLog(next, t('battle.log.drawTo', { side: sideLabel(side), n: drawn.drawn }));
  const hand = next.sides[side].hand;
  const out = hand.find((c) => c.uid === choice) ?? defaultSelfDiscard(next, side);
  if (!out) return next;
  const s2 = next.sides[side];
  next = updateSide(next, side, { hand: s2.hand.filter((c) => c.uid !== out.uid), discard: [...s2.discard, out.cardId] });
  return addLog(next, t('battle.log.drawToDiscard', { side: sideLabel(side), card: nameOf(out.cardId) }));
}

/** ちえのささやき（フギン 指示書 BM）で選べる、自分の山札の回避の技カード（同じカードは1つにまとめる。山札の順） */
export function searchEvadeChoices(state: BattleState, side: Side): string[] {
  return [...new Set(state.sides[side].deck.filter((id) => isEvadeCardId(id)))];
}

const isEvadeCardId = (id: string): boolean => {
  const c = cardCatalog.get(id);
  return c?.kind === 'skill' && c.effect.type === 'evade';
};

/** さきよみ → かぜよみ の順（指示書 BM の CPU の選び方。同じ条件のとき） */
const SEARCH_EVADE_ORDER: readonly string[] = ['skl-huginn-12', 'skl-huginn-11'];

/**
 * ちえのささやきで手札に加える回避の決まった選び方（指定が無いとき：CPU・試遊）：
 * ① いまのマナで出せる回避（はねやすめ・守りの陣も入れる）→ ② さきよみ → かぜよみ → ほかの回避（マナの少ない順）
 */
export function defaultSearchEvade(state: BattleState, side: Side): string | undefined {
  const mana = manaOf(state.sides[side]);
  const rank = (id: string): number => {
    const i = SEARCH_EVADE_ORDER.indexOf(id);
    return i >= 0 ? i : SEARCH_EVADE_ORDER.length;
  };
  const cost = (id: string): number => guardCost(state, getSkill(id), side);
  return searchEvadeChoices(state, side).sort((a, b) => Number(cost(a) > mana) - Number(cost(b) > mana) || rank(a) - rank(b) || cost(a) - cost(b))[0];
}

/**
 * ちえのささやき（フギン 2026-11-06 指示書 BM）：山札から回避の技カードを1枚（choice＝カードの ID。無い・合わなければ決まった選び方）手札に加え、山札をシャッフル。
 * 山札に回避が無ければ、かわりに1枚引く。山札が0枚なら使えない（cardUsability。BM の直し）
 */
function searchEvade(state: BattleState, side: Side, choice: string | undefined): BattleState {
  const s = state.sides[side];
  // 山札が0枚のときは使えない（cardUsability）。念のため何もしない
  if (s.deck.length === 0) return state;
  const choices = searchEvadeChoices(state, side);
  if (choices.length === 0) {
    const drawn = drawCards(s, 1, state.nextUid);
    const next = updateSide({ ...state, nextUid: drawn.nextUid }, side, drawn.side);
    return addLog(next, t('battle.log.searchEvadeDraw', { side: sideLabel(side) }));
  }
  const id = choice && choices.includes(choice) ? choice : (defaultSearchEvade(state, side) as string);
  const at = s.deck.indexOf(id);
  const rest = [...s.deck.slice(0, at), ...s.deck.slice(at + 1)];
  const mixed = shuffle(rest, state.seed);
  const next = updateSide({ ...state, seed: mixed.seed, nextUid: state.nextUid + 1 }, side, { deck: mixed.items, hand: [...s.hand, { uid: `c${state.nextUid}`, cardId: id }] });
  return addLog(next, t('battle.log.searchEvade', { side: sideLabel(side), card: nameOf(id) }));
}

/** ぜんちぜんのう（ノウス 指示書 BN）で選べる、自分の山札のカード（同じカードは1つにまとめる。山札の順） */
export function searchAnyChoices(state: BattleState, side: Side): string[] {
  return [...new Set(state.sides[side].deck)];
}

/** 攻撃のダメージ（カードの数字。無ければ 0） */
const cardDamageOf = (id: string): number => {
  const c = cardCatalog.get(id);
  return c?.kind === 'skill' && c.effect.type === 'attack' ? (c.stat?.value ?? 0) : 0;
};

/**
 * ぜんちぜんのうで手札に加えるカードの決まった選び方（指定が無いとき：CPU・試遊。指示書 BN の目安）：
 * ① 生きている味方が使える攻撃で、いまのマナ（ぜんちぜんのうを払ったあと）で撃てる、いちばんダメージの大きいもの（同じならマナの多い方）
 * → ② 回避（マナの少ない順）→ ③ 生きている味方が使える攻撃（マナが足りなくても。ダメージの大きい順）→ ④ 山札のいちばん上
 */
export function defaultSearchAny(state: BattleState, side: Side): string | undefined {
  const choices = searchAnyChoices(state, side);
  if (choices.length === 0) return undefined;
  const me = state.sides[side];
  const mana = manaOf(me);
  const alive = new Set(me.monsters.filter((m) => m.life > 0).map((m) => m.cardId));
  const skillOf = (id: string): SkillCard | null => {
    const c = cardCatalog.get(id);
    return c?.kind === 'skill' && alive.has(c.monsterId) ? c : null;
  };
  const attacks = choices.filter((id) => skillOf(id)?.effect.type === 'attack');
  const byDamage = (a: string, b: string): number => cardDamageOf(b) - cardDamageOf(a) || getSkill(b).cost - getSkill(a).cost;
  const affordable = attacks.filter((id) => getSkill(id).cost <= mana).sort(byDamage);
  if (affordable[0]) return affordable[0];
  const evades = choices.filter((id) => skillOf(id)?.effect.type === 'evade').sort((a, b) => guardCost(state, getSkill(a), side) - guardCost(state, getSkill(b), side));
  if (evades[0]) return evades[0];
  return attacks.sort(byDamage)[0] ?? choices[0];
}

/**
 * ぜんちぜんのう（ノウス 2026-11-07 指示書 BN）：山札から好きなカードを1枚（choice＝カードの ID。無い・合わなければ決まった選び方）手札に加え、山札をシャッフル。
 * 山札が0枚なら使えない（cardUsability）。ここでは念のため何もしない
 */
function searchAny(state: BattleState, side: Side, choice: string | undefined): BattleState {
  const s = state.sides[side];
  if (s.deck.length === 0) return state;
  const choices = searchAnyChoices(state, side);
  const id = choice && choices.includes(choice) ? choice : (defaultSearchAny(state, side) as string);
  const at = s.deck.indexOf(id);
  const rest = [...s.deck.slice(0, at), ...s.deck.slice(at + 1)];
  const mixed = shuffle(rest, state.seed);
  const next = updateSide({ ...state, seed: mixed.seed, nextUid: state.nextUid + 1 }, side, { deck: mixed.items, hand: [...s.hand, { uid: `c${state.nextUid}`, cardId: id }] });
  return addLog(next, t('battle.log.searchAny', { side: sideLabel(side), card: nameOf(id) }));
}

/**
 * ときをすいとる（ノウス 2026-11-07 指示書 BN）：相手の山札の上から count 枚を相手の捨て札に。足りなければあるだけ、0枚なら何もしない。
 * この技で山札切れの負けにはしない。捨てたカードは記録に出す
 */
function millDeck(state: BattleState, side: Side, count: number): BattleState {
  const foe = otherSide(side);
  const s = state.sides[foe];
  const milled = s.deck.slice(0, Math.max(0, Math.min(count, s.deck.length)));
  if (milled.length === 0) return addLog(state, t('battle.log.millDeckNone', { side: sideLabel(foe) }));
  const next = updateSide(state, foe, { deck: s.deck.slice(milled.length), discard: [...s.discard, ...milled] });
  return addLog(next, t('battle.log.millDeck', { side: sideLabel(foe), n: milled.length, cards: milled.map((id) => nameOf(id)).join(t('common.listSeparator')) }));
}

/** もりのたよりで捨てる1枚の決まった選び方（指定が無いとき：試遊・テスト）。必要マナのいちばん多い札（同じなら右はし）。CPU は ai.ts の pickDrawToDiscard で選ぶ */
export function defaultSelfDiscard(state: BattleState, side: Side): HandCard | undefined {
  const cost = (c: HandCard): number => getPlayCard(c.cardId).cost;
  return [...state.sides[side].hand].reverse().sort((a, b) => cost(b) - cost(a))[0];
}

/**
 * カラスのめで捨てさせる1枚の決まった選び方（CPU の腕前 A・B と同じ。ai.ts の pickDiscardChoice もこれを使う）：
 * ① 次の相手の手番に払えるマナで使える攻撃技のうち、side のモンスターを倒せるもの（いちばんダメージの大きいもの）
 * ② 無ければ、いちばんダメージの大きい攻撃技 → ③ 攻撃技が無ければ、条件の無い回避 → ④ 防御 → ⑤ 残りの左はし
 */
export function defaultDiscardChoice(state: BattleState, side: Side): HandCard | undefined {
  const victim = otherSide(side);
  const vs = state.sides[victim];
  const hand = vs.hand;
  const skillOf = (c: HandCard): SkillCard | null => {
    const card = getPlayCard(c.cardId);
    return card.kind === 'skill' ? card : null;
  };
  // 相手の生きているモンスターが使える攻撃技（持ち主が生きているもの）
  const alive = vs.monsters.filter((m) => m.life > 0).map((m) => m.cardId);
  const attacks = hand
    .map((c) => ({ c, k: skillOf(c) }))
    .filter((x): x is { c: HandCard; k: SkillCard } => !!x.k && x.k.effect.type === 'attack' && !!x.k.stat && alive.includes(x.k.monsterId));
  const power = (k: SkillCard): number => k.stat?.value ?? 0;
  // 次の相手の手番に払えるマナ：いまの相手のマナ（マナ化は攻撃のあとなので、次の手番の攻撃には使えない）
  const mana = manaOf(vs);
  const mine = state.sides[side].monsters.filter((m) => m.life > 0);
  const kills = attacks
    .filter((x) => x.k.cost <= mana && mine.some((m) => m.life <= power(x.k)))
    .sort((a, b) => power(b.k) - power(a.k));
  if (kills[0]) return kills[0].c;
  const strongest = [...attacks].sort((a, b) => power(b.k) - power(a.k))[0];
  if (strongest) return strongest.c;
  const evade = hand.find((c) => {
    const k = skillOf(c);
    return !!k && k.effect.type === 'evade' && !k.effect.minCost && guardMaxCost(k) === null;
  });
  if (evade) return evade;
  const defense = hand.find((c) => skillOf(c)?.effect.type === 'defense');
  return defense ?? hand[0];
}

/**
 * いたずら（正式：ラズック 2026-10-24）：side の手札からランダムに1枚を、その山札へ戻してシャッフルする。補充はしない。
 * 手札が0枚のときは使えない（cardUsability。2026-10-24 ユーザー指示）
 */
function handToDeck(state: BattleState, side: Side): BattleState {
  const s = state.sides[side];
  if (s.hand.length === 0) return state;
  const pick = nextInt(state.seed, s.hand.length);
  const card = s.hand[pick.value] as HandCard;
  const mixed = shuffle([...s.deck, card.cardId], pick.seed);
  const next = updateSide({ ...state, seed: mixed.seed }, side, { hand: s.hand.filter((c) => c.uid !== card.uid), deck: mixed.items });
  return addLog(next, t('battle.log.handToDeck', { player: s.name }));
}

function healMonster(state: BattleState, target: BattleMonster, value: number): BattleState {
  const healed = Math.min(target.maxLife, target.life + value);
  const next = updateMonster(state, target.uid, { life: healed });
  return addLog(next, t('battle.log.heal', { name: nameOf(target.cardId), n: healed - target.life }));
}

/** 山札の上から数枚をそのままマナにする（マナは必ずカード1枚＝1マナ）。決められた枚数を動かせなければ負け */
function deckToMana(state: BattleState, side: Side, count: number): BattleState {
  const s = state.sides[side];
  if (s.deck.length < count) return loseByDeckOut(state, side);
  const moved = s.deck.slice(0, count);
  const next = updateSide(state, side, { deck: s.deck.slice(moved.length), manaPile: [...s.manaPile, ...moved] });
  return addLog(moved.length > 0 ? addFx(next, 'manaGain', side) : next, t('battle.log.deckToMana', { n: moved.length }));
}

/**
 * 引く効果で count 枚を山札から取る。手札の上限（BATTLE_RULES.maxHand）までは手札へ、超える分は引かずに山札の上からそのままマナへ
 * （2026-10-28 ユーザー決定。捨てる画面は作らない）。山札が count 枚あることは呼ぶ側で確かめる。
 * 引いた記録（drawLog。1枚も引けなかったときは出さない）のあと、マナにした分があれば「手札がいっぱいなので…」の記録を足す
 */
function drawUpToMax(state: BattleState, side: Side, count: number, drawLog: (drawn: number) => string): BattleState {
  const room = Math.max(0, BATTLE_RULES.maxHand - state.sides[side].hand.length);
  const drawn = drawCards(state.sides[side], Math.min(count, room), state.nextUid);
  let next = updateSide({ ...state, nextUid: drawn.nextUid }, side, drawn.side);
  if (drawn.drawn > 0) next = addLog(next, drawLog(drawn.drawn));
  const toMana = Math.min(count - drawn.drawn, next.sides[side].deck.length);
  if (toMana > 0) {
    const s = next.sides[side];
    next = updateSide(next, side, { deck: s.deck.slice(toMana), manaPile: [...s.manaPile, ...s.deck.slice(0, toMana)] });
    next = addLog(addFx(next, 'manaGain', side), t('battle.log.handFullMana', { max: BATTLE_RULES.maxHand, n: toMana }));
  }
  return next;
}

/** 効果のドロー。指示された枚数を引けなければ負け（手札の上限を超える分はマナになるが、山札から取る枚数は同じ） */
function drawByEffect(state: BattleState, side: Side, count: number): BattleState {
  if (state.sides[side].deck.length < count) return loseByDeckOut(state, side);
  return drawUpToMax(state, side, count, (n) => t('battle.log.draw', { n }));
}

/**
 * サポートを使う。モンスターの行動は使わない。回数制限のあるものは使用回数を数える。
 * 全体カードは場に残り、すでに場にあったカードは持ち主の捨て札へ。
 */
function useSupport(state: BattleState, side: Side, cardUid: string, card: SupportCard, targetUid: string | undefined, choice?: string): BattleState {
  let target: BattleMonster | undefined;
  const type = card.effect.type;
  if (type === 'heal' || type === 'stone' || type === 'cheer') {
    target = targetUid ? targetsFor(state, side, card).find((m) => m.uid === targetUid) : undefined;
    if (!target) return state;
  }
  // 思い出の箱：捨て札の技カード（choice＝カードの ID）。風まかせ：このカード以外の手札（choice＝uid）
  if (type === 'recall' && (!choice || !recallChoices(state, side).includes(choice))) return state;
  if (type === 'swap' && (!choice || choice === cardUid || !findHandCard(state, side, choice))) return state;
  const s = state.sides[side];
  let next: BattleState;
  if (card.duration === 'field') {
    // 場に置く（捨て札には行かない）
    next = updateSide(state, side, { hand: s.hand.filter((c) => c.uid !== cardUid) });
  } else {
    next = removeFromHand(state, side, cardUid);
  }
  next = payMana(next, side, card.cost);
  if (card.limitGroup) {
    const usage = next.sides[side].turnUsage;
    next = updateSide(next, side, { turnUsage: { ...usage, [card.limitGroup]: (usage[card.limitGroup] ?? 0) + 1 } });
  }
  next = addLog(next, t('battle.log.support', { side: sideLabel(side), card: cardName(card) }));
  const e = card.effect;
  switch (e.type) {
    case 'heal':
      return target ? healMonster(next, target, e.value) : state;
    case 'draw':
      return drawByEffect(next, side, e.value);
    case 'mana':
      return deckToMana(next, side, e.value);
    case 'stone': {
      // 投石：ちから技（マナ1・ダメージ1）として、相手の守り（防御・回避）を待つ。場の増減・しめったはだ・防御の軽減は今の決まりどおり
      if (!target) return state;
      const power = Math.max(0, e.value + fieldModifier(state, 'force'));
      return {
        ...next,
        phase: 'defense',
        pending: {
          attacker: side,
          userUid: '',
          targetUid: target.uid,
          cardId: card.id,
          stat: 'force',
          power,
          responses: [],
          ...(isPinned(state, target) ? { pinned: true } : {}),
        },
      };
    }
    case 'recall': {
      const s2 = next.sides[side];
      const at = s2.discard.lastIndexOf(choice as string);
      if (at < 0) return state;
      const discard = [...s2.discard.slice(0, at), ...s2.discard.slice(at + 1)];
      next = updateSide({ ...next, nextUid: next.nextUid + 1 }, side, { discard, hand: [...s2.hand, { uid: `c${next.nextUid}`, cardId: choice as string }] });
      return addLog(next, t('battle.log.recall', { side: sideLabel(side), card: nameOf(choice as string) }));
    }
    case 'swap': {
      const s2 = next.sides[side];
      const back = s2.hand.find((c) => c.uid === choice);
      if (!back) return state;
      const mixed = shuffle([...s2.deck, back.cardId], next.seed);
      next = updateSide({ ...next, seed: mixed.seed }, side, { hand: s2.hand.filter((c) => c.uid !== back.uid), deck: mixed.items });
      next = addLog(next, t('battle.log.swap', { side: sideLabel(side) }));
      return drawByEffect(next, side, 1);
    }
    case 'manaDrain':
      return drainMana(next, side, e.value);
    case 'cheer':
      if (!target) return state;
      next = updateMonster(next, target.uid, { cheer: { amount: e.value, turn: state.turn } });
      return addLog(next, t('battle.log.cheer', { name: nameOf(target.cardId), n: e.value }));
    case 'guardDiscount':
    case 'field':
      return addLog(setField(next, { cardId: card.id, owner: side }), t('battle.log.fieldEnter', { card: cardName(card) }));
    case 'habitat':
      // まいあがる風・しずまる大地（指示書 AQ）：場の枠に、居場所を変える場として出す（期限なし。みちしおの水中も上書き）
      next = addLog(setField(next, { cardId: card.id, owner: side, habitat: e.habitat }), t('battle.log.fieldEnter', { card: cardName(card) }));
      return addLog(next, t('battle.log.habitatField', { where: t(`habitat.${e.habitat}`) }));
    case 'clearField':
      return clearField(next);
  }
}

/**
 * 守備：防御・回避カードを1枚使う（条件を満たす限り1回の攻撃に何枚でも）。
 * cardUid が null なら守備を終えて、ダメージを計算する。
 */
function defend(state: BattleState, side: Side, cardUid: string | null): BattleState {
  const pending = state.pending;
  if (state.phase !== 'defense' || !pending || pending.attacker === side) return state;
  if (cardUid === null) {
    return resolvePending(addLog(state, t(pending.responses.length === 0 ? 'battle.log.noDefense' : 'battle.log.defenseDone', { side: sideLabel(side) })));
  }
  if (!cardUsability(state, side, cardUid).usable) return state;
  const hand = findHandCard(state, side, cardUid);
  if (!hand) return state;
  const skill = getSkill(hand.cardId);
  if (skill.effect.type === 'cover') return cover(state, side, cardUid, skill, pending);
  // はねやすめ（フギン 指示書 BM）：印があれば、この回避はマナ0で使え、印は消える
  const rested = featherRestOwner(state, side, skill);
  let next = removeFromHand(state, side, cardUid);
  next = payMana(next, side, guardCost(next, skill, side));
  if (rested) next = addLog(updateMonster(next, rested.uid, { featherRest: null }), t('battle.log.featherRestUsed', { name: nameOf(rested.cardId) }));
  next = { ...next, pending: { ...pending, responses: [...pending.responses, skill.id] } };
  const params = { side: sideLabel(side), skill: cardName(skill), v: guardReduction(skill) };
  const logKey = skill.effect.type === 'evade' ? 'battle.log.evade' : skill.effect.type === 'defense' && skill.effect.nullify ? 'battle.log.nullify' : 'battle.log.guard';
  return addLog(next, t(logKey, params));
}

/**
 * かばう（試遊中：ジオル 2026-10-29）：攻撃の狙いをジオルに変える。そのあとジオルは自分の防御・回避もふつうに使える（マナがあれば）。
 * 攻撃に付いた効果（まきつく など）も、代わりに受けたジオルが受ける（resolvePending は狙いの uid に効かせる）
 */
function cover(state: BattleState, side: Side, cardUid: string, skill: SkillCard, pending: PendingAttack): BattleState {
  const user = coverUser(state, side, skill);
  const ally = findMonster(state, pending.targetUid)?.monster;
  if (!user || !ally) return state;
  let next = removeFromHand(state, side, cardUid);
  next = payMana(next, side, guardCost(next, skill));
  const { pinned: _p, ...base } = pending;
  const reduce = skill.effect.type === 'cover' ? (skill.effect.reduce ?? 0) : 0;
  next = { ...next, pending: { ...base, targetUid: user.uid, coveredFrom: ally.uid, responses: [], ...(isPinned(next, user) ? { pinned: true } : {}), ...(reduce > 0 ? { coverReduce: reduce } : {}) } };
  // みがわり（クヨウ 指示書 BH）：ダメージ−reduce の文
  return addLog(next, reduce > 0 ? t('battle.log.standIn', { name: nameOf(user.cardId), ally: nameOf(ally.cardId), n: reduce }) : t('battle.log.cover', { name: nameOf(user.cardId), ally: nameOf(ally.cardId) }));
}

/** 行動を待っている側（防御待ちなら防御側） */
export function actingSide(state: BattleState): Side | null {
  if (state.phase === 'ended') return null;
  if (state.phase === 'defense' && state.pending) return otherSide(state.pending.attacker);
  return state.active;
}
