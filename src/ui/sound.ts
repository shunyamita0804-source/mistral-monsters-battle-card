import cardDealSwishMp3 from '@assets/audio/se/card_deal/swish.mp3';
import cardFlipMp3 from '@assets/audio/se/card_flip.mp3';
import cardSlideMp3 from '@assets/audio/se/card_slide.mp3';
import cardRevealMp3 from '@assets/audio/se/card_reveal.mp3';
import turnOrderOgg from '@assets/audio/se/turn_order_select.ogg';
import turnOrderM4a from '@assets/audio/se/turn_order_select.m4a';
import manaGainOgg from '@assets/audio/se/mana_gain.ogg';
import manaGainM4a from '@assets/audio/se/mana_gain.m4a';
import manaVanishMp3 from '@assets/audio/se/mana_vanish.mp3';
import lifeTickMp3 from '@assets/audio/se/life_tick.mp3';
import evadeMp3 from '@assets/audio/se/evade_success.mp3';
import hitBlowMp3 from '@assets/audio/se/hit_blow.mp3';
import hitSuperMp3 from '@assets/audio/se/hit_super.mp3';
import manaSpendMp3 from '@assets/audio/se/mana_spend.mp3';
import cardAttackMp3 from '@assets/audio/se/card_attack.mp3';
import cardGuardMp3 from '@assets/audio/se/card_guard.mp3';
import cardSpecialMp3 from '@assets/audio/se/card_special.mp3';
import cardSupportMp3 from '@assets/audio/se/card_support.mp3';
import cardEvadeMp3 from '@assets/audio/se/card_evade.mp3';
import knockoutMp3 from '@assets/audio/se/knockout.mp3';
import healMp3 from '@assets/audio/se/heal.mp3';
import cardWisdomMp3 from '@assets/audio/se/card_wisdom.mp3';
import cardSealMp3 from '@assets/audio/se/card_seal.mp3';
import recoilMp3 from '@assets/audio/se/recoil.mp3';
import battleStartMp3 from '@assets/audio/se/battle_start.mp3';
import battleWinMp3 from '@assets/audio/se/battle_win.mp3';
import battleLoseMp3 from '@assets/audio/se/battle_lose.mp3';
import packOpenMp3 from '@assets/audio/se/pack_open.mp3';
import rewardMp3 from '@assets/audio/se/reward.mp3';
import fragmentMp3 from '@assets/audio/se/fragment.mp3';
import doorOpenMp3 from '@assets/audio/se/door_open.mp3';
import doorCloseMp3 from '@assets/audio/se/door_close.mp3';
import gateOpenMp3 from '@assets/audio/se/gate_open.mp3';
import gateCloseMp3 from '@assets/audio/se/gate_close.mp3';
import stairsMp3 from '@assets/audio/se/stairs.mp3';
import chestUnlockMp3 from '@assets/audio/se/chest_unlock.mp3';
import chestOpenWoodMp3 from '@assets/audio/se/chest_open_wood.mp3';
import chestOpenIronMp3 from '@assets/audio/se/chest_open_iron.mp3';
import registerMp3 from '@assets/audio/se/register.mp3';
import coinsMp3 from '@assets/audio/se/coins.mp3';
import dripMp3 from '@assets/audio/se/drip.mp3';
import autoDoorMp3 from '@assets/audio/se/auto_door.mp3';
import underwaterLoopMp3 from '@assets/audio/se/underwater_loop.mp3';
import uiTapMp3 from '@assets/audio/se/ui/ui_tap.mp3';
import uiDecideMp3 from '@assets/audio/se/ui/ui_decide.mp3';
import uiCancelMp3 from '@assets/audio/se/ui/ui_cancel.mp3';
import uiDisabledMp3 from '@assets/audio/se/ui/ui_disabled.mp3';

