import titleMp3 from '@assets/audio/bgm/bgm_title.mp3';
import townMp3 from '@assets/audio/bgm/bgm_town.mp3';
import tournamentMp3 from '@assets/audio/bgm/bgm_tournament.mp3';
import tournamentBattleMp3 from '@assets/audio/bgm/bgm_tournament_battle.mp3';
import dungeonMp3 from '@assets/audio/bgm/bgm_dungeon.mp3';
import battleMp3 from '@assets/audio/bgm/bgm_battle.mp3';
import bossBattleMp3 from '@assets/audio/bgm/bgm_boss_battle.mp3';
import dungeonRuinsMp3 from '@assets/audio/bgm/bgm_dungeon_ruins.mp3';
import dungeonForestMp3 from '@assets/audio/bgm/bgm_dungeon_forest.mp3';
import dungeonWaterMp3 from '@assets/audio/bgm/bgm_dungeon_water.mp3';
import dungeonIceMp3 from '@assets/audio/bgm/bgm_dungeon_ice.mp3';
import dungeonFireMp3 from '@assets/audio/bgm/bgm_dungeon_fire.mp3';
import dungeonMachineMp3 from '@assets/audio/bgm/bgm_dungeon_machine.mp3';
import dungeonHolyMp3 from '@assets/audio/bgm/bgm_dungeon_holy.mp3';
import shopMp3 from '@assets/audio/bgm/bgm_shop.mp3';
import practiceMp3 from '@assets/audio/bgm/bgm_practice.mp3';
import labMp3 from '@assets/audio/bgm/bgm_lab.mp3';
import homeMp3 from '@assets/audio/bgm/bgm_home.mp3';
import houseMp3 from '@assets/audio/bgm/bgm_house.mp3';
import neighborMp3 from '@assets/audio/bgm/bgm_neighbor.mp3';
import bureauMp3 from '@assets/audio/bgm/bgm_bureau.mp3';
import prologueMp3 from '@assets/audio/bgm/bgm_prologue.mp3';
import departureMp3 from '@assets/audio/bgm/bgm_departure.mp3';
import { sound } from './sound.ts';

/**
 * BGM。曲はミストラルモンスターズで使っている曲（ユーザー指示 2026-10-22）と、2026-10-26 にユーザーが届けたユーフルカの4曲（街・対戦・ボス・大会の対戦）。
 * 規約はどちらもユーザー確認済み。出どころは docs/audio-credits.md。
 *
 * - ファイルは「ループする範囲だけを切り出し、終わりを頭へつないだ」MP3（tools/audio/make_bgm_loops.py・make_bgm_loops_wingless.py）。audio の loop で繰り返す
 * - 音量は Web Audio のゲイン（iPhone は audio の volume を変えられないため）。効果音と同じ AudioContext を使う
 * - ブラウザは最初のタップまで音を出せないので、それまでは「鳴らしたい曲」だけ覚えておき、最初のタップで鳴らし始める
 * - 曲を替えるときは前の曲を少しずつ小さくして止め、新しい曲を少しずつ大きくする
 * - 画面が隠れたら（ホームに戻る・別のアプリ）止め、戻ったら続きから
 * - 設定の BGM の音量（0〜1）を BGM_REGISTRY の gain に掛ける。0（ミュート含む）なら止める
 */
export type BgmId =
  | 'title'
  | 'town'
  | 'tournament'
  | 'tournamentBattle'
  | 'dungeon'
  | 'dungeonRuins'
  | 'dungeonForest'
  | 'dungeonWater'
  | 'dungeonIce'
  | 'dungeonFire'
  | 'dungeonMachine'
  | 'dungeonHoly'
  | 'shop'
  | 'practice'
  | 'lab'
  | 'home'
  | 'house'
  | 'neighbor'
  | 'bureau'
  | 'prologue'
  | 'departure'
  | 'battle'
  | 'bossBattle';

interface BgmEntry {
  readonly src: string;
  /** 曲ごとの音量合わせ（ミスモンの曲は audio-registry.js と同じ値。ユーフルカの曲は測って合わせた。約 -18.5 LUFS にそろう） */
  readonly gain: number;
  /** false：くり返さず1回だけ（プロローグ。2026-10-30） */
  readonly loop?: false;
}

