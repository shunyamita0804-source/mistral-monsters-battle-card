import { getDungeon, ENCOUNTERS } from '../../data/dungeons.ts';
import { FRAGMENT_TOTAL } from '../../data/fragments.ts';
import type { ArtDoorAnim } from '../../data/worldArt.generated.ts';
import { BUREAU_DESK_FRONT, getMap, isResidentId, TOWN_SIGNS, type ChestObject, type EnemyObject, type MapDefinition, type MapObject, type NpcId, type NpcObject, type WarpTarget } from '../../data/maps.ts';
import { residentScene, type SceneId } from '../../data/storyScenes.ts';
import { BOOSTERS, EXAM_OPPONENT, examLifeScale, type BoosterKey } from '../../data/introV2.ts';
import { boosterArtUrl } from '../components/boosterArt.ts';
import { INITIAL_BOOSTER_SELECT, tapBooster } from '../../game/story/boosterSelect.ts';
import pointerFingerArt from '@assets/images/ui/booster/pointer_finger.webp';
import guideTalkSmile from '@assets/images/characters/neighbor_guide_talk_smile.webp';
import { cardCatalog, getMonster } from '../../data/cards.ts';
import { createCardView } from '../components/cardView.ts';
import { isDeckValid } from '../../game/deck/deck.ts';
import {
  changeFloor,
  defeatEnemy,
  isChestOpened,
  isEnemyActive,
  leaveDungeon,
  openChest,
} from '../../game/progress/dungeon.ts';
import { collectFragment, fragmentAt, fragmentCount } from '../../game/progress/fragments.ts';
import type { Direction, Location } from '../../game/save/saveData.ts';
import {
  adjacentCellOf,
  canStep,
  DIR_DELTA,
  findPathWhere,
  isBlocked,
  isNearNpc,
  mapSize,
  nearestNpc,
  objectsAt,
  STEPS_4,
  type Point,
} from '../../game/world/world.ts';
import {
  advanceMove,
  advancePhase,
  diagonalOf,
  DIR_ROW,
  facing,
  FOOT_X,
  FOOT_Y,
  FRAME_H,
  FRAME_W,
  PLAYER_FOOT_X,
  PLAYER_FRAME_W,
  frameOf,
  frameWeightsOf,
  FRAMES_PER_STEP,
  framesPerSecond,
  IDLE_COL,
  isContactFrame,
  isWalking,
  PLAYER_RUN_ART_ROWS,
  PLAYER_SHEET_COLS,
  PLAYER_SHEET_ROWS,
  PLAYER_V2_ROWS,
  sheetRow,
  squashOf,
  strideOf,
  viewOf,
  walkSpeed,
  type Diagonal,
  type PlayerGender,
} from '../../game/world/walkAnim.ts';
import {
  applySceneEffects,
  isNpcPresent,
  sceneAfterPractice,
  sceneOnEnter,
  sceneOnTable,
  sceneOnTalk,
  showsPracticeGoal,
  startPractice,
} from '../../game/story/intro.ts';
import {
  beginExam,
  claimBooster,
  finishExam,
  isIntroV2Active,
  isIntroV2Done,
  skipIntroV2,
  startIntroV2OnTown,
  type IntroV2,
} from '../../game/story/introV2.ts';
import { newId } from '../gameStore.ts';
import { playScene } from '../components/dialogue.ts';
import { showDungeonIntro } from '../components/dungeonIntro.ts';
import { showOpeningIntro } from '../components/openingIntro.ts';
import { confirmModal, messageModal, openModal } from '../components/modal.ts';
import { button, h } from '../dom.ts';
import maleSheet from '@assets/images/characters/player_male_sheet.webp';
import femaleSheet from '@assets/images/characters/player_female_sheet.webp';
import guideSheet from '@assets/images/characters/npc_neighbor_guide_walk.webp';
import clerkSheet from '@assets/images/characters/npc_clerk_walk.webp';
import researcherSheet from '@assets/images/characters/npc_researcher_walk.webp';
import receptionistSheet from '@assets/images/characters/npc_receptionist_walk.webp';
import teacherSheet from '@assets/images/characters/npc_teacher_walk.webp';
import residentASheet from '@assets/images/characters/npc_resident_a_walk.webp';
import residentBSheet from '@assets/images/characters/npc_resident_b_walk.webp';
import residentDSheet from '@assets/images/characters/npc_resident_d_walk.webp';
import residentESheet from '@assets/images/characters/npc_resident_e_walk.webp';
import chestWood from '@assets/images/maps/dungeon/chest_01_base.webp';
import chestWood1 from '@assets/images/maps/dungeon/chest_01_anim_01.webp';
import chestWood2 from '@assets/images/maps/dungeon/chest_01_anim_02.webp';
import chestWood3 from '@assets/images/maps/dungeon/chest_01_anim_03.webp';
import chestWood4 from '@assets/images/maps/dungeon/chest_01_anim_04.webp';
import chestIron from '@assets/images/maps/dungeon/chest_02_base.webp';
import chestIron1 from '@assets/images/maps/dungeon/chest_02_anim_01.webp';
import chestIron2 from '@assets/images/maps/dungeon/chest_02_anim_02.webp';
import chestIron3 from '@assets/images/maps/dungeon/chest_02_anim_03.webp';
import chestIron4 from '@assets/images/maps/dungeon/chest_02_anim_04.webp';
import chestGold from '@assets/images/maps/dungeon/chest_03_base.webp';
import chestGold1 from '@assets/images/maps/dungeon/chest_03_anim_01.webp';
import chestGold2 from '@assets/images/maps/dungeon/chest_03_anim_02.webp';
import chestGold3 from '@assets/images/maps/dungeon/chest_03_anim_03.webp';
import chestGold4 from '@assets/images/maps/dungeon/chest_03_anim_04.webp';
import dungeonBattleBg from '@assets/images/backgrounds/battle_dungeon.webp';
import bossBattleBg from '@assets/images/backgrounds/battle_boss.webp';
import forestBattleBg from '@assets/images/backgrounds/battle_forest.webp';
import { bgm, type BgmId } from '../bgm.ts';
import { coinIcon } from '../components/coinIcon.ts';
import practiceBattleBg from '@assets/images/backgrounds/battle_practice.webp';
import signDownArt from '@assets/images/maps/dungeon/sign_down.webp';
import signUpArt from '@assets/images/maps/dungeon/sign_up.webp';
import signExitArt from '@assets/images/maps/dungeon/sign_exit.webp';
import { t, type Params } from '../../i18n/i18n.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { cardName, dungeonName, mapName, objectLabel, objectMessage, opponentName, personName } from '../../i18n/content.ts';
import { personOfSpeaker } from '../../data/people.ts';
import { meetSpeaker } from '../../game/people/peopleBook.ts';
import { itemGetWindow } from '../components/rewardGlow.ts';
import encounterFx1 from '@assets/images/effects/fx_encounter_1.webp';
import encounterFx2 from '@assets/images/effects/fx_encounter_2.webp';
import encounterFx3 from '@assets/images/effects/fx_encounter_3.webp';
import shardArt from '@assets/images/ui/reward/shard.webp';
import cardBundleArt from '@assets/images/ui/reward/card_bundle.webp';
import prizePouchArt from '@assets/images/icons/prize_pouch.webp';
import clearSceneArt from '@assets/images/ui/reward/clear_scene.webp';
import firstClearSealArt from '@assets/images/ui/reward/first_clear_seal.webp';
import { sound, type AmbientId, type StepSurface } from '../sound.ts';
import type { ScreenContext, ScreenDefinition } from './types.ts';

/** 仮マップ（ダンジョン）の1マスの大きさ（論理px） */
const TILE = 40;
/** ダンジョンの帯（階に入った・クリア・ボスの階）を出しておく時間 */
const BANNER_MS = 2200;
/** 敵とぶつかったときの光：1コマの時間と、最後に白く光る時間 */
const ENCOUNTER_FRAME_MS = 110;
const ENCOUNTER_WHITE_MS = 260;
/** ダンジョンの床・壁の絵を1回敷く大きさ（論理px。4マス分） */
const DUNGEON_TEX = 160;
/** 正式な絵の街：設計図の 1 単位 → 論理px（主人公 108×144 が 61×81 になる） */
const ART_SCALE = 0.5625;
/** 部屋は画面の高さに合わせて少し大きく見せる（街の何倍までか。人物の絵がぼやけない範囲） */
const ROOM_ZOOM_MAX = 1.35;
/**
 * 街・部屋の人物の大きさ（設計図の 144 単位に対する倍率）。2026-10-23 に街に対して小さすぎたので 1.2 倍に（ユーザー承認）。
 * 2026-10-24 ユーザー「立ちと歩きは街に対して小さく見える。走っているサイズ感をメインに」で 1.35 倍に（主人公も人も同じ倍率）。
 * 2026-10-24（2回目）ユーザー「まだ走ると大きく見える。立ち・歩きも走りの大きさに」：シートの各行の頭の大きさを立ち姿にそろえ
 * （tools/art/adult_walk_build.py --match-heads。走りの絵は頭が 1.1〜1.27 倍で描かれていた）、全体を走りの大きさ（1.35×約1.15）に
 */
const FIGURE_ZOOM = 1.55;
/**
 * 人物の横幅を広げる倍率（2026-10-23 ユーザー指示「主人公の横幅をもう少し大きく」。比べる画像で 1.1 倍を選んだ）。
 * 2026-10-24 ユーザー「NPC と少しサイズ感が違う」：背の高さ・頭の大きさは同じで、違いはこの倍率が主人公だけだったこと → 人（NPC）にも同じ倍率をかける
 */
const FIGURE_WIDEN = 1.1;
/** 部屋の絵が画面の高さのどれくらいを占めるか */
const ROOM_FILL = 0.9;
/** 自動ドア（2026-10-27 カードショップ）：全部開くまで・全部閉じるまでの時間（ミリ秒） */
const DOOR_OPEN_MS = 380;
const DOOR_CLOSE_MS = 520;
/** 自動ドアの表示（左右の戸の絵・開き具合 0〜1・最後に動かした時刻） */
interface DoorState {
  readonly anim: ArtDoorAnim;
  readonly left: HTMLElement;
  readonly right: HTMLElement;
  t: number;
  at: number;
}
/** 場所を移るときの暗転（ミリ秒） */
const FADE_OUT_MS = 170;
/** 絵の読み込みを待つ上限（ミリ秒）。遅い回線でも操作できなくならないように */
const REVEAL_TIMEOUT_MS = 3000;
/** スティック：これ以上指を動かしたら移動の操作にする／スティックの半径／方向を決める最小の距離（論理px） */
const STICK_START = 12;
const STICK_RADIUS = 84;
const STICK_DEAD = 16;
/** スティックの輪の半径（CSS の .world__stick 208px の半分。2026-10-25 に2倍）と、輪を出さない上の帯の高さ（論理px） */
const STICK_RING_R = 104;
const STICK_TOP = 64;
/**
 * 歩く速さ・歩幅・コマ送りの計算は src/game/world/walkAnim.ts（確認画面と共用。2026-10-24）。
 * 歩くときの上下の弾み（人物の背たけに対する割合）。
 * 2026-10-23 ユーザー「プカプカ浮いて見える。しっかり地面に足が着いているように」で 0 に（体を持ち上げると影から離れて浮いて見えた）
 */
const WALK_BOB = 0;
/** 走る（2026-10-23・ユーザー承認）：スティックを大きく倒すと走る。弾みは歩きと同じく 0 */
const RUN_BOB = 0;
/**
 * 歩くときの体の動き（2026-10-24 ユーザー「もう少しクオリティを上げたい」。足元を基準にするので、体を持ち上げて浮いて見えることはない）：
 * - 足が地面に着くコマで体をわずかに縮め、足がそろうコマでわずかに伸ばす（たての倍率の幅。横はその半分だけ逆に）
 * - 進む向きへ体を少し前に傾ける（度。横へ進むとき）。歩き出し・止まりはなめらかに
 * - 足元の影は、体が伸びる（足がそろう）ときに少し小さく
 */
const WALK_SQUASH = 0.018;
const RUN_SQUASH = 0.026;
const WALK_LEAN_DEG = 2.2;
const RUN_LEAN_DEG = 4;
const LEAN_RATE = 10;
const SHADOW_PULSE = 0.05;
/** 端末の「視差効果を減らす」がオンなら、体の動きを付けない */
const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** スティックをこれ以上倒すと走る／これより戻すと歩きに戻る（論理px。行ったり来たりしないよう差をつける） */
const STICK_RUN = 36;
const STICK_WALK_BACK = 28;
/** カメラが人物を追う強さ（1秒あたり）。ぴったり付けず少し遅れて追い、止まるとなめらかに追いつく */
const CAMERA_FOLLOW = 9;
/**
 * カメラの遊び（2026-10-24 改訂R2 フェーズ1）：人物がこの幅（論理px）の中で動く間はカメラを動かさない。
 * 1歩ごとの細かい動きで背景がずっと揺れて「背景が滑るだけ」に見えないように
 */
const CAMERA_DEAD_X = 14;
const CAMERA_DEAD_Y = 18;
/** カメラの先読み：進む向きの先を少し多く見せる（見える範囲の幅・高さに対する割合）と、その追いつく速さ（1秒あたり） */
const CAMERA_LOOK = 0.08;
const CAMERA_LOOK_RATE = 2.5;
/**
 * 見せる倍率（2026-10-24 改訂R2 フェーズ1。地図・人物を同じ倍率で拡大し、カメラが追う）。
 * ダンジョン：全体が一度に見えて主人公が小さかった（ユーザーの動画 V1）ので 1.25・1.5・1.75 倍を比べて 1.5 倍（人物の大きさが街と同じ 81 論理px になる）。
 * 街：1.00・1.15・1.30 倍を比べて 1.15 倍（家の入口・道が見えたまま、主人公が少し大きく見える。1.30 倍は先が見えにくい。記録は docs/battle-layout-r2.md）。部屋は画面の高さに合わせて別に決めている（#artScale）
 */
const VIEW_ZOOM: Readonly<Record<MapDefinition['area'], number>> = { town: 1.15, interior: 1, dungeon: 1.5 };
/** スティックの向きを変えるまでの余裕（ラジアン）。4方向の境目（45度）を 8度こえるまで前の向きのまま */
const STICK_HOLD = Math.PI / 4 + (8 * Math.PI) / 180;
/**
 * 進めない向き（壁など）へスティックを倒したとき、その場で向きを変えるまでの時間（ミリ秒）。
 * 2026-10-23 ユーザー「指でなぞると人物がクルクル回ってチープ」：指のわずかな動きで、その場で向きが次々変わらないように
 */
const TURN_IN_PLACE_MS = 220;
/**
 * 人のまわり（2026-10-24 改訂R2 フェーズ1。ユーザーの動画 V3 で主人公と人の絵が大きく重なった）：
 * 正式な絵の街・部屋では、人から NPC_SPACE マス以内は通れない。話せるのは NPC_TALK_RANGE マス以内。
 * 主人公が NPC_GAZE_RANGE マス以内に来ると、その人は主人公の方を向く（控えめな反応。離れると元の向きに戻る）
 */
const NPC_SPACE = 1;
const NPC_TALK_RANGE = 2;
const NPC_GAZE_RANGE = 3;
/** 宝箱の絵（ミスモンの正式素材）：閉じた絵と、開く動きの4コマ（4コマ目が開いたあとの絵） */
const CHEST_ART: Readonly<Record<ChestObject['look'], { readonly closed: string; readonly opening: readonly string[] }>> = {
  wood: { closed: chestWood, opening: [chestWood1, chestWood2, chestWood3, chestWood4] },
  iron: { closed: chestIron, opening: [chestIron1, chestIron2, chestIron3, chestIron4] },
  gold: { closed: chestGold, opening: [chestGold1, chestGold2, chestGold3, chestGold4] },
};
/** 宝箱が開く動きの1コマの時間（ミリ秒） */
const CHEST_FRAME_MS = 110;
/**
 * ダンジョンの階ごとの対戦の背景。
 * 2026-10-23 デザイン第2弾の地下ダンジョンの背景に入れ替えた（それまではミスモンの野外の背景：
 * battle_field_meadow / coast / volcano.webp。ファイルは assets に残してあるので、戻すときはここを元に戻す）
 */