/**
 * 効果音（SE）。
 *
 * - 素材の差し替えは SE_REGISTRY を書き換えるだけ（音の出どころは docs/audio-credits.md）
 * - Web Audio（AudioContext）で鳴らす。iPhone Safari は最初のタップまで音を出せないため、
 *   最初の pointerdown で AudioContext を再開してから読み込む
 * - 同じ音を短い間隔で何度でも重ねて鳴らせる（カードを1枚ずつ配る音）
 * - 音が鳴らせない環境では何もしない（ゲームは止めない）
 * - 設定の効果音の音量（0〜1）を SE_REGISTRY の gain に掛ける。0（ミュート含む）なら鳴らさない
 */
export type SoundId =
  | 'cardDraw'
  | 'cardFlip'
  | 'cardSlide'
  | 'cardReveal'
  | 'turnOrderSelect'
  | 'manaGain'
  | 'manaVanish'
  | 'lifeTick'
  | 'evade'
  | 'hitNormal'
  | 'hitStrong'
  | 'manaSpend'
  | 'cardAttack'
  | 'cardGuard'
  | 'cardSpecial'
  | 'cardSupport'
  | 'cardEvade'
  | 'knockout'
  | 'heal'
  | 'cardWisdom'
  | 'cardSeal'
  | 'recoil'
  | 'battleStart'
  | 'battleWin'
  | 'battleLose'
  | 'packOpen'
  | 'reward'
  | 'fragment'
  | 'doorOpen'
  | 'doorClose'
  | 'gateOpen'
  | 'gateClose'
  | 'stairs'
  | 'chestUnlock'
  | 'chestOpenWood'
  | 'chestOpenIron'
  | 'register'
  | 'coins'
  | 'drip'
  | 'ironDoorOpen'
  | 'autoDoor'
  | 'uiTap'
  | 'uiDecide'
  | 'uiCancel'
  | 'uiDisabled';

/**
 * 足音の地面の種類（2026-10-23。ユーザー提供の「〇〇の上を走る」から1歩ぶんずつ切り出した音。tools/audio/world_se_build.py）。
 * 石＝街の石畳・大会会場、土＝街の南の出口への道、板＝建物の中、砂利＝洞窟のダンジョン。ほかはこれからのダンジョン用
 */
export type StepSurface = 'stone' | 'grass' | 'wood' | 'gravel' | 'dirt' | 'sand' | 'snow' | 'wet';

/**
 * ダンジョンの環境音（2026-10-23）。入った直後から、BGM の上に小さく重ねる。
 * - drip：洞窟の水滴（間をあけて、ときどき1滴）
 * - underwater：水の中のこもった音（切れ目なく繰り返す）＋水滴。水のダンジョン用（いまは使う場所なし）
 */
export type AmbientId = 'drip' | 'underwater';

type SoundEntry = (
  | {
      /** OGG（Chrome・Firefox など）と M4A（iPhone Safari など）。再生できる方を使う */
      readonly ogg: string;
      readonly m4a: string;
    }
  /** MP3（どのブラウザでも鳴る。ユーザーが試聴して承認した音をそのまま使う） */
  | { readonly mp3: string }
) & {
  /** 音量（1 = 元のまま） */
  readonly gain: number;
};

/** ボタンの音の大きさ（2026-10-28 指示書「ほかの効果音より少し小さめ（耳につかないように）」。届いた音は大きめなので半分弱に） */
const UI_GAIN = 0.4;

/** カードを配る音の大きさ（届いた音は大きめなので、ほかの効果音とそろえる） */
const DEAL_GAIN = 0.45;

