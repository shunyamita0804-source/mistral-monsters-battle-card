import titleMp3 from '@assets/audio/bgm/bgm_title.mp3';
import townMp3 from '@assets/audio/bgm/bgm_town.mp3';
import tournamentMp3 from '@assets/audio/bgm/bgm_tournament.mp3';
import tournamentBattleMp3 from '@assets/audio/bgm/bgm_tournament_battle.mp3';
import dungeonMp3 from '@assets/audio/bgm/bgm_dungeon.mp3';
import battleMp3 from '@assets/audio/bgm/bgm_battle.mp3';
import bossBattleMp3 from '@assets/audio/bgm/bgm_boss_battle.mp3';
import dungeonRuinsMp3 from '@assets/audio/bgm/bgm_dungeon_ruins.mp3';
import dungeonForestMp3 from '@assets/audio/bgm/bgm_dungeon_forest.mp3';
import shopMp3 from '@assets/audio/bgm/bgm_shop.mp3';
import practiceMp3 from '@assets/audio/bgm/bgm_practice.mp3';
import labMp3 from '@assets/audio/bgm/bgm_lab.mp3';
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
  | 'shop'
  | 'practice'
  | 'lab'
  | 'battle'
  | 'bossBattle';

interface BgmEntry {
  readonly src: string;
  /** 曲ごとの音量合わせ（ミスモンの曲は audio-registry.js と同じ値。ユーフルカの曲は測って合わせた。約 -18.5 LUFS にそろう） */
  readonly gain: number;
}

export const BGM_REGISTRY: Readonly<Record<BgmId, BgmEntry>> = {
  // タイトル：Bon Voyage! / HarumachiMusic（Pixabay）
  title: { src: titleMp3, gain: 0.68 },
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
  // カードショップ（店の中とショップの画面）：セールストーク / BGMer
  shop: { src: shopMp3, gain: 0.48 },
  // カード練習場（ユーザーの言う「教習所」）：無心になれる作業 / BGMer
  practice: { src: practiceMp3, gain: 0.56 },
  // カード研究所（研究所の中と図鑑）：開かれし封印の扉 / ユーフルカ（Wingless Seraph）
  lab: { src: labMp3, gain: 0.76 },
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
}

class BgmPlayer {
  #wanted: BgmId | null = null;
  #playing: { id: BgmId; track: Track } | null = null;
  #volume = 1;
  #unlocked = false;
  #installed = false;

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
      this.#unlocked = true;
      // タップの処理の中で play() を呼ぶ（iPhone はここでないと鳴らせない）
      if (this.#playing) void this.#playing.track.el.play().catch(() => undefined);
      else this.#start();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      const el = this.#playing?.track.el;
      if (!el) return;
      if (document.hidden) el.pause();
      else if (this.#unlocked) void el.play().catch(() => undefined);
    });
  }

  #start(): void {
    const id = this.#wanted;
    if (!id || !this.#unlocked || this.#volume <= 0 || this.#playing) return;
    const track = this.#createTrack(BGM_REGISTRY[id].src);
    this.#playing = { id, track };
    this.#setLevel(track, 0, 0);
    void track.el.play().catch(() => undefined);
    this.#setLevel(track, BGM_REGISTRY[id].gain * this.#volume, FADE_IN_S);
  }

  #stop(fadeS: number): void {
    const p = this.#playing;
    if (!p) return;
    this.#playing = null;
    this.#setLevel(p.track, 0, fadeS);
    setTimeout(() => {
      p.track.el.pause();
      p.track.el.removeAttribute('src');
      p.track.el.load();
      p.track.gain?.disconnect();
    }, fadeS * 1000 + 50);
  }

  #createTrack(src: string): Track {
    const el = new Audio(src);
    el.loop = true;
    el.preload = 'auto';
    const ctx = sound.audioContext();
    if (!ctx) return { el, gain: null };
    try {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      const gain = ctx.createGain();
      ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
      return { el, gain };
    } catch {
      return { el, gain: null };
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
