import { getMonster, getPlayCard, getSkill, getSupport } from '../../data/cards.ts';
import { provisionalRuleNotes } from '../../data/rules.ts';
import { chooseAction } from '../../game/battle/ai.ts';
import {
  actingSide,
  applyAction,
  canConvertToMana,
  cardUsability,
  createBattle,
  findMonster,
  manaOf,
  otherSide,
  incomingDamage,
  supportUsesLeft,
  targetsFor,
  type BattleAction,
  type BattleFxKind,
  type BattleMonster,
  type BattleState,
  type Side,
} from '../../game/battle/engine.ts';
import { faceKeyOf, opponentFace, opponentFaceUrl } from '../components/opponentFace.ts';
import {
  categoryLabel,
  describePlayCard,
  effectLabel,
  guardReduction,
  skillCategory,
  statLabel,
  supportShortText,
  targetsEnemy,
  type PlayCard,
  type StatType,
} from '../../game/cards/cardTypes.ts';
import { buildAutoDeck } from '../../game/deck/deck.ts';
import { nextBattleHint, type BattleHintId } from '../../game/story/battleTutorial.ts';
import { recordPersonBattle } from '../../game/people/peopleBook.ts';
import { randomSeed, shuffle } from '../../game/rng.ts';
import { cardName, opponentName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { openCardDetail } from '../components/cardDetail.ts';
import { confirmModal, openModal } from '../components/modal.ts';
import { commandButton, confirmCommand } from '../components/commandButton.ts';
import { createMonsterPortrait } from '../components/monsterPortrait.ts';
import { heroFaceUrl, heroResultUrl } from '../components/heroArt.ts';
import { versusBanner } from '../components/versusBanner.ts';
import { resolveCardArt } from '../cardArtSources.ts';
import { BATTLE_CARD_RATIO, createBattleMonsterCard, hasBattleCard } from '../components/battleMonsterCard.ts';
import { battleDigits } from '../components/battleDigits.ts';
import iconStatForce from '@assets/images/ui/battle/icon_stat_force.webp';
import iconStatWisdom from '@assets/images/ui/battle/icon_stat_wisdom.webp';
import iconMana from '@assets/images/ui/battle/icon_mana.webp';
import iconDeck from '@assets/images/ui/battle/icon_deck.webp';
import iconHand from '@assets/images/ui/battle/icon_hand.webp';
import iconDiscard from '@assets/images/ui/battle/icon_discard.webp';
import fxForce from '@assets/images/effects/fx_force.webp';
import fxWisdom from '@assets/images/effects/fx_wisdom.webp';
import fxDefense from '@assets/images/effects/fx_defense.webp';
import fxEvade from '@assets/images/effects/fx_evade.webp';
import fxSpecial from '@assets/images/effects/fx_special.webp';
import fxHeal from '@assets/images/effects/fx_heal.webp';
import fxManaGain from '@assets/images/effects/fx_mana_gain.webp';
import fxManaConvert from '@assets/images/effects/fx_mana_convert.webp';
import fxManaSpend from '@assets/images/effects/fx_mana_spend.webp';
import targetPlayerArt from '@assets/images/ui/battle/target_player.webp';
import targetOpponentArt from '@assets/images/ui/battle/target_opponent.webp';
import knockoutArt from '@assets/images/ui/battle/knockout_mark.webp';
import statusSealedArt from '@assets/images/ui/battle/status_sealed.webp';
import statusStunnedArt from '@assets/images/ui/battle/status_stunned.webp';
import statusTauntArt from '@assets/images/ui/battle/status_taunt.webp';
import statusShieldArt from '@assets/images/ui/battle/status_shield.webp';
import statusActedArt from '@assets/images/ui/battle/status_acted.webp';
import statusWeakenArt from '@assets/images/ui/battle/status_weaken.webp';
import rulesArt1 from '@assets/images/ui/rules/rules_1.webp';
import rulesArt2 from '@assets/images/ui/rules/rules_2.webp';
import rulesArt3 from '@assets/images/ui/rules/rules_3.webp';
import rulesArt4 from '@assets/images/ui/rules/rules_4.webp';

/** ルールの窓の図（2026-10-26 デザイン第11弾）：マナにする・攻撃と守り・サポート・勝ち負け */
const RULES_ART = [rulesArt1, rulesArt2, rulesArt3, rulesArt4];

/** 導入イベントV2の試験のヒント（先生の台詞。03_全台詞 の S04） */
const V2_HINT: Readonly<Record<BattleHintId, MessageKey>> = {
  monsters: 'introV2.hint.monsters',
  firstMana: 'introV2.hint.mana',
  attack: 'introV2.hint.attack',
  mana: 'introV2.hint.mana',
  defense: 'introV2.hint.defense',
  result: 'introV2.hint.monsters',
};
import { battleCardHeight, createBattleCard } from '../components/battleCard.ts';
import { skillValueBadge, skillValueBadgeText } from '../../game/cards/cardFace.ts';
import { bgm } from '../bgm.ts';
import { button, h } from '../dom.ts';
import { once, type BattleRequest } from '../gameStore.ts';
import { sound, type SoundId } from '../sound.ts';
import type { ScreenDefinition } from './types.ts';

/** ルール上のきっかけ → 効果音 */
const FX_SOUND: Readonly<Record<BattleFxKind, SoundId>> = {
  manaSpend: 'manaSpend',
  manaConvert: 'manaVanish',
  manaGain: 'manaGain',
  evade: 'evade',
  hitNormal: 'hitNormal',
  hitStrong: 'hitStrong',
  recoil: 'recoil',
};

/** 使ったカードを大きく見せるときの音（カードの種類ごと） */
function showcaseSound(card: PlayCard): SoundId {
  if (card.kind === 'support') return 'cardSupport';
  switch (card.effect.type) {
    case 'defense':
      return 'cardGuard';
    case 'evade':
      return 'cardEvade';
    case 'weaken':
    case 'taunt':
    case 'handToDeck':
    case 'discardRandom':
    case 'shield':
    case 'healSelf':
      return 'cardSpecial';
    case 'seal':
      return 'cardSeal';
    default:
      return card.stat?.type === 'wisdom' ? 'cardWisdom' : 'cardAttack';
  }
}

/** 相手の1手ごとの間（ミリ秒） */
/** 2026-10-26 ユーザー指示「相手がカード使った時の処理が早すぎる。何したのか追うのが難しい」で 1100→1500 */
const AI_STEP_MS = 1500;
/**
 * 場のモンスターの幅（論理px。指示書の目安 72〜80）。2026-10-25 ユーザー指示「ずっと出ているカードが新しいデザインの方」：
 * バトル用カード（800×920）のあるモンスターはそのカードで、まだ無いモンスターは同じ縦横比に切り抜いたアイコンで出す
 */
const MONSTER_ICON = 76;
const MONSTER_ICON_H = Math.round(MONSTER_ICON * BATTLE_CARD_RATIO);
/** 場のモンスターをタップしたときに見せる正式カードの絵の幅（論理px） */
const OFFICIAL_CARD_DETAIL_W = 250;
/**
 * 手札のカードの幅（論理px）。2026-10-25 リデザイン パートB：上下の空の帯をなくした表面（battleCard.ts）にして 66→70。
 * 2026-10-26 ユーザー指示「手札もう少し大きく」で 70→82（入りきらないときは少し重ねる：handRow の --hand-overlap）。
 * 高さは技の絵の縦横比から battleCardHeight() で出す
 */
const HAND_CARD_W = 80;
/** 幅の狭い画面では手札を少し小さくする（下限）。それでも入りきらない分は重ねる */
const HAND_CARD_MIN_W = 70;
/** 相手の手札（裏向き）の高さを決める幅（2026-10-26 自分の手札を縦長にしたが、相手の裏向きの列は高さを増やさないよう前の大きさのまま） */
const OPP_HAND_BASE_W = 82;
/** 小さくするのは、5枚がこの幅だけ重なってもまだ入らないとき（論理px） */
const HAND_SOFT_OVERLAP = 8;
/** 手札の列の左右の余白とカードの間（論理px。battlePs.css の .battle__hand と同じ値） */
const HAND_ROW_PAD = 6;
const HAND_GAP = 3;
/**
 * フォーカスエリア（説明の欄）の大きなカードの幅（論理px）。2026-10-25 リデザイン：名前・絵・効果文の入る大きなカード（battleCard.ts）で 132。
 * 2026-10-26 ユーザー指示「説明の欄はスペースがあるので縮めて」で一度 108 にしたが、同じ日に情報を列の左へ移して欄に余裕ができたので 132 に戻した（演出・守備のカードも 112）
 */
const DETAIL_CARD_W = 176;
/**
 * 技の演出で大きく見せるカードの幅。2026-10-26 ユーザー指示「大きく見せて」で 112→150（欄に入りきらないときは fitFocusCards が縮める）
 */
const SPOT_CARD_W = 176;
/** 守備の選択で、相手の攻撃のカード・守備のカードの幅 */
const DEFENSE_ATTACK_W = 112;
const DEFENSE_CARD_W = 60;
/**
 * 相手の手札の裏向きのカードが、フォーカスエリアのカードの場所へ大きくなりながら動く時間（ミリ秒。見た目だけ。ルールの処理は先に済んでいる）。
 * 2026-10-26 ユーザー指示「大きく見せて裏返しから表向きに。モンスターファームバトルカードをもっと参考に」：着いたら裏から表へ返す（OPP_CARD_FLIP_MS）
 */
const OPP_CARD_FLY_MS = 620;
/** 真ん中に来た相手のカードを裏から表へ返す時間（ミリ秒。半分で表に替わる） */
const OPP_CARD_FLIP_MS = 520;
/** 相手のひと言を大きく出しておく時間（ミリ秒）。押すと先に消える */
const TALK_MS = 2200;
/** ひと言を1文字ずつ出す間隔（ミリ秒。PS版の会話のように） */
const TALK_CHAR_MS = 45;
/**
 * 技を使ったときの演出の長さ（ミリ秒。2026-10-25 リデザイン パートC：指示書「約1〜1.5秒、タップでスキップ」。ここだけで調整する）。
 * 使ったカードをフォーカスエリアに大きく出し、「誰が誰に使ったか」の1行と、使った側・対象のアイコンの光りを見せる。見せている間は操作と相手の行動を待たせる
 */
const SHOWCASE_MS = 1200;
/** 相手の使ったカードを表に返してから見せておく時間（ミリ秒。2026-10-26 ユーザー指示「何したのか追うのが難しい」で自分の SHOWCASE_MS より長く。タップで飛ばせる） */
const OPP_SHOWCASE_MS = 2400;
/** 命中したときの一瞬の間（ヒットストップ）と画面の揺れ */
const HIT_PAUSE_MS = 320;
/** 状態の印の能力の絵（技カードのバーの拳・本の丸。tools/design/stat_icon_crop.py） */
const STAT_ICON: Readonly<Record<StatType, string>> = { force: iconStatForce, wisdom: iconStatWisdom };
/** 技の対象に出す指のマークを、カードを大きく見せ終わってからも残す時間（ミリ秒） */
const POINTER_EXTRA_MS = 500;
/** ダメージでライフを1ずつ減らす間隔と、命中から数え始めるまで（ミリ秒） */
const LIFE_TICK_MS = 150;
const LIFE_TICK_START_MS = 220;
/** カードを1枚配る間隔（ミリ秒） */
const DEAL_MS = 110;
/**
 * 配った手札は、はじめ裏向き。配り終えて少し置いてから、左から1枚ずつ表に返す（2026-10-26 ユーザー指示「最初裏返しで、その後パラパラーっと表向きに」）。
 * 配り終えてから返し始めるまで・1枚ずつずらす間隔・1枚を返す時間（ミリ秒）
 */
const HAND_FLIP_WAIT_MS = 260;
const HAND_FLIP_STAGGER_MS = 95;
const HAND_FLIP_MS = 240;
/** 先攻・後攻のカードをめくってからバトルを始めるまで（ミリ秒） */
const ORDER_REVEAL_MS = 1300;
/**
 * マナにするカードが、手札の場所で光って消える時間（ミリ秒）。
 * 2026-10-24 ユーザー指示「マナにしたときはカードが一個一個、消えるエフェクトを入れその時にSEを。マナのとこに行く時のSEは不要」：
 * 情報箱へ飛ばすのをやめ、その場で消す。消える瞬間にマナが1増え、消える音（manaVanish）が1回鳴る
 */
const MANA_VANISH_MS = 420;
/** 何枚かまとめてマナにするとき、1枚ずつ消す間隔（ミリ秒。一枚ずつ分かるように） */
const MANA_VANISH_STAGGER_MS = 260;
/** 場面の表示（あなたのターン・マナ化など）が出ている時間（ミリ秒） */
const BANNER_MS = 1100;
/** 手札を上へこれだけ持ち上げると「離すと使う／マナにする」になる（論理 px） */
const HAND_LIFT_PX = 48;
/** 手札が横にはみ出しているとき、指が端のこの幅に入ると自動で送る（論理 px） */
const HAND_EDGE_PX = 32;
/** 自動で送る速さ（1コマあたり px） */
const HAND_SCROLL_STEP = 6;

interface Targeting {
  readonly cardUid: string;
  readonly targets: readonly string[];
  readonly prompt: string;
}

/**
 * 技が当たったときの光（2026-10-26 デザイン第8弾。黒い背景の絵を「光を足す」重ね方でモンスターのアイコンに重ねる）。
 * ちから・かしこさ＝攻撃でライフが減った、防御・回避＝守備のカードを使った、特殊＝相手を選ぶ特殊の技、回復＝ライフが増えた
 */
type HitFxKind = 'force' | 'wisdom' | 'defense' | 'evade' | 'special' | 'heal';
const HIT_FX_ART: Readonly<Record<HitFxKind, string>> = { force: fxForce, wisdom: fxWisdom, defense: fxDefense, evade: fxEvade, special: fxSpecial, heal: fxHeal };
/** 光を見せる時間（ミリ秒） */
const HIT_FX_MS = 700;

/** 上の帯の流れる文字：流れる速さ（論理px／秒）・帯の幅の目安・1文字の幅の目安（流れる時間の計算に使う） */
const TICKER_SPEED = 48;
const TICKER_BOX_PX = 190;
const TICKER_CHAR_PX = 13;

/** 先攻・後攻のカード（表示の文字は orderFace() で引く） */
type OrderLabel = 'first' | 'second';

/** 手札を指でなぞっている間の状態（指を置いてから離すまで） */
interface HandSwipe {
  readonly pointerId: number;
  /** 最初に指を置いたカード */
  readonly startUid: string;
  /** いま指の下にあるカード */
  uid: string;
  /** いまのカードに入ったときの指の位置（画面の座標）。持ち上げた量はここから測る */
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  /** 別のカードへなぞった */
  moved: boolean;
  /** 手札の列から上へ持ち上げている（離すと使う／マナにする） */
  lifted: boolean;
  /** マナ化：なぞったカードを候補に入れる（add）／外す（remove）。マナ化以外は null */
  readonly paint: 'add' | 'remove' | null;
}

const orderFace = (label: OrderLabel): string => t(label === 'first' ? 'battle.order.faceFirst' : 'battle.order.faceSecond');

/** 場の全体カードの短い説明から、先頭の「場：」を外す（帯に「場」の札を別に出すため） */
function withoutFieldPrefix(text: string): string {
  const prefix = t('card.short.fieldPrefix');
  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

/**
 * カードバトル画面。ルールはすべて src/game/battle/engine.ts（純粋関数）に任せ、ここは表示と操作だけ。
 *
 * 流れ：先攻・後攻を決める（伏せたカード2枚から1枚を選ぶ）→ 手札を1枚ずつ配る → 対戦 → 結果
 * 配置（縦持ち）：上＝手番の表示／中＝相手と自分の情報箱＋モンスター3体／中段＝説明文と選んだ技カードの拡大／下＝手札と操作
 */
export const battleScreen: ScreenDefinition = {
  id: 'battle',
  titleKey: 'battle.title',
  create(ctx) {
    const request = ctx.store.pendingBattle;
    const element = h('main', { class: 'screen battle' });
    if (!request) {
      element.append(
        h('p', { class: 'battle__missing', text: t('battle.missing') }),
        button(t('common.back'), () => ctx.reset('world'), 'btn btn--primary'),
      );
      return { element };
    }
    ctx.store.pendingBattle = null;
    const req: BattleRequest = request;
    bgm.play(req.bgm ?? 'battle');
    // 対戦の始まり（先攻・後攻を決める画面が出たとき）
    sound.play('battleStart', 150);
    /** 勝ち・負けの音を鳴らしたか（結果の表示は描き直しで何度も作られるので1回だけ） */
    let resultSounded = false;
    if (req.background) {
      // 対戦の背景の絵（ダンジョン）。上に暗い膜を重ねて、カードや文字を読みやすくする
      element.classList.add('has-bg');
      if (req.backgroundVivid) element.classList.add('has-bg--vivid');
      element.style.setProperty('--battle-bg', `url("${req.background}")`);
    }
    // 手札のカードの大きさ（自分の手札＝表・相手の手札＝裏で同じ値。CSS の --hand-card-w / --hand-card-h）
    element.style.setProperty('--hand-card-w', `${HAND_CARD_W}px`);
    element.style.setProperty('--hand-card-h', `${battleCardHeight(HAND_CARD_W, 'tall').toFixed(2)}px`);
    element.style.setProperty('--opp-card-h', `${battleCardHeight(OPP_HAND_BASE_W, 'hand').toFixed(2)}px`);
    const save = ctx.store.save;
    const seed = randomSeed();

    // 先攻・後攻のカード（並び順はランダム）
    const orderCards: OrderLabel[] = shuffle<OrderLabel>(['first', 'second'], seed ^ 0x5bd1e995).items;
    let orderPicked: number | null = null;

    let state: BattleState | null = null;
    let selectedUid: string | null = null;
    /** コマンドのメニュー（PS版の「コマンド」：×ボタンで開く一覧にならう）が開いているか */
    let commandMenuOpen = false;
    /** 相手のひと言（顔の絵の横の吹き出し）。【仮】台詞は仮 */
    let oppLine: string | null = null;
    /** ひと言を出しておく時刻（これを過ぎたら消す）と、新しいひと言かを見分ける番号 */
    let talkUntil = 0;
    /** ひと言を出し始めた時刻（1文字ずつ出す） */
    let talkStart = 0;
    let talkSeq = 0;
    let talkShownSeq = -1;
    const detailW = DETAIL_CARD_W;
    /** 相手のひと言（【仮】台詞）を、顔の絵と一緒に大きく出す（カードの上に重ねる） */
    const say = (key: Parameters<typeof t>[0]): void => {
      oppLine = t(key);
      talkStart = Date.now();
      // 1文字ずつ出し終わってから TALK_MS 読めるように
      talkUntil = talkStart + [...oppLine].length * TALK_CHAR_MS + TALK_MS;
      talkSeq++;
      const wait = talkUntil - Date.now();
      setTimeout(() => {
        if (!destroyed && Date.now() >= talkUntil) render();
      }, wait + 30);
    };
    /** 表示済みの手札（新しく来たカードだけを配る演出にする） */
    const shownHand = new Set<string>();
    /**
     * 配っている途中の手札：届く時刻（slide）と表に返す時刻（flip）。描き直しても動きが最初に戻らないよう、時刻から動きの途中を出す。
     * 返し終えたら消す
     */
    const handDeal = new Map<string, { slide: number; flip: number }>();
    /** 表示済みの相手の手札（新しく引いたカードだけ山札から来る動きにする。中身は画面に出さない） */
    const shownOppHand = new Set<string>();
    /** 配っている間は操作と相手の行動を待たせる */
    let busyUntil = 0;
    /** 前回描画時のライフ（ダメージ・回復の演出に使う） */
    const prevLife = new Map<string, number>();
    /** 技・サポートの対象に選ばれたモンスター（指のマークを出す。until まで） */
    /** 技の対象に出す矢印（side＝技を使った側。自分の技＝青、相手の技＝赤） */
    let pointed: { uid: string; until: number; side: Side } | null = null;
    /** モンスターに重ねている技の光（from〜until の間だけ出す） */
    let hitFx: { uid: string; kind: HitFxKind; from: number; until: number }[] = [];
    /** 上の帯の流れる文字（文が変わった時刻） */
    let tickerState = { text: '', start: 0 };
    /** 使ったカードを大きく見せ終わる時刻（それまで指のマークを出さない） */
    let showcaseUntil = 0;
    /** いま大きく見せている技（パートC）。user＝使ったモンスター（守備は守ったモンスター）、target＝対象 */
    let spotlight: {
      cardId: string;
      side: Side;
      userUid: string | null;
      targetUid: string | null;
      until: number;
      /** 相手のカード：裏向きのカードが飛んできて着く時刻（そこから表に返す）。自分のカードは null（すぐ表で見せる） */
      arriveAt: number | null;
    } | null = null;
    /** ダメージでライフを1ずつ減らしている間の、表示中のライフ（数え終わったら消す） */
    const lifeShown = new Map<string, number>();
    /** 前回描画時のマナ（マナが増えた演出に使う） */
    const prevMana = new Map<Side, number>();
    /** 鳴らし終えた効果音のきっかけ（engine の fx の seq） */
    let lastFxSeq = 0;
    /** マナ化で選んだ手札（まとめてマナにする） */
    const manaPicks = new Set<string>();
    /** マナ化で飛んでいる途中の手札（着くまで手札の列では隠しておく） */
    const manaFlying = new Set<string>();
    /** 描き直しても外さない演出の層（飛んでいくカード。外すとアニメーションが最初からになる） */
    const fxLayer = h('div', { class: 'battle__fx-layer', attrs: { 'aria-hidden': 'true' } });
    /**
     * カメラ（2026-10-24 ユーザー指示、2026-10-25 リデザイン後に戻した）：相手が動く・守るときは上（相手の手札）へ、
     * 自分が動く・守るときは下へ寄せる（相手の手札が半分ほど画面の上へ出る）。
     * 動きをなめらかにするため、カメラの枠（camera）とレンズ（lens）は描き直しても作り直さない（中の盤面だけ入れ替える）
     */
    const lens = h('div', { class: 'battle-camera__lens' });
    const camera = h('div', { class: 'battle-camera', dataset: { focus: 'none' } }, lens);
    /** カメラを寄せる側：相手が動く・守る＝上、自分が動く・守る＝下、終わったら寄せない */
    const cameraFocus = (s: BattleState): 'top' | 'bottom' | 'none' => {
      if (s.phase === 'ended') return 'none';
      // 相手の使ったカードを相手の場所で見せている間は上のまま（守備の場面になっても、見せ終わってから下へ）
      if (spotlight && spotlight.side === 'opponent' && Date.now() < spotlight.until) return 'top';
      const side = s.phase === 'defense' && s.pending ? otherSide(s.pending.attacker) : s.active;
      return side === 'opponent' ? 'top' : 'bottom';
    };
    /** 画面を描き直す（演出の層・カメラ・開いている窓は外さずに残す。外すとアニメーションが最初からになる／窓がすぐ閉じてしまう） */
    const replaceView = (...nodes: (Node | string)[]): void => {
      const keep = (child: ChildNode): boolean =>
        child === fxLayer ||
        (child === camera && nodes.includes(camera)) ||
        (child instanceof HTMLElement && (child.classList.contains('modal') || child.classList.contains('command-confirm')));
      for (const child of [...element.childNodes]) if (!keep(child)) child.remove();
      const i = nodes.indexOf(camera);
      if (i >= 0) {
        if (!camera.isConnected) element.prepend(camera);
        camera.before(...nodes.slice(0, i));
        camera.after(...nodes.slice(i + 1));
      } else element.prepend(...nodes);
      if (!fxLayer.isConnected) element.append(fxLayer);
    };
    /** 最後に出した場面の表示（同じ表示を繰り返さない） */
    let bannerKey = '';
    /** 前回出したコマンド（同じなら出てくる動きをつけない） */
    let lastCommandKey = '';
    let targeting: Targeting | null = null;
    let auto = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;
    /** 手札をなぞっている間の状態と、持ち上げたカードの絵（指についてくる） */
    let swipe: HandSwipe | null = null;
    let swipeGhost: HTMLElement | null = null;
    let swipeRaf = 0;
    const finish = once((winner: BattleState['winner']) => {
      // 名刺図鑑：相手が人物なら登録して勝ち負けを数える（2026-10-27）
      ctx.store.update((s) => recordPersonBattle(s, req.opponent, winner ?? 'draw'));
      req.onFinish(winner ?? 'draw');
    });
    /** 最初の練習試合のヒント（出したものは2度出さない。出ている間は相手も待つ） */
    const seenHints = new Set<BattleHintId>();
    let hintOpen: BattleHintId | null = null;

    const dealing = (): boolean => Date.now() < busyUntil;

    /** 手札のカードを使う・守備に出す行動なら、そのカードと陣営（大きく見せる演出に使う） */
    const playedCard = (s: BattleState, action: BattleAction): { cardId: string; side: Side } | null => {
      const uid = action.type === 'useCard' ? action.cardUid : action.type === 'defend' ? action.cardUid : null;
      if (!uid) return null;
      const hand = s.sides[action.side].hand.find((c) => c.uid === uid);
      return hand ? { cardId: hand.cardId, side: action.side } : null;
    };

    /**
     * 相手が手札のカードを使う・守備に出す・マナにするとき、そのカードの裏向きの絵の位置（画面の座標）。
     * 並び順だけで探す（カードの中身は使わない）
     */
    const opponentCardFrom = (s: BattleState, action: BattleAction): DOMRect | null => {
      if (action.side !== 'opponent') return null;
      const uid = action.type === 'useCard' || action.type === 'convertToMana' || action.type === 'defend' ? action.cardUid : null;
      if (!uid) return null;
      const index = s.sides.opponent.hand.findIndex((c) => c.uid === uid);
      const back = index >= 0 ? element.querySelectorAll('.battle-hand--opponent .battle-hand__back')[index] : undefined;
      return back ? back.getBoundingClientRect() : null;
    };

    /**
     * 相手の手札の裏向きのカードを、フォーカスエリアの大きなカードの場所へ、大きくしながら動かす（使う・守備に出す）。見た目だけ。
     * 着いたら、その場所のカード（spotlightPanel）が裏から表へ返る（使ったカードは公開される場面なので、ここで初めて表にする）。
     * 2026-10-26 ユーザー指示「大きく見せて裏返しから表向きにするみたいなモンスターファームバトルカードをもっと参考に」
     */
    const flyOpponentCard = (from: DOMRect): void => {
      const root = element.getBoundingClientRect();
      const scale = stageScale();
      const x = (from.left - root.left) / scale;
      const y = (from.top - root.top) / scale;
      const w = from.width / scale;
      const hgt = from.height / scale;
      // 行き先：表に返るカードの場所（なければ説明の欄の真ん中に、同じ大きさのまま）
      const goal = element.querySelector('.battle-spot__flip')?.getBoundingClientRect();
      const detail = element.querySelector('.battle-detail')?.getBoundingClientRect();
      const gw = goal ? goal.width / scale : w;
      const gh = goal ? goal.height / scale : hgt;
      const gx = goal ? (goal.left - root.left) / scale : detail ? (detail.left + detail.width / 2 - root.left) / scale - w / 2 : x;
      const gy = goal ? (goal.top - root.top) / scale : detail ? (detail.top + detail.height / 2 - root.top) / scale - hgt / 2 : y;
      const fly = h('span', { class: 'battle-hand__back battle__opp-fly' });
      fly.style.left = `${x}px`;
      fly.style.top = `${y}px`;
      fly.style.width = `${w}px`;
      fly.style.height = `${hgt}px`;
      fly.style.setProperty('--dx', `${gx - x}px`);
      fly.style.setProperty('--dy', `${gy - y}px`);
      fly.style.setProperty('--sx', (gw / w).toFixed(3));
      fly.style.setProperty('--sy', (gh / hgt).toFixed(3));
      fxLayer.append(fly);
      sound.play('cardSlide');
      setTimeout(() => fly.remove(), OPP_CARD_FLY_MS + 40);
    };

    /** 相手がマナにしたカード（裏向き）を、手札の場所で光らせて消す。見た目だけ */
    const vanishOpponentCard = (from: DOMRect): void => {
      const root = element.getBoundingClientRect();
      const scale = stageScale();
      const ghost = h('span', { class: 'battle-hand__back battle__mana-vanish battle__mana-vanish--opponent' });
      ghost.style.left = `${(from.left - root.left) / scale}px`;
      ghost.style.top = `${(from.top - root.top) / scale}px`;
      ghost.style.width = `${from.width / scale}px`;
      ghost.style.height = `${from.height / scale}px`;
      // ルールの処理（音）は先に済んでいるので、はじける所から始める
      ghost.style.setProperty('--delay', `${-Math.round(MANA_VANISH_MS * 0.35)}ms`);
      fxLayer.append(ghost);
      setTimeout(() => ghost.remove(), MANA_VANISH_MS);
    };

    /** 見せ終えた「相手の手札の確認」（engine の reveal の seq。同じものを2度出さない） */
    let shownRevealSeq = 0;
    /** 不思議な嗅覚（正式：ノビトン 2026-10-25）：相手の手札をすべて表で見せる窓。手札そのものは裏向きのまま動かさない */
    const showReveal = (cardIds: readonly string[]): void => {
      const handle = openModal(element, {
        title: t('battle.reveal.title'),
        body: [
          h('p', { class: 'modal__text', text: t('battle.reveal.lead') }),
          h(
            'div',
            { class: 'battle-reveal' },
            ...cardIds.map((id) => h('div', { class: 'battle-reveal__card' }, createBattleCard(getPlayCard(id), { width: 70, size: 'hand' }))),
          ),
          h('ul', { class: 'battle-reveal__names' }, ...cardIds.map((id) => h('li', { text: cardName(getPlayCard(id)) }))),
        ],
        actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
      });
    };

    const dispatch = (action: BattleAction): void => {
      if (!state) return;
      const played = playedCard(state, action);
      const oppFrom = opponentCardFrom(state, action);
      const before = state;
      const next = applyAction(state, action);
      if (next === state) return;
      state = next;
      targeting = null;
      // 自分が不思議な嗅覚を使ったら、カードを大きく見せたあとに相手の手札を表で見せる（相手が使ったときは経過の1行だけ）
      const reveal = state.reveal;
      if (reveal && reveal.viewer === 'player' && reveal.seq !== shownRevealSeq) {
        shownRevealSeq = reveal.seq;
        const ids = reveal.cardIds;
        setTimeout(() => !destroyed && showReveal(ids), SHOWCASE_MS);
      }
      if (selectedUid && !state.sides.player.hand.some((c) => c.uid === selectedUid)) selectedUid = null;
      // 相手のカードは、裏向きのまま手札からフォーカスエリアへ大きくなりながら動き、着いたら表に返す（返し終えるまでの時間）
      const flyIn = played && oppFrom && action.type !== 'convertToMana';
      const revealDelay = flyIn ? OPP_CARD_FLY_MS + OPP_CARD_FLIP_MS : 0;
      // 見せておく時間（相手のカードは長め）
      const hold = played?.side === 'opponent' ? OPP_SHOWCASE_MS : SHOWCASE_MS;
      if (played) {
        busyUntil = Math.max(busyUntil, Date.now() + revealDelay + hold - 150);
        // 相手のカードが動いている間も、指のマークはまだ出さない
        showcaseUntil = Date.now() + revealDelay + hold;
      }
      // 誰に向けた技か分かるよう、対象のモンスターに指のマークを出す（自分・相手どちらの技も。攻撃は守備が終わるまでも出る）
      if (action.type === 'useCard' && action.targetUid) {
        const until = Date.now() + revealDelay + hold + POINTER_EXTRA_MS;
        pointed = { uid: action.targetUid, until, side: action.side };
        setTimeout(() => !destroyed && render(), until - Date.now() + 20);
      }
      queueHitFx(before, next, action, played, played ? revealDelay + hold : 0);
      // 大きく見せる欄を先に出し（相手のカードは着くまで隠しておく）、そこへ相手のカードを飛ばす
      if (played) showcase(played.cardId, played.side, playedBy(before, next, action), action.type === 'useCard' ? (action.targetUid ?? null) : null, flyIn ? OPP_CARD_FLY_MS : 0);
      render();
      if (oppFrom) {
        // 相手のマナ化も、手札の場所で光って消える
        if (action.type === 'convertToMana') vanishOpponentCard(oppFrom);
        else flyOpponentCard(oppFrom);
      }
    };

    /**
     * 技の光を決める（表示だけ。ルールは変えない）。使ったカードを大きく見せている間は待ち、見せ終わってから出す。
     * ライフが減った＝攻撃の種類（ちから・かしこさ）、増えた＝回復、守備のカード＝防御・回避、相手を選ぶ特殊の技＝特殊
     */
    const queueHitFx = (before: BattleState, after: BattleState, action: BattleAction, played: { cardId: string } | null, delay: number): void => {
      const list: { uid: string; kind: HitFxKind }[] = [];
      const attackCard = before.pending?.cardId ?? played?.cardId;
      const attack = attackCard ? getPlayCard(attackCard) : null;
      const attackKind: HitFxKind = attack?.kind === 'skill' && attack.stat?.type === 'wisdom' ? 'wisdom' : 'force';
      for (const side of ['player', 'opponent'] as const) {
        for (const m of after.sides[side].monsters) {
          const was = before.sides[side].monsters.find((x) => x.uid === m.uid)?.life ?? m.life;
          if (m.life < was) list.push({ uid: m.uid, kind: attackKind });
          else if (m.life > was) list.push({ uid: m.uid, kind: 'heal' });
        }
      }
      const card = played ? getPlayCard(played.cardId) : null;
      if (action.type === 'defend' && card?.kind === 'skill' && before.pending) {
        const category = card.category;
        if (category === 'defense' || category === 'evade') list.push({ uid: before.pending.targetUid, kind: category });
      }
      if (action.type === 'useCard' && action.targetUid && card?.kind === 'skill' && card.category === 'special') list.push({ uid: action.targetUid, kind: 'special' });
      if (list.length === 0) return;
      const from = Date.now() + delay;
      const until = from + HIT_FX_MS;
      hitFx = [...hitFx.filter((f) => f.until > Date.now()), ...list.map((f) => ({ ...f, from, until }))];
      setTimeout(() => !destroyed && render(), delay + 10);
      setTimeout(() => !destroyed && render(), delay + HIT_FX_MS + 20);
    };

    /** いま出している技の光（描き直しても動きが最初に戻らないよう、経った時間の分だけ動きを進める） */
    const hitFxOn = (uid: string): HTMLElement[] => {
      const now = Date.now();
      return hitFx
        .filter((f) => f.uid === uid && now >= f.from && now < f.until)
        .map((f) => {
          const el = h('img', { class: `battle-fx battle-fx--${f.kind}`, attrs: { src: HIT_FX_ART[f.kind], alt: '', 'aria-hidden': 'true', draggable: 'false' } });
          el.style.animationDelay = `${f.from - now}ms`;
          return el;
        });
    };

    /** カードを使ったモンスター（技：行動済になったモンスター、守備：狙われたモンスター、サポート：なし） */
    const playedBy = (before: BattleState, after: BattleState, action: BattleAction): string | null => {
      if (action.type === 'defend') return before.pending?.targetUid ?? null;
      if (action.type !== 'useCard') return null;
      const was = before.sides[action.side].monsters;
      return after.sides[action.side].monsters.find((m, i) => m.acted && !was[i]?.acted)?.uid ?? null;
    };

    /** 演出をタップで飛ばす：大きく見せるのをやめ、待たせていた操作・相手の行動をすぐ進める */
    const skipSpotlight = (): void => {
      if (!spotlight || Date.now() >= spotlight.until) return;
      spotlight = null;
      showcaseUntil = Date.now();
      busyUntil = Math.min(busyUntil, Date.now());
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      render();
    };

    /**
     * 使ったカードをフォーカスエリアに大きく見せる（2026-10-25 リデザイン パートC。技のアニメーションではなく、カードそのものを見せる）。
     * 見せている間は操作と相手の行動を待たせる（タップで飛ばせる）
     */
    const showcase = (cardId: string, side: Side, userUid: string | null, targetUid: string | null, flyMs = 0): void => {
      const now = Date.now();
      // 相手のカード（flyMs > 0）：飛んできて着いたら表に返し、返し終えてから OPP_SHOWCASE_MS 見せる（自分のカードは SHOWCASE_MS）
      const reveal = flyMs > 0 ? flyMs + OPP_CARD_FLIP_MS : 0;
      const until = now + reveal + (side === 'opponent' ? OPP_SHOWCASE_MS : SHOWCASE_MS);
      spotlight = { cardId, side, userUid, targetUid, until, arriveAt: flyMs > 0 ? now + flyMs : null };
      showcaseUntil = until;
      setTimeout(() => {
        // 見せ終わったら、技の対象に指のマークを出す・守備の選択を出すために描き直す
        if (!destroyed && state && spotlight && spotlight.until === until) render();
      }, until - now + 10);
      if (flyMs > 0) {
        // 表に替わる瞬間（返す動きの半分）に、めくる音とカードの種類の音
        sound.play('cardReveal', flyMs + OPP_CARD_FLIP_MS / 2);
        sound.play(showcaseSound(getPlayCard(cardId)), flyMs + OPP_CARD_FLIP_MS / 2);
      } else sound.play(showcaseSound(getPlayCard(cardId)));
    };

    /** 演出の1行：「ラズックの「しっぽアタック」！ → ミュロル」（相手のモンスターには「相手の」を付ける） */
    const spotlightLine = (s: BattleState, sp: NonNullable<typeof spotlight>): string => {
      const who = (uid: string | null): string | null => {
        const found = uid ? findMonster(s, uid) : null;
        if (!found) return null;
        return t(found.side === 'opponent' ? 'battle.spot.whoOpponent' : 'battle.spot.whoPlayer', { name: cardName(found.monster.cardId) });
      };
      const user = who(sp.userUid) ?? t(`battle.side.${sp.side}`);
      const card = cardName(getPlayCard(sp.cardId));
      const target = who(sp.targetUid);
      return target ? t('battle.spot.lineTarget', { user, card, target }) : t('battle.spot.line', { user, card });
    };

    /** 演出の中身：上に1行、左に名前・種類・威力・効果の文、右にカードを大きく。タップで飛ばす */
    const spotlightPanel = (s: BattleState, sp: NonNullable<typeof spotlight>): HTMLElement => {
      const card = getPlayCard(sp.cardId);
      const kind = card.kind === 'skill' ? categoryLabel(skillCategory(card)) : t(card.duration === 'field' ? 'card.supportKind.field' : 'card.kind.support');
      // 数値の行（skillValueBadge のきまり）：ダメージ＝「ちから 3」、防御＝「防御 −3」、回避＝「回避」、特殊＝「効果」
      const badge = card.kind === 'skill' ? skillValueBadge(card) : null;
      const power =
        badge?.kind === 'damage'
          ? t('battle.spot.power', { stat: kind, n: badge.value })
          : badge?.kind === 'guard'
            ? t('battle.spot.guard', { n: badge.value })
            : badge
              ? skillValueBadgeText(badge)
              : kind;
      // 相手のカード：着くまで隠し、着いたら裏から表へ返す。文字は表に替わってから出す（描き直したときは途中から）
      const arriving = sp.arriveAt !== null && Date.now() < sp.arriveAt + OPP_CARD_FLIP_MS;
      // 相手のカードは相手の場所（上。相手の手札と列の上に重ねる）で、カードを左・説明を右に（PS版の 2P 側と同じ向かい合わせ）
      const where = sp.side === 'opponent' ? 'battle-opp-spot' : 'battle-detail';
      // 「誰が誰に」の1行：自分のカードは上に横長で、相手のカードは説明の列の頭に（カードを場所の高さいっぱいに出すため）
      const line = h('p', { class: 'battle-spot__line', text: spotlightLine(s, sp) });
      const inInfo = sp.side === 'opponent';
      const panel = h(
        'div',
        {
          class: `${where} battle-spot battle-spot--${sp.side}${arriving ? ' is-arriving' : ''}`,
          attrs: { role: 'button', 'aria-label': t('battle.spot.skip') },
          on: { click: skipSpotlight },
        },
        inInfo ? null : line,
        h(
          'div',
          { class: 'battle-spot__body' },
          h(
            'div',
            { class: 'battle-spot__info' },
            inInfo ? line : null,
            h('p', { class: 'battle-spot__name', text: cardName(card) }),
            h('p', { class: 'battle-spot__power', text: power }),
            h('p', { class: 'battle-spot__desc', text: describePlayCard(card) }),
            h('p', { class: 'battle-spot__skip', text: t('battle.spot.tapToSkip') }),
          ),
          h(
            'div',
            { class: 'battle-spot__card' },
            arriving
              ? h('div', { class: 'battle-spot__flip' }, createBattleCard(card, { width: SPOT_CARD_W, size: 'focus' }), h('span', { class: 'battle-spot__back' }))
              : createBattleCard(card, { width: SPOT_CARD_W, size: 'focus' }),
          ),
        ),
      );
      if (arriving && sp.arriveAt !== null) panel.style.setProperty('--arrive-delay', `${sp.arriveAt - Date.now()}ms`);
      return panel;
    };

    /** いまの画面の拡大率（ステージは拡大縮小されているので、位置の計算に使う） */
    const stageScale = (): number => {
      const w = element.offsetWidth;
      return w > 0 ? element.getBoundingClientRect().width / w : 1;
    };

    /**
     * 選んだ手札をまとめてマナにする：カードが1枚ずつ、手札の場所で光って消える。
     * 1枚消えるたびにマナが1増えて、消える音が1回鳴る（音・絵・マナの数をそろえる）
     */
    const convertPicked = (): void => {
      if (!state || dealing() || manaPicks.size === 0) return;
      const picks = state.sides.player.hand.filter((c) => manaPicks.has(c.uid)).map((c) => c.uid);
      const root = element.getBoundingClientRect();
      const scale = stageScale();
      // 先に全部の位置を測って写しを置く（1枚ずつ手札から抜けると、残りのカードの位置がずれるため）
      for (const [i, uid] of picks.entries()) {
        const from = element.querySelector(`.battle__hand-card[data-uid="${uid}"] .skill-card`);
        if (!from) continue;
        const r = from.getBoundingClientRect();
        const ghost = from.cloneNode(true) as HTMLElement;
        ghost.classList.add('battle__mana-vanish');
        ghost.style.left = `${(r.left - root.left) / scale}px`;
        ghost.style.top = `${(r.top - root.top) / scale}px`;
        ghost.style.setProperty('--delay', `${i * MANA_VANISH_STAGGER_MS}ms`);
        // カードがほどけて青い光の粒になる絵（2026-10-26 デザイン第9弾）
        ghost.append(h('img', { class: 'battle__mana-fx battle__mana-fx--convert', attrs: { src: fxManaConvert, alt: '', 'aria-hidden': 'true', draggable: 'false' } }));
        fxLayer.append(ghost);
        setTimeout(() => ghost.remove(), MANA_VANISH_MS + i * MANA_VANISH_STAGGER_MS + 50);
        element.querySelector(`.battle__hand-card[data-uid="${uid}"]`)?.classList.add('is-leaving');
      }
      for (const uid of picks) manaFlying.add(uid);
      const total = MANA_VANISH_MS + (picks.length - 1) * MANA_VANISH_STAGGER_MS;
      busyUntil = Math.max(busyUntil, Date.now() + total);
      for (const [i, uid] of picks.entries()) {
        // 光ってはじける瞬間（消える動きの 35%）に、1枚ずつルールに渡す（できなかった分は何も起きず、音も鳴らない）
        setTimeout(() => {
          manaFlying.delete(uid);
          if (destroyed || !state) return;
          state = applyAction(state, { type: 'convertToMana', side: 'player', cardUid: uid });
          if (i === picks.length - 1) {
            manaPicks.clear();
            selectedUid = null;
          }
          render();
        }, i * MANA_VANISH_STAGGER_MS + Math.round(MANA_VANISH_MS * 0.35));
      }
    };

    /** マナ化で手札をタップ：マナにする候補に入れる／外す（最初のターンは決まった枚数まで） */
    const toggleManaPick = (uid: string): void => {
      if (!state) return;
      if (manaPicks.has(uid)) manaPicks.delete(uid);
      else {
        const limit = state.manaConvertLimit;
        if (limit !== null && manaPicks.size >= limit) return;
        manaPicks.add(uid);
      }
    };

    /** 守備に使えるカードが1枚もないときは、守備の選択を出さずに自動で進める */
    const noDefensePossible = (s: BattleState): boolean =>
      s.phase === 'defense' &&
      s.pending?.attacker === 'opponent' &&
      !s.sides.player.hand.some((c) => cardUsability(s, 'player', c.uid).usable);

    const scheduleAi = (): void => {
      if (timer || destroyed || !state || hintOpen) return;
      const side = actingSide(state);
      if (!side) return;
      const wait = Math.max(0, busyUntil - Date.now());
      if (side === 'player' && !auto) {
        if (!noDefensePossible(state)) {
          // 配り終わったら操作できるように描き直す
          if (wait > 0) timer = setTimeout(() => ((timer = null), render()), wait);
          return;
        }
        timer = setTimeout(() => {
          timer = null;
          if (!destroyed && state && noDefensePossible(state)) dispatch({ type: 'defend', side: 'player', cardUid: null });
        }, AI_STEP_MS + 250 + wait);
        return;
      }
      timer = setTimeout(() => {
        timer = null;
        if (destroyed || !state) return;
        const s = actingSide(state);
        if (!s || (s === 'player' && !auto)) return;
        const action = chooseAction(state, s);
        if (action) dispatch(action);
      }, AI_STEP_MS + wait);
    };

    /* ---------- 先攻・後攻 ---------- */

    const pickOrder = (index: number): void => {
      if (orderPicked !== null) return;
      orderPicked = index;
      sound.play('turnOrderSelect');
      render();
      const first: Side = orderCards[index] === 'first' ? 'player' : 'opponent';
      setTimeout(() => {
        if (destroyed) return;
        state = createBattle(
          { name: t('battle.side.player'), deck: save.deck },
          { name: opponentName(req.opponent), deck: buildAutoDeck(req.opponent.monsters), lifeScale: req.opponent.lifeScale },
          seed,
          first,
        );
        say('battle.talk.start');
        render();
      }, ORDER_REVEAL_MS);
    };

    const orderView = (): HTMLElement => {
      const picked = orderPicked;
      const result = picked === null ? null : orderCards[picked];
      return h(
        'div',
        { class: 'battle-order' },
        versusView(),
        h('p', { class: 'battle-order__title', text: picked === null ? t('battle.order.title') : t(result === 'first' ? 'battle.order.resultFirst' : 'battle.order.resultSecond') }),
        h('p', { class: 'battle-order__hint', text: picked === null ? t('battle.order.hint') : t(result === 'first' ? 'battle.order.startPlayer' : 'battle.order.startOpponent') }),
        h(
          'div',
          { class: 'battle-order__cards' },
          ...orderCards.map((label, i) =>
            h(
              'button',
              {
                class: `battle-order__card${picked !== null ? ' is-open' : ''}${picked === i ? ' is-picked' : ''}`,
                attrs: { type: 'button', 'aria-label': picked === null ? t('battle.order.cardAria', { n: i + 1 }) : orderFace(label) },
                dataset: { index: String(i) },
                on: { click: () => pickOrder(i) },
              },
              h('span', { class: 'battle-order__back', attrs: { 'aria-hidden': 'true' } }),
              h('span', { class: `battle-order__face battle-order__face--${label}`, text: orderFace(label) }),
            ),
          ),
        ),
      );
    };

    /** 先攻・後攻を決める画面の上の「あなた VS 相手」。相手の顔の絵が無いとき（ダンジョン・練習）は、相手の先頭のモンスターのアイコン */
    const versusView = (): HTMLElement => {
      const faceImg = (url: string): HTMLElement => h('img', { attrs: { src: url, alt: '', draggable: 'false' } });
      const opponentUrl = opponentFaceUrl(faceKeyOf(req.opponent));
      const lead = req.opponent.monsters[0];
      const opponentFaceEl = opponentUrl ? faceImg(opponentUrl) : lead ? createMonsterPortrait(getMonster(lead), 44) : h('span');
      return versusBanner(
        { name: t('battle.side.player'), face: faceImg(heroFaceUrl(save.player.gender)) },
        { name: opponentName(req.opponent), face: opponentFaceEl },
      );
    };

    /* ---------- 操作 ---------- */

    const useCard = (cardUid: string): void => {
      if (!state || dealing()) return;
      const hand = state.sides.player.hand.find((c) => c.uid === cardUid);
      if (!hand || !cardUsability(state, 'player', cardUid).usable) return;
      const card = getPlayCard(hand.cardId);
      const targets = targetsFor(state, 'player', card);
      const enemyTarget = card.kind === 'skill' && targetsEnemy(card);
      if (enemyTarget || card.effect.type === 'heal') {
        if (targets.length === 1 && targets[0]) {
          dispatch({ type: 'useCard', side: 'player', cardUid, targetUid: targets[0].uid });
          return;
        }
        targeting = {
          cardUid,
          targets: targets.map((t) => t.uid),
          prompt: t(card.effect.type === 'attack' ? 'battle.prompt.attackTarget' : enemyTarget ? 'battle.prompt.specialTarget' : 'battle.prompt.healTarget'),
        };
        render();
        return;
      }
      dispatch({ type: 'useCard', side: 'player', cardUid });
    };

    /* ---------- 手札を指でなぞる ---------- */
    // ・なぞる：指の下のカードを選んで中段に大きく出す（マナ化では、なぞったカードをまとめて候補に入れる／外す）
    // ・上へはじく（持ち上げて離す）：そのカードを使う。マナ化では候補ごとマナにする
    // ・タップは従来どおり。手札が横にはみ出すときは、指を端へ寄せると送る

    const isMyMana = (s: BattleState): boolean => s.phase === 'mana' && s.active === 'player' && !auto;
    const isMyMain = (s: BattleState): boolean => s.phase === 'main' && s.active === 'player' && !auto;

    /** 指の位置にある手札（列の高さにあるときだけ。カードの間のすき間は近い方） */
    const handCardAt = (x: number, y: number): string | null => {
      const row = element.querySelector<HTMLElement>('.battle__hand');
      if (!row) return null;
      const r = row.getBoundingClientRect();
      if (y < r.top || y > r.bottom) return null;
      let best: string | null = null;
      let bestGap = Infinity;
      for (const el of row.querySelectorAll<HTMLElement>('.battle__hand-card')) {
        const c = el.getBoundingClientRect();
        if (c.right < r.left || c.left > r.right) continue;
        const gap = x < c.left ? c.left - x : x > c.right ? x - c.right : 0;
        if (gap < bestGap) {
          bestGap = gap;
          best = el.dataset.uid ?? null;
        }
      }
      return best;
    };

    /** マナ化でなぞったカードを、最初のカードに合わせて候補に入れる／外す */
    const paintManaPick = (uid: string): void => {
      if (!swipe?.paint || dealing()) return;
      if (manaPicks.has(uid) !== (swipe.paint === 'add')) toggleManaPick(uid);
    };

    /** 持ち上げたカードを指の上に出す（描き直しで消えるので、描き直しのたびに付け直す） */
    const syncSwipeGhost = (): void => {
      const s = state;
      const hand = swipe?.lifted && s ? s.sides.player.hand.find((c) => c.uid === swipe?.uid) : undefined;
      if (!swipe || !s || !hand) {
        swipeGhost?.remove();
        swipeGhost = null;
        return;
      }
      if (!swipeGhost || swipeGhost.dataset.uid !== hand.uid) {
        swipeGhost?.remove();
        const usability = cardUsability(s, 'player', hand.uid);
        const label = isMyMana(s) ? t('battle.hand.releaseMana') : usability.usable ? t('battle.hand.releaseUse') : (usability.reason ?? t('battle.prompt.unusable'));
        swipeGhost = h(
          'div',
          { class: `battle__hand-ghost${isMyMana(s) || usability.usable ? '' : ' is-unusable'}`, dataset: { uid: hand.uid }, attrs: { 'aria-hidden': 'true' } },
          createBattleCard(getPlayCard(hand.cardId), { width: 78, size: 'hand' }),
          h('span', { class: 'battle__hand-ghost-label', text: label }),
        );
      }
      if (!swipeGhost.isConnected) element.append(swipeGhost);
      const root = element.getBoundingClientRect();
      const scale = stageScale();
      // 端のカードでも絵が画面からはみ出さないように
      const half = 46;
      swipeGhost.style.left = `${Math.min(element.offsetWidth - half, Math.max(half, (swipe.x - root.left) / scale))}px`;
      swipeGhost.style.top = `${(swipe.y - root.top) / scale}px`;
    };

    /** 指が動いたあと：持ち上げたかどうかと、指の下のカードを調べ直す */
    const updateSwipe = (): void => {
      if (!swipe || !state) return;
      const s = state;
      const scale = stageScale();
      const up = (swipe.anchorY - swipe.y) / scale;
      const across = Math.abs(swipe.x - swipe.anchorX) / scale;
      // 持ち上げられるのは、使える場面（自分の攻撃・マナ化）で配り終えているときだけ
      const lift = (isMyMain(s) || isMyMana(s)) && !dealing() && up >= HAND_LIFT_PX && up > across;
      let changed = lift !== swipe.lifted;
      swipe.lifted = lift;
      if (!swipe.lifted) {
        const uid = handCardAt(swipe.x, swipe.y);
        if (uid && uid !== swipe.uid) {
          if (!swipe.moved) {
            swipe.moved = true;
            paintManaPick(swipe.startUid);
          }
          swipe.uid = uid;
          swipe.anchorX = swipe.x;
          swipe.anchorY = swipe.y;
          selectedUid = uid;
          paintManaPick(uid);
          changed = true;
        }
      }
      if (changed) render();
      else syncSwipeGhost();
    };

    /** 手札が横にはみ出しているとき、指が端にあれば少しずつ送る（指を置いている間ずっと） */
    const swipeAutoScroll = (): void => {
      swipeRaf = 0;
      if (!swipe) return;
      const row = element.querySelector<HTMLElement>('.battle__hand');
      if (row && !swipe.lifted && row.scrollWidth > row.clientWidth) {
        const r = row.getBoundingClientRect();
        const edge = HAND_EDGE_PX * stageScale();
        const dir = swipe.x < r.left + edge ? -1 : swipe.x > r.right - edge ? 1 : 0;
        if (dir !== 0 && swipe.y >= r.top && swipe.y <= r.bottom) {
          row.scrollLeft += dir * HAND_SCROLL_STEP;
          updateSwipe();
        }
      }
      swipeRaf = requestAnimationFrame(swipeAutoScroll);
    };

    const onSwipeMove = (e: PointerEvent): void => {
      if (!swipe || e.pointerId !== swipe.pointerId) return;
      swipe.x = e.clientX;
      swipe.y = e.clientY;
      updateSwipe();
    };

    const stopSwipe = (): HandSwipe | null => {
      const done = swipe;
      swipe = null;
      window.removeEventListener('pointermove', onSwipeMove);
      window.removeEventListener('pointerup', onSwipeEnd);
      window.removeEventListener('pointercancel', onSwipeEnd);
      if (swipeRaf) cancelAnimationFrame(swipeRaf);
      swipeRaf = 0;
      swipeGhost?.remove();
      swipeGhost = null;
      return done;
    };

    const onSwipeEnd = (e: PointerEvent): void => {
      if (!swipe || e.pointerId !== swipe.pointerId) return;
      const done = stopSwipe();
      const s = state;
      if (!done || !s || destroyed) return;
      if (e.type === 'pointercancel') {
        render();
        return;
      }
      if (done.lifted && !dealing()) {
        selectedUid = done.uid;
        if (isMyMana(s)) {
          // 上へはじいたカードも候補に入れて、候補をまとめてマナにする
          if (!manaPicks.has(done.uid)) toggleManaPick(done.uid);
          render();
          if (manaPicks.has(done.uid) && canConvertToMana(s, 'player')) convertPicked();
          return;
        }
        if (isMyMain(s) && cardUsability(s, 'player', done.uid).usable) {
          useCard(done.uid);
          return;
        }
      } else if (!done.moved && isMyMana(s) && !dealing()) {
        // なぞらずに離した＝タップ：従来どおり候補に入れる／外す
        toggleManaPick(done.uid);
      }
      render();
    };

    const onHandDown = (e: PointerEvent): void => {
      if (swipe || !state || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const uid = (e.target as Element | null)?.closest<HTMLElement>('.battle__hand-card')?.dataset.uid;
      if (!uid) return;
      e.preventDefault();
      swipe = {
        pointerId: e.pointerId,
        startUid: uid,
        uid,
        anchorX: e.clientX,
        anchorY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        lifted: false,
        paint: isMyMana(state) ? (manaPicks.has(uid) ? 'remove' : 'add') : null,
      };
      selectedUid = uid;
      targeting = null;
      window.addEventListener('pointermove', onSwipeMove);
      window.addEventListener('pointerup', onSwipeEnd);
      window.addEventListener('pointercancel', onSwipeEnd);
      swipeRaf = requestAnimationFrame(swipeAutoScroll);
      render();
    };

    const tapMonster = (side: Side, monster: BattleMonster): void => {
      if (targeting && targeting.targets.includes(monster.uid)) {
        dispatch({ type: 'useCard', side: 'player', cardUid: targeting.cardUid, targetUid: monster.uid });
        return;
      }
      const extra = [
        t(`battle.monster.owner.${side}`),
        t(monster.acted ? 'battle.monster.lifeActed' : 'battle.monster.life', { life: monster.life, max: monster.maxLife }),
      ];
      // 正式カードの絵（名前・LIFE 入り）があれば、それを大きく見せる（2026-10-25 ユーザー指示「タップすると正式絵に」）。無ければいままでの詳しい表示
      const card = getMonster(monster.cardId);
      const officialUrl = resolveCardArt(card.art);
      if (officialUrl) {
        const img = h('img', { class: 'battle-card-detail__official', attrs: { src: officialUrl, alt: cardName(card), draggable: 'false' } });
        img.style.width = `${OFFICIAL_CARD_DETAIL_W}px`;
        const handle = openModal(element, {
          className: 'battle-card-detail',
          body: [img, ...extra.map((text) => h('p', { class: 'battle-card-detail__line', text }))],
          actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
        });
        return;
      }
      openCardDetail(element, getMonster(monster.cardId), { extra });
    };

    const surrender = (): void => {
      confirmModal(element, t('battle.surrenderTitle'), [h('p', { text: t('battle.surrenderText') })], () => {
        if (!state) return;
        state = { ...state, phase: 'ended', winner: 'opponent', endReason: 'knockout' };
        render();
      });
    };

    const showRules = (): void => {
      const handle = openModal(element, {
        title: t('battle.rulesTitle'),
        body: [
          // 図（2026-10-26 デザイン第11弾）：マナにする・攻撃と守り・サポート・勝ち負け
          h(
            'div',
            { class: 'rules-art' },
            ...RULES_ART.map((src, i) =>
              h('figure', { class: 'rules-art__item' }, h('img', { attrs: { src, alt: '', draggable: 'false' } }), h('figcaption', { text: t(`battle.rulesArt.${i + 1}` as MessageKey) })),
            ),
          ),
          h('p', { class: 'modal__text', text: t('battle.rulesLead') }),
          h('ul', { class: 'rule-list' }, ...provisionalRuleNotes().map((note) => h('li', { text: note }))),
        ],
        actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
      });
    };

    /** これまでの経過（ログ）をすべて見る窓。ふだんは真ん中の帯に最新の1行だけ出す */
    const showLog = (): void => {
      if (!state) return;
      const lines = [...state.log].reverse();
      const handle = openModal(element, {
        title: t('battle.log.title'),
        body: [h('ol', { class: 'battle-log' }, ...lines.map((l) => h('li', { class: 'battle-log__line', text: l.text })))],
        actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
      });
    };

    /* ---------- 表示 ---------- */
    // 2026-10-24 改訂R2「対戦テーブル」：上から 相手の手札（裏）→ 相手の列 → 真ん中の帯 → 自分の列 → 自分の手札（表）→ 説明。
    // 相手の列：左＝誰・いまの状態、真ん中＝モンスター3体、右＝マナ・山札・手札・捨札。
    // 自分の列：左＝マナ・山札・手札・捨札、真ん中＝モンスター3体、右＝操作のボタン（2026-10-24 ユーザー指示：いちばん下は下すぎて操作しにくい）

    /** いまの状態（攻撃中・マナ化中・守備中・待機中） */
    const sideState = (s: BattleState, side: Side): string => {
      if (s.phase === 'ended') return t('battle.zone.state.ended');
      if (s.phase === 'defense' && s.pending) return t(s.pending.attacker === side ? 'battle.zone.state.attack' : 'battle.zone.state.defense');
      if (s.active !== side) return t('battle.zone.state.wait');
      return t(s.phase === 'mana' ? 'battle.zone.state.mana' : 'battle.zone.state.attack');
    };

    /**
     * 情報の欄（2026-10-26 ユーザー指示「あなた・相手とマナ、山札や手札はモンスターカードの左に寄せる」）。
     * モンスターの列の左に縦に並べる：誰か（相手は顔の絵と名前）・いまの状態・マナ・山札・手札・捨札（アイコン＋文字。文字も残す）
     */
    const sideStats = (s: BattleState, side: Side): HTMLElement => {
      const st = s.sides[side];
      const active = s.active === side && s.phase !== 'ended';
      const icon = (src: string): HTMLElement => h('img', { class: 'battle-info__icon', attrs: { src, alt: '', 'aria-hidden': 'true', draggable: 'false' } });
      const count = (src: string, text: string): HTMLElement => h('span', { class: 'battle-info__count' }, icon(src), h('span', { text }));
      return h(
        'div',
        { class: `battle-stats battle-stats--${side}${active ? ' is-active' : ''}` },
        h(
          'span',
          { class: 'battle-stats__who' },
          h('span', { class: 'battle-line__tag', text: t(`battle.side.${side}`) }),
          side === 'opponent' ? opponentFace(faceKeyOf(req.opponent), 16) : null,
        ),
        side === 'opponent' ? h('span', { class: 'battle-stats__name', text: st.name }) : null,
        h('span', { class: 'battle-stats__state', text: sideState(s, side) }),
        h(
          'span',
          { class: 'battle-info__mana', attrs: { 'aria-label': t('battle.info.manaAria', { n: manaOf(st) }) } },
          icon(iconMana),
          h('span', { class: 'battle-info__mana-label', text: t('card.detail.mana') }),
          h('span', { class: 'battle-info__mana-value', text: String(manaOf(st)) }),
        ),
        count(iconDeck, t('battle.info.deck', { n: st.deck.length })),
        count(iconHand, t('battle.info.hand', { n: st.hand.length })),
        count(iconDiscard, t('battle.info.discard', { n: st.discard.length })),
      );
    };

    /** モンスターの列：左に情報の欄、右にモンスター3体 */
    const monsterRow = (s: BattleState, side: Side): HTMLElement =>
      h('div', { class: `battle-row battle-row--${side}` }, sideStats(s, side), monsterSet(s, side));

    /** モンスター3体（正方形のアイコンを横一列。2026-10-25 リデザイン：カードの枠をやめ、ライフはアイコンの下に数字で大きく） */
    const monsterSet = (s: BattleState, side: Side): HTMLElement =>
      h(
        'div',
        { class: `battle-side battle-side--${side}` },
        ...s.sides[side].monsters.map((m) => {
          const isTarget = targeting?.targets.includes(m.uid) ?? false;
          const before = prevLife.get(m.uid) ?? m.life;
          const diff = m.life - before;
          const isPendingTarget = s.pending?.targetUid === m.uid;
          // 使ったカードを大きく見せている間は出さない（2026-10-24 ユーザー指示）。見せ終わってから
          const isPointed = m.life > 0 && Date.now() >= showcaseUntil && (isPendingTarget || (pointed?.uid === m.uid && Date.now() < pointed.until));
          const down = m.life <= 0;
          // 技の演出の間：使った側と対象のアイコンを光らせる（つながりが分かるように）
          const spot = spotlight && Date.now() < spotlight.until ? spotlight : null;
          const spotClass = spot?.userUid === m.uid ? ' is-spot-user' : spot?.targetUid === m.uid ? ' is-spot-target' : '';
          // ライフのゲージ（2026-10-26 デザイン第9弾）：1/3 以下＝赤、1/2 以下＝黄土色、それより多い＝緑
          const lifeLevel = m.life * 3 <= m.maxLife ? ' is-low' : m.life * 2 <= m.maxLife ? ' is-mid' : '';
          const bar = h('span', { class: `battle__monster-bar${lifeLevel}` }, h('span', { class: 'battle__monster-bar-fill' }));
          (bar.firstElementChild as HTMLElement).style.width = `${Math.max(0, (m.life / m.maxLife) * 100)}%`;
          return h(
            'button',
            {
              // 対象を選ぶ間は、選べないモンスターを暗くして候補と見分ける
              class: `battle__monster battle__monster--${side}${isTarget ? ' is-target' : targeting ? ' is-not-target' : ''}${isPendingTarget ? ' is-attacked' : ''}${m.acted && !down ? ' is-acted' : ''}${down ? ' is-down' : ''}${diff < 0 ? ' is-hit' : ''}${spotClass}`,
              attrs: { type: 'button', 'aria-label': t('battle.monster.aria', { name: cardName(m.cardId), life: m.life }) },
              dataset: { uid: m.uid },
              on: { click: () => tapMonster(side, m) },
            },
            h(
              'span',
              { class: 'battle__monster-icon' },
              hasBattleCard(m.cardId)
                ? createBattleMonsterCard(getMonster(m.cardId), MONSTER_ICON, { current: lifeShown.get(m.uid) ?? m.life, max: m.maxLife })
                : createMonsterPortrait(getMonster(m.cardId), MONSTER_ICON, MONSTER_ICON_H),
              // 戦闘不能の印・行動済の印（2026-10-26 デザイン第9弾。文字も残す）
              down
                ? h('span', { class: 'battle__monster-down' }, h('img', { class: 'battle__monster-down-mark', attrs: { src: knockoutArt, alt: '', draggable: 'false' } }), h('span', { class: 'battle__monster-down-text', text: t('card.down') }))
                : null,
              m.acted && !down ? h('span', { class: 'battle__acted' }, statusIcon(statusActedArt), h('span', { text: t('battle.monster.acted') })) : null,
              // 吠える・ダストキック（技のダメージ−）・すなかけ（次の手番は攻撃できない）・ちょうはつ（ラズックだけ）がかかっている印
              !down ? statusBadges(s, m) : null,
              diff < 0 ? h('span', { class: 'battle__burst', attrs: { 'aria-hidden': 'true' } }) : null,
              ...hitFxOn(m.uid),
              // 回復だけ「+2」のように出す。ダメージは数字を出さず、ライフを1ずつ減らして音で数える（2026-10-24 ユーザー指示）
              diff > 0 ? battleDigits(diff, 'battle__float') : null,
            ),
            bar,
            // いまのライフ／最大（最大はカードのデータから。バーと同じ値）
            h(
              'span',
              { class: `battle__monster-life${down ? ' is-down' : m.life * 3 <= m.maxLife ? ' is-low' : ''}` },
              h('span', { class: 'battle__monster-life-now', text: String(lifeShown.get(m.uid) ?? m.life) }),
              h('span', { class: 'battle__monster-life-max', text: `/${m.maxLife}` }),
            ),
            // 技の対象の矢印（2026-10-26 デザイン第9弾。それまでは絵文字の👇）。色は技を使った側：自分の技＝青、相手の技＝赤
            isPointed ? pointerArrow(isPendingTarget && s.pending ? s.pending.attacker : (pointed?.side ?? otherSide(side))) : null,
          );
        }),
      );

    /**
     * モンスターにかかっている特殊の効果の印（無ければ null）。
     * 技のダメージ−（吠える・ダストキック・熱風の威嚇）は、拳（ちから）・本（かしこさ）の印と赤い数字の「−1」で出す（2026-10-24 ユーザー指示「文字にしない」）
     */
    /** 状態のアイコン（小さな丸い印） */
    const statusIcon = (src: string): HTMLElement => h('img', { class: 'battle__status-art', attrs: { src, alt: '', 'aria-hidden': 'true', draggable: 'false' } });

    /** 技の対象の矢印。by＝技を使った側 */
    const pointerArrow = (by: Side): HTMLElement =>
      h('img', { class: `battle__pointer battle__pointer--by-${by}`, attrs: { src: by === 'player' ? targetPlayerArt : targetOpponentArt, alt: '', 'aria-hidden': 'true', draggable: 'false' } });

    /** マナの光（約0.8秒で消える） */
    const manaFx = (src: string, kind: 'gain' | 'spend'): HTMLElement => {
      const el = h('img', { class: `battle__mana-fx battle__mana-fx--${kind}`, attrs: { src, alt: '', 'aria-hidden': 'true', draggable: 'false' } });
      setTimeout(() => el.remove(), 900);
      return el;
    };

    const statusBadges = (s: BattleState, m: BattleMonster): HTMLElement | null => {
      const items: HTMLElement[] = [];
      const weakenBadge = (stat: StatType, n: number): HTMLElement =>
        h(
          'span',
          { class: 'battle__status-stat', attrs: { role: 'img', 'aria-label': t('battle.status.weaken', { stat: statLabel(stat), n }) } },
          statusIcon(statusWeakenArt),
          h('img', { class: 'battle__status-icon', attrs: { src: STAT_ICON[stat], alt: '', draggable: 'false' } }),
          battleDigits(-n, 'battle__status-num'),
        );
      // 熱風の威嚇は期限（untilTurn）が過ぎたら出さない
      if (m.weaken && (m.weaken.untilTurn === undefined || m.weaken.untilTurn >= s.turn)) items.push(weakenBadge(m.weaken.stat, m.weaken.amount));
      // ダストキック：かけた手番（相手の番）と、効く手番（次の手番）の間だけ出す
      if (m.weakenTurn && m.weakenTurn.turn >= s.turn) items.push(weakenBadge(m.weakenTurn.stat, m.weakenTurn.amount));
      // 状態のアイコン（2026-10-26 デザイン第9弾。文字も残す）
      const textBadge = (art: string, text: string): HTMLElement => h('span', { class: 'battle__status-text' }, statusIcon(art), h('span', { text }));
      if (m.sealedTurn !== undefined && m.sealedTurn !== null && m.sealedTurn >= s.turn) items.push(textBadge(statusSealedArt, t('battle.status.sealed')));
      // まきつく：次の手番は技を使えない（2026-10-26 から印を出す）
      if (m.stunnedTurn !== undefined && m.stunnedTurn !== null && m.stunnedTurn >= s.turn) items.push(textBadge(statusStunnedArt, t('battle.status.stunned')));
      // すなをほる：攻撃の対象にならない（使った手番と相手の次の手番の間だけ出す。絵は守りの印を使う）
      if (m.hiddenTurn !== undefined && m.hiddenTurn !== null && m.hiddenTurn >= s.turn) items.push(textBadge(statusShieldArt, t('battle.status.hidden')));
      if (m.taunt && m.taunt.turn >= s.turn) items.push(textBadge(statusTauntArt, t('battle.status.taunted', { only: cardName(m.taunt.monsterId) })));
      // しめったはだ：受けるダメージ−（使った手番と相手の次の手番の間だけ出す）
      if (m.shield && m.shield.untilTurn >= s.turn) {
        const stat = m.shield.against === 'all' ? t('card.stat.all') : statLabel(m.shield.against);
        items.push(textBadge(statusShieldArt, t('battle.status.shield', { stat, n: m.shield.reduce })));
      }
      if (items.length === 0) return null;
      return h('span', { class: 'battle__status' }, ...items);
    };

    /**
     * 相手の手札（裏向き。2026-10-23 ユーザー指示「相手の手札は見えたらダメ」。2026-10-25 リデザインでいったん外し、ユーザー指示で戻した）。
     * 自分の手札と同じ大きさで、実際の枚数だけ並べる。押しても何も出さない。入りきらないときは重ねる
     */
    const opponentHand = (s: BattleState): HTMLElement => {
      const hand = s.sides.opponent.hand;
      let newIndex = 0;
      const row = h(
        'div',
        { class: 'battle-hand battle-hand--opponent', attrs: { role: 'img', 'aria-label': t('battle.oppHand.count', { n: hand.length }) } },
        ...hand.map((c) => {
          const back = h('span', { class: 'battle-hand__back' });
          if (!shownOppHand.has(c.uid)) {
            // 新しく引いたカード：山札の方から1枚ずつ来る
            back.classList.add('is-dealt');
            back.style.animationDelay = `${newIndex * DEAL_MS}ms`;
            // 相手が引くときも同じ音（2026-10-26 ユーザー指示「本当の人間と戦ってるようなイメージ」）
            sound.deal(newIndex * DEAL_MS);
            newIndex++;
            shownOppHand.add(c.uid);
          }
          return back;
        }),
        hand.length === 0 ? h('span', { class: 'battle-hand__empty', text: t('battle.oppHand.empty') }) : null,
      );
      row.style.setProperty('--n', String(Math.max(1, hand.length)));
      return row;
    };

    /**
     * 相手のひと言（2026-10-23 ユーザー指示：顔の絵とセリフは大きく、カードの上に重ねてよい。PS版の対戦画面にならう）。
     * 押すと先に消える。顔の絵がない相手（ダンジョンなど）は吹き出しだけ
     */
    const talkOverlay = (s: BattleState): HTMLElement | null => {
      if (!oppLine || Date.now() >= talkUntil) return null;
      const url = opponentFaceUrl(faceKeyOf(req.opponent));
      const el = h(
        'div',
        {
          class: `battle__talk${talkShownSeq !== talkSeq ? ' is-enter' : ''}`,
          attrs: { role: 'status', 'aria-label': oppLine },
          on: {
            click: () => {
              // PS版のように：出している途中なら全部出す、出し終わっていたら閉じる
              const chars = [...(oppLine ?? '')].length;
              if (Date.now() < talkStart + chars * TALK_CHAR_MS) {
                talkStart = Date.now() - chars * TALK_CHAR_MS;
                talkUntil = Date.now() + TALK_MS;
                setTimeout(() => !destroyed && Date.now() >= talkUntil && render(), TALK_MS + 30);
              } else talkUntil = 0;
              render();
            },
          },
        },
        // 顔の絵は金とえんじの枠に入れる（2026-10-27 デザイン第13弾。枠は uiParts12.css の ::after）
        url ? h('span', { class: 'battle__talk-frame' }, h('img', { class: 'battle__talk-face', attrs: { src: url, alt: '', draggable: 'false' } })) : null,
        h('div', { class: 'battle__talk-box' }, h('p', { class: 'battle__talk-name', text: s.sides.opponent.name }), typewriter(oppLine, talkStart)),
      );
      talkShownSeq = talkSeq;
      return el;
    };

    /**
     * セリフを1文字ずつ出す（PS版の会話の出し方）。描き直しても続きから出すよう、出し始めた時刻から文字数を決める。
     * 出し終わったら、次へ進める印（▼）を点滅させる
     */
    const typewriter = (line: string, start: number): HTMLElement => {
      const chars = [...line];
      const text = h('span', { class: 'battle__talk-text' });
      const more = h('span', { class: 'battle__talk-more', attrs: { 'aria-hidden': 'true' }, text: '▼' });
      const el = h('p', { class: 'battle__talk-line', attrs: { 'aria-hidden': 'true' } }, text, more);
      const step = (): boolean => {
        const n = Math.min(chars.length, Math.floor((Date.now() - start) / TALK_CHAR_MS) + 1);
        text.textContent = chars.slice(0, n).join('');
        const done = n >= chars.length;
        more.classList.toggle('is-shown', done);
        return done;
      };
      if (!step()) {
        const id = setInterval(() => {
          if (!el.isConnected || step()) clearInterval(id);
        }, TALK_CHAR_MS);
      }
      return el;
    };

    const detailPanel = (s: BattleState): HTMLElement => {
      // 技を使った演出の間は、そのカードを大きく（パートC）。相手の攻撃に守れるときは、攻撃のカードの下に守備の選択
      // 自分の使ったカードだけここで大きく見せる（相手のカードは相手の場所＝上で見せる：opponentSpot）
      if (spotlight && spotlight.side === 'player' && Date.now() < spotlight.until) return spotlightPanel(s, spotlight);
      // 守備の選択は、相手のカードを上で見せ終わってから出す（それまでは説明の欄に攻撃の文だけ）
      const defense = spotlight && Date.now() < spotlight.until ? null : defensePanel(s);
      if (defense) return defense;
      const hand = selectedUid ? s.sides.player.hand.find((c) => c.uid === selectedUid) : undefined;
      const card = hand ? getPlayCard(hand.cardId) : undefined;
      let body: (HTMLElement | null)[];
      if (targeting) {
        body = [h('p', { class: 'battle-text__prompt', text: targeting.prompt })];
      } else if (s.phase === 'defense' && s.pending) {
        const p = s.pending;
        body = [
          h('p', {
            class: 'battle-text__prompt',
            text:
              p.attacker === 'opponent'
                ? t(noDefensePossible(s) ? 'battle.prompt.incomingNoDefense' : 'battle.prompt.incoming', {
                    skill: cardName(p.cardId),
                    stat: statLabel(p.stat),
                    power: p.power,
                  })
                : t('battle.prompt.attacking', { skill: cardName(p.cardId), n: incomingDamage(s, p) }),
          }),
        ];
      } else if (s.phase === 'mana' && s.active === 'player') {
        // マナ化：手札をタップして候補を選び、「マナにする」でまとめてマナに
        const limit = s.manaConvertLimit;
        body = [
          h('p', {
            class: 'battle-text__prompt',
            text:
              limit === null
                ? t('battle.prompt.mana')
                : limit > 0
                  ? t('battle.prompt.manaFirst', { n: limit })
                  : t('battle.prompt.manaFirstDone'),
          }),
          h('p', { class: 'battle-text__ok', text: t('battle.prompt.picked', { n: manaPicks.size }) }),
          card ? h('p', { class: 'battle-text__desc', text: t('battle.prompt.nameDesc', { name: cardName(card), desc: describePlayCard(card) }) }) : null,
        ];
      } else if (card && hand) {
        const usability = cardUsability(s, 'player', hand.uid);
        const owner =
          card.kind === 'skill'
            ? t('battle.prompt.owner', { name: cardName(card.monsterId) })
            : card.duration === 'field'
              ? t('battle.prompt.supportField')
              : t('battle.prompt.supportLeft', { n: supportUsesLeft(s, 'player', card) ?? '-' });
        body = [
          h('p', { class: 'battle-text__name', text: cardName(card) }),
          h('p', { class: 'battle-text__owner', text: owner }),
          h('p', { class: 'battle-text__desc', text: describePlayCard(card) }),
          usability.usable
            ? h('p', { class: 'battle-text__ok', text: t('battle.prompt.usable') })
            : h('p', { class: 'battle-text__ng', text: usability.reason ?? t('battle.prompt.unusable') }),
        ];
      } else {
        body = [
          h('p', {
            class: 'battle-text__hint',
            text:
              s.phase === 'main' && s.active === 'player'
                ? t('battle.prompt.hintMain')
                : t('battle.prompt.hint'),
          }),
        ];
      }
      // フォーカスエリア（2026-10-25 リデザイン：画面の約1/3）。左＝説明の箱、右＝選んだカードを大きく。何も選んでいないときは説明（操作のガイド）だけ
      return h(
        'div',
        { class: `battle-detail${card ? '' : ' is-guide'}` },
        h(
          'div',
          { class: 'battle-detail__left' },
          h('div', { class: 'battle-text' }, h('div', { class: 'battle-text__body' }, ...body)),
        ),
        card ? h('div', { class: 'battle-detail__card' }, createBattleCard(card, { width: detailW, size: 'focus' })) : null,
      );
    };

    const handRow = (s: BattleState): HTMLElement => {
      const myTurnMain = s.phase === 'main' && s.active === 'player';
      const myMana = s.phase === 'mana' && s.active === 'player' && !auto;
      // カードの大きさ：5枚が少し重なって入る大きさ（HAND_CARD_W〜HAND_CARD_MIN_W）。枚数が減っても大きさは変えない
      const room = (element.offsetWidth || 390) - HAND_ROW_PAD * 2;
      const slots = Math.max(5, s.sides.player.hand.length);
      const cardW = Math.max(HAND_CARD_MIN_W, Math.min(HAND_CARD_W, Math.floor((room - (slots - 1) * (HAND_GAP - HAND_SOFT_OVERLAP)) / slots) - 4));
      element.style.setProperty('--hand-card-w', `${cardW}px`);
      element.style.setProperty('--hand-card-h', `${battleCardHeight(cardW, 'tall').toFixed(2)}px`);
      // 新しく来たカード：1枚ずつ裏向きで配り、配り終えたら左から1枚ずつ表に返す（時刻を決めて handDeal に覚える）
      const now = Date.now();
      const fresh = s.sides.player.hand.filter((c) => !shownHand.has(c.uid));
      const flipFrom = now + fresh.length * DEAL_MS + HAND_FLIP_WAIT_MS;
      for (const [i, c] of fresh.entries()) {
        const deal = { slide: now + i * DEAL_MS, flip: flipFrom + i * HAND_FLIP_STAGGER_MS };
        handDeal.set(c.uid, deal);
        shownHand.add(c.uid);
        sound.deal(deal.slide - now);
        sound.play('cardFlip', deal.flip - now + HAND_FLIP_MS / 2);
      }
      if (fresh.length > 0) {
        busyUntil = Math.max(busyUntil, flipFrom + (fresh.length - 1) * HAND_FLIP_STAGGER_MS + HAND_FLIP_MS);
        // 返し終えたら、裏面の層を外すために描き直す
        setTimeout(() => !destroyed && render(), busyUntil - now + 30);
      }
      const row = h(
        'div',
        {
          class: 'battle__hand',
          attrs: { 'aria-label': t('battle.hand.aria') },
          // なぞる・はじくは指を置いたところから自分で追う（長押しのメニューも出さない）
          on: { pointerdown: onHandDown, contextmenu: (e) => e.preventDefault() },
        },
        ...s.sides.player.hand.map((c) => {
          const card = getPlayCard(c.cardId);
          const usable = cardUsability(s, 'player', c.uid).usable;
          const deal = handDeal.get(c.uid);
          if (deal && now >= deal.flip + HAND_FLIP_MS) handDeal.delete(c.uid);
          const isNew = !!deal && now < deal.flip + HAND_FLIP_MS;
          const picked = myMana && manaPicks.has(c.uid);
          const touching = swipe?.uid === c.uid ? (swipe.lifted ? ' is-lifted' : ' is-touching') : '';
          const leaving = manaFlying.has(c.uid) ? ' is-leaving' : '';
          const el = h(
            'button',
            {
              class: `battle__hand-card${usable ? ' is-usable' : ''}${!usable && myTurnMain ? ' is-unusable' : ''}${selectedUid === c.uid ? ' is-selected' : ''}${picked ? ' is-picked' : ''}${isNew ? ' is-dealt' : ''}${touching}${leaving}`,
              attrs: {
                type: 'button',
                'aria-label': picked
                  ? t('battle.hand.ariaPicked', { name: cardName(card) })
                  : usable
                    ? cardName(card)
                    : t('battle.hand.ariaUnusable', { name: cardName(card) }),
                ...(myMana ? { 'aria-pressed': String(picked) } : {}),
              },
              dataset: { uid: c.uid },
              on: {
                click: (e) => {
                  // 指・マウスの操作はなぞる処理（onHandDown）で受ける。ここはキーボードの決定だけ
                  if (e.detail !== 0) return;
                  selectedUid = c.uid;
                  targeting = null;
                  if (myMana && !dealing()) toggleManaPick(c.uid);
                  render();
                },
              },
            },
            isNew
              ? h('span', { class: 'battle__hand-face' }, createBattleCard(card, { width: cardW, size: 'tall' }), h('span', { class: 'battle__hand-cover' }))
              : createBattleCard(card, { width: cardW, size: 'tall' }),
            picked ? h('span', { class: 'battle__hand-mana' }, h('span', { class: 'battle__hand-mana-text', text: t('card.detail.mana') })) : null,
          );
          if (deal && isNew) {
            // 配る動き・表に返す動きを、決めた時刻に合わせて出す（描き直したときは途中から）
            el.style.setProperty('--deal-delay', `${deal.slide - now}ms`);
            el.style.setProperty('--flip-delay', `${deal.flip - now}ms`);
          }
          return el;
        }),
        // 空の手札の台（2026-10-26 デザイン第11弾）の上に「手札なし」
        s.sides.player.hand.length === 0 ? h('span', { class: 'battle-hand__empty battle-hand__empty--tray', text: t('battle.hand.empty') }) : null,
      );
      // 入りきらないときは少しずつ重ねる（2026-10-26 手札を大きくしたため。横に送らずに全部見えるように）
      const n = s.sides.player.hand.length;
      const need = n * (cardW + 4) + (n - 1) * HAND_GAP;
      if (n > 1 && need > room) row.style.setProperty('--hand-overlap', `${((room - need) / (n - 1)).toFixed(1)}px`);
      return row;
    };

    /** 相手の攻撃に守れるか（自分が操作していて、守備に使えるカードがある） */
    const canChooseDefense = (s: BattleState): boolean =>
      !auto && s.phase === 'defense' && !!s.pending && s.pending.attacker === 'opponent' && !noDefensePossible(s);

    /**
     * 守備の選択（2026-10-25 リデザイン パートC：それまでの画面全体の窓をやめ、フォーカスエリアに。働きは同じ）。
     * 上に攻撃の1行、攻撃のカードを大きく、その横に威力・いまのダメージ、下に守備に使えるカード。「守備しない／守備を終える」は下の操作のボタン
     */
    const defensePanel = (s: BattleState): HTMLElement | null => {
      if (!canChooseDefense(s) || !s.pending) return null;
      const pending = s.pending;
      const target = s.sides.player.monsters.find((m) => m.uid === pending.targetUid);
      // 守備に使えるのは狙われたモンスターのカードだけなので、そのカードだけ並べる
      const options = s.sides.player.hand.filter((c) => {
        const card = getPlayCard(c.cardId);
        return card.kind === 'skill' && ['defense', 'evade'].includes(card.effect.type) && card.monsterId === target?.cardId;
      });
      const used = pending.responses.map((id) => cardName(id)).join(t('common.listSeparator'));
      const attacker = findMonster(s, pending.userUid);
      return h(
        'div',
        { class: 'battle-detail battle-spot battle-spot--opponent battle__defense' },
        h('p', {
          class: 'battle-spot__line',
          text: spotlightLine(s, { cardId: pending.cardId, side: 'opponent', userUid: attacker ? pending.userUid : null, targetUid: pending.targetUid, until: 0, arriveAt: null }),
        }),
        h(
          'div',
          { class: 'battle-spot__body' },
          h(
            'div',
            { class: 'battle-spot__info' },
            h('p', { class: 'battle__defense-title', text: t('battle.defense.title') }),
            h('p', {
              class: 'battle__defense-text',
              text: target
                ? t('battle.defense.text', { skill: cardName(pending.cardId), name: cardName(target.cardId), stat: statLabel(pending.stat), power: pending.power })
                : t('battle.defense.textNoTarget', { skill: cardName(pending.cardId), stat: statLabel(pending.stat), power: pending.power }),
            }),
            h('p', {
              class: 'battle__defense-hint',
              text: used ? t('battle.defense.damageUsed', { n: incomingDamage(s, pending), used }) : t('battle.defense.damage', { n: incomingDamage(s, pending) }),
            }),
            h('p', { class: 'battle__defense-hint', text: t('battle.defense.hint', { stat: statLabel(pending.stat), n: manaOf(s.sides.player) }) }),
          ),
          h('div', { class: 'battle-spot__card' }, createBattleCard(getPlayCard(pending.cardId), { width: DEFENSE_ATTACK_W, size: 'focus' })),
        ),
        h(
          'div',
          { class: 'battle__defense-cards' },
          ...options.map((c) => {
            const usable = cardUsability(s, 'player', c.uid);
            const skill = getSkill(c.cardId);
            const label = skill.effect.type === 'evade' ? effectLabel('evade') : `-${guardReduction(skill)}`;
            const b = h(
              'button',
              {
                class: `battle__defense-card${usable.usable ? '' : ' is-unusable'}`,
                attrs: { type: 'button', 'aria-label': t('battle.defense.cardAria', { name: cardName(skill) }) },
                on: { click: () => dispatch({ type: 'defend', side: 'player', cardUid: c.uid }) },
              },
              createBattleCard(skill, { width: DEFENSE_CARD_W, size: 'hand' }),
              h('span', { class: 'battle__defense-label', text: usable.usable ? label : (usable.reason ?? '') }),
            );
            b.disabled = !usable.usable;
            return b;
          }),
        ),
      );
    };

    const resultOverlay = (s: BattleState): HTMLElement | null => {
      if (s.phase !== 'ended') return null;
      const w = s.winner;
      if (!resultSounded) {
        resultSounded = true;
        sound.play(w === 'player' ? 'battleWin' : 'battleLose', 500);
        say(w === 'player' ? 'battle.talk.lose' : 'battle.talk.win');
      }
      const title = t(w === 'player' ? 'battle.result.win' : w === 'opponent' ? 'battle.result.lose' : 'battle.result.draw');
      const reason = s.endReason === 'deckOut' ? t(w === 'player' ? 'battle.result.deckOutOpponent' : 'battle.result.deckOutPlayer') : '';
      const go = commandButton(t('battle.result.next'), () => {
        go.disabled = true;
        finish(s.winner);
      });
      // 勝ち・負けの主人公の姿（2026-10-27 デザイン第13弾。引き分けは出さない）。結果の窓の上に、窓が足元に重なるように
      const hero =
        w === 'player' || w === 'opponent'
          ? h('img', { class: 'battle__result-hero', attrs: { src: heroResultUrl(save.player.gender, w === 'player'), alt: '', draggable: 'false' } })
          : null;
      return h(
        'div',
        { class: `battle__result battle__result--${w ?? 'draw'}` },
        hero,
        h(
          'div',
          { class: 'battle__result-panel' },
          // 勝ち・負けの帯（デザイン第2弾）の真ん中に結果の文字
          h('div', { class: 'battle__result-banner' }, h('p', { class: 'battle__result-title', text: title })),
          h('p', { class: 'battle__result-sub', text: t('battle.result.sub', { title: req.title, n: s.turn }) }),
          reason ? h('p', { class: 'battle__result-sub', text: reason }) : null,
          go,
        ),
      );
    };

    const v2Hints = req.hintSet === 'introV2';
    /** 練習試合のヒント（「わかった」で閉じる。常設のボタンは増やさない） */
    const hintOverlay = (s: BattleState): HTMLElement | null => {
      if (!req.tutorial || auto) return null;
      if (!hintOpen && !dealing()) {
        const next = nextBattleHint(s, seenHints, !noDefensePossible(s));
        if (next) {
          hintOpen = next;
          seenHints.add(next);
          // 導入イベントV2の試験：マナの説明は1回だけ（先攻1ターン目でも同じ文）。勝敗のヒントは無い（勝ったあとは先生が話す）
          if (v2Hints && (next === 'firstMana' || next === 'mana')) seenHints.add('firstMana').add('mana');
          if (v2Hints && next === 'result') hintOpen = null;
        }
      }
      if (!hintOpen) return null;
      const ok = commandButton(t('story.hint.ok'), () => {
        ok.disabled = true;
        hintOpen = null;
        render();
      });
      return h(
        'div',
        { class: 'battle__hint', dataset: { hint: hintOpen }, attrs: { role: 'dialog' } },
        h(
          'div',
          { class: 'battle__hint-panel' },
          h('p', { class: 'battle__hint-title', text: t(v2Hints ? 'introV2.hint.title' : 'story.hint.title') }),
          h('p', { class: 'battle__hint-text', text: t(v2Hints ? V2_HINT[hintOpen] : (`story.hint.${hintOpen}` as const)) }),
          ok,
        ),
      );
    };

    /** 上の端の小さなボタン（降参＝白旗・ルール＝本の丸い絵。2026-10-23 デザイン第7弾）。文字は絵の下に小さく */
    const topButton = (kind: 'surrender' | 'rules', label: string, onTap: () => void): HTMLElement =>
      h(
        'button',
        { class: `battle__top-btn battle__top-btn--${kind}`, attrs: { type: 'button' }, on: { click: onTap } },
        h('span', { class: 'battle__top-icon', attrs: { 'aria-hidden': 'true' } }),
        h('span', { class: 'battle__top-label', text: label }),
      );

    /** 上の帯：降参（左端・確かめてから）／対戦の名前といまの手番・場面／ルール（右端） */
    /**
     * 上の帯（2026-10-26 ユーザー指示「真ん中の経過の1行を画面上部へ。文字が自動で流れるように。ダンジョン戦などの項目も」）。
     * 左右のボタンの間に、手番・最新の経過・対戦の名前・先攻後攻を1行にして流す。押すと経過をすべて見る。場の全体カードがあれば左に札
     */
    const tickerText = (s: BattleState | null): string => {
      if (!s) return req.title;
      const turn = s.phase === 'ended' ? t('battle.turnBar.ended') : t('battle.turnBar', { n: s.turn, who: t(`battle.side.${s.active}`), phase: t(`battle.phase.${s.phase}`) });
      const last = s.log[s.log.length - 1]?.text ?? '';
      return [turn, last, req.title, t(s.first === 'player' ? 'battle.field.first' : 'battle.field.second')].filter((x) => x !== '').join(t('battle.ticker.separator'));
    };

    const ticker = (s: BattleState | null): HTMLElement => {
      const text = tickerText(s);
      // 描き直しても流れが最初に戻らないよう、文が変わったときだけ流れ始めの時刻を新しくし、経った時間の分だけ進めて出す
      if (text !== tickerState.text) tickerState = { text, start: Date.now() };
      const seconds = (TICKER_BOX_PX + [...text].length * TICKER_CHAR_PX) / TICKER_SPEED;
      const textEl = h('span', { class: 'battle__ticker-text', text });
      textEl.style.animationDuration = `${seconds.toFixed(2)}s`;
      textEl.style.animationDelay = `${-(((Date.now() - tickerState.start) / 1000) % seconds).toFixed(2)}s`;
      return h(
        'button',
        { class: 'battle__ticker', attrs: { type: 'button', 'aria-label': `${text}（${t('battle.log.open')}）` }, on: { click: () => s && showLog() } },
        textEl,
      );
    };

    const header = (s: BattleState | null = null): HTMLElement =>
      h(
        'header',
        { class: `battle__header${s ? ` battle__header--${s.phase === 'ended' ? 'ended' : s.active}` : ''}` },
        req.allowSurrender ? topButton('surrender', t('battle.surrender'), surrender) : h('span'),
        h('div', { class: 'battle__heading' }, s?.field ? fieldChip(s) : null, ticker(s)),
        topButton('rules', t('battle.rules'), showRules),
      );

    const qaBar = (): HTMLElement | null =>
      ctx.store.qa && state
        ? h(
            'div',
            { class: 'battle__qa' },
            button(t(auto ? 'battle.qa.autoStop' : 'battle.qa.auto'), () => {
              auto = !auto;
              render();
            }, 'btn btn--small'),
            button(t('battle.qa.win'), () => {
              if (!state) return;
              state = { ...state, phase: 'ended', winner: 'player', endReason: 'knockout' };
              render();
            }, 'btn btn--small'),
            // 負けたときの流れ（導入イベントV2の試験の再挑戦など）を確かめる
            button(t('battle.qa.lose'), () => {
              if (!state) return;
              state = { ...state, phase: 'ended', winner: 'opponent', endReason: 'knockout' };
              render();
            }, 'btn btn--small'),
          )
        : null;

    /**
     * 場面の表示（あなたのターン・マナ化など）。場面が変わったときだけ短く出す。
     * 2026-10-25 リデザイン パートD：画面の真ん中の大きな帯をやめ、経過の1行の上に小さな札を1行だけ（上の手番の帯の文言もそのとき光る）
     */
    const phaseBanner = (s: BattleState): HTMLElement | null => {
      if (s.phase === 'ended' || s.phase === 'defense') return null;
      const key = `${s.turn}-${s.active}-${s.phase}`;
      if (key === bannerKey) return null;
      bannerKey = key;
      element.querySelector('.battle__ticker')?.classList.add('is-changed');
      const el = h(
        'div',
        { class: `battle__phase-chip battle__phase-chip--${s.active}`, attrs: { 'aria-hidden': 'true' } },
        t(s.phase === 'mana' && s.manaConvertLimit === null ? `battle.banner.mana.${s.active}` : `battle.banner.turn.${s.active}`),
      );
      setTimeout(() => el.remove(), BANNER_MS);
      // 相手の列と自分の列の間（自分のモンスター3体の上の端）に重ねる
      const row = element.querySelector('.battle-row--player .battle-side');
      if (!row) return el;
      row.append(el);
      return null;
    };

    /** 場の全体カード（上の帯の左に出す。タップで詳しく） */
    const fieldChip = (s: BattleState): HTMLElement => {
      if (!s.field) return h('span', { class: 'battle-turn__first', text: t(s.first === 'player' ? 'battle.field.first' : 'battle.field.second') });
      const card = getSupport(s.field.cardId);
      return h(
        'button',
        {
          class: `battle-turn__field battle-turn__field--${s.field.owner}`,
          attrs: { type: 'button', 'aria-label': t('battle.field.aria', { name: cardName(card) }) },
          on: { click: () => openCardDetail(element, card, { extra: [t(`battle.field.by.${s.field?.owner ?? 'player'}`)] }) },
        },
        h('span', { class: 'battle-turn__field-label', text: t('battle.field.label') }),
        h('span', { class: 'battle-turn__field-text', text: withoutFieldPrefix(supportShortText(card)) }),
      );
    };

    /** マナが増えた演出（前回の描画との差で判断する）と効果音（ルールで確定したきっかけで鳴らす） */
    const playEffects = (s: BattleState): void => {
      for (const side of ['player', 'opponent'] as const) {
        const now = manaOf(s.sides[side]);
        const before = prevMana.get(side);
        prevMana.set(side, now);
        if (before === undefined || now <= before) continue;
        const box = element.querySelector(`.battle-stats--${side} .battle-info__mana`);
        if (box) {
          box.classList.add('is-mana-up');
          box.append(h('span', { class: 'battle__mana-float', text: `+${now - before}` }), h('span', { class: 'battle__mana-spark', attrs: { 'aria-hidden': 'true' } }), manaFx(fxManaGain, 'gain'));
        }
      }
      // 音はマナの数の差では選ばず、ルールで確定したきっかけで鳴らす（1件につき1回。描き直しでは鳴らさない）
      // マナ化＝manaConvert（1枚1回。カードが光って消える音 manaVanish）、山札からマナ＝manaGain、支払い＝manaSpend、回避・命中
      if (s.fxSeq < lastFxSeq) lastFxSeq = 0;
      for (const fx of s.fx) {
        if (fx.seq <= lastFxSeq) continue;
        sound.play(FX_SOUND[fx.kind]);
        // マナを払った：情報の欄のマナに、青い粒がはじける光（2026-10-26 デザイン第9弾）
        if (fx.kind === 'manaSpend') element.querySelector(`.battle-stats--${fx.side} .battle-info__mana`)?.append(manaFx(fxManaSpend, 'spend'));
        // 命中：画面を揺らし、一瞬だけ次の行動を待たせる（ヒットストップ）
        if (fx.kind === 'hitNormal' || fx.kind === 'hitStrong') {
          const cls = fx.kind === 'hitStrong' ? 'is-shake-strong' : 'is-shake';
          element.classList.remove('is-shake', 'is-shake-strong');
          void element.offsetWidth;
          element.classList.add(cls);
          setTimeout(() => element.classList.remove(cls), 420);
          busyUntil = Math.max(busyUntil, Date.now() + HIT_PAUSE_MS);
        }
      }
      lastFxSeq = s.fxSeq;
    };

    /** 攻撃終了。まだ使えるカードがあるときは確かめる（押しまちがい防止） */
    const requestEndAttack = (s: BattleState): void => {
      const end = (): void => dispatch({ type: 'endAttack', side: 'player' });
      if (s.sides.player.hand.some((c) => cardUsability(s, 'player', c.uid).usable)) {
        confirmCommand(element, t('battle.confirm.endAttack'), { ok: t('battle.confirm.toMana'), cancel: t('battle.confirm.keepAttacking') }, end);
      } else end();
    };

    /**
     * 操作のボタン（2026-10-25 リデザイン：手札の下に横一列。それまでは自分のモンスターの右に縦並び）。働きは同じ。
     * 左に「コマンド」（攻撃終了・ターン終了・ルール・降参の一覧）、真ん中はいつも場面を終えるボタン（攻撃終了・ターン終了）か状態の札、
     * 右はその時に使うボタン（2026-10-27 ユーザー指示で、右にあった「攻撃終了・ターン終了」を真ん中に、使うボタンを右に）。
     * - 攻撃：「攻撃終了」。カードを選ぶと「使う（使えるときだけ）」「やめる」。対象を選ぶ間は「やめる」
     * - マナ化：「ターン終了」、選んだカードがあれば「マナにする（N枚）」
     * - 相手の番・守備・オート中：いまの状態の札
     * 配っている間・手札をなぞっている間は、並びを変えずに押せないだけにする（ボタンの位置が跳ねないように）
     */
    const commandPanel = (s: BattleState, blocked: boolean): HTMLElement => {
      const panel = h('div', { class: 'battle-cmds battle__commands', attrs: { role: 'group', 'aria-label': t('battle.cmd.aria') } });
      if (s.phase === 'ended') {
        lastCommandKey = '';
        return panel;
      }
      // 3つの場所（2026-10-27 ユーザー指示「その時に使うコマンドは触りやすい右に。ターン終了は真ん中に常に」）：
      // 左＝「コマンド」、真ん中＝場面を終えるボタン（攻撃終了・ターン終了・守備しない）か状態の札、右＝その時に使うボタン（使う・やめる・マナにする）
      let middle: HTMLElement | null = null;
      const actions: HTMLElement[] = [];
      const mine = s.active === 'player' && !auto;
      const selected = selectedUid ? s.sides.player.hand.find((c) => c.uid === selectedUid) : undefined;
      const deselect = (): void => {
        selectedUid = null;
        targeting = null;
        render();
      };
      // 状態の札。相手の番を待つときは、えんじの札の丸い窓に砂時計（2026-10-26 デザイン第11弾。4コマで落ちる）
      const statusTag = (text: string, waiting = false): HTMLElement =>
        waiting
          ? h('span', { class: 'battle-cmds__status battle-cmds__status--wait' }, h('span', { class: 'battle-cmds__sand', attrs: { 'aria-hidden': 'true' } }), h('span', { text }))
          : h('span', { class: 'battle-cmds__status', text });
      if (mine && s.phase === 'main') {
        if (!targeting && selected && cardUsability(s, 'player', selected.uid).usable) actions.push(commandButton(t('battle.cmd.use'), () => useCard(selected.uid)));
        if (targeting || selected) actions.push(commandButton(t('common.cancel'), deselect, 'cancel'));
        middle = commandButton(t('battle.cmd.endAttack'), () => requestEndAttack(s), 'cancel');
      } else if (mine && s.phase === 'mana') {
        if (manaPicks.size > 0 && canConvertToMana(s, 'player')) actions.push(commandButton(t('battle.cmd.makeMana', { n: manaPicks.size }), convertPicked));
        middle = commandButton(t('battle.cmd.endTurn'), () => requestEndTurn(), 'cancel');
      } else if (canChooseDefense(s) && s.pending) {
        // 守備の選択はフォーカスエリア。「守備しない／守備を終える」は真ん中
        const pass = s.pending.responses.length === 0;
        middle = commandButton(t(pass ? 'battle.defense.pass' : 'battle.defense.done'), () => dispatch({ type: 'defend', side: 'player', cardUid: null }), 'cancel');
      } else if (s.phase === 'defense' && s.pending?.attacker === 'opponent' && !auto) {
        middle = statusTag(t('battle.dock.noDefense'), true);
      } else {
        middle = statusTag(t(auto ? 'battle.dock.auto' : 'battle.dock.waiting'), !auto);
      }
      middle.classList.add('is-main');
      const buttons = [commandMenuButton(), middle, ...actions];
      if (blocked || swipe) for (const b of buttons) if (b instanceof HTMLButtonElement) b.disabled = true;
      const key = buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent).join('|');
      if (key !== lastCommandKey) panel.classList.add('is-enter');
      lastCommandKey = key;
      panel.append(buttons[0] as HTMLElement, middle);
      if (actions.length > 0) panel.append(h('div', { class: 'battle-cmds__actions' }, ...actions));
      return panel;
    };

    const requestEndTurn = (): void => {
      const end = (): void => dispatch({ type: 'endTurn', side: 'player' });
      if (manaPicks.size > 0) {
        confirmCommand(element, t('battle.confirm.endTurn'), { ok: t('battle.confirm.endAnyway'), cancel: t('battle.confirm.backToMana') }, end);
      } else end();
    };

    /** 「コマンド」ボタン（操作のボタンの左端）。押すとコマンドの一覧（攻撃終了・ターン終了・ルール・降参）を開く */
    const commandMenuButton = (): HTMLElement => {
      const b = commandButton(t('battle.cmd.menu'), () => {
        commandMenuOpen = !commandMenuOpen;
        render();
      });
      b.classList.add('battle__cmd-open');
      b.classList.toggle('is-open', commandMenuOpen);
      b.setAttribute('aria-expanded', String(commandMenuOpen));
      return b;
    };

    /** コマンドの一覧（「コマンド」ボタンの左に開く）。外側を押すと閉じる */
    const commandMenu = (s: BattleState, blocked: boolean): HTMLElement | null => {
      if (!commandMenuOpen || s.phase === 'ended') return null;
      const close = (): void => {
        commandMenuOpen = false;
        render();
      };
      // 先に一覧を閉じて描き直してから実行する（実行で出る確認の窓・ルールの窓が、描き直しで消えないように。
      // 2026-10-24 不具合：「攻撃終了」の確認が描き直しで消え、マナ化へ進めなかった）
      const run = (fn: () => void) => (): void => {
        commandMenuOpen = false;
        render();
        fn();
      };
      const mine = s.active === 'player' && !auto && !blocked;
      const items: HTMLButtonElement[] = [];
      if (mine && s.phase === 'main') items.push(commandButton(t('battle.cmd.endAttack'), run(() => requestEndAttack(s)), 'cancel'));
      if (mine && s.phase === 'mana') items.push(commandButton(t('battle.cmd.endTurn'), run(requestEndTurn), 'cancel'));
      items.push(commandButton(t('battle.rules'), run(showRules)));
      if (req.allowSurrender) items.push(commandButton(t('battle.surrender'), run(surrender), 'cancel'));
      return h(
        'div',
        { class: 'battle__cmd-menu', on: { click: (e) => e.target === e.currentTarget && close() } },
        h('div', { class: 'battle__cmd-list', attrs: { role: 'menu', 'aria-label': t('battle.cmd.menu') } }, ...items),
      );
    };

    /**
     * ダメージでライフが減ったとき：数字を1ずつ減らしながら、1減るごとに「カタッ」と1回鳴らす（何ダメージか分かるように。2026-10-24 ユーザー指示）。
     * 描き直しても続くよう、表示中の値は lifeShown に持ち、数字の要素はその都度探す
     */
    const countLifeDown = (uid: string, from: number, to: number): number => {
      lifeShown.set(uid, from);
      for (let i = 1; i <= from - to; i++) {
        const value = from - i;
        const at = LIFE_TICK_START_MS + (i - 1) * LIFE_TICK_MS;
        sound.play('lifeTick', at);
        setTimeout(() => {
          if (destroyed) return;
          if (value <= to) lifeShown.delete(uid);
          else lifeShown.set(uid, value);
          const el = element.querySelector(`.battle__monster[data-uid="${uid}"] .battle__monster-life-now`);
          if (!el) return;
          el.textContent = String(value);
          el.classList.remove('is-tick');
          void (el as HTMLElement).offsetWidth;
          el.classList.add('is-tick');
        }, at);
      }
      return LIFE_TICK_START_MS + (from - to - 1) * LIFE_TICK_MS;
    };

    /**
     * フォーカスエリアの大きなカードを、欄に入る大きさに縮める（相手の番はカメラが上へ寄るので欄が狭くなる。2026-10-25）。
     * 縮めるだけで、大きくはしない
     */
    const fitFocusCards = (): void => {
      for (const box of element.querySelectorAll<HTMLElement>('.battle-detail__card, .battle-spot__card')) {
        const card = box.firstElementChild as HTMLElement | null;
        if (!card) continue;
        card.style.zoom = '';
        const room = box.clientHeight;
        const need = card.offsetHeight;
        if (room > 0 && need > room) card.style.zoom = String(Math.max(0.5, (room / need) * 0.97));
      }
    };

    const render = (): void => {
      element.dataset.stage = state ? 'play' : 'order';
      if (!state) {
        replaceView(header(), orderView());
        return;
      }
      const s = state;
      // 手札から無くなったカード・マナ化以外の場面では、マナにする候補を消す
      if (s.phase !== 'mana' || s.active !== 'player') manaPicks.clear();
      for (const uid of [...manaPicks]) if (!s.sides.player.hand.some((c) => c.uid === uid)) manaPicks.delete(uid);
      // ダメージを受けたモンスター：ライフを1ずつ減らして数える（数え終わる時刻。倒れた音はそのあと）
      const countEnds = new Map<string, number>();
      for (const side of ['player', 'opponent'] as const) {
        for (const m of s.sides[side].monsters) {
          const before = prevLife.get(m.uid);
          if (before !== undefined && m.life < before) countEnds.set(m.uid, countLifeDown(m.uid, lifeShown.get(m.uid) ?? before, m.life));
        }
      }
      const handScroll = element.querySelector('.battle__hand')?.scrollLeft ?? 0;
      const hand = handRow(s);
      const blocked = dealing();
      const menu = commandMenu(s, blocked);
      // 2026-10-25 リデザイン（PS版にならう）：上から 手番の帯 → 相手の情報1行 → 相手3体 → 経過1行 → 自分3体 → 自分の情報1行
      // → フォーカスエリア（説明と大きなカード。残りの高さに広がる）→ 手札 → 操作のボタン（横一列）
      camera.dataset.focus = cameraFocus(s);
      // 相手の手札と列をひとまとめにして、相手が使ったカードはその上に大きく見せる（2026-10-26 ユーザー指示「相手は相手の場所で大きく見せる」）
      const oppSpot = spotlight && spotlight.side === 'opponent' && Date.now() < spotlight.until ? spotlightPanel(s, spotlight) : null;
      lens.replaceChildren(
        h(
          'div',
          { class: 'battle-board' },
          h('div', { class: 'battle-opp-zone' }, opponentHand(s), monsterRow(s, 'opponent'), oppSpot),
          monsterRow(s, 'player'),
        ),
      );
      replaceView(header(s), qaBar() ?? '', camera, detailPanel(s), hand, commandPanel(s, blocked));
      fitFocusCards();
      const overlays = [talkOverlay(s), menu, resultOverlay(s), phaseBanner(s), hintOverlay(s)].filter((o): o is HTMLElement => o !== null);
      element.append(...overlays);
      const handEl = element.querySelector('.battle__hand');
      if (handEl) handEl.scrollLeft = handScroll;
      syncSwipeGhost();
      playEffects(s);
      for (const side of ['player', 'opponent'] as const) {
        for (const m of s.sides[side].monsters) {
          // 倒れた・回復した瞬間の音（描き直しでは鳴らさない：前回のライフと比べる）
          const before = prevLife.get(m.uid);
          if (before !== undefined && before > 0 && m.life === 0) {
            sound.play('knockout', (countEnds.get(m.uid) ?? 0) + 200);
            // 相手のひと言（【仮】台詞）：自分のモンスターが倒れた／こちらのモンスターを倒した
            say(side === 'opponent' ? 'battle.talk.ownDown' : 'battle.talk.knock');
          }
          else if (before !== undefined && m.life > before) sound.play('heal');
          prevLife.set(m.uid, m.life);
        }
      }
      element.classList.toggle('is-defending', canChooseDefense(s) && !(spotlight && Date.now() < spotlight.until));
      element.dataset.phase = s.phase;
      element.dataset.active = s.active;
      element.dataset.acting = blocked ? 'dealing' : (actingSide(s) ?? 'none');
      element.dataset.winner = s.winner ?? '';
      element.dataset.first = s.first;
      scheduleAi();
    };

    render();
    return {
      element,
      destroy: () => {
        destroyed = true;
        if (timer) clearTimeout(timer);
        stopSwipe();
      },
    };
  },
};