export const SE_REGISTRY: Readonly<Record<SoundId, SoundEntry>> = {
  // カードを引く・手札に配る（1枚ごとに1回）：2026-10-26 ユーザー提供の「Motion-Swish07-5」（利用確認済み。ユーザー指示「この1つで1枚に1度」）。
  // 前は効果音ラボ「カードを配る」から切り出した card_deal.mp3（ファイルは残している）
  cardDraw: { mp3: cardDealSwishMp3, gain: DEAL_GAIN },
  // 2026-10-26 ユーザー指示「SEも適切なもの探して」：Kenney「Casino Audio」（CC0・クレジット不要）から切り出した音
  // 配った手札が1枚ずつ表になる（パラパラ）：card-place-1
  cardFlip: { mp3: cardFlipMp3, gain: 0.8 },
  // 相手の使ったカードが裏向きのまま真ん中へ飛んでくる：card-shove-3
  cardSlide: { mp3: cardSlideMp3, gain: 0.9 },
  // 真ん中に来た相手のカードが表に返る：card-slide-3
  cardReveal: { mp3: cardRevealMp3, gain: 1.0 },
  // 先攻・後攻のカードを選んだ瞬間：ミストラルモンスターズ正式素材「分かれ道の選択」（15_branch_select）
  turnOrderSelect: { ogg: turnOrderOgg, m4a: turnOrderM4a, gain: 1.0 },
  // 山札からマナが増えた（手札5枚のときのドロー・カードの効果）：ミストラルモンスターズの GOLD_GET と同じ音（Mix of SFX by Ivokard「bell」・CC0）
  manaGain: { ogg: manaGainOgg, m4a: manaGainM4a, gain: 1.8 },
  // 手札のカードをマナにした（マナ化・1枚につき1回。カードが光って消える瞬間）：効果音ラボ「シャキーン1」（2026-10-24 ユーザーが候補から選んだ。
  // それまでの「カードがマナの欄に行くときの音」mana_convert はやめた）
  manaVanish: { mp3: manaVanishMp3, gain: 1.0 },
  // ダメージでライフが1減るごとに1回（何ダメージか音で分かるように）：効果音ラボ「カタカタ震える」の1粒（2026-10-24 ユーザー指示）
  lifeTick: { mp3: lifeTickMp3, gain: 1.2 },
  // 回避が成功してダメージ0が確定した：効果音ラボ「高速移動」（正式採用 2026-10-22）
  evade: { mp3: evadeMp3, gain: 1.0 },
  // 攻撃が命中した（通常）：効果音ラボ「打撃2」（2026-10-24 ユーザー指示「ダメージ与えた時のSEを変えて」。前は OtoLogic「Hit-Punch02-1(Dry)」）
  hitNormal: { mp3: hitBlowMp3, gain: 1.0 },
  // 攻撃が命中した（強攻撃。仮に必要マナ3以上の技）：効果音ラボ「必殺技ヒット」（同。前は効果音ラボ「大パンチ」）
  hitStrong: { mp3: hitSuperMp3, gain: 0.9 },
  // マナを支払った（技・サポート・守備のカードを使った）：効果音ラボ「ワープ」。マナ化（増える）では鳴らさない
  manaSpend: { mp3: manaSpendMp3, gain: 1.0 },
  // 2026-10-23 ユーザー提供の効果音（ZIP「Downloads」。ファイル名から効果音ラボの素材とみられる。docs/audio-credits.md）
  // 使ったカードを大きく見せるとき（種類ごと）・守備・倒れた・回復
  cardAttack: { mp3: cardAttackMp3, gain: 1.0 },
  cardGuard: { mp3: cardGuardMp3, gain: 0.7 },
  cardSpecial: { mp3: cardSpecialMp3, gain: 0.6 },
  cardSupport: { mp3: cardSupportMp3, gain: 0.6 },
  cardEvade: { mp3: cardEvadeMp3, gain: 1.2 },
  knockout: { mp3: knockoutMp3, gain: 0.8 },
  heal: { mp3: healMp3, gain: 0.6 },
  // 2026-10-23 追加（同じ ZIP。ユーザー「全て利用可・必要な所に使って」）
  cardWisdom: { mp3: cardWisdomMp3, gain: 0.7 },
  cardSeal: { mp3: cardSealMp3, gain: 0.7 },
  recoil: { mp3: recoilMp3, gain: 0.9 },
  battleStart: { mp3: battleStartMp3, gain: 1.0 },
  battleWin: { mp3: battleWinMp3, gain: 1.1 },
  battleLose: { mp3: battleLoseMp3, gain: 0.9 },
  packOpen: { mp3: packOpenMp3, gain: 1.0 },
  reward: { mp3: rewardMp3, gain: 0.7 },
  fragment: { mp3: fragmentMp3, gain: 1.0 },
  // 2026-10-23 ユーザー提供の効果音 第2弾（ZIP「Downloads 2」。利用確認済み。docs/audio-credits.md）
  // 建物に入る・出る（ドア）、ダンジョンに入る・出る（門・鉄の扉）、階段、宝箱（鍵→ふた）、買い物、お金、水滴
  doorOpen: { mp3: doorOpenMp3, gain: 0.8 },
  doorClose: { mp3: doorCloseMp3, gain: 0.9 },
  gateOpen: { mp3: gateOpenMp3, gain: 0.7 },
  gateClose: { mp3: gateCloseMp3, gain: 0.8 },
  stairs: { mp3: stairsMp3, gain: 0.9 },
  chestUnlock: { mp3: chestUnlockMp3, gain: 1.0 },
  chestOpenWood: { mp3: chestOpenWoodMp3, gain: 0.7 },
  chestOpenIron: { mp3: chestOpenIronMp3, gain: 0.6 },
  register: { mp3: registerMp3, gain: 0.7 },
  coins: { mp3: coinsMp3, gain: 0.9 },
  drip: { mp3: dripMp3, gain: 1.6 },
  // 2026-10-26 ユーザー提供（利用確認済み）。大会会場に出入りする＝鉄の扉を開ける（宝箱の鉄の箱と同じファイル）、
  // カードショップに出入りする＝自動ドア（録音が小さいので gain で大きく）
  ironDoorOpen: { mp3: chestOpenIronMp3, gain: 0.8 },
  autoDoor: { mp3: autoDoorMp3, gain: 4.0 },
  // 2026-10-28 ボタンの音（ZIP「Mistral_Name_CardList_UISound_20261028」。進行が合成した音。どのボタンに何を付けるかは src/ui/buttonSound.ts）
  // ふつうのボタン・メニュー・タブ・一覧の行／決める（決定・はい・買う・出発）／戻る・いいえ・閉じる／押せない（灰色の）ボタン
  uiTap: { mp3: uiTapMp3, gain: UI_GAIN },
  uiDecide: { mp3: uiDecideMp3, gain: UI_GAIN },
  uiCancel: { mp3: uiCancelMp3, gain: UI_GAIN },
  uiDisabled: { mp3: uiDisabledMp3, gain: UI_GAIN * 1.2 },
};

