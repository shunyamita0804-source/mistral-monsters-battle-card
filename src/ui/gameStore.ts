import type { OpponentDefinition } from '../data/tournaments.ts';
import type { BattleWinner } from '../game/battle/engine.ts';
import { sanitizeLocation } from '../game/progress/dungeon.ts';
import type { PracticeResult } from '../game/story/intro.ts';
import { createNewSave, type SaveData } from '../game/save/saveData.ts';
import { MemoryStorage, SaveRepository, type KeyValueStorage, type LoadResult } from '../game/save/saveRepository.ts';
import type { BgmId } from './bgm.ts';
import { SettingsStore } from './settingsStore.ts';

/** バトル画面に渡す依頼。結果の処理（セーブ更新・画面遷移）は依頼元が持つ */
export interface BattleRequest {
  readonly title: string;
  readonly opponent: OpponentDefinition;
  /** 降参ボタンを出すか */
  readonly allowSurrender: boolean;
  /** 最初の練習試合：場面に合わせてヒントを出す（バトルのルールは変えない） */
  readonly tutorial?: boolean;
  /** 対戦中の BGM（無ければダンジョン・練習と同じ通常の対戦の曲） */
  readonly bgm?: BgmId;
  /** 対戦の背景の絵（無ければ従来の色の背景） */
  readonly background?: string;
  /** 背景の絵を濃いめに見せる（練習試合の机の絵。ふだんはうっすら） */
  readonly backgroundVivid?: boolean;
  /** 対戦後に1回だけ呼ばれる */
  readonly onFinish: (winner: BattleWinner) => void;
}

/**
 * ゲーム全体の状態。セーブデータの読み書きと、画面をまたぐ一時的な情報（バトル依頼・お知らせ）を持つ。
 * セーブの変更は update() に純粋関数を渡して行い、そのたびに保存する。
 */
export class GameStore {
  readonly #repo: SaveRepository;
  #save: SaveData | null = null;
  readonly loadResult: LoadResult;
  /** 次に開くバトル */
  pendingBattle: BattleRequest | null = null;
  /** 歩行画面に戻ったときに出すお知らせ */
  flashMessage: string | null = null;
  /** 歩行画面に戻ったときに出す帯（2026-10-26 デザイン第10弾：ダンジョンをクリアしたとき。2026-10-27 第13弾：3回負けて入り口へ戻されたとき） */
  flashBanner: 'clear' | 'retreat' | null = null;
  /** ダンジョンに入った直後に出す、挿絵とダンジョン名の札（ダンジョンの ID。2026-10-26 ユーザー指示） */
  dungeonIntro: string | null = null;
  /** 練習試合の結果（歩行画面に戻ったとき、対戦後の会話に使う） */
  practiceResult: PracticeResult | null = null;
  /** QA用の機能を出すか（URL に ?qa=1） */
  readonly qa: boolean;
  /** 最後に保存できたか */
  lastSaveOk = true;
  /** 設定（言語・音量）。セーブとは別に保存する */
  readonly settings: SettingsStore;

  constructor(storage: KeyValueStorage, qa = false) {
    // 言語を先に決める（読み込みのお知らせなどをその言語で出すため）
    this.settings = new SettingsStore(storage);
    this.#repo = new SaveRepository(storage);
    this.qa = qa;
    this.loadResult = this.#repo.load();
    if (this.loadResult.status === 'loaded') this.#save = sanitizeLocation(this.loadResult.save);
  }

  static fromBrowser(): GameStore {
    let storage: KeyValueStorage;
    try {
      storage = window.localStorage;
      storage.getItem('probe');
    } catch {
      storage = new MemoryStorage();
    }
    const qa = new URLSearchParams(window.location.search).get('qa') === '1';
    return new GameStore(storage, qa);
  }

  get hasSave(): boolean {
    return this.#save !== null;
  }

  get save(): SaveData {
    if (!this.#save) throw new Error('セーブデータがありません');
    return this.#save;
  }

  newGame(gender: 'male' | 'female'): void {
    this.#save = { ...createNewSave(), player: { gender } };
    this.persist();
  }

  update(fn: (save: SaveData) => SaveData): SaveData {
    const next = fn(this.save);
    if (next !== this.#save) {
      this.#save = next;
      this.persist();
    }
    return next;
  }

  persist(): void {
    if (this.#save) this.lastSaveOk = this.#repo.save(this.#save);
  }

  /**
   * バックアップから読んだセーブに入れ替える。先にいまのセーブを退避し、書き込めたときだけ入れ替える。
   * 失敗したら false（いまのセーブはそのまま）。
   */
  restoreSave(save: SaveData): boolean {
    if (!this.#repo.stashBeforeRestore()) return false;
    const next = sanitizeLocation(save);
    if (!this.#repo.save(next)) return false;
    this.#save = next;
    this.pendingBattle = null;
    this.flashMessage = null;
    this.flashBanner = null;
    this.practiceResult = null;
    this.lastSaveOk = true;
    return true;
  }

  deleteSave(): void {
    this.#repo.clear();
    this.#save = null;
  }
}

/** 二重タップ防止：1回目の呼び出しだけ実行する関数を作る */
export function once<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  let done = false;
  return (...args: A) => {
    if (done) return;
    done = true;
    fn(...args);
  };
}

/** 一意なID（購入・大会参加など） */
export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rand}`;
}