export const BGM_REGISTRY: Readonly<Record<BgmId, BgmEntry>> = {
  // タイトル：異世界へようこそ / 蒲鉾さちこ（OpenTracks〔旧 DOVA-SYNDROME〕。2026-10-30 ユーザー提供）。
  // 前のタイトル曲（Bon Voyage! / HarumachiMusic）は bgm_departure.mp3（下の departure。主人公の選択・名前の画面）
  title: { src: titleMp3, gain: 1.2 },
  // 街・部屋：放浪者の街 / ユーフルカ（Wingless Seraph。2026-10-26 ユーザー提供）
  town: { src: townMp3, gain: 0.39 },
  // 大会の受付：Battle - スタンバイフェイズ / lei（DOVA-SYNDROME）
  tournament: { src: tournamentMp3, gain: 0.69 },
  // 大会の対戦（公式ランク戦）：Conflict / ユーフルカ（Wingless Seraph。2026-10-26 ユーザー提供）
  tournamentBattle: { src: tournamentBattleMp3, gain: 0.37 },
  // ダンジョンの探索（曲の決まっていないダンジョン用）：Spirits Forest / HydroGene（CC0）
  dungeon: { src: dungeonMp3, gain: 1.1 },
  // 2026-10-26 ユーザー提供（利用確認済み）
  // 遺跡のダンジョン：月の廃墟 / ユーフルカ（Wingless Seraph）
  dungeonRuins: { src: dungeonRuinsMp3, gain: 0.38 },
  // 森のダンジョン：古代エルフの聖域 / ユーフルカ（Wingless Seraph）
  dungeonForest: { src: dungeonForestMp3, gain: 0.39 },
  // 2026-10-27 ダンジョン7つ（ユーフルカ〔Wingless Seraph〕。2026-10-26 にユーザーが届けた曲。gain は docs/audio-credits.md の値）
  // 水の神殿：Undersea Palace ～海底神殿～
  dungeonWater: { src: dungeonWaterMp3, gain: 0.35 },
  // 氷の洞窟：永遠の雪原
  dungeonIce: { src: dungeonIceMp3, gain: 0.5 },
  // 炎の火山：Tower of Despair（火か機械かは Claude の推測。docs/audio-credits.md）
  dungeonFire: { src: dungeonFireMp3, gain: 0.33 },
  // 機械の塔：Another Dimension（同じく推測）
  dungeonMachine: { src: dungeonMachineMp3, gain: 0.35 },
  // 天の聖域：The Sacred Place
  dungeonHoly: { src: dungeonHolyMp3, gain: 0.46 },
  // カードショップ（店の中とショップの画面）：セールストーク / BGMer
  shop: { src: shopMp3, gain: 0.48 },
  // カード練習場（ユーザーの言う「教習所」）：無心になれる作業 / BGMer
  practice: { src: practiceMp3, gain: 0.56 },
  // カード研究所（研究所の中と図鑑）：開かれし封印の扉 / ユーフルカ（Wingless Seraph）
  lab: { src: labMp3, gain: 0.76 },
  // 2026-10-26 ユーザー提供（利用確認済み。曲名・作者はファイルに書かれていない）
  // 主人公の部屋（家の中）
  home: { src: homeMp3, gain: 0.44 },
  // 住人の家（民家A〜E 共通）
  house: { src: houseMp3, gain: 0.72 },
  // 案内人（となりの家の女性）の家
  neighbor: { src: neighborMp3, gain: 1.07 },
  // カードバトラー管理局：白銀の城 / マニーラ（OpenTracks〔旧 DOVA-SYNDROME〕。2026-10-30 ユーザー提供）
  bureau: { src: bureauMp3, gain: 0.51 },
  // プロローグ（1回だけ。約12秒）：Shy Love / チョコミント（OpenTracks〔旧 DOVA-SYNDROME〕。2026-10-30 ユーザー提供・指示書 M）
  prologue: { src: prologueMp3, gain: 0.77, loop: false },
  // 主人公の選択・名前（プロローグのあと）：Bon Voyage! / HarumachiMusic（Pixabay。前のタイトル曲。2026-10-30 指示書 O2 ユーザー決定）
  departure: { src: departureMp3, gain: 0.68 },
  // ダンジョン・練習の対戦（野生モンスター）：神獣の試練 / ユーフルカ（Wingless Seraph。2026-10-26 ユーザー提供）
  battle: { src: battleMp3, gain: 0.36 },
  // ダンジョンのボス：己と仲間を信じて / ユーフルカ（Wingless Seraph。2026-10-26 ユーザー提供）
  bossBattle: { src: bossBattleMp3, gain: 0.31 },
};

/** 曲を替えるときの、小さくする／大きくする時間（秒） */
const FADE_OUT_S = 0.6;
const FADE_IN_S = 0.8;