const STEP_FILES = import.meta.glob<string>('/assets/audio/se/steps/*.mp3', { eager: true, query: '?url', import: 'default' });
/** 地面ごとの1歩の音（4個ずつ。順に鳴らさず、毎回ちがうものを選ぶ） */
const STEP_URLS: Readonly<Record<string, readonly string[]>> = Object.entries(STEP_FILES)
  .sort(([a], [b]) => a.localeCompare(b))
  .reduce<Record<string, string[]>>((acc, [path, url]) => {
    const surface = /\/([a-z]+)_\d+\.mp3$/.exec(path)?.[1];
    if (surface) (acc[surface] ??= []).push(url);
    return acc;
  }, {});
/** 足音の音量。歩くと1秒に6歩ほど鳴るので、ほかの音よりずっと小さく */
const STEP_GAIN = { walk: 0.16, run: 0.24 } as const;
/** 水中のループの音量 */
const UNDERWATER_GAIN = 0.35;
/** 水滴の間（ミリ秒）。この範囲でばらばらに */
const DRIP_GAP_MS = [2200, 6500] as const;

type AudioContextCtor = typeof AudioContext;

interface AmbientState {
  readonly id: AmbientId;
  timer: number;
  loop: AudioBufferSourceNode | null;
  loopGain: GainNode | null;
}