const DUNGEON_BATTLE_BG: Readonly<Record<string, string>> = {
  'dungeon-01-b1': dungeonBattleBg,
  'dungeon-01-b2': dungeonBattleBg,
  'dungeon-01-b3': dungeonBattleBg,
  // 精霊の森（2026-10-27 デザイン第12弾の森の対戦の背景。それまではミスモンの草原の背景 battle_field_meadow.webp）
  'dungeon-02-b1': forestBattleBg,
  'dungeon-02-b2': forestBattleBg,
  'dungeon-02-b3': forestBattleBg,
};
/** ダンジョンごとの BGM（2026-10-26 ユーザー提供）。無いダンジョンは 'dungeon' */
const DUNGEON_BGM: Readonly<Record<string, BgmId>> = { 'dungeon-01': 'dungeonRuins', 'dungeon-02': 'dungeonForest' };
/** 建物の中の BGM（2026-10-26 ユーザー提供）。無い部屋は街と同じ */
const ROOM_BGM: Readonly<Record<string, BgmId>> = {
  shop: 'shop',
  practice: 'practice',
  lab: 'lab',
  home: 'home',
  neighbor: 'neighbor',
  'house-a': 'house',
  'house-b': 'house',
  'house-d': 'house',
  'house-e': 'house',
};
/**
 * ダンジョンごとの足音の地面と環境音（2026-10-23）。新しいダンジョンを足すときはここに1行
 * （例：水のダンジョンなら { ground: 'wet', ambient: 'underwater' }、雪なら 'snow'、砂漠なら 'sand'）。無いダンジョンは洞窟と同じ
 */
const DUNGEON_SOUND: Readonly<Record<string, { readonly ground: StepSurface; readonly ambient: AmbientId | null }>> = {
  'dungeon-01': { ground: 'gravel', ambient: 'drip' },
  // 森：芝生の足音・水滴なし（マップの形は遺跡の写し。床・壁・階段の絵は 2026-10-27 デザイン第12弾の森の絵）
  'dungeon-02': { ground: 'grass', ambient: null },
};
const DEFAULT_DUNGEON_SOUND = { ground: 'gravel', ambient: 'drip' } as const;
/** 街の南の出口へ続く土の道（この行から下）。ほかの道は石畳 */
const TOWN_DIRT_FROM_Y = 117;
/** 建物の中の床（無い部屋は板）。大会会場は石 */
const ROOM_GROUND: Readonly<Record<string, StepSurface>> = { hall: 'stone', bureau: 'stone' };
/** 施設の看板を上の帯の下に保つ位置（論理px） */
const SIGN_MIN_BOTTOM = 98;
/**
 * 人物の歩行素材：1コマ 216×288、足元 (108, 270)（FRAME_W・FOOT_X などは walkAnim.ts）。人の絵は行＝方向（front/back/left/right）、列＝4コマ（シート 864×1152）。
 * 街・部屋では 108×144 単位（設計図どおり）、ダンジョン（仮マップ）では少し小さく描く
 */
/** 待機の絵が歩行シートの何列目と同じか（歩き4コマは「右足を前・立つ・左足を前・立つ」なので2列目） */
const NPC_IDLE_COL = 1;

/**
 * 主人公の絵：歩き1周8コマ＋立ち止まり1コマを1枚にまとめたシート（9列×8行。行は 正面・背中・左・右・左下・右下・左上・右上）。
 * 歩く・止まるで別の画像に切り替えると、iPhone で読み込み直しの間だけ人物が消えるので、1枚の中で位置だけ動かす。
 * tools/art/adult_walk_build.py が作る。2026-10-24〜：第2版の絵（着く・沈む・足を運ぶ・伸び上がる×右足・左足）がある向きはその8コマ、
 * 無い向きは前の4コマ（右足を前・立つ・左足を前・立つ）を1コマずつ2回並べている
 */
export const PLAYER_SHEET: Readonly<Record<PlayerGender, string>> = { male: maleSheet, female: femaleSheet };

/** 人の歩行の絵（4列×4行。2026-10-23 の大人の絵。tools/art/adult_walk_build.py --npc が作る） */
const NPC_SHEET: Readonly<Record<NpcId, string>> = {
  neighbor_guide: guideSheet,
  clerk: clerkSheet,
  researcher: researcherSheet,
  receptionist: receptionistSheet,
  teacher: teacherSheet,
  // カードバトラー管理局の受付：大会会場の受付の絵を流用（暫定。正式な絵が届いたらここを差し替える）
  bureau_clerk: receptionistSheet,
  resident_a: residentASheet,
  resident_b: residentBSheet,
  resident_d: residentDSheet,
  resident_e: residentESheet,
};

/** 話しかけるとひと言しゃべってから画面を開く人（台詞は仮。src/data/storyScenes.ts の greet〜） */
const STAFF_GREETING: Readonly<Partial<Record<NpcId, SceneId>>> = {
  clerk: 'greetClerk',
  receptionist: 'greetReceptionist',
  researcher: 'greetResearcher',
};

/** 人の呼び名（読み上げ用）。人物の名前（src/data/people.ts） */
function npcName(npcId: NpcId): string {
  const person = personOfSpeaker(npcId);
  return person ? personName(person) : t('introV2.speaker.bureau');
}

const TILE_CLASS: Readonly<Record<string, string>> = {
  '#': 'wall', '.': 'floor', ',': 'grass', '=': 'road', T: 'tree', '~': 'water', H: 'bld-hall', A: 'bld-home',
  B: 'bld-shop', P: 'bld-practice', N: 'bld-neighbor', D: 'door', d: 'exit', G: 'dungeon-gate', F: 'fountain', S: 'stairs-down', U: 'stairs-up', b: 'bed', M: 'wallmap',
  h: 'bookshelf', k: 'desk', s: 'shelf', c: 'counter', n: 'npc', g: 'gacha', x: 'table', r: 'rug',
};

const coins = (n: number): string => t('common.coins', { n } satisfies Params);

/** 2つの角度の差（-π〜π） */
const angleDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** ダンジョンの案内板の絵（2026-10-26 デザイン第9弾） */
const DUNGEON_SIGN_ART = { down: signDownArt, up: signUpArt, exit: signExitArt } as const;

/** ダンジョンの案内板の種類（下り＝次の階・上り＝前の階・出口＝街へ） */
function dungeonSignKind(target: WarpTarget): 'down' | 'up' | 'exit' | null {
  if (target.kind === 'floor') return target.delta > 0 ? 'down' : 'up';
  if (target.kind === 'leaveDungeon') return 'exit';
  return null;
}

export const worldScreen: ScreenDefinition = {
  id: 'world',
  titleKey: 'world.title',
  create(ctx) {
    const element = h('main', { class: 'screen world' });
    const world = new WorldView(ctx, element);
    world.load();
    return { element, destroy: () => world.destroy() };
  },
};

interface Move {
  readonly from: Point;
  readonly to: Point;
  /** 1歩の長さ（斜めは √2） */
  readonly len: number;
  t: number;
}

/** 導入イベントV2で一緒に歩く幼馴染（from → to へ、主人公の1歩と同じ進み具合で動く。to が null なら入口に入って消える） */
interface Follower {
  readonly el: HTMLElement;
  tile: Point;
  from: Point;
  to: Point | null;
  dir: Direction;
}

/** パック選び：1回目のタップから、同じ箱のタップを決定として受け付けるまで（ミリ秒）・決まってから受付のお礼まで */
const BOOSTER_CONFIRM_DELAY_MS = 450;
const BOOSTER_DECIDED_MS = 700;

/** 導入イベントV2：幼馴染が主人公の何マス先を歩くか（1マスだと縦に歩くとき主人公に隠れる） */
const FOLLOW_LEAD = 3;


/** 導入イベントV2で、続きの場面が無い場所にいたときに戻す所（ふつうは起きない） */
function introV2Anchor(v: IntroV2): Location {
  const town = getMap('town')?.spawn ?? { x: 0, y: 0, dir: 'down' as const };
  const practice = getMap('practice')?.spawn ?? town;
  const bureau = getMap('bureau')?.spawn ?? town;
  switch (v.state) {
    case 'schoolArrival':
    case 'examBattleActive':
    case 'examPassed':
      return { mapId: 'practice', ...practice };
    case 'escortToBureau':
    case 'bureauReception':
    case 'packSelection':
      return v.state === 'escortToBureau' ? { mapId: 'practice', ...practice } : { mapId: 'bureau', ...bureau };
    default:
      return { mapId: 'town', ...town };
  }
}

/** 【仮】ブースターパックの表示名 */
function boosterName(key: BoosterKey): string {
  return t(`introV2.pack.name.${key.slice(-1)}` as MessageKey);
}

/**
 * 歩きの確認画面（walkLabScreen.ts）が本体と同じ WorldView を使うための調整項目（2026-10-24）。
 * 本編では使わない（undefined）。値はセーブ・設定に保存しない
 */
export interface WorldDevState {
  /** 移動速度の倍率（1＝本編どおり） */
  speedScale: number;
  /** 再生速度の倍率（進んだ距離あたりのコマ数。1＝本編どおり。移動速度と別に変えて足滑りの原因を切り分ける） */
  animScale: number;
  /** 時間の倍率（低速再生。1＝通常、0.25＝1/4 の速さ） */
  timeScale: number;
  paused: boolean;
  /** 一時停止中の「1コマ送り」の残り回数 */
  stepFrames: number;
  /** カメラを動かさない（出発点を見たまま。人物の実際の移動量を確かめる） */
  fixedCamera: boolean;
  /** 表示倍率（null＝本編どおり VIEW_ZOOM） */
  zoom: number | null;
  /** その場で動かす（位置を変えずにコマだけ進める）。null＝ふつうに移動 */
  treadmill: { dir: Direction; diag: Diagonal | null; mode: 'idle' | 'walk' | 'run' } | null;
  /** 格子・地面線・基準点・コマの枠を出す */
  overlays: boolean;
}

/** 確認画面に毎コマ知らせる数値 */
export interface WorldDevFrame {
  readonly row: number;
  readonly col: number;
  readonly phase: number;
  readonly walking: boolean;
  readonly running: boolean;
  /** いまの速さ（論理px/秒）・1歩の長さ（論理px）・コマが切り替わる速さ（コマ/秒） */
  readonly speedPx: number;
  readonly stride: number;
  readonly fps: number;
  /** 人物のコマの高さ（論理px）・1マス（論理px）・表示倍率 */
  readonly figureH: number;
  readonly cell: number;
  readonly zoom: number;
  readonly tile: Point;
  readonly pos: Point;
  readonly foot: Point;
  /** 画面に出ている人物の大きさ（論理px。表示倍率をかけたもの）：コマの枠と絵の高さ */
  readonly shownCellW: number;
  readonly shownCellH: number;
  readonly gender: PlayerGender;
}

export interface WorldDevOptions {
  readonly map: MapDefinition;
  readonly start: Location;
  readonly state: WorldDevState;
  readonly onFrame?: (info: WorldDevFrame) => void;
}

export class WorldView {
  readonly #ctx: ScreenContext;
  readonly #root: HTMLElement;
  /** 確認画面用の調整（本編では undefined） */
  readonly #dev: WorldDevOptions | undefined;
  /** 確認画面の格子・地面線・基準点 */
  #devGrid: HTMLElement | null = null;
  #devGround: HTMLElement | null = null;
  #devOrigin: HTMLElement | null = null;
  #map!: MapDefinition;
  #pos: Point = { x: 0, y: 0 };
  #tile: Point = { x: 0, y: 0 };
  #dir: Direction = 'down';
  /** 斜めに1歩進んだときの絵の向き（上下左右へ進む・向きを変えると null） */
  #diag: Diagonal | null = null;
  #move: Move | null = null;
  #path: Point[] = [];
  /** 経路の最後に話しかける・調べる物 */
  #afterPath: MapObject | null = null;
  /** スティック・方向キーで歩く向き（8方向） */
  #held: Point | null = null;
  /** #held（押している向き）が最後に変わった時刻 */
  #heldAt = 0;
  #keys = new Set<Direction>();
  #busy = false;
  #raf = 0;
  #last = 0;
  /** 自動ドア */
  #doors: DoorState[] = [];
  /** 歩きの位相（歩数。1歩＝4コマ。コマ送り用。walkAnim.ts）・最後に歩いていた時刻 */
  #phase = 0;
  #lastMoving = 0;
  /** 体の傾き（度。いまの値）と、最後に体の動きを計算した時刻 */
  #lean = 0;
  #leanTime = 0;
  /** 足音を鳴らした歩きのコマ（-1＝止まっている） */
  #stepCol = -1;
  /** 走っているか（止まるまで続く）・歩き出してからの時間（秒。加速用） */
  #running = false;
  #moveTime = 0;
  /** カメラの位置（地図をずらす量。論理px）。null なら次の描画で人物にぴったり合わせる */
  #cam: Point | null = null;
  #camTime = 0;
  /** カメラが見ている点（遊びの中心。拡大後の地図の座標）と、先読みの量 */
  #focus: Point = { x: 0, y: 0 };
  #look: Point = { x: 0, y: 0 };
  /** 1論理px あたりの画面の画素（地図の位置をそろえる単位）と、それを測ったときの画面の大きさ */
  #snap = 1;
  #snapKey = '';
  #playerLook = '';
  #destroyed = false;
  #mapLayer!: HTMLElement;
  #viewport!: HTMLElement;
  #player!: HTMLElement;
  #objectEls = new Map<string, HTMLElement>();
  /** 人物の足元の影（人物の要素 → 影） */
  #shadows = new Map<HTMLElement, HTMLElement>();
  /** 正式な絵の地図の表示倍率（設計図の単位 → 論理px） */
  #scale = ART_SCALE;
  /** 暗転の幕 */
  #fade: HTMLElement | null = null;
  /** 他の部屋の絵を先に読み込んだか（アプリを開いている間に1回） */
  static #preloaded = false;
  #stick!: HTMLElement;
  #examineBtn: HTMLElement | null = null;
  /** 施設の看板（上の帯に隠れないように位置を直す） */
  #signs: { el: HTMLElement; top: number; maxShift: number; shift: number }[] = [];
  /** しらべるボタンを光らせているマス（同じマスでは計算し直さない） */
  #nearKey = '';
  /** 話しかけられる人の頭の上の印・調べられる物のきらめき（2026-10-23 デザイン第6弾）。となりにいる間だけ1つ出す */
  #marker: HTMLElement | null = null;
  /** スティック操作中の指（1本だけ） */
  #touch: { id: number; x: number; y: number; dragging: boolean } | null = null;
  /** 住人に話しかけた回数（人の ID → 回数。アプリを開いている間） */
  static #talkCount = new Map<string, number>();
  /** 一度スティックを使ったら操作の説明を出さない（アプリを開いている間） */
  static #stickUsed = false;
  /** 導入イベントV2：一緒に歩く幼馴染（街だけ。主人公の1マス先を歩く。to が null なら建物に入って消える） */
  #follower: Follower | null = null;
  /** 自動で歩く道（導入イベントV2）が終わった・進めなくなったときにすること */
  #pathDone: (() => void) | null = null;
  /** 自動で歩いている途中の会話（残りのマスがこの数以下になったら1回。S02） */
  #walkTalk: { readonly at: number; readonly resume: () => void } | null = null;
  /** 幼馴染が主人公の何マス先を歩くか（いまの道で） */
  #followLead = 1;
  readonly #onKeyDown = (e: KeyboardEvent): void => this.#key(e, true);
  readonly #onKeyUp = (e: KeyboardEvent): void => this.#key(e, false);

