import type { OpponentDefinition } from '../data/tournaments.ts';
import type { BattleSummary } from '../game/battle/simulate.ts';
import type { BattleWinner } from '../game/battle/engine.ts';
import { sanitizeLocation } from '../game/progress/dungeon.ts';
import type { PracticeResult } from '../game/story/intro.ts';
import type { Deck } from '../game/deck/deck.ts';
import { createNewGameSave, type SaveData } from '../game/save/saveData.ts';
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
  /** ヒントの文（無ければ前の導入の練習試合の文。introV2＝導入イベントV2の試験：先生の台詞） */
  readonly hintSet?: 'story' | 'introV2';
  /** イベントの対戦の ID（導入イベントV2の試験は 'introV2-exam'。ふつうの練習試合と分ける） */
  readonly eventBattleId?: string;
  /** 対戦中の BGM（無ければダンジョン・練習と同じ通常の対戦の曲） */
  readonly bgm?: BgmId;
  /** 対戦の背景の絵（無ければ従来の色の背景） */
  readonly background?: string;
  /** 背景の絵を濃いめに見せる（練習試合の机の絵。ふだんはうっすら） */
  readonly backgroundVivid?: boolean;
  /** 対戦後に1回だけ呼ばれる（summary：残ったモンスター・与えたダメージ。対戦が始まる前に終わったときは無い） */
  readonly onFinish: (winner: BattleWinner, summary?: BattleSummary) => void;
  /** 借りるデッキ（試験で先生が貸すデッキ。無ければ自分のデッキ。所持カードには入れない） */
  readonly playerDeck?: Deck;
  /** 相手のデッキ（無ければ opponent のモンスターから組む。確認用の画面：プカリムの試遊で、元の箱のデッキと戦うとき） */
  readonly opponentDeck?: Deck;
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
  flashBanner: 'clear' | 'retreat' | 'charm' | null = null; // 'charm'：身代わりのお守りの演出（ダンジョン探索の画面。2026-10-27）
  /**
   * ダンジョン探索の画面に戻ったときの演出（2026-10-27 デザイン33点）：card＝手に入れた技カード（台座と光で見せる）・
   * leave＝勝った相手のバトラーの ID（その場から光の粒になって去る）
   */
  flashRun: { readonly card?: string; readonly leave?: string } | null = null;
  /** ダンジョン（ランダム生成）をクリアして街に戻ったときの、報酬の場面（祭壇に置くカードと、初回クリアか） */
  flashClear: { readonly cards: readonly string[]; readonly firstClear: boolean } | null = null;
  /** 守り手（ボス）に勝って街に戻ったときの、守り手のひと言（顔の絵のキーと文。2026-10-28）。報酬のお知らせの前に出す */
  flashKeeper: { readonly face: string; readonly text: string } | null = null;
  /** ダンジョンに入った直後に出す、挿絵とダンジョン名の札（ダンジョンの ID。2026-10-26 ユーザー指示） */
  dungeonIntro: string | null = null;
  /** 新しく始めた直後に、物語の始まりの挿絵を出す（2026-10-27 ユーザー指示。主人公を選んだあとに1回だけ） */
  openingIntro = false;
  /** 練習試合の結果（歩行画面に戻ったとき、対戦後の会話に使う） */
  practiceResult: PracticeResult | null = null;
  /** 導入イベントV2の試験の対戦の結果（歩行画面に戻ったとき、合格・再挑戦の会話に使う） */
  introV2Result: 'won' | 'lost' | null = null;
  /** ピートとの勝負の結果（2026-10-29。歩行画面に戻ったとき、ピートのひと言ともらったカードを出す） */
  peteResult: { readonly first: boolean; readonly cardId: string } | 'lost' | null = null;
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

  /** 最初から（2026-10-28：カードを持たずに始める。初期デッキ3択はなくした。名前は主人公を選んだすぐあとに決めたもの） */
  newGame(gender: 'male' | 'female', name: string): void {
    this.#save = { ...createNewGameSave(new Date()), player: { gender, name } };
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
    this.flashRun = null;
    this.flashClear = null;
    this.flashKeeper = null;
    this.practiceResult = null;
    this.introV2Result = null;
    this.peteResult = null;
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