class SoundPlayer {
  #ctx: AudioContext | null = null;
  /** 読み込んだ音（キーはファイルの URL） */
  #buffers = new Map<string, AudioBuffer>();
  #loading = new Map<string, Promise<void>>();
  #lastStep = '';
  #ambient: AmbientState | null = null;
  #unlockInstalled = false;
  /** 設定の効果音の音量（0〜1） */
  #volume = 1;
  #played = 0;

  setVolume(volume: number): void {
    this.#volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
    const loopGain = this.#ambient?.loopGain;
    if (loopGain) loopGain.gain.value = Math.max(0.0001, UNDERWATER_GAIN * this.#volume);
  }

  get volume(): number {
    return this.#volume;
  }

  /** 最初のタップで音を使えるようにする（何度呼んでもよい） */
  installUnlock(): void {
    if (this.#unlockInstalled || typeof window === 'undefined') return;
    this.#unlockInstalled = true;
    const unlock = (): void => {
      const ctx = this.#context();
      if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      this.preload();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
  }

  #context(): AudioContext | null {
    if (this.#ctx) return this.#ctx;
    if (typeof window === 'undefined') return null;
    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext) as
      | AudioContextCtor
      | undefined;
    if (!Ctor) return null;
    try {
      this.#ctx = new Ctor();
    } catch {
      this.#ctx = null;
    }
    return this.#ctx;
  }

  /** BGM（bgm.ts）も同じ AudioContext を使う（iPhone で最初のタップに1つだけ鳴らせる状態にするため） */
  audioContext(): AudioContext | null {
    return this.#context();
  }

  #source(entry: SoundEntry): string {
    if ('mp3' in entry) return entry.mp3;
    const probe = typeof document !== 'undefined' ? document.createElement('audio') : null;
    const ogg = probe?.canPlayType('audio/ogg; codecs="vorbis"') ?? '';
    return ogg !== '' ? entry.ogg : entry.m4a;
  }

  preload(): void {
    for (const id of Object.keys(SE_REGISTRY) as SoundId[]) void this.#load(this.#source(SE_REGISTRY[id]));
    for (const urls of Object.values(STEP_URLS)) for (const url of urls) void this.#load(url);
  }

  #load(url: string): Promise<void> {
    const existing = this.#loading.get(url);
    if (existing) return existing;
    const ctx = this.#context();
    if (!ctx) return Promise.resolve();
    const task = fetch(url)
      .then((r) => r.arrayBuffer())
      .then(
        (data) =>
          new Promise<AudioBuffer>((resolve, reject) => {
            // 古い Safari はコールバック形式のみ。Promise も返れば両方に備える
            const r = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined;
            if (r && typeof r.then === 'function') r.then(resolve, reject);
          }),
      )
      .then((buffer) => {
        this.#buffers.set(url, buffer);
      })
      .catch(() => {
        // 読み込めなければ無音のまま
      });
    this.#loading.set(url, task);
    return task;
  }

  /**
   * 押したことが分かる小さな音（2026-10-28 からボタンの音 ui_tap。前はその場で作った「コッ」）。
   * ボタンでない所（歩く画面で人を押した・ページをめくった など）や、選んだ状態にするだけのボタンで使う
   */
  tap(): void {
    this.play('uiTap');
  }