  constructor(ctx: ScreenContext, root: HTMLElement, dev?: WorldDevOptions) {
    this.#ctx = ctx;
    this.#root = root;
    this.#dev = dev;
    window.addEventListener('keydown', this.#onKeyDown);
    window.addEventListener('keyup', this.#onKeyUp);
  }

  get #store() {
    return this.#ctx.store;
  }

  destroy(): void {
    this.#destroyed = true;
    cancelAnimationFrame(this.#raf);
    sound.ambient(null);
    window.removeEventListener('keydown', this.#onKeyDown);
    window.removeEventListener('keyup', this.#onKeyUp);
  }

  /** 地図と人物を見せる倍率（VIEW_ZOOM。確認画面では指定の倍率） */
  get #zoom(): number {
    return this.#dev?.state.zoom ?? VIEW_ZOOM[this.#map.area];
  }

  /** 主人公の絵（男性・女性） */
  get #gender(): PlayerGender {
    return this.#store.save.player.gender === 'female' ? 'female' : 'male';
  }

  /** 走れる場所か（街だけ。建物の中・ダンジョンでは走らない：2026-10-25 ユーザー指示） */
  get #canRun(): boolean {
    return this.#map.area === 'town';
  }

  /** いまの1歩の長さ（論理px） */
  get #stride(): number {
    return strideOf(this.#figureH, this.#running, viewOf(this.#dir));
  }

  /** 確認画面の「その場で動かす」で歩いている最中か */
  get #treadmillMoving(): boolean {
    const tm = this.#dev?.state.treadmill;
    return tm !== null && tm !== undefined && tm.mode !== 'idle';
  }