interface Track {
  readonly el: HTMLAudioElement;
  readonly gain: GainNode | null;
  /** 止めている途中（小さくし終えたら片付ける）のタイマー。使い回すときは取り消す */
  stopTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * 使い回す audio の数（鳴っている曲・小さくしている途中の曲・予備）。
 * 2026-10-26 ユーザー報告「建物に入ると、一歩動かないと音が鳴らない」：iPhone は、タップの処理の中で一度 play() した audio しか
 * あとから鳴らせない。曲を替えるたびに新しい audio を作っていたため、建物に入った（タップの外）ときの新しい曲は次のタップまで鳴らなかった。
 * 最初のタップでこの数だけ audio を作って鳴らせる状態にし、曲を替えるときは src だけ入れ替えて使い回す
 */
const POOL_SIZE = 3;

class BgmPlayer {
  #wanted: BgmId | null = null;
  #playing: { id: BgmId; track: Track } | null = null;
  #volume = 1;
  #unlocked = false;
  #installed = false;
  /** 最初のタップで鳴らせる状態にした audio（Web Audio につないだまま使い回す） */
  readonly #pool: Track[] = [];

  setVolume(volume: number): void {
    this.#volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
    const p = this.#playing;
    if (!p) {
      this.#start();
      return;
    }
    if (this.#volume <= 0) {
      this.#stop(0.2);
      return;
    }
    this.#setLevel(p.track, BGM_REGISTRY[p.id].gain * this.#volume, 0.15);
  }

  /** この曲を鳴らす（同じ曲ならそのまま。null で止める） */
  play(id: BgmId | null): void {
    this.#wanted = id;
    if (this.#playing?.id === id) return;
    this.#stop(FADE_OUT_S);
    this.#start();
  }

  /** 最初のタップで鳴らし始める・画面が隠れたら止める（何度呼んでもよい） */
  installUnlock(): void {
    if (this.#installed || typeof window === 'undefined') return;
    this.#installed = true;
    const unlock = (): void => {
      // タップの処理の中で play() を呼ぶ（iPhone はここでないと鳴らせない）。使い回す audio もここで鳴らせる状態に
      this.#fillPool();
      this.#unlocked = true;
      if (this.#playing) void this.#playing.track.el.play().catch(() => undefined);
      else this.#start();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchend', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      const el = this.#playing?.track.el;
      if (!el) return;
      if (document.hidden) el.pause();
      else if (this.#unlocked) void el.play().catch(() => undefined);
    });
  }

  /** 使い回す audio をタップの処理の中で作り、一度 play() して鳴らせる状態にする（音源がないので音は出ない） */
  #fillPool(): void {
    while (this.#pool.length < POOL_SIZE) {
      const track = this.#createTrack();
      void track.el.play().catch(() => undefined);
      track.el.pause();
      this.#pool.push(track);
    }
  }

  /** 次に使う audio：いま鳴らしている曲以外。小さくしている途中のものしかなければ、それを取り消して使う */
  #takeTrack(): Track {
    const free = this.#pool.filter((t) => t !== this.#playing?.track);
    const track = free.find((t) => !t.stopTimer && !t.el.getAttribute('src')) ?? free[0] ?? this.#createTrack();
    if (track.stopTimer) {
      clearTimeout(track.stopTimer);
      track.stopTimer = null;
      track.el.pause();
    }
    return track;
  }

  #start(): void {
    const id = this.#wanted;
    if (!id || !this.#unlocked || this.#volume <= 0 || this.#playing) return;
    const track = this.#takeTrack();
    const entry = BGM_REGISTRY[id];
    track.el.src = entry.src;
    track.el.loop = entry.loop !== false;
    track.el.currentTime = 0;
    this.#playing = { id, track };
    this.#setLevel(track, 0, 0);
    void track.el.play().catch(() => undefined);
    // 1回だけの曲は頭から聞こえるよう、すぐ大きくする
    this.#setLevel(track, entry.gain * this.#volume, entry.loop === false ? 0.05 : FADE_IN_S);
  }

  #stop(fadeS: number): void {
    const p = this.#playing;
    if (!p) return;
    this.#playing = null;
    const track = p.track;
    this.#setLevel(track, 0, fadeS);
    track.stopTimer = setTimeout(() => {
      track.stopTimer = null;
      track.el.pause();
      track.el.removeAttribute('src');
      track.el.load();
    }, fadeS * 1000 + 50);
  }

  #createTrack(): Track {
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    const ctx = sound.audioContext();
    if (!ctx) return { el, gain: null, stopTimer: null };
    try {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      const gain = ctx.createGain();
      ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
      return { el, gain, stopTimer: null };
    } catch {
      return { el, gain: null, stopTimer: null };
    }
  }

  #setLevel(track: Track, level: number, seconds: number): void {
    const g = track.gain;
    if (!g) {
      // Web Audio が使えない環境：audio の volume で（すぐ切り替える）
      track.el.volume = Math.min(1, Math.max(0, level));
      return;
    }
    const now = g.context.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    if (seconds > 0) g.gain.linearRampToValueAtTime(level, now + seconds);
    else g.gain.setValueAtTime(level, now);
  }
}

export const bgm = new BgmPlayer();