  /**
   * ガチャのハンドルを回すときの歯車の「カチッ」（2026-10-27）。素材ファイルを使わずその場で作る。
   * 金属の小さな爪が歯車にかかるような、高めで短い音。効果音の音量・ミュートに従う
   */
  ratchet(): void {
    this.#played += 1;
    if (this.#volume <= 0) return;
    const ctx = this.#context();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1900, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.025);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06 * this.#volume, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * これまでに play()・ratchet() で鳴らした回数。ボタンの音（buttonSound.ts）は、押したボタンがほかの効果音を鳴らしたときは鳴らさない（二重にしない）ために使う。
   * 足音・環境音は数えない
   */
  get playCount(): number {
    return this.#played;
  }

  /** delayMs 後に鳴らす（カードを1枚ずつ配るときの時間差に使う） */
  play(id: SoundId, delayMs = 0): void {
    this.#played += 1;
    // 自動の確認（tools/e2e）用：window.__seLog を用意したときだけ、鳴らした音の名前を記録する
    (globalThis as { __seLog?: string[] }).__seLog?.push(id);
    this.#playUrl(this.#source(SE_REGISTRY[id]), SE_REGISTRY[id].gain, delayMs);
  }

  /** カードを1枚配る・引く音（delayMs 後。1枚に1回） */
  deal(delayMs = 0): void {
    this.play('cardDraw', delayMs);
  }

  /** 足が地面に着いたときの1歩の音。前と同じ音が続かないように選ぶ */
  step(surface: StepSurface, running: boolean): void {
    const urls = STEP_URLS[surface];
    if (!urls || urls.length === 0) return;
    const choices = urls.length > 1 ? urls.filter((u) => u !== this.#lastStep) : urls;
    const url = choices[Math.floor(Math.random() * choices.length)] ?? urls[0]!;
    this.#lastStep = url;
    this.#playUrl(url, running ? STEP_GAIN.run : STEP_GAIN.walk, 0);
  }

  /** ダンジョンの環境音を始める（同じものが鳴っていれば何もしない）。null で止める */
  ambient(id: AmbientId | null): void {
    if (this.#ambient?.id === id) return;
    this.#stopAmbient();
    if (!id || typeof window === 'undefined') return;
    const state: AmbientState = { id, timer: 0, loop: null, loopGain: null };
    this.#ambient = state;
    // 水滴：入ってすぐ1滴、そのあとは間をあけてときどき
    const drip = (delay: number): void => {
      state.timer = window.setTimeout(() => {
        if (this.#ambient !== state) return;
        this.#playUrl(this.#source(SE_REGISTRY.drip), SE_REGISTRY.drip.gain * (0.55 + Math.random() * 0.45), 0);
        drip(DRIP_GAP_MS[0] + Math.random() * (DRIP_GAP_MS[1] - DRIP_GAP_MS[0]));
      }, delay);
    };
    drip(400);
    if (id === 'underwater') {
      void this.#load(underwaterLoopMp3).then(() => {
        const ctx = this.#context();
        const buffer = this.#buffers.get(underwaterLoopMp3);
        if (this.#ambient !== state || !ctx || !buffer || this.#volume <= 0) return;
        try {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(UNDERWATER_GAIN * this.#volume, ctx.currentTime + 1.2);
          source.connect(gain).connect(ctx.destination);
          source.start();
          state.loop = source;
          state.loopGain = gain;
        } catch {
          // 鳴らせなくてもゲームは続ける
        }
      });
    }
  }

  #stopAmbient(): void {
    const state = this.#ambient;
    this.#ambient = null;
    if (!state) return;
    clearTimeout(state.timer);
    const ctx = this.#ctx;
    if (state.loop && state.loopGain && ctx) {
      try {
        state.loopGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
        state.loop.stop(ctx.currentTime + 0.6);
      } catch {
        // すでに止まっている
      }
    }
  }

  #playUrl(url: string, gainValue: number, delayMs: number): void {
    if (this.#volume <= 0) return;
    const ctx = this.#context();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const buffer = this.#buffers.get(url);
    if (!buffer) {
      void this.#load(url);
      return;
    }
    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = gainValue * this.#volume;
      source.connect(gain).connect(ctx.destination);
      source.start(ctx.currentTime + Math.max(0, delayMs) / 1000);
    } catch {
      // 鳴らせなくてもゲームは続ける
    }
  }
}

export const sound = new SoundPlayer();