  /** 1マスの大きさ（論理px） */
  get #cell(): number {
    return this.#map.art ? this.#map.art.cell * this.#scale : TILE;
  }

  /** 人物の絵の高さ（論理px）。街・部屋は設計図の 144 単位の FIGURE_ZOOM 倍、仮マップ（ダンジョン）は小さめ（2026-10-24 に街と同じ割合で 54→61→70） */
  get #figureH(): number {
    return this.#map.art ? 144 * this.#scale * FIGURE_ZOOM : 70;
  }

  /** マス (x, y) に立つ人の足元（論理px） */
  #foot(p: Point): Point {
    const c = this.#cell;
    return { x: (p.x + 0.5) * c, y: this.#map.art ? (p.y + 0.5) * c : (p.y + 0.9) * c };
  }

  /** 人物の絵の位置と大きさ（足元を合わせる）。lift は歩くときの弾み（影は地面に残す） */
  #placeFigure(el: HTMLElement, p: Point, lift = 0, pose: { sx: number; sy: number; deg: number; shadow: number } | null = null): void {
    const k = this.#figureH / (FRAME_H / 2);
    const f = this.#foot(p);
    const wk = k * FIGURE_WIDEN;
    const footX = el === this.#player ? PLAYER_FOOT_X : FOOT_X;
    // 体の動き（足元を中心に縮める・傾ける）は transform-origin を足元にして重ねる（#sizeFigure）
    const body = pose ? ` rotate(${pose.deg.toFixed(2)}deg) scale(${pose.sx.toFixed(4)}, ${pose.sy.toFixed(4)})` : '';
    el.style.transform = `translate(${f.x - (footX / 2) * wk}px, ${f.y - (FOOT_Y / 2) * k - lift}px)${body}`;
    // 変わったときだけ書く（毎コマ書くと、iPhone で重なり順の計算し直しが重くなる）
    const z = String(10 + Math.round(f.y));
    if (el.style.zIndex !== z) el.style.zIndex = z;
    const shadow = this.#shadows.get(el);
    if (shadow) shadow.style.transform = `translate(${f.x}px, ${f.y}px)${pose && pose.shadow !== 1 ? ` scale(${pose.shadow.toFixed(3)})` : ''}`;
  }

  /** 人物の足元の影（地面に置く。家具・人物より奥） */
  #addShadow(el: HTMLElement): void {
    const cls = el === this.#player ? 'world__shadow world__shadow--player' : 'world__shadow world__shadow--npc';
    const shadow = h('div', { class: cls, attrs: { 'aria-hidden': 'true' } });
    // 2026-10-23：人物が地面に立って見えるよう、影を大きく濃く（背景の絵の影の強さに合わせる）
    // 2026-10-25 ユーザー「まだ背景に浮いているように見える。NPC も」：影の真ん中が足の裏より下にあり、影の上に立って（浮いて）見えた。
    // 影の真ん中を足の裏の線に合わせ、平たい楕円に（濃い所は靴のまわりだけ。CSS の .world__shadow）。絵の縁取り・足元の暗さは tools/art/ground_figures.py
    // NPC は少し大きく（2026-10-26 ユーザー「貼り付けた感じ」。主人公の影はそのまま）
    const big = el === this.#player ? 1 : 1.18;
    const w = this.#figureH * 0.71 * big;
    const sh = this.#figureH * 0.19 * big;
    Object.assign(shadow.style, { width: `${w}px`, height: `${sh}px`, marginLeft: `${-w / 2}px`, marginTop: `${-sh / 2}px` });
    this.#shadows.set(el, shadow);
    this.#mapLayer.append(shadow);
  }

  #sizeFigure(el: HTMLElement): void {
    const k = this.#figureH / (FRAME_H / 2);
    const wk = k * FIGURE_WIDEN;
    // 主人公のコマは横に広い（PLAYER_FRAME_W。走りの絵が切れないように）
    const isPlayer = el === this.#player;
    el.style.width = `${((isPlayer ? PLAYER_FRAME_W : FRAME_W) / 2) * wk}px`;
    el.style.height = `${(FRAME_H / 2) * k}px`;
    // 体の動きの中心は足元（縮めても傾けても足は地面から離れない）
    el.style.transformOrigin = `${((isPlayer ? PLAYER_FOOT_X : FOOT_X) / 2) * wk}px ${(FOOT_Y / 2) * k}px`;
  }

  /** セーブの現在地のマップを表示する（確認画面では指定の地図・位置） */
  load(): void {
    const dev = this.#dev;
    const loc = dev ? dev.start : this.#store.save.location;
    const map = dev ? dev.map : getMap(loc.mapId);
    if (!map) return;
    this.#map = map;
    this.#tile = { x: loc.x, y: loc.y };
    this.#pos = { ...this.#tile };
    this.#dir = loc.dir;
    this.#diag = null;
    this.#move = null;
    this.#path = [];
    this.#afterPath = null;
    this.#busy = false;
    this.#pathDone = null;
    this.#walkTalk = null;
    this.#follower = null;
    this.#scale = this.#artScale(map);
    this.#phase = 0;
    // 導入イベントV2：家から初めて街に出たら始める（上の帯にメニューを出さないよう、描く前に）
    if (!dev && map.id === 'town') this.#store.update(startIntroV2OnTown);
    if (!dev) {
      const dungeonId = this.#store.save.activeDungeon?.dungeonId ?? '';
      bgm.play(map.area === 'dungeon' ? (DUNGEON_BGM[dungeonId] ?? 'dungeon') : (ROOM_BGM[map.id] ?? 'town'));
      sound.ambient(map.area === 'dungeon' ? this.#dungeonSound().ambient : null);
    }
    this.#build(true);
    cancelAnimationFrame(this.#raf);
    this.#last = performance.now();
    this.#raf = requestAnimationFrame((t) => this.#frame(t));
    // 確認画面では会話・お知らせを出さない（歩きだけを見る）
    const flash = dev ? null : this.#store.flashMessage;
    // 導入イベントV2の最中は、その続き（前の導入の場面は出さない）
    const v2Run = dev ? null : this.#introV2OnLoad();
    const scene = dev || v2Run ? null : this.#sceneOnLoad();
    // ダンジョンの帯（2026-10-26 デザイン第10弾）：クリアして街に戻ったとき・階に入ったとき（対戦から戻ったときは出さない）
    // 'charm'（身代わりのお守り）はダンジョン探索の画面だけで使う
    const banner = dev || this.#store.flashBanner === 'charm' ? null : this.#store.flashBanner;
    const intro = dev ? null : this.#store.dungeonIntro;
    this.#store.dungeonIntro = null;
    const introDungeon = intro && map.area === 'dungeon' ? getDungeon(intro) : undefined;
    if (introDungeon) {
      // ダンジョンに入った直後：挿絵とダンジョン名の札（階の帯の代わり）
      showDungeonIntro(this.#root, introDungeon);
    } else if (banner) {
      this.#store.flashBanner = null;
      this.#banner(banner, t(banner === 'retreat' ? 'world.bannerRetreat' : 'world.bannerClear'));
    } else if (!dev && !flash && map.area === 'dungeon') {
      const save = this.#store.save;
      const dungeon = save.activeDungeon ? getDungeon(save.activeDungeon.dungeonId) : undefined;
      const boss = map.objects.some((o) => o.type === 'enemy' && o.boss && !save.activeDungeon?.defeatedEnemies.includes(o.id));
      if (dungeon) this.#banner(boss ? 'boss' : 'floor', t('world.placeDungeon', { dungeon: dungeonName(dungeon), floor: mapName(map) }));
    }
    // ダンジョン（ランダム生成）をクリアして戻ったとき：報酬を受け取る場面（祭壇の上にカード）の上にお知らせ
    const clear = dev ? null : this.#store.flashClear;
    this.#store.flashClear = null;
    const afterOpening = (): void => {
      const next = v2Run ?? (scene ? () => this.#playScene(scene) : undefined);
      if (flash) {
        this.#store.flashMessage = null;
        const stage = clear ? this.#clearScene(clear) : null;
        this.#message(flash, () => {
          stage?.remove();
          next?.();
        });
      } else next?.();
    };
    // 新しく始めた直後：物語の始まりの挿絵（2026-10-27）。消えてからお知らせ・場面を出す
    const opening = !dev && this.#store.openingIntro;
    this.#store.openingIntro = false;
    if (opening) showOpeningIntro(this.#root, afterOpening);
    else afterOpening();
  }

  /** 画面の真ん中に少しの間だけ出す帯（階に入った・クリア・ボスの階・戻された）。タップの邪魔をしない */
  #banner(kind: 'floor' | 'clear' | 'boss' | 'retreat', text: string): void {
    const el = h('div', { class: `world__banner world__banner--${kind}`, attrs: { 'aria-hidden': 'true' } }, h('span', { class: 'world__banner-text', text }));
    this.#root.append(el);
    setTimeout(() => el.remove(), BANNER_MS);
  }

  /** 敵とぶつかったときの光（3コマ。光を足す重ね方）。終わったら next */
  #encounterFlash(next: () => void): void {
    const img = h('img', { class: 'world__encounter-fx-img', attrs: { src: encounterFx1, alt: '', draggable: 'false' } });
    const el = h('div', { class: 'world__encounter-fx', attrs: { 'aria-hidden': 'true' } }, img);
    this.#root.append(el);
    const frames = [encounterFx2, encounterFx3];
    frames.forEach((src, i) => setTimeout(() => (img.src = src), (i + 1) * ENCOUNTER_FRAME_MS));
    setTimeout(() => el.classList.add('is-white'), frames.length * ENCOUNTER_FRAME_MS + ENCOUNTER_FRAME_MS / 2);
    setTimeout(next, (frames.length + 1) * ENCOUNTER_FRAME_MS + ENCOUNTER_WHITE_MS);
  }

  /** 正式な絵の表示倍率。部屋は画面の高さに合わせて大きくする（街の ROOM_ZOOM_MAX 倍まで） */
  #artScale(map: MapDefinition): number {
    if (!map.art || map.area !== 'interior') return ART_SCALE;
    const vh = (this.#root.clientHeight || 844) - 8;
    // fitHeight：カードショップ（横長の新しい内装）は、ほかの部屋と同じ高さを基準にして人物の大きさをそろえる（部屋は縦にも少し動く）
    return Math.min(ART_SCALE * ROOM_ZOOM_MAX, Math.max(ART_SCALE, (vh * ROOM_FILL) / (map.art.fitHeight ?? map.art.height)));
  }

  /** 絵を読み込み終えてから幕を開ける（入った瞬間に家具だけ・背景だけが見えないように） */
  #reveal(): void {
    const fade = this.#fade;
    if (!fade) return;
    const imgs: HTMLImageElement[] = [...this.#mapLayer.querySelectorAll('img')];
    // 人物の絵（背景画像で表示しているもの）も読み込み終えてから見せる
    for (const el of [this.#player, ...this.#objectEls.values()]) {
      const m = /url\("(.+)"\)/.exec(el.style.backgroundImage);
      if (!m?.[1] || typeof Image === 'undefined') continue;
      const img = new Image();
      img.src = m[1];
      imgs.push(img);
    }
    const ready = Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => undefined) : Promise.resolve())));
    const timeout = new Promise((r) => setTimeout(r, REVEAL_TIMEOUT_MS));
    void Promise.race([ready, timeout]).then(() => {
      if (this.#destroyed || this.#fade !== fade) return;
      fade.classList.remove('is-on');
      this.#preloadOthers();
    });
  }

  /** 他の街・部屋の絵を、あいている時間に読み込んでおく（入ったときにすぐ出るように） */
  #preloadOthers(): void {
    if (WorldView.#preloaded || typeof Image === 'undefined') return;
    WorldView.#preloaded = true;
    setTimeout(() => {
      const urls = new Set<string>();
      for (const id of ['town', 'home', 'neighbor', 'shop', 'lab', 'hall', 'practice', 'house-a', 'bureau']) {
        const art = getMap(id)?.art;
        for (const img of [...(art?.tiles ?? []), ...(art?.sprites ?? [])]) urls.add(img.file);
      }
      for (const url of urls) {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
      }
    }, 600);
  }

  /** 暗転してから別の場所へ */
  #goTo(next: () => void): void {
    this.#busy = true;
    this.#path = [];
    this.#held = null;
    this.#fade?.classList.add('is-on');
    setTimeout(() => {
      if (!this.#destroyed) next();
    }, FADE_OUT_MS);
  }

  /** このマップに来たときに始まる会話（練習試合のあと・最初に街へ出たとき・練習場に着いたとき） */
  #sceneOnLoad(): SceneId | null {
    const store = this.#store;
    const result = store.practiceResult;
    if (result) {
      store.practiceResult = null;
      return sceneAfterPractice(store.save, result);
    }
    return sceneOnEnter(store.save, this.#map.id);
  }

  /* ---------- 表示の組み立て ---------- */

  #isVisible = (obj: MapObject): boolean => {
    if (obj.type === 'enemy') return isEnemyActive(this.#store.save, obj.id);
    if (obj.type === 'npc') return isNpcPresent(this.#store.save, obj);
    return true;
  };

  #blocked = (x: number, y: number): boolean =>
    isBlocked(this.#map, x, y, this.#isVisible) || (this.#map.art !== undefined && isNearNpc(this.#map, x, y, this.#isVisible, NPC_SPACE));

  /** 話せる範囲にいる人（正式な絵の街・部屋。いちばん近い人・同じ近さなら向いている方） */
  #nearNpc(from: Point = this.#tile): NpcObject | null {
    return this.#map.art ? nearestNpc(this.#map, from, this.#isVisible, NPC_TALK_RANGE, this.#dir) : null;
  }

  /** 人の方を向いてから話しかける */
  #talkTo(npc: NpcObject): void {
    this.#dir = this.#dirTo(npc);
    this.#diag = null;
    this.#talk(npc);
  }

  #build(fade = false): void {
    this.#touch = null;
    this.#shadows.clear();
    this.#doors = [];
    this.#held = null;
    this.#keys.clear();
    const map = this.#map;
    const { width, height } = mapSize(map);
    const save = this.#store.save;
    const dungeon = save.activeDungeon ? getDungeon(save.activeDungeon.dungeonId) : undefined;
    const title = map.area === 'dungeon' && dungeon ? t('world.placeDungeon', { dungeon: dungeonName(dungeon), floor: mapName(map) }) : mapName(map);
    const cell = this.#cell;

    // ダンジョンはダンジョンごとの見た目も（world__map--dungeon-02 ＝精霊の森の床・壁・階段・ボスのしるし。uiParts12.css）
    const look = map.area === 'dungeon' && save.activeDungeon ? ` world__map--${save.activeDungeon.dungeonId}` : '';
    this.#mapLayer = h('div', { class: `world__map world__map--${map.area}${look}${map.art ? ' world__map--art' : ''}` });
    this.#mapLayer.style.width = `${width * cell}px`;
    this.#mapLayer.style.height = `${height * cell}px`;
    if (map.art) {
      // 正式な絵：背景（街は分割した絵・部屋は部屋の箱）＋家具（人と前後を比べて重ねる）
      for (const img of map.art.tiles) this.#mapLayer.append(this.#artImage(img.file, img, 'world__bg', 0));
      for (const img of map.art.sprites) {
        const z = img.z ? 10 + Math.round(img.z * this.#scale) : 1;
        this.#mapLayer.append(this.#artImage(img.file, img, 'world__furniture', z));
      }
      this.#buildDoors(map.art.doorAnims ?? []);
    } else {
      const tiles = h('div', { class: 'world__tiles' });
      tiles.style.gridTemplateColumns = `repeat(${width}, ${TILE}px)`;
      const dungeon = map.area === 'dungeon';
      map.tiles.forEach((row, y) => {
        [...row].forEach((ch, x) => {
          const kind = TILE_CLASS[ch] ?? 'wall';
          const el = h('div', { class: `tile tile--${kind}` });
          if (dungeon) {
            // ダンジョンの床・壁の絵（2026-10-23 デザイン第2弾）は、つなげて敷く絵なので、マスの位置だけずらして続けて見せる
            el.style.setProperty('--tx', `${-((x * TILE) % DUNGEON_TEX)}px`);
            el.style.setProperty('--ty', `${-((y * TILE) % DUNGEON_TEX)}px`);
            // 壁の下が通れるマスなら、壁の正面（手前を向いた面）を描く
            const below = map.tiles[y + 1]?.[x];
            if (kind === 'wall' && below !== undefined && (TILE_CLASS[below] ?? 'wall') !== 'wall') el.classList.add('tile--wall-face');
          }
          tiles.append(el);
        });
      });
      this.#mapLayer.append(tiles);
    }
    this.#addLabels();
    this.#objectEls.clear();
    for (const obj of map.objects) {
      const el = this.#objectElement(obj);
      if (el) {
        this.#objectEls.set(obj.id, el);
        this.#mapLayer.append(el);
      }
    }
    // 確認画面：格子（1マスごと）と地面線・基準点（地図と同じ層に置き、同じ倍率で拡大される）
    this.#devGrid = this.#devGround = this.#devOrigin = null;
    if (this.#dev) {
      this.#devGrid = h('div', { class: 'world__dev-grid', attrs: { 'aria-hidden': 'true' } });
      this.#devGrid.style.backgroundSize = `${cell}px ${cell}px`;
      this.#devGround = h('div', { class: 'world__dev-ground', attrs: { 'aria-hidden': 'true' } });
      this.#devOrigin = h('div', { class: 'world__dev-origin', attrs: { 'aria-hidden': 'true' } });
      this.#mapLayer.append(this.#devGrid, this.#devGround, this.#devOrigin);
    }
    this.#player = h('div', { class: 'world__player', attrs: { 'aria-label': t('world.player') } });
    this.#sizeFigure(this.#player);
    // 絵は最初に1回だけ設定する（あとは位置だけ動かす）
    this.#player.style.backgroundImage = `url("${PLAYER_SHEET[this.#gender]}")`;
    this.#player.style.backgroundSize = `${parseFloat(this.#player.style.width) * PLAYER_SHEET_COLS}px ${parseFloat(this.#player.style.height) * PLAYER_SHEET_ROWS}px`;
    this.#addShadow(this.#player);
    this.#playerLook = '';
    this.#mapLayer.append(this.#player);
    this.#marker = h('div', { class: 'world__marker', attrs: { 'aria-hidden': 'true' } });
    this.#mapLayer.append(this.#marker);

    this.#viewport = h('div', { class: 'world__viewport' }, this.#mapLayer);

    const hud = h(
      'header',
      { class: 'world__hud' },
      h(
        'div',
        { class: 'world__place' },
        h('span', { class: 'world__place-name', text: title }),
        map.art ? null : h('span', { class: 'world__place-note', text: t('world.placeNote') }),
      ),
      h('span', { class: 'world__coins' }, coinIcon(), coins(save.coins)),
      // 右上の小さなボタン（2026-10-27 デザイン33点の 24：脱出＝えんじに扉、メニュー＝紺に本。ui33.css）
      map.area === 'dungeon' ? button(t('world.escape'), () => this.#confirmLeave(), 'btn btn--small world__hud-btn world__hud-btn--escape') : null,
      // 【仮】チュートリアルスキップ（2026-10-27 ユーザー指示。販売前に消す予定）。導入イベントV2の最中と始まる前だけ
      this.#showsSkip ? button(t('introV2.skip.button'), () => this.#confirmSkipIntroV2(), 'btn btn--small world__skip-intro') : null,
      // 導入イベントV2の最中はメニューを出さない（自由に動けるようになってから）
      this.#eventLock ? null : button(t('world.menu'), () => this.#menu(), 'btn btn--small world__hud-btn world__hud-btn--menu'),
    );

    // 移動：画面のどこでも指を置いてすべらせると、その方向へ歩く（指を置いた所に半透明のスティックが出る。上下左右の4方向）。
    // すべらせずに離したらタップ（近くの人・となりの家具に話す・調べる。タップでは歩かない：2026-10-25）
    this.#stick = h('div', { class: 'world__stick', attrs: { 'aria-hidden': 'true' } }, h('div', { class: 'world__stick-knob' }));
    this.#viewport.append(this.#stick);
    this.#viewport.addEventListener('pointerdown', (e) => this.#pointerDown(e));
    this.#viewport.addEventListener('pointermove', (e) => this.#pointerMove(e));
    this.#viewport.addEventListener('pointerup', (e) => this.#pointerUp(e, true));
    this.#viewport.addEventListener('pointercancel', (e) => this.#pointerUp(e, false));

    const examine = (this.#examineBtn = h(
      'button',
      { class: 'world__action', attrs: { type: 'button', 'aria-label': t('world.examine') }, on: { click: () => this.#examine() } },
      h('span', { class: 'world__action-icon', attrs: { 'aria-hidden': 'true' } }),
      h('span', { class: 'world__action-label', text: t('world.examine') }),
    ));
    if (this.#eventLock) examine.style.display = 'none';
    const hint = WorldView.#stickUsed || this.#eventLock ? null : h('div', { class: 'world__hint', text: t('world.hint') });

    const v2Goal = this.#dev ? null : this.#introV2Goal(save.story.introV2, map.id);
    const goal = v2Goal
      ? h('div', { class: 'world__goal', text: t(v2Goal) })
      : showsPracticeGoal(save, map.id)
        ? h('div', { class: 'world__goal', text: t('story.goal.practice') })
        : null;
    // 暗転の幕：場所に入ったときは閉じた状態から、絵を読み込み終えたら開ける
    const keepClosed = !fade && this.#fade?.classList.contains('is-on');
    this.#fade = h('div', { class: `world__fade${fade || keepClosed ? ' is-on' : ''}`, attrs: { 'aria-hidden': 'true' } });
    this.#nearKey = '';
    this.#root.replaceChildren(this.#viewport, hud, examine, hint ?? '', goal ?? '', this.#fade);
    this.#root.dataset.map = map.id;
    this.#root.dataset.intro = save.story.intro;
    this.#root.dataset.introV2 = save.story.introV2.state;
    // 一緒に歩く幼馴染（会話のあとに描き直したときも、同じマスに出す）
    if (this.#follower) this.#follower = this.#makeFollower(this.#follower.tile, this.#follower.dir);
    this.#cam = null;
    this.#render();
    if (fade) this.#reveal();
  }

  /**
   * 自動ドア（2026-10-27 カードショップの外と中）：入口の枠（clip）の中に左右の戸を置き、枠の外は見せない。
   * 人が near のマスにいる間は開き、離れると閉じる（#updateDoors）。入ったとき・出てきたときは開いたところから
   */
  #buildDoors(anims: readonly ArtDoorAnim[]): void {
    const sc = this.#scale;
    this.#doors = anims.map((anim) => {
      const box = h('div', { class: 'world__door', attrs: { 'aria-hidden': 'true' } });
      const { clip } = anim;
      Object.assign(box.style, {
        left: `${clip.x * sc}px`,
        top: `${clip.y * sc}px`,
        width: `${clip.w * sc}px`,
        height: `${clip.h * sc}px`,
        zIndex: String(10 + Math.round(anim.z * sc)),
      });
      const leaf = (img: ArtDoorAnim['left']): HTMLElement => this.#artImage(img.file, { ...img, x: img.x - clip.x, y: img.y - clip.y }, 'world__furniture world__door-leaf', 0);
      const left = leaf(anim.left);
      const right = leaf(anim.right);
      box.append(left, right);
      this.#mapLayer.append(box);
      const door = { anim, left, right, t: this.#nearDoor(anim) ? 1 : 0, at: performance.now() };
      this.#placeDoor(door);
      return door;
    });
  }

  /** 人が戸の開く範囲にいるか（歩いている途中は行き先のマスも見る） */
  #nearDoor(anim: ArtDoorAnim): boolean {
    const { near } = anim;
    const inside = (p: Point): boolean => p.x >= near.x && p.x < near.x + near.w && p.y >= near.y && p.y < near.y + near.h;
    return inside(this.#tile) || (this.#move !== null && inside(this.#move.to));
  }

  #placeDoor(door: DoorState): void {
    const dx = door.anim.travel * door.t * this.#scale;
    door.left.style.transform = `translateX(${-dx}px)`;
    door.right.style.transform = `translateX(${dx}px)`;
  }

  #updateDoors(time: number): void {
    for (const door of this.#doors) {
      const dt = Math.max(0, time - door.at);
      door.at = time;
      const target = this.#nearDoor(door.anim) ? 1 : 0;
      if (door.t === target) continue;
      // 閉じていた戸が開き始めるとき：自動ドアの音（2026-10-26 ユーザー提供の auto_door.mp3。それまでは店に出入りする瞬間に鳴らしていた）
      if (target === 1 && door.t === 0) sound.play('autoDoor');
      const step = dt / (target > door.t ? DOOR_OPEN_MS : DOOR_CLOSE_MS);
      door.t = target > door.t ? Math.min(1, door.t + step) : Math.max(0, door.t - step);
      this.#placeDoor(door);
    }
  }

  #artImage(src: string, r: { x: number; y: number; w: number; h: number }, cls: string, z: number): HTMLElement {
    const img = h('img', { class: cls, attrs: { src, alt: '', draggable: 'false', decoding: 'async' } });
    Object.assign(img.style, {
      left: `${r.x * this.#scale}px`,
      top: `${r.y * this.#scale}px`,
      width: `${r.w * this.#scale}px`,
      height: `${r.h * this.#scale}px`,
      zIndex: String(z),
    });
    return img;
  }

  #addLabels(): void {
    const map = this.#map;
    const cell = this.#cell;
    const save = this.#store.save;
    this.#signs = [];
    if (map.id === 'town') {
      // 施設の名前（建物の絵の上端）
      for (const sign of TOWN_SIGNS) {
        const v2Goal = this.#dev ? null : this.#introV2Goal(save.story.introV2, map.id);
        const goal =
          (sign.label === 'practice' && (showsPracticeGoal(save, map.id) || v2Goal === 'introV2.goal.school')) || (sign.label === 'bureau' && v2Goal === 'introV2.goal.bureau');
        const el = h('div', { class: `world__sign${goal ? ' is-goal' : ''}`, text: t(`world.building.${sign.label}` as MessageKey) });
        Object.assign(el.style, { left: `${sign.x * this.#scale}px`, top: `${sign.y * this.#scale}px` });
        const door = map.art?.doors?.[sign.building];
        const top = sign.y * this.#scale;
        const maxShift = door ? Math.max(0, door.y * cell - 3 * this.#figureH * 0.5 - top) : 0;
        this.#signs.push({ el, top, maxShift, shift: 0 });
        this.#mapLayer.append(el);
      }
      return;
    }
    for (const obj of map.objects) {
      if (obj.type !== 'interact' && obj.type !== 'warp') continue;
      // 正式な絵の部屋では、使える家具（調べると画面が開く物）と出口だけに名前を出す
      if (map.art && obj.type === 'interact' && obj.action === 'message') continue;
      // ダンジョンの階段・出口：案内板の絵（2026-10-26 デザイン第9弾。下り・上り・出口）の板に名前を重ねる
      const signKind = map.area === 'dungeon' && obj.type === 'warp' ? dungeonSignKind(obj.target) : null;
      const el = signKind
        ? h(
            'div',
            { class: `world__label world__label--warp world__dungeon-sign world__dungeon-sign--${signKind}` },
            h('span', { class: 'world__dungeon-sign-post' }, h('img', { attrs: { src: DUNGEON_SIGN_ART[signKind], alt: '', draggable: 'false' } }), h('span', { class: 'world__dungeon-sign-text', text: objectLabel(obj) })),
          )
        : map.art
          ? h('div', { class: `world__label world__label--${obj.type}` }, h('span', { class: 'world__label-text', text: objectLabel(obj) }))
          : h('div', { class: `world__label world__label--${obj.type}`, text: objectLabel(obj) });
      Object.assign(el.style, { left: `${obj.x * cell}px`, top: `${obj.y * cell}px`, width: `${obj.w * cell}px`, height: `${obj.h * cell}px` });
      this.#mapLayer.append(el);
    }
  }

  #objectElement(obj: MapObject): HTMLElement | null {
    const cell = this.#cell;
    const place = (el: HTMLElement, x: number, y: number): HTMLElement => {
      el.style.left = `${x * cell}px`;
      el.style.top = `${y * cell}px`;
      return el;
    };
    if (obj.type === 'enemy') {
      const enc = ENCOUNTERS[obj.encounterId];
      const el = h('div', {
        class: `world__enemy${obj.boss ? ' world__enemy--boss' : ''}`,
        text: obj.boss ? t('world.boss') : t('world.enemy'),
        attrs: { 'aria-label': enc ? opponentName(enc) : t('world.enemy') },
      });
      return place(el, obj.x, obj.y);
    }
    if (obj.type === 'npc') {
      if (!this.#isVisible(obj)) return null;
      // 人物の歩行の絵（待機の向き）。足元のマスに立つ。
      // 絵は中の「体」の層に描き、体だけを足の裏を中心に縦へわずかに伸び縮みさせる（呼吸。2026-10-26 ユーザー「足は地面にしっかり着地」）。
      // 位置を決める transform（外側）と分けるので、伸び縮みしても足元は動かない
      const body = h('div', { class: 'world__npc-body' });
      const el = h('div', { class: 'world__npc', dataset: { npc: obj.npcId }, attrs: { 'aria-label': npcName(obj.npcId) } }, body);
      this.#sizeFigure(el);
      this.#addShadow(el);
      body.style.backgroundImage = `url("${NPC_SHEET[obj.npcId]}")`;
      body.style.transformOrigin = el.style.transformOrigin;
      // 人ごとに呼吸の始まりをずらす（そろって動かないように）
      body.style.animationDelay = `${-((obj.x * 7 + obj.y * 13) % 32) / 10}s`;
      this.#faceNpc(el, 'down');
      this.#placeFigure(el, { x: obj.x, y: obj.y + (obj.drawDy ?? 0) });
      return el;
    }
    if (obj.type === 'chest') {
      const save = this.#store.save;
      const opened = save.activeDungeon ? isChestOpened(save, save.activeDungeon.dungeonId, obj.id) : false;
      const art = CHEST_ART[obj.look];
      const el = h('div', { class: `world__chest${opened ? ' is-open' : ''}`, attrs: { 'aria-label': opened ? t('world.chestEmptyLabel') : t('world.chest') } });
      el.style.backgroundImage = `url("${opened ? art.opening[art.opening.length - 1] : art.closed}")`;
      return place(el, obj.x, obj.y);
    }
    return null;
  }

  #faceNpc(el: HTMLElement, dir: Direction): void {
    const w = parseFloat(el.style.width);
    const hgt = parseFloat(el.style.height);
    const body = (el.querySelector('.world__npc-body') as HTMLElement | null) ?? el;
    body.style.backgroundSize = `${w * 4}px ${hgt * 4}px`;
    body.style.backgroundPosition = `${-NPC_IDLE_COL * w}px ${-DIR_ROW[dir] * hgt}px`;
    el.dataset.face = dir;
  }

  /* ---------- ループ ---------- */

  #frame(time: number): void {
    if (this.#destroyed) return;
    let dt = Math.min(0.05, (time - this.#last) / 1000);
    this.#last = time;
    const dev = this.#dev?.state;
    // 確認画面の1コマ送りで進めた時間（#oneFrameDt が #step まで済ませる）
    let stepped = 0;
    if (dev) {
      // 確認画面：低速再生・一時停止・1コマ送り（止めている間は時間を進めない）
      if (dev.paused) {
        dt = 0;
        if (dev.stepFrames > 0) {
          dev.stepFrames -= 1;
          stepped = this.#oneFrameDt();
        }
      } else dt *= dev.timeScale;
    }
    if (!this.#busy && dt > 0) this.#step(dt);
    if (this.#move || this.#treadmillMoving) {
      this.#lastMoving = time;
      this.#moveTime += dt + stepped;
    } else {
      this.#moveTime = 0;
      if (!this.#held) this.#running = false;
    }
    this.#render(time);
    this.#raf = requestAnimationFrame((t) => this.#frame(t));
  }

  /** 確認画面の1コマ送り：コマが1つ進むまで少しずつ時間を進め、その合計の時間を返す */
  #oneFrameDt(): number {
    const dev = this.#dev?.state;
    if (!dev) return 0;
    const weights = frameWeightsOf(this.#dir, this.#running);
    const before = frameOf(this.#phase, weights);
    let total = 0;
    for (let i = 0; i < 400 && frameOf(this.#phase, weights) === before; i += 1) {
      const slice = 1 / 240;
      if (this.#busy) break;
      this.#step(slice);
      total += slice;
      if (!this.#move && !this.#treadmillMoving) break;
    }
    return total;
  }

  /**
   * dt 秒ぶん進める。マスに着いて歩き続けるときは、あまった時間でそのまま次のマスへ進む
   * （2026-10-23。それまではマスごとに1コマ止まり、カクカクして見えた）
   */
  #step(dt: number): void {
    const tm = this.#dev?.state.treadmill;
    if (tm) {
      // 確認画面「その場で動かす」：向き・状態を指定どおりにし、位置は変えずにコマだけ進める
      this.#dir = tm.dir;
      this.#diag = tm.diag;
      this.#running = tm.mode === 'run';
      this.#move = null;
      this.#path = [];
      if (tm.mode !== 'idle') this.#phase = advancePhase(this.#phase, this.#speed() * dt, this.#stride, this.#animScale);
      return;
    }
    if (!this.#move) {
      this.#startNext();
      if (!this.#move) return;
    }
    const r = advanceMove(this.#move.t, this.#move.len, dt, this.#speed(), this.#cell);
    this.#move.t = r.t;
    // コマ送りは進んだ距離で決める（歩幅は walkAnim.ts。走りに変わっても位相は続きから）
    this.#phase = advancePhase(this.#phase, r.dist, this.#stride, this.#animScale);
    if (r.t >= 1) {
      this.#tile = this.#move.to;
      this.#pos = { ...this.#tile };
      this.#move = null;
      this.#followerArrive();
      this.#arrive();
      if (r.rest > 0 && !this.#busy) this.#step(r.rest);
      return;
    }
    const { from, to, t } = this.#move;
    this.#pos = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  }

  /** 確認画面の再生速度の倍率（本編は 1） */
  get #animScale(): number {
    return this.#dev?.state.animScale ?? 1;
  }

  /** いまの歩く速さ（論理px/秒）。走る・歩き出しの加速・止まる最後のマスの減速（walkAnim.ts） */
  #speed(): number {
    const decel = this.#move && !this.#held && this.#path.length === 0 ? this.#move.t : null;
    return walkSpeed(this.#running, this.#moveTime, decel, this.#dev?.state.speedScale ?? 1);
  }

  /** 止まっているとき：道順・調べる予約・押している向きから、次の1歩を始める */
  #startNext(): void {
    // 導入イベントV2：歩いている途中の会話（S02）。残りの道は会話のあとに歩き直す
    const talk = this.#walkTalk;
    if (talk && this.#path.length > 0 && this.#path.length <= talk.at) {
      this.#walkTalk = null;
      this.#path = [];
      this.#pathDone = null;
      talk.resume();
      return;
    }
    const next = this.#path.shift();
    if (next) {
      const dx = next.x - this.#tile.x;
      const dy = next.y - this.#tile.y;
      if (!this.#tryStep(dx, dy, false)) this.#path = [];
      else if (this.#follower) {
        // 幼馴染は1マス先を歩く（道の終わり＝建物の入口では、先に入って消える）
        const f = this.#follower;
        f.from = f.tile;
        f.to = this.#path[this.#followLead - 1] ?? null;
      }
      if (this.#path.length === 0 && !this.#move) this.#finishPath();
      return;
    }
    if (this.#pathDone) {
      this.#finishPath();
      return;
    }
    if (this.#afterPath) {
      const target = this.#afterPath;
      if (target.type === 'npc' && this.#map.art) {
        this.#afterPath = null;
        if (this.#nearNpc()?.id === target.id || Math.max(Math.abs(target.x - this.#tile.x), Math.abs(target.y - this.#tile.y)) <= NPC_TALK_RANGE) this.#talkTo(target);
        return;
      }
      const cell = adjacentCellOf(this.#afterPath, this.#tile);
      this.#afterPath = null;
      if (cell) {
        this.#dir = this.#dirTo(cell);
        this.#diag = null;
        this.#interactAt(cell.x, cell.y);
      }
      return;
    }
    if (this.#held) this.#tryStep(this.#held.x, this.#held.y, true);
  }

  #dirTo(p: Point): Direction {
    const dx = p.x - this.#tile.x;
    const dy = p.y - this.#tile.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  /** (dx, dy) へ1歩。斜めで進めないときは、進める方の縦か横へすべる（スティック操作のとき）。進めたら true */
  #tryStep(dx: number, dy: number, slide: boolean): boolean {
    const from = this.#tile;
    const tries: [number, number][] = [[dx, dy]];
    if (slide && dx !== 0 && dy !== 0) tries.push([dx, 0], [0, dy]);
    for (const [sx, sy] of tries) {
      if (canStep(from, sx, sy, this.#blocked)) {
        // 向きは押している向き（dx, dy）に合わせる。壁ぞいにすべって進むときも、すべる向きの絵に切り替えない
        // （2026-10-23：斜めの絵と正面・横の絵が1歩ごとに入れ替わり、クルクル回って見えたため）
        this.#dir = facing(dx, dy, this.#dir);
        this.#diag = diagonalOf(dx, dy);
        this.#move = { from, to: { x: from.x + sx, y: from.y + sy }, len: sx !== 0 && sy !== 0 ? Math.SQRT2 : 1, t: 0 };
        return true;
      }
    }
    // 進めない：同じ向きをしばらく押し続けたときだけ、その場でその向きを向く（指のわずかな動きで回らないように）
    if (!slide || performance.now() - this.#heldAt >= TURN_IN_PLACE_MS) {
      this.#dir = facing(dx, dy, this.#dir);
      this.#diag = diagonalOf(dx, dy);
    }
    // その先が敵なら戦う
    const enemy = objectsAt(this.#map, from.x + dx, from.y + dy, this.#isVisible).find((o): o is EnemyObject => o.type === 'enemy');
    this.#path = [];
    if (enemy) this.#encounter(enemy);
    return false;
  }

  #arrive(): void {
    const loc: Location = { mapId: this.#map.id, x: this.#tile.x, y: this.#tile.y, dir: this.#dir };
    this.#store.update((s) => ({ ...s, location: loc }));
    const warp = objectsAt(this.#map, this.#tile.x, this.#tile.y).find((o) => o.type === 'warp');
    if (warp && warp.type === 'warp') {
      this.#path = [];
      this.#held = null;
      const target = warp.target;
      if (target.kind === 'map') {
        // 建物に入る・出る：ドアの音（大会会場は出入りとも鉄の扉、カードショップは出入りとも自動ドア。2026-10-26 ユーザー指示）。
        // カードショップは 2026-10-27 から、自動ドアが開き始めるときに鳴らす（#updateDoors）ので、ここでは鳴らさない
        const to = getMap(target.mapId);
        const shop = to?.id === 'shop' || this.#map.id === 'shop';
        if (to && to.area !== this.#map.area && !shop) {
          const building = to.area === 'interior' ? to.id : this.#map.id;
          const entering = to.area === 'interior';
          sound.play(
            building === 'hall' ? 'ironDoorOpen' : entering ? 'doorOpen' : 'doorClose',
          );
        }
        this.#store.update((s) => ({ ...s, location: { mapId: target.mapId, x: target.x, y: target.y, dir: target.dir } }));
        this.#goTo(() => this.load());
      } else if (target.kind === 'floor') {
        sound.play('stairs');
        this.#store.update((s) => changeFloor(s, target.delta));
        this.#goTo(() => this.load());
      } else if (target.kind === 'dungeonGate') {
        // 入口の1マス手前（北）に戻してから選択画面へ。戻ってきたとき入口の上に立ったままにならないように
        const back: Location = { mapId: this.#map.id, x: this.#tile.x, y: this.#tile.y - 1, dir: 'up' };
        this.#store.update((s) => ({ ...s, location: back }));
        this.#busy = true;
        this.#ctx.navigate('dungeonSelect');
      } else {
        this.#confirmLeave();
      }
    }
  }

  /**
   * 歩くときの体の動き（WALK_SQUASH ほか）。足が着くコマ（偶数）で縮み、足がそろうコマ（奇数）で伸びる。
   * 進んだ距離から決めるので、足のコマ送りとずれない。止まると元に戻る
   */
  #bodyPose(time: number, walking: boolean, drawn = false, leanDrawn = false): { sx: number; sy: number; deg: number; shadow: number } | null {
    if (REDUCED_MOTION) return null;
    const dt = Math.min(0.05, Math.max(0, (time - this.#leanTime) / 1000));
    this.#leanTime = time;
    const mv = this.#move;
    const dx = walking && mv ? Math.sign(mv.to.x - mv.from.x) : 0;
    // 走りの絵（第3版）には前傾が描いてあるので、プログラムの傾きは付けない
    const target = leanDrawn ? 0 : dx * (this.#running ? RUN_LEAN_DEG : WALK_LEAN_DEG);
    this.#lean += (target - this.#lean) * (1 - Math.exp(-LEAN_RATE * dt));
    if (Math.abs(this.#lean) < 0.01) this.#lean = 0;
    // 1コマ＝半歩。足が着いているコマ（偶数）の真ん中で c＝1（いちばん縮む）、足がそろうコマ（奇数）の真ん中で c＝−1
    // 第2版の絵（drawn）は体の上下が絵に描いてあるので、縮み・影の動きは付けない
    const c = walking && !drawn ? squashOf(this.#phase) : 0;
    const a = this.#running ? RUN_SQUASH : WALK_SQUASH;
    if (c === 0 && this.#lean === 0) return null;
    return { sx: 1 + (a / 2) * c, sy: 1 - a * c, deg: this.#lean, shadow: 1 + SHADOW_PULSE * c };
  }

  #render(time = performance.now()): void {
    const p = this.#pos;
    this.#updateDoors(time);
    // 歩いている間（と、歩き続けている途中のマスの切り替わり）は歩行シート、止まったら待機の絵
    const walking = isWalking(time, this.#lastMoving, this.#move !== null || this.#treadmillMoving);
    const w = parseFloat(this.#player.style.width);
    const hgt = parseFloat(this.#player.style.height);
    if (!walking) this.#phase = 0;
    // 1歩を4コマで送る（1周＝右足・左足の2歩＝8コマ）。背たけが小さいダンジョンでは歩幅も小さく、走るときは歩幅を大きく（walkAnim.ts）
    const step = frameOf(this.#phase, frameWeightsOf(this.#dir, walking && this.#running));
    const col = walking ? step : IDLE_COL;
    // 足音：足が地面に着くコマ（右足が着く＝0・左足が着く＝4）に変わったときに1歩
    if (!walking) this.#stepCol = -1;
    else if (col !== this.#stepCol) {
      this.#stepCol = col;
      if (isContactFrame(col)) sound.step(this.#ground(), this.#running);
    }
    const row = sheetRow(this.#dir, this.#diag, walking && this.#running);
    // 立ち止まっているかの印（CSS の is-idle。呼吸の動きは 2026-10-23 にやめた）。変わったときだけ書く
    if (walking === this.#player.classList.contains('is-idle')) this.#player.classList.toggle('is-idle', !walking);
    const look = `${row}:${col}`;
    if (look !== this.#playerLook) {
      this.#player.style.backgroundPosition = `${-col * w}px ${-row * hgt}px`;
      this.#playerLook = look;
    }
    const v2 = PLAYER_V2_ROWS[this.#gender].has(row);
    const runArt = PLAYER_RUN_ART_ROWS[this.#gender].has(row);
    this.#placeFigure(this.#player, p, walking && step % FRAMES_PER_STEP === 2 ? this.#figureH * (this.#running ? RUN_BOB : WALK_BOB) : 0, this.#bodyPose(time, walking, v2, runArt));
    this.#renderFollower();
    const { width, height } = mapSize(this.#map);
    const cell = this.#cell;
    const z = this.#zoom;
    const vw = this.#viewport.clientWidth || 390;
    const vh = this.#viewport.clientHeight || 600;
    const mw = width * cell * z;
    const mh = height * cell * z;
    const f = this.#foot(p);
    const dev = this.#dev;
    if (dev) this.#renderDev(time, { row, col, walking, f, w, hgt, cell, z });
    // カメラは人物の体の真ん中＋進む向きの先読みを見る。遊びの中では動かさない
    const camDt = Math.min(0.05, Math.max(0, (time - this.#camTime) / 1000));
    this.#camTime = time;
    const mv = this.#move;
    const ahead = mv ? { x: mv.to.x - mv.from.x, y: mv.to.y - mv.from.y } : { x: 0, y: 0 };
    const al = Math.hypot(ahead.x, ahead.y) || 1;
    const la = 1 - Math.exp(-CAMERA_LOOK_RATE * camDt);
    this.#look = {
      x: this.#look.x + ((ahead.x / al) * vw * CAMERA_LOOK - this.#look.x) * la,
      y: this.#look.y + ((ahead.y / al) * vh * CAMERA_LOOK - this.#look.y) * la,
    };
    // 確認画面「カメラを止める」：出発点を見たまま（人物が動いた量がそのまま見える）
    const anchor = dev?.state.fixedCamera ? this.#foot(dev.start) : f;
    if (dev?.state.fixedCamera) this.#look = { x: 0, y: 0 };
    const body = { x: anchor.x * z + this.#look.x, y: (anchor.y - this.#figureH / 2) * z + this.#look.y };
    if (!this.#cam || dev?.state.fixedCamera) this.#focus = body;
    else {
      const dx = body.x - this.#focus.x;
      const dy = body.y - this.#focus.y;
      this.#focus = {
        x: Math.abs(dx) > CAMERA_DEAD_X ? body.x - Math.sign(dx) * CAMERA_DEAD_X : this.#focus.x,
        y: Math.abs(dy) > CAMERA_DEAD_Y ? body.y - Math.sign(dy) * CAMERA_DEAD_Y : this.#focus.y,
      };
    }
    const fo = this.#focus;
    const tx = mw <= vw ? (vw - mw) / 2 : -Math.min(Math.max(fo.x - vw / 2, 0), mw - vw);
    const ty = mh <= vh ? (vh - mh) / 2 : -Math.min(Math.max(fo.y - vh / 2, 0), mh - vh);
    // カメラは少し遅れて追う（場所に入ったときはぴったり）
    if (!this.#cam || dev?.state.fixedCamera) this.#cam = { x: tx, y: ty };
    else {
      const a = 1 - Math.exp(-CAMERA_FOLLOW * camDt);
      this.#cam = { x: this.#cam.x + (tx - this.#cam.x) * a, y: this.#cam.y + (ty - this.#cam.y) * a };
    }
    const { x: cx, y: cy } = this.#cam;
    // 画面の実際の点（デバイスの画素）にそろえる。論理px で丸めると、人物が地図に対して半px ずつ揺れて見える
    const snap = this.#pixelSnap();
    this.#mapLayer.style.transform = `translate(${Math.round(cx * snap) / snap}px, ${Math.round(cy * snap) / snap}px)${z !== 1 ? ` scale(${z})` : ''}`;
    // 施設の看板が上の帯に隠れるときは、建物の上を少し下へずらす（玄関の上までは下げない）
    for (const sign of this.#signs) {
      const shift = Math.max(0, Math.min((SIGN_MIN_BOTTOM - (sign.top * z + cy)) / z, sign.maxShift));
      if (shift !== sign.shift) {
        sign.shift = shift;
        sign.el.style.transform = `translate(-50%, calc(-100% + ${shift.toFixed(1)}px))`;
      }
    }
    const px = String(this.#tile.x);
    const py = String(this.#tile.y);
    if (this.#root.dataset.px !== px) this.#root.dataset.px = px;
    if (this.#root.dataset.py !== py) this.#root.dataset.py = py;
    if (!this.#move) this.#updateNear();
  }

  /** 確認画面：格子・地面線・基準点・コマの枠を更新し、数値を知らせる */
  #renderDev(time: number, v: { row: number; col: number; walking: boolean; f: Point; w: number; hgt: number; cell: number; z: number }): void {
    const dev = this.#dev;
    if (!dev) return;
    const on = dev.state.overlays;
    if (this.#root.classList.contains('is-dev-overlay') !== on) this.#root.classList.toggle('is-dev-overlay', on);
    if (this.#devGround) this.#devGround.style.transform = `translate(0, ${v.f.y}px)`;
    if (this.#devOrigin) this.#devOrigin.style.transform = `translate(${v.f.x}px, ${v.f.y}px)`;
    const speedPx = v.walking ? this.#speed() : 0;
    const stride = this.#stride;
    dev.onFrame?.({
      row: v.row,
      col: v.col,
      phase: this.#phase,
      walking: v.walking,
      running: this.#running,
      speedPx,
      stride,
      fps: framesPerSecond(speedPx, stride, this.#animScale),
      figureH: this.#figureH,
      cell: v.cell,
      zoom: v.z,
      tile: this.#tile,
      pos: this.#pos,
      foot: v.f,
      shownCellW: v.w * v.z,
      shownCellH: v.hgt * v.z,
      gender: this.#gender,
    });
    void time;
  }

  /** 確認画面：向きを指定する（本編では使わない） */
  setFacing(dir: Direction, diag: Diagonal | null): void {
    if (!this.#dev) return;
    this.#dir = dir;
    this.#diag = diag;
  }

  /** 確認画面：人物を出発点に戻す（カメラも） */
  resetPosition(): void {
    const dev = this.#dev;
    if (!dev) return;
    this.#tile = { x: dev.start.x, y: dev.start.y };
    this.#pos = { ...this.#tile };
    this.#move = null;
    this.#path = [];
    this.#phase = 0;
    this.#cam = null;
  }

  /* ---------- 操作 ---------- */

  /* ---------- スティック（指を置いた所に出る） ---------- */

  #pointerDown(e: PointerEvent): void {
    if (this.#busy || this.#eventLock || this.#touch) return;
    this.#touch = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
    try {
      this.#viewport.setPointerCapture(e.pointerId);
    } catch {
      // 取れなくても動く
    }
  }

  #pointerMove(e: PointerEvent): void {
    const touch = this.#touch;
    if (!touch || touch.id !== e.pointerId) return;
    // ステージは拡大縮小されているので、論理pxに直して判断する
    const scale = this.#stageScale();
    const dx = (e.clientX - touch.x) / scale;
    const dy = (e.clientY - touch.y) / scale;
    const dist = Math.hypot(dx, dy);
    if (!touch.dragging) {
      if (dist < STICK_START) return;
      touch.dragging = true;
      this.#path = [];
      this.#afterPath = null;
      this.#placeStick(touch.x, touch.y, scale);
      this.#stick.classList.add('is-on');
      if (!WorldView.#stickUsed) {
        WorldView.#stickUsed = true;
        this.#root.querySelector('.world__hint')?.remove();
      }
    }
    const k = Math.min(1, STICK_RADIUS / Math.max(dist, 1));
    const knob = this.#stick.firstElementChild as HTMLElement | null;
    if (knob) knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    if (this.#busy || dist < STICK_DEAD) {
      this.#held = null;
      return;
    }
    // 大きく倒すと走る。少し戻しただけでは歩きに戻さない。建物の中・ダンジョンでは走らない（2026-10-25 ユーザー指示）
    if (!this.#canRun) this.#running = false;
    else if (dist >= STICK_RUN) this.#running = true;
    else if (dist < STICK_WALK_BACK) this.#running = false;
    this.#stick.classList.toggle('is-run', this.#running);
    // 上下左右の4方向：90度ずつ（2026-10-25 ユーザー「斜めには進めないように」。それまでは8方向）。
    // 境目のあたりで指がふるえても向きが行ったり来たりしないよう、少しこえるまで前の向きのまま
    const angle = Math.atan2(dy, dx);
    const held = this.#held;
    if (held && Math.abs(angleDiff(angle, Math.atan2(held.y, held.x))) <= STICK_HOLD) return;
    const sector = Math.round(angle / (Math.PI / 2));
    const a = (sector * Math.PI) / 2;
    this.#held = { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
    this.#heldAt = performance.now();
  }

  /**
   * スティックの輪を出す位置（指を置いた所）。2026-10-24 改訂R2 フェーズ1：輪が画面の端で欠けたり、
   * 上の帯・右下の「調べる」に重なったりしないよう、輪だけ内側へずらす（歩く向きは指を置いた所から測るので変わらない）
   */
  #placeStick(clientX: number, clientY: number, scale: number): void {
    const v = this.#viewport.getBoundingClientRect();
    const vw = this.#viewport.clientWidth;
    const vh = this.#viewport.clientHeight;
    const r = STICK_RING_R + 4;
    let x = Math.min(Math.max((clientX - v.left) / scale, r), vw - r);
    let y = Math.min(Math.max((clientY - v.top) / scale, STICK_TOP + r), vh - r);
    const btn = this.#examineBtn?.getBoundingClientRect();
    if (btn) {
      const bl = (btn.left - v.left) / scale;
      const bt = (btn.top - v.top) / scale;
      if (x + r > bl && y + r > bt) x = Math.max(r, bl - r);
    }
    this.#stick.style.left = `${x}px`;
    this.#stick.style.top = `${y}px`;
  }

  #pointerUp(e: PointerEvent, tap: boolean): void {
    const touch = this.#touch;
    if (!touch || touch.id !== e.pointerId) return;
    this.#touch = null;
    this.#stick.classList.remove('is-on', 'is-run');
    if (touch.dragging) {
      this.#held = null;
      return;
    }
    if (tap) this.#tap(e);
  }

  #stageScale(): number {
    const w = this.#root.offsetWidth;
    return w > 0 ? this.#root.getBoundingClientRect().width / w : 1;
  }

  /** 1論理px が画面の何画素か。画面の大きさが変わったときだけ測り直す（毎コマ測ると重い） */
  #pixelSnap(): number {
    const key = `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}`;
    if (key !== this.#snapKey) {
      const snap = this.#stageScale() * (window.devicePixelRatio || 1);
      if (snap > 0) {
        this.#snapKey = key;
        this.#snap = snap;
      }
    }
    return this.#snap;
  }

  #key(e: KeyboardEvent, down: boolean): void {
    if (this.#busy || this.#eventLock || this.#root.querySelector('.modal')) return;
    const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as const)[e.key as 'ArrowUp'];
    if (dir) {
      e.preventDefault();
      // パソコンでは Shift を押しながらで走る（街だけ）
      this.#running = e.shiftKey && this.#canRun;
      if (down) {
        this.#path = [];
        this.#keys.add(dir);
      } else this.#keys.delete(dir);
      // 上下左右の4方向だけ（2026-10-25 ユーザー「斜めには進めないように」）。2つ押しているときは、あとから押した方
      const last = [...this.#keys].pop();
      this.#held = last ? { ...DIR_DELTA[last] } : null;
      this.#heldAt = performance.now();
    } else if (down && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      this.#examine();
    }
  }

  #tap(e: MouseEvent): void {
    if (this.#busy || this.#eventLock) return;
    const rect = this.#mapLayer.getBoundingClientRect();
    const cell = this.#cell;
    const { width } = mapSize(this.#map);
    const scale = rect.width / (width * cell);
    const lx = (e.clientX - rect.left) / scale;
    const ly = (e.clientY - rect.top) / scale;
    const x = Math.floor(lx / cell);
    const y = Math.floor(ly / cell);
    // 人の絵（足元のマスより大きい）をタップしたら、その人に話しかける
    const person = this.#map.objects.find((o): o is NpcObject => {
      if (o.type !== 'npc' || !this.#isVisible(o)) return false;
      const f = this.#foot(o);
      const hw = this.#figureH * 0.3;
      return lx >= f.x - hw && lx <= f.x + hw && ly >= f.y - this.#figureH && ly <= f.y + cell / 2;
    });
    // 話しかけ・調べる対象（出入口は歩いて踏むので対象外）
    const target = person ?? objectsAt(this.#map, x, y, this.#isVisible).find((o) => o.type !== 'warp');
    // 2026-10-25 ユーザー「タップでは動かないように」：タップで歩かない（その場所へ歩く・人や家具まで歩いてから話すのをやめた）。
    // 話せる範囲の人・となりの家具だけ、その場で話す・調べる（向きだけ変える）。移動はスティック（画面をなぞる）だけ
    if (this.#move) return;
    if (person && this.#map.art) {
      if (Math.max(Math.abs(this.#tile.x - person.x), Math.abs(this.#tile.y - person.y)) > NPC_TALK_RANGE) return;
      // 押したことが分かるよう小さな音（ボタンと同じ音）
      sound.tap();
      this.#talkTo(person);
      return;
    }
    const here = target ? adjacentCellOf(target, this.#tile) : null;
    if (here) {
      this.#dir = this.#dirTo(here);
      this.#diag = null;
      this.#interactAt(here.x, here.y);
    }
  }

  /** 話しかけ・調べることができる、となりのマス（正面を先に） */
  #nearTarget(): Point | null {
    const order: Direction[] = [this.#dir, 'up', 'down', 'left', 'right'];
    for (const dir of order) {
      const d = DIR_DELTA[dir];
      const p = { x: this.#tile.x + d.x, y: this.#tile.y + d.y };
      if (objectsAt(this.#map, p.x, p.y, this.#isVisible).some((o) => o.type !== 'warp')) return p;
    }
    return null;
  }

  /** 調べられる物のとなりにいる間、しらべるボタンを光らせる */
  #updateNear(): void {
    const key = `${this.#map.id}:${this.#tile.x},${this.#tile.y}`;
    if (key === this.#nearKey) return;
    this.#nearKey = key;
    this.#gaze();
    const npc = this.#nearNpc();
    const near = npc ? { x: npc.x, y: npc.y } : this.#nearTarget();
    this.#examineBtn?.classList.toggle('is-ready', near !== null);
    // 話せる人がいるときは「話す」、それ以外は「調べる」（何ができるかをボタンの文字で見せる）
    const label = t(npc ? 'world.talk' : 'world.examine');
    const labelEl = this.#examineBtn?.querySelector('.world__action-label');
    if (labelEl && labelEl.textContent !== label) {
      labelEl.textContent = label;
      this.#examineBtn?.setAttribute('aria-label', label);
    }
    this.#showMarker(near);
  }

  /** 近くの人は主人公の方を向く。離れたら元の向き（正面）に戻る（話しかけたときの向きは #talk で決める） */
  #gaze(): void {
    for (const obj of this.#map.objects) {
      if (obj.type !== 'npc') continue;
      const el = this.#objectEls.get(obj.id);
      if (!el) continue;
      const dx = this.#tile.x - obj.x;
      const dy = this.#tile.y - obj.y;
      const near = Math.max(Math.abs(dx), Math.abs(dy)) <= NPC_GAZE_RANGE;
      const dir: Direction = !near ? 'down' : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      if (el.dataset.face !== dir) this.#faceNpc(el, dir);
    }
  }

  /** となりの人には頭の上に「…」の吹き出し、調べられる物にはきらめき。敵には出さない */
  #showMarker(p: Point | null): void {
    const marker = this.#marker;
    if (!marker) return;
    const obj = p ? objectsAt(this.#map, p.x, p.y, this.#isVisible).find((o) => o.type !== 'warp' && o.type !== 'enemy') : undefined;
    if (!p || !obj) {
      marker.className = 'world__marker';
      return;
    }
    const talk = obj.type === 'npc';
    marker.className = `world__marker ${talk ? 'is-talk' : 'is-examine'}`;
    if (talk) {
      const f = this.#foot({ x: obj.x, y: obj.y + (obj.drawDy ?? 0) });
      marker.style.transform = `translate(${f.x}px, ${f.y - this.#figureH * 0.84}px)`;
      return;
    }
    // 物：家具などの範囲（w×h マス）の、横の真ん中・上のほうに
    const w = 'w' in obj ? obj.w : 1;
    const c = this.#cell;
    const f = this.#foot({ x: obj.x + (w - 1) / 2, y: obj.y });
    marker.style.transform = `translate(${f.x}px, ${f.y - c * 0.9}px)`;
  }

  /** 正面（なければ、となり）と足元を調べる */
  #examine(): void {
    if (this.#busy || this.#eventLock || this.#move) return;
    const d = DIR_DELTA[this.#dir];
    const front = { x: this.#tile.x + d.x, y: this.#tile.y + d.y };
    const npc = this.#nearNpc();
    if (npc) {
      this.#talkTo(npc);
      return;
    }
    const near = this.#nearTarget();
    if (near) {
      this.#dir = this.#dirTo(near);
      this.#diag = null;
      if (this.#interactAt(near.x, near.y)) return;
    }
    // 欠片：正式な絵の街ではマスが細かいので、まわり2マスまで
    const range = this.#map.art ? 2 : 0;
    for (const p of [this.#tile, front]) {
      const fragment = fragmentAt(this.#map.id, p.x, p.y, range);
      if (fragment) {
        const r = collectFragment(this.#store.save, fragment.id);
        if (r.collected) {
          this.#store.update(() => r.save);
          sound.play('fragment');
          this.#message(
            t('world.fragmentFound', { n: fragmentCount(r.save), total: FRAGMENT_TOTAL }),
            undefined,
            itemGetWindow(shardArt, t('world.fragmentItem', { n: fragmentCount(r.save), total: FRAGMENT_TOTAL })),
          );
          return;
        }
      }
    }
    this.#message(t('world.nothingHere'));
  }

  /** そのマスの物に話しかける・調べる。何かあれば true */
  #interactAt(x: number, y: number): boolean {
    const objects = objectsAt(this.#map, x, y, this.#isVisible);
    for (const obj of objects) {
      if (obj.type === 'enemy') {
        this.#encounter(obj);
        return true;
      }
      if (obj.type === 'chest') {
        this.#openChest(obj);
        return true;
      }
      if (obj.type === 'npc') {
        this.#talk(obj);
        return true;
      }
      if (obj.type === 'interact') {
        this.#action(obj.action, objectMessage(obj));
        return true;
      }
    }
    return false;
  }

  /* ---------- 会話・練習試合（序盤イベント。進み具合は src/game/story/intro.ts） ---------- */

  #talk(npc: NpcObject): void {
    // 話しかけられた人は主人公の方を向く
    const el = this.#objectEls.get(npc.id);
    if (el) {
      const dx = this.#tile.x - npc.x;
      const dy = this.#tile.y - npc.y;
      this.#faceNpc(el, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    }
    if (npc.npcId === 'neighbor_guide') this.#playScene(sceneOnTalk(this.#store.save));
    else if (npc.action && STAFF_GREETING[npc.npcId]) {
      // 店員・受付・研究員：顔の絵つきでひと言しゃべってから、その画面を開く（2026-10-23）
      const action = npc.action;
      this.#playScene(STAFF_GREETING[npc.npcId] as SceneId, () => this.#action(action));
    } else if (npc.action) this.#action(npc.action);
    else if (isResidentId(npc.npcId)) {
      // 住人：話しかけるたびに 2つの話を交互に（回数はアプリを開いている間だけ覚える）
      const count = WorldView.#talkCount.get(npc.id) ?? 0;
      WorldView.#talkCount.set(npc.id, count + 1);
      this.#playScene(residentScene(npc.npcId, count));
    }
  }

  /** 会話を出す。after は会話が終わったあと（練習試合を始めないとき）にすること */
  #playScene(id: SceneId, after?: () => void): void {
    this.#busy = true;
    this.#held = null;
    this.#path = [];
    this.#afterPath = null;
    const store = this.#store;
    playScene(this.#root, id, {
      onEffects: (effects) => store.update((s) => applySceneEffects(s, effects)),
      // 名刺図鑑：話した人を登録（2026-10-27）
      onSpeaker: (speaker) => store.update((s) => meetSpeaker(s, speaker)),
      onClose: (practice) => {
        if (this.#destroyed) return;
        // 案内役の場所・目的地の表示が変わることがあるので描き直す
        this.#build();
        this.#busy = false;
        if (practice) this.#startPractice(practice.tutorial);
        else after?.();
      },
    });
  }

  /* ---------- 導入イベントV2「プロのカードバトラーになる試験」（進み具合は src/game/story/introV2.ts） ---------- */

  get #v2(): IntroV2 {
    return this.#store.save.story.introV2;
  }

  /** 導入イベントV2の最中：自由に歩けない（スティック・調べる・メニューを出さない） */
  get #eventLock(): boolean {
    return !this.#dev && isIntroV2Active(this.#v2);
  }

  /** 【仮】チュートリアルスキップのボタンを出すか */
  get #showsSkip(): boolean {
    return !this.#dev && !isIntroV2Done(this.#v2);
  }

  /** 街に出す目的地の案内 */
  #introV2Goal(v: IntroV2, mapId: string): MessageKey | null {
    if (mapId !== 'town') return null;
    if (v.state === 'introGreeting' || v.state === 'escortToSchool') return 'introV2.goal.school';
    if (v.state === 'escortToBureau') return 'introV2.goal.bureau';
    return null;
  }

  /**
   * 場所に入ったとき：導入イベントV2の続きを決める（主人公を置き直す・幼馴染を出すのはここで、会話・歩きは返す関数で始める）。
   * 途中でアプリを閉じても、ここで続きから始まる。どれにも当てはまらない場所にいたら、決まった場所へ戻す
   */
  #introV2OnLoad(): (() => void) | null {
    const store = this.#store;
    if (isIntroV2Done(this.#v2)) return null;
    const mapId = this.#map.id;
    if (this.#v2.state === 'notStarted') return null;
    const v = this.#v2;
    const result = store.introV2Result;
    store.introV2Result = null;
    const inTown = mapId === 'town';
    switch (v.state) {
      case 'introGreeting':
      case 'escortToSchool':
        if (inTown) {
          this.#follower = this.#makeFollower(this.#escortRoute('door-practice', true)?.guide ?? this.#sideTile(1), 'up');
          this.#faceFollower();
          const walk = (): void => this.#escortTo('door-practice', true);
          return v.state === 'introGreeting' ? () => this.#playScene('v2Greeting', walk) : walk;
        }
        if (mapId === 'practice' && v.state === 'escortToSchool') return () => this.#walkToTeacher(() => this.#playScene('v2School', () => this.#startExam()));
        break;
      case 'schoolArrival':
        if (mapId === 'practice') {
          this.#placeBeforeTeacher();
          const scene: SceneId = result === 'lost' ? 'v2Retry' : v.examAttempts > 0 ? 'v2Resume' : 'v2School';
          return () => this.#playScene(scene, () => this.#startExam());
        }
        break;
      case 'examPassed':
        if (mapId === 'practice') {
          this.#placeBeforeTeacher();
          return () => this.#playScene('v2Pass', () => this.#walkOut('practice-exit'));
        }
        break;
      case 'escortToBureau':
        if (mapId === 'practice') return () => this.#walkOut('practice-exit');
        if (inTown) {
          this.#follower = this.#makeFollower(this.#escortRoute('door-bureau', true)?.guide ?? this.#sideTile(1), 'down');
          this.#faceFollower();
          return () => this.#escortTo('door-bureau', false);
        }
        if (mapId === 'bureau') return () => this.#walkToDesk(() => this.#playScene('v2Reception', () => this.#choosePack()));
        break;
      case 'bureauReception':
        if (mapId === 'bureau') return () => this.#walkToDesk(() => this.#playScene('v2Reception', () => this.#choosePack()));
        break;
      case 'packSelection':
        if (mapId === 'bureau') {
          this.#placeAt(BUREAU_DESK_FRONT, 'up');
          return () => this.#choosePack();
        }
        break;
      case 'packClaimed':
      case 'worldBriefing':
        if (mapId === 'bureau' && v.state === 'packClaimed') return () => this.#walkOut('bureau-exit');
        if (inTown) {
          this.#follower = this.#makeFollower(this.#sideTile(FOLLOW_LEAD), 'left');
          this.#faceFollower();
          return () =>
            this.#playScene('v2Briefing', () => {
              // 幼馴染は家に帰る（となりの家にいる）
              this.#follower = null;
              this.#build();
            });
        }
        break;
      default:
        break;
    }
    // 決まった場所に戻す（ふつうは起きない。古い記録・想定外の位置のとき）
    const anchor = introV2Anchor(this.#v2);
    if (anchor.mapId === mapId) return null;
    return () => {
      store.update((s) => ({ ...s, location: anchor }));
      this.#goTo(() => this.load());
    };
  }

  /** 上下左右だけの道（from を含まない） */
  #path4(from: Point, isGoal: (x: number, y: number) => boolean): Point[] | null {
    return findPathWhere(this.#map, from, isGoal, this.#blocked, 60000, STEPS_4);
  }

  /**
   * 入口（ワープ）までの道と、幼馴染の立つ所。幼馴染は主人公の FOLLOW_LEAD マス先を歩く（重なって見えないように）。
   * 歩き始める前は主人公の横（FOLLOW_LEAD マス）に立ち、目的地に近い側を選ぶ。歩いている途中（会話のあと）は今いるマスから
   */
  #escortRoute(warpId: string, placeGuide = false): { route: Point[]; guide: Point; lead: number } | null {
    const warp = this.#map.objects.find((o) => o.id === warpId);
    if (!warp || warp.type !== 'warp') return null;
    const inWarp = (x: number, y: number): boolean => x >= warp.x && x < warp.x + warp.w && y >= warp.y && y < warp.y + warp.h;
    const plan = (guide: Point): { route: Point[]; guide: Point; lead: number } | null => {
      const toGuide = guide.x === this.#tile.x && guide.y === this.#tile.y ? [] : this.#path4(this.#tile, (x, y) => x === guide.x && y === guide.y);
      const rest = this.#path4(guide, inWarp);
      if (!toGuide || !rest) return null;
      return { route: [...toGuide, ...rest], guide, lead: toGuide.length };
    };
    if (this.#follower) return plan(this.#follower.tile);
    if (!placeGuide) {
      const path = this.#path4(this.#tile, inWarp);
      return path ? { route: path, guide: this.#tile, lead: 1 } : null;
    }
    let best: { route: Point[]; guide: Point; lead: number } | null = null;
    for (const d of [DIR_DELTA.left, DIR_DELTA.right, DIR_DELTA.up, DIR_DELTA.down]) {
      const side = this.#freeLine(d, FOLLOW_LEAD);
      const p = side ? plan(side) : null;
      if (p && (!best || p.route.length < best.route.length)) best = p;
    }
    if (best) return best;
    // 横に場所がなければ、道の先に立つ
    const path = this.#path4(this.#tile, inWarp);
    if (!path || path.length === 0) return null;
    const lead = Math.min(FOLLOW_LEAD, path.length);
    return { route: path, guide: path[lead - 1] as Point, lead };
  }

  /** 主人公から d の向きに n マス、どれも歩けるなら n マス先（なければ null） */
  #freeLine(d: Point, n: number): Point | null {
    for (let k = 1; k <= n; k += 1) if (this.#blocked(this.#tile.x + d.x * k, this.#tile.y + d.y * k)) return null;
    return { x: this.#tile.x + d.x * n, y: this.#tile.y + d.y * n };
  }

  /** 自動で道を歩く。終わったら（または進めなくなったら）done */
  #autoWalk(path: readonly Point[], done: () => void): void {
    this.#busy = false;
    this.#held = null;
    this.#keys.clear();
    this.#running = false;
    this.#afterPath = null;
    this.#path = [...path];
    this.#pathDone = done;
    if (path.length === 0) this.#finishPath();
  }

  #finishPath(): void {
    const done = this.#pathDone;
    this.#pathDone = null;
    this.#path = [];
    done?.();
  }

  /** 幼馴染と一緒に、建物の入口まで歩く（入口を踏むと #arrive が中へ入れる）。道が無ければ暗転して入口の中へ */
  #escortTo(warpId: string, talk: boolean): void {
    const plan = this.#escortRoute(warpId);
    const path = plan?.route ?? null;
    this.#followLead = plan?.lead ?? 1;
    const warp = this.#map.objects.find((o) => o.id === warpId);
    const fallback = (): void => {
      if (!warp || warp.type !== 'warp' || warp.target.kind !== 'map') return;
      const target = warp.target;
      this.#store.flashMessage = t('introV2.walkFail');
      this.#store.update((s) => ({ ...s, location: { mapId: target.mapId, x: target.x, y: target.y, dir: target.dir } }));
      this.#goTo(() => this.load());
    };
    if (!path || path.length === 0) {
      fallback();
      return;
    }
    // S02：道の半分くらいで幼馴染が話す（1回だけ）
    this.#walkTalk = talk ? { at: Math.floor(path.length / 2), resume: () => this.#playScene('v2Walk', () => this.#escortTo(warpId, false)) } : null;
    // 入口を踏めば場所が変わる（load がこの続きを決める）。ここに来たら入口に着けなかった
    this.#autoWalk(path, fallback);
  }

  /** 部屋の出口まで歩く */
  #walkOut(warpId: string): void {
    this.#escortTo(warpId, false);
  }

  /** 教習所の先生の前のマス（話せる近さで、入口からいちばん近い所）まで */
  #teacherFrontPath(): Point[] | null {
    const teacher = this.#map.objects.find((o) => o.type === 'npc' && o.npcId === 'teacher');
    if (!teacher) return null;
    const near = (x: number, y: number): boolean => Math.max(Math.abs(teacher.x - x), Math.abs(teacher.y - y)) <= NPC_TALK_RANGE && x === teacher.x;
    return findPathWhere(this.#map, this.#tile, near, this.#blocked, 40000, STEPS_4) ?? findPathWhere(this.#map, this.#tile, (x, y) => Math.max(Math.abs(teacher.x - x), Math.abs(teacher.y - y)) <= NPC_TALK_RANGE, this.#blocked, 40000, STEPS_4);
  }

  #walkToTeacher(done: () => void): void {
    const path = this.#teacherFrontPath();
    this.#autoWalk(path ?? [], () => {
      this.#faceTeacher();
      done();
    });
  }

  /** 先生の前に立たせる（試験のあと・途中で閉じたあと） */
  #placeBeforeTeacher(): void {
    const entry = this.#map.spawn;
    const save = { ...this.#tile };
    this.#tile = { x: entry.x, y: entry.y };
    const path = this.#teacherFrontPath();
    const last = path?.[path.length - 1];
    this.#tile = save;
    if (last) this.#placeAt(last, 'up');
    this.#faceTeacher();
  }

  #faceTeacher(): void {
    const teacher = this.#map.objects.find((o): o is NpcObject => o.type === 'npc' && o.npcId === 'teacher');
    if (!teacher) return;
    this.#dir = this.#dirTo(teacher);
    this.#diag = null;
    const el = this.#objectEls.get(teacher.id);
    if (el) this.#faceNpc(el, 'down');
  }

  /** 管理局（仮）の受付の前まで */
  #walkToDesk(done: () => void): void {
    const path = findPathWhere(this.#map, this.#tile, (x, y) => x === BUREAU_DESK_FRONT.x && y === BUREAU_DESK_FRONT.y, this.#blocked, 4000, STEPS_4);
    this.#autoWalk(path ?? [], () => {
      if (this.#tile.x !== BUREAU_DESK_FRONT.x || this.#tile.y !== BUREAU_DESK_FRONT.y) this.#placeAt(BUREAU_DESK_FRONT, 'up');
      this.#dir = 'up';
      this.#diag = null;
      done();
    });
  }

  /** 主人公をそのマスに置く（位置も保存する） */
  #placeAt(p: Point, dir: Direction): void {
    this.#tile = { x: p.x, y: p.y };
    this.#pos = { ...this.#tile };
    this.#move = null;
    this.#dir = dir;
    this.#diag = null;
    this.#cam = null;
    const loc: Location = { mapId: this.#map.id, x: p.x, y: p.y, dir };
    this.#store.update((s) => ({ ...s, location: loc }));
  }

  /** 主人公の横 n マスの歩けるマス（幼馴染を立たせる。無ければもっと近く） */
  #sideTile(n: number): Point {
    for (let k = n; k >= 1; k -= 1) {
      for (const d of [DIR_DELTA.right, DIR_DELTA.left, DIR_DELTA.down, DIR_DELTA.up]) {
        const p = this.#freeLine(d, k);
        if (p) return p;
      }
    }
    return { ...this.#tile };
  }

  /** 試験の対戦（先生が相手。勝つまで再挑戦。負けるたびに先生のライフを少なくする：救済。ふつうの練習試合とは別の対戦） */
  #startExam(): void {
    const store = this.#store;
    if (!isDeckValid(store.save.deck, store.save.collection)) {
      this.#message(t('world.deckInvalidBattle'));
      return;
    }
    this.#busy = true;
    const ctx = this.#ctx;
    store.update(beginExam);
    const attempt = store.save.story.introV2.examAttempts;
    store.pendingBattle = {
      title: t('introV2.exam.title'),
      opponent: { ...EXAM_OPPONENT, lifeScale: examLifeScale(attempt) },
      // 試験は降参できない（負けても先生の前から再挑戦）
      allowSurrender: false,
      background: practiceBattleBg,
      backgroundVivid: true,
      tutorial: true,
      hintSet: 'introV2',
      eventBattleId: 'introV2-exam',
      onFinish: (winner) => {
        store.update((s) => finishExam(s, winner === 'player'));
        store.introV2Result = winner === 'player' ? 'won' : 'lost';
        ctx.reset('world');
      },
    };
    ctx.navigate('battle');
  }

  /**
   * 受付でブースターパックを3つから1つ選ぶ（2026-10-27 指示書「BoosterPack_Claude_Request」）。
   * 3箱を横に並べ、1回目のタップで仮に選ぶ（指が箱の上に出て、幼馴染が特徴をひと言）。同じ箱をもう一度タップすると決定（別の確認の窓は出さない）。
   * 別の箱をタップしたら、その箱の1回目に切り替わるだけ。説明が見えてから少しのあいだは同じ箱のタップを決定にしない（連打で決まらない）。
   * 決まったら1回だけ受け取り（claimBooster。ID で1回だけ）→ 受付のお礼 → 外へ
   */
  #choosePack(): void {
    this.#busy = true;
    // 受け取りの ID は画面を開いたときに作る（連打・二重の処理でも1回だけ）
    const tx = newId('introV2-booster');
    let state = INITIAL_BOOSTER_SELECT;
    const finger = h('img', { class: 'booster-select__finger', attrs: { src: pointerFingerArt, alt: '', draggable: 'false', 'aria-hidden': 'true' } });
    finger.hidden = true;
    const talkText = h('p', { class: 'booster-select__text', attrs: { 'aria-live': 'polite' } });
    const talkSub = h('p', { class: 'booster-select__sub' });
    const talkFace = h('img', { class: 'booster-select__face', attrs: { src: guideTalkSmile, alt: '', draggable: 'false' } });
    const talkName = h('span', { class: 'booster-select__name', text: npcName('neighbor_guide') });
    const talk = h('div', { class: 'booster-select__talk' }, talkFace, h('div', { class: 'booster-select__talk-body' }, talkName, talkText, talkSub));
    const boxes = BOOSTERS.map((b) =>
      h(
        'button',
        { class: 'booster-select__box', attrs: { type: 'button', 'aria-label': boosterName(b.key), 'aria-pressed': 'false' }, dataset: { pack: b.key }, on: { click: () => tap(b.key) } },
        h('img', { class: 'booster-select__art', attrs: { src: boosterArtUrl(b), alt: '', draggable: 'false' } }),
      ),
    );
    const row = h('div', { class: 'booster-select__row' }, ...boxes, finger);
    const show = (): void => {
      for (const el of boxes) {
        const on = el.dataset.pack === state.selected;
        el.classList.toggle('is-selected', on);
        el.setAttribute('aria-pressed', String(on));
      }
      const box = boxes.find((el) => el.dataset.pack === state.selected);
      finger.hidden = !box;
      if (box) finger.style.left = `${box.offsetLeft + box.offsetWidth / 2}px`;
      // 初めは案内だけ（顔なし）。選んだら幼馴染の顔とひと言
      const selected = state.selected;
      talk.classList.toggle('is-guide', selected !== null);
      talkText.textContent = selected ? t(`introV2.pack.guide.${selected.slice(-1)}` as MessageKey) : t('introV2.pack.hint');
      talkSub.textContent = selected ? t('introV2.pack.again') : '';
    };
    const tap = (key: BoosterKey): void => {
      const before = state;
      state = tapBooster(state, key, performance.now(), BOOSTER_CONFIRM_DELAY_MS);
      if (state === before) return;
      if (state.decided) decide(state.decided);
      else {
        sound.tap();
        show();
      }
    };
    const decide = (key: BoosterKey): void => {
      for (const el of boxes) el.disabled = true;
      view.classList.add('is-decided');
      this.#store.update((s) => claimBooster(s, key, tx));
      sound.play('reward');
      setTimeout(() => {
        view.remove();
        this.#playScene('v2Thanks', () => this.#walkOut('bureau-exit'));
      }, BOOSTER_DECIDED_MS);
    };
    const view = h(
      'div',
      { class: 'booster-select', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': t('introV2.pack.title') } },
      h('h2', { class: 'booster-select__title', text: t('introV2.pack.title') }),
      row,
      talk,
      h('p', { class: 'booster-select__note', text: t('introV2.pack.temp') }),
    );
    this.#root.append(view);
    show();
  }

  /** 【仮】チュートリアルスキップ（確かめてから。試験・パックの受け取りはしない） */
  #confirmSkipIntroV2(): void {
    const wasBusy = this.#busy;
    this.#busy = true;
    confirmModal(
      this.#root,
      t('introV2.skip.title'),
      [h('p', { class: 'modal__text', text: t('introV2.skip.text') })],
      () => {
        this.#store.update(skipIntroV2);
        this.#follower = null;
        this.#path = [];
        this.#pathDone = null;
        this.#walkTalk = null;
        this.#build();
        this.#busy = false;
      },
      () => {
        if (isIntroV2Done(this.#v2)) return;
        this.#busy = wasBusy;
      },
    );
  }

  /* ---------- 一緒に歩く幼馴染 ---------- */

  #makeFollower(tile: Point, dir: Direction): Follower {
    const body = h('div', { class: 'world__npc-body' });
    const el = h('div', { class: 'world__npc world__follower', dataset: { npc: 'neighbor_guide' }, attrs: { 'aria-label': npcName('neighbor_guide') } }, body);
    this.#sizeFigure(el);
    this.#addShadow(el);
    body.style.backgroundImage = `url("${NPC_SHEET.neighbor_guide}")`;
    body.style.transformOrigin = el.style.transformOrigin;
    this.#faceNpc(el, dir);
    this.#mapLayer.append(el);
    const f: Follower = { el, tile: { ...tile }, from: { ...tile }, to: { ...tile }, dir };
    this.#placeFigure(el, tile);
    return f;
  }

  /** 幼馴染と主人公を向かい合わせる（声をかけるとき・案内のとき） */
  #faceFollower(): void {
    const f = this.#follower;
    if (!f) return;
    this.#dir = this.#dirTo(f.tile);
    this.#diag = null;
    const dx = this.#tile.x - f.tile.x;
    const dy = this.#tile.y - f.tile.y;
    f.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.#faceNpc(f.el, f.dir);
  }

  /** 主人公が1歩進み終えたとき：幼馴染も次のマスに着く（入口に入ったら消える） */
  #followerArrive(): void {
    const f = this.#follower;
    if (!f) return;
    if (!f.to) {
      f.el.remove();
      this.#shadows.get(f.el)?.remove();
      this.#shadows.delete(f.el);
      this.#follower = null;
      return;
    }
    f.tile = { ...f.to };
    f.from = { ...f.to };
  }

  #renderFollower(): void {
    const f = this.#follower;
    if (!f) return;
    const mv = this.#move;
    const to = f.to;
    const moving = mv !== null && to !== null && (to.x !== f.from.x || to.y !== f.from.y);
    const p = moving && to ? { x: f.from.x + (to.x - f.from.x) * mv.t, y: f.from.y + (to.y - f.from.y) * mv.t } : f.tile;
    if (moving && to) {
      const dir: Direction = to.x !== f.from.x ? (to.x > f.from.x ? 'right' : 'left') : to.y > f.from.y ? 'down' : 'up';
      f.dir = dir;
      // 歩きの4コマ（左足・立つ・右足・立つ）
      const col = Math.floor(this.#phase * 2) % 4;
      const w = parseFloat(f.el.style.width);
      const hgt = parseFloat(f.el.style.height);
      const body = f.el.firstElementChild as HTMLElement | null;
      if (body) body.style.backgroundPosition = `${-col * w}px ${-DIR_ROW[dir] * hgt}px`;
      f.el.dataset.face = dir;
    } else if (mv === null && f.el.dataset.walk !== 'idle') {
      this.#faceNpc(f.el, f.dir);
    }
    f.el.dataset.walk = moving ? 'walk' : 'idle';
    f.el.classList.toggle('is-leaving', mv !== null && to === null);
    this.#placeFigure(f.el, p);
  }

  /** 練習試合（報酬・戦績なし。勝ち負けで進行は止まらない） */
  #startPractice(tutorial: boolean): void {
    const store = this.#store;
    const opponent = ENCOUNTERS['enc-practice'];
    if (!opponent) return;
    if (!isDeckValid(store.save.deck, store.save.collection)) {
      this.#message(t('world.deckInvalidBattle'));
      return;
    }
    this.#busy = true;
    const ctx = this.#ctx;
    store.update((s) => startPractice(s, tutorial));
    // 案内役のいる所で始めたら、終わったあとに案内役が話す
    const withGuide = this.#map.objects.some((o) => o.type === 'npc' && o.npcId === 'neighbor_guide' && this.#isVisible(o));
    store.pendingBattle = {
      title: t('story.practice.title'),
      opponent,
      allowSurrender: true,
      // 練習場の対戦の机（2026-10-26 デザイン第9弾）
      background: practiceBattleBg,
      backgroundVivid: true,
      tutorial: tutorial && store.save.story.intro !== 'completed',
      onFinish: (winner) => {
        store.practiceResult = { winner, tutorial, withGuide };
        ctx.reset('world');
      },
    };
    ctx.navigate('battle');
  }

  #action(action: string, message?: string): void {
    const nav = this.#ctx.navigate;
    switch (action) {
      case 'deck': return nav('deck');
      case 'dungeonSelect': return nav('dungeonSelect');
      case 'collection': return nav('collection');
      case 'peopleBook': return nav('peopleBook');
      case 'settings': return nav('settings');
      case 'shopClerk': return nav('shopMenu');
      case 'gacha': return nav('gacha');
      case 'tournamentDesk': return nav('tournament');
      case 'practiceTable': return this.#playScene(sceneOnTable(this.#store.save));
      case 'bureauDesk': return this.#playScene('v2BureauAfter');
      default: this.#message(message ?? '');
    }
  }

  #openChest(chest: ChestObject): void {
    const r = openChest(this.#store.save, chest);
    if (!r.opened) {
      this.#message(t('world.chestAlreadyEmpty'));
      return;
    }
    this.#store.update(() => r.save);
    const el = this.#objectEls.get(chest.id);
    if (el) {
      // 開く動き（4コマ）。最後のコマ（開いたあと）で止める
      el.classList.add('is-open');
      for (const [i, frame] of CHEST_ART[chest.look].opening.entries()) {
        setTimeout(() => (el.style.backgroundImage = `url("${frame}")`), i * CHEST_FRAME_MS);
      }
    }
    const parts: string[] = [];
    if (chest.reward.coins > 0) parts.push(coins(chest.reward.coins));
    for (const c of chest.reward.cards) parts.push(t(c.cardId.startsWith('skl') ? 'world.chestCardSkill' : 'world.chestCardMonster', { n: c.count }));
    // 鍵を開ける → ふたが開く（木の箱はきしむ音、鉄・金の箱は重い扉の音） → ごほうび（お金が入っていればお金の音も）
    sound.play('chestUnlock');
    sound.play(chest.look === 'wood' ? 'chestOpenWood' : 'chestOpenIron', 280);
    sound.play('reward', 750);
    if (chest.reward.coins > 0) sound.play('coins', 950);
    // 手に入れたときの小窓（2026-10-26 デザイン第10弾）：カードが入っていればカードの束、お金だけなら袋の絵を台座に
    const icon = chest.reward.cards.length > 0 ? cardBundleArt : prizePouchArt;
    this.#message(t('world.chestOpened', { items: parts.join(t('world.rewardSeparator')) }), undefined, itemGetWindow(icon, parts.join(t('world.rewardSeparator'))));
  }

  #encounter(enemy: EnemyObject): void {
    if (this.#busy) return;
    const opponent = ENCOUNTERS[enemy.encounterId];
    if (!opponent) return;
    const store = this.#store;
    if (!isDeckValid(store.save.deck, store.save.collection)) {
      this.#message(t('world.deckInvalidBattle'));
      return;
    }
    this.#busy = true;
    this.#held = null;
    this.#path = [];
    const ctx = this.#ctx;
    const names = opponent.monsters.map((m) => cardName(getMonster(m))).join(t('common.listSeparator'));
    store.pendingBattle = {
      title: enemy.boss ? t('world.bossBattle') : t('world.dungeonBattle'),
      opponent,
      allowSurrender: true,
      bgm: enemy.boss ? 'bossBattle' : 'battle',
      // ボスとの対戦はボス戦の背景（2026-10-26 デザイン第11弾）
      ...(enemy.boss ? { background: bossBattleBg } : DUNGEON_BATTLE_BG[this.#map.id] ? { background: DUNGEON_BATTLE_BG[this.#map.id] } : {}),
      onFinish: (winner) => {
        if (winner === 'player') {
          const r = defeatEnemy(store.save, enemy.id, enemy.boss);
          store.update((s) => ({ ...r.save, stats: { ...s.stats, battlesWon: s.stats.battlesWon + 1 } }));
          if (r.cleared) {
            store.update((s) => leaveDungeon(s));
            store.flashBanner = 'clear';
            store.flashMessage = t(r.firstClear ? 'world.dungeonClearedFirst' : 'world.dungeonCleared', { coins: coins(r.coins) });
            // ボスを初めて倒したときのカード（2026-10-26：仮のジオル・フルーネ）
            if (r.cards.length > 0) {
              const names = r.cards.map((c) => t('tournament.prizeCard', { name: cardName(c.cardId), n: c.count })).join(t('common.listSeparator'));
              store.flashMessage += `\n${t('world.bossCards', { cards: names })}`;
            }
          } else {
            store.flashMessage = t('world.victory', { coins: coins(r.coins) });
          }
        } else {
          store.update((s) => ({ ...leaveDungeon(s), stats: { ...s.stats, battlesLost: s.stats.battlesLost + 1 } }));
          store.flashMessage = t('world.defeat');
        }
        ctx.reset('world');
      },
    };
    this.#message(t('world.encounter', { name: opponentName(opponent), monsters: names }), () => {
      this.#busy = true;
      this.#encounterFlash(() => ctx.navigate('battle'));
    });
  }

  /** いまのダンジョンの足音・環境音 */
  #dungeonSound(): { readonly ground: StepSurface; readonly ambient: AmbientId | null } {
    const id = this.#store.save.activeDungeon?.dungeonId;
    return (id ? DUNGEON_SOUND[id] : undefined) ?? DEFAULT_DUNGEON_SOUND;
  }

  /** 立っている所の地面（足音の種類）。街は石畳、南の出口への道だけ土 */
  #ground(): StepSurface {
    const map = this.#map;
    if (map.area === 'dungeon') return this.#dungeonSound().ground;
    if (map.area === 'interior') return ROOM_GROUND[map.id] ?? 'wood';
    return map.id === 'town' && this.#tile.y >= TOWN_DIRT_FROM_Y ? 'dirt' : 'stone';
  }

  #confirmLeave(): void {
    this.#busy = true;
    confirmModal(
      this.#root,
      t('world.leaveTitle'),
      [h('p', { class: 'modal__text', text: t('world.leaveText') })],
      () => {
        sound.play('gateClose');
        this.#store.update((s) => leaveDungeon(s));
        this.load();
      },
      () => {
        this.#busy = false;
      },
      'warn',
    );
  }

  /**
   * クリアの報酬を受け取る場面（2026-10-27 デザイン33点の 12・13）：遺跡の最奥の祭壇の絵を画面いっぱいに出し、祭壇の上にカードを立てる
   * （2枚なら左右、1枚なら真ん中）。初めてのクリアは、ボスのカードに「初回クリア」の封蝋を付ける。お知らせを閉じると消す
   */
  #clearScene(clear: { readonly cards: readonly string[]; readonly firstClear: boolean }): HTMLElement {
    const cards = clear.cards.map((id, i) => {
      const def = cardCatalog.get(id);
      return def
        ? h(
            'div',
            { class: 'world__clear-card' },
            createCardView(def, 104, false),
            clear.firstClear && i === 0 && clear.cards.length > 1 ? h('img', { class: 'world__clear-seal', attrs: { src: firstClearSealArt, alt: '', draggable: 'false' } }) : null,
          )
        : null;
    });
    const el = h(
      'div',
      { class: 'world__clear-scene', attrs: { 'aria-hidden': 'true' } },
      h('img', { class: 'world__clear-bg', attrs: { src: clearSceneArt, alt: '', draggable: 'false' } }),
      h('div', { class: 'world__clear-altar' }, ...cards),
    );
    this.#root.append(el);
    return el;
  }

  #message(text: string, onClose?: () => void, visual?: HTMLElement): void {
    this.#busy = true;
    this.#held = null;
    messageModal(
      this.#root,
      text,
      () => {
        this.#busy = false;
        onClose?.();
      },
      undefined,
      visual,
    );
  }

  #menu(): void {
    const save = this.#store.save;
    const deckOk = isDeckValid(save.deck, save.collection);
    const fragments = fragmentCount(save);
    this.#busy = true;
    const handle = openModal(this.#root, {
      title: t('world.menu'),
      body: [
        h('p', { class: 'modal__text', text: t('world.menuStatus', { rank: save.rank, coins: coins(save.coins) }) }),
        h('p', { class: 'modal__text', text: t(deckOk ? 'world.menuDeckOk' : 'world.menuDeckNg') }),
        fragments > 0 ? h('p', { class: 'modal__text', text: t('world.menuFragments', { n: fragments, total: FRAGMENT_TOTAL }) }) : null,
        h('p', { class: 'modal__text modal__text--sub', text: t(this.#store.lastSaveOk ? 'world.autoSave' : 'world.autoSaveFailed') }),
      ],
      actions: [
        { label: t('common.toTitle'), onTap: () => { handle.close(); this.#ctx.reset('title'); } },
        { label: t('common.close'), primary: true, onTap: () => handle.close() },
      ],
      onClose: () => {
        this.#busy = false;
      },
    });
  }
}
