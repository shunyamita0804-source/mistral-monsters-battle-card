import type { Habitat, SkillEffect } from '../game/cards/cardTypes.ts';

export type { Habitat };

/**
 * 指示書 AJ（2026-11-01 ユーザー決定）：技カードの作り直し（全15体）。
 * - どのモンスターも技カードは12枚（今の14枚から外す技・足す技はこの表のとおり）。レアは各モンスター4つ（rare）
 * - 数字はモンファーBC（PS 版・LIFE は同じ 6〜10）を物差しに上げ直した（LIFE はどのモンスターも変えない）
 * - 名前を変えた技は、カードの ID と絵はそのまま（名前と数字・効果だけ変える）。新しい技（skl-kalshell-15・skl-desuoru-15・16）の絵は仮（art）
 * - 居場所（地上・空中・水中）：MONSTER_HABITAT。場が水中（みちしお）のあいだは全員を水中として扱う（src/game/battle/engine.ts）
 * - box：最初の箱（ブースター）に入れる枚数（箱が決まっている子だけ。ラズック・ノビトンは仮の箱の枚数。src/data/introV2.ts）
 * この表がカードの正本。src/data/cards.ts がこの表で 15体の技を組み立てる（各モンスターのファイルの14技は、絵と前のデータを引くためだけに使う）。
 * 決まりの細かい所は docs/battle-rules.md「指示書 AJ」
 */
/** モンスターの居場所（指示書 AJ【2】） */
export const MONSTER_HABITAT: Readonly<Record<string, Habitat>> = {
  'mon-soramo': 'ground',
  'mon-nobiton': 'ground',
  'mon-lazuck': 'ground',
  'mon-flune': 'ground',
  'mon-tsumuji': 'ground',
  'mon-geol': 'ground',
  'mon-shishien': 'ground',
  'mon-hakuran': 'ground',
  'mon-gauul': 'air',
  'mon-pukarim': 'air',
  'mon-hyouzuku': 'air',
  'mon-desuoru': 'air',
  'mon-myurol': 'water',
  'mon-kalshell': 'water',
  'mon-serephine': 'water',
};

/** 分類：ち＝ちから・か＝かしこさ・特＝特殊・防＝防御・避＝回避 */
export type AjCategory = 'ち' | 'か' | '特' | '防' | '避';

export interface AjSkillRow {
  readonly id: string;
  readonly name: string;
  readonly cat: AjCategory;
  readonly mana: number;
  /** 攻撃（ち・か）のダメージ。ほかは null */
  readonly damage: number | null;
  /** ゲームでの動き（ち・か で効果の無い技は省略＝ふつうの攻撃） */
  readonly effect?: SkillEffect;
  /** カードに書く効果の文（無ければ null） */
  readonly text: string | null;
  /** ガチャのレアの枠（★） */
  readonly rare?: boolean;
  /** 最初の箱の枚数 */
  readonly box?: number;
  /** 新しい技の仮の絵（assets/images/cards/skills/ のファイル名。正式な絵が届くまで） */
  readonly tempArt?: string;
}

const atk = (extra: Omit<Extract<SkillEffect, { type: 'attack' }>, 'type'> = {}): SkillEffect => ({ type: 'attack', ...extra });
const guard = (reduce: number, against: 'force' | 'wisdom' | 'all'): SkillEffect => ({ type: 'defense', reduce, against });
const dodge = (against: 'force' | 'wisdom' | 'all', minCost?: number): SkillEffect => (minCost ? { type: 'evade', against, minCost } : { type: 'evade', against });

// よく使う効果の文
const T_HALF = '回避されても半分のダメージ';
const T_UNDODGE = '回避されない';
const T_UNBLOCK = '防御されない';
const T_SEAL = '相手1体は次の攻撃を行えない';
const T_FORCE = 'ちから技に効く';
const T_WISDOM = 'かしこさ技に効く';
const T_BOTH = 'ちから技・かしこさ技に効く';
const T_DODGE_ALL = 'マナに関係なく、ちから技・かしこさ技を回避';
const T_DODGE_2 = 'マナ2以上のちから技・かしこさ技を回避';
const T_DODGE_FORCE = 'ちから技を回避';
const T_TIDE = '次の相手のターン終了まで、全モンスターを水中にする';

/** 15体の12枚（並び＝表示の番号 1〜12） */
export const AJ_SKILLS: Readonly<Record<string, readonly AjSkillRow[]>> = {
  // ソラモ（地上・LIFE 7）［箱：旅立ちのきらめき 16枚］
  'mon-soramo': [
    { id: 'skl-soramo14-01', name: 'ひっかき', cat: 'ち', mana: 0, damage: 1, text: null, box: 0 },
    { id: 'skl-soramo14-02', name: '連続ひっかき', cat: 'ち', mana: 1, damage: 2, effect: atk({ halfOnEvade: true }), text: T_HALF, rare: true, box: 0 },
    { id: 'skl-soramo14-03', name: 'たいあたり', cat: 'ち', mana: 2, damage: 2, text: null, box: 3 },
    { id: 'skl-soramo14-04', name: 'しっぽうち', cat: 'ち', mana: 3, damage: 3, text: null, box: 3 },
    { id: 'skl-soramo14-05', name: 'スターダイブ', cat: 'ち', mana: 4, damage: 5, text: null, box: 2 },
    { id: 'skl-soramo14-06', name: 'ソラモビーム', cat: 'か', mana: 2, damage: 3, text: null, rare: true, box: 0 },
    { id: 'skl-soramo14-07', name: 'スターダストレイ', cat: 'か', mana: 3, damage: 4, text: null, box: 1 },
    { id: 'skl-soramo14-08', name: 'スターフォール', cat: 'か', mana: 4, damage: 6, text: null, rare: true, box: 1 },
    { id: 'skl-soramo14-09', name: 'すなかけ', cat: '特', mana: 2, damage: null, effect: { type: 'seal' }, text: T_SEAL, box: 2 },
    { id: 'skl-soramo14-10', name: '吠える', cat: '特', mana: 2, damage: null, effect: { type: 'discardRandom' }, text: '相手の手札からランダムに1枚捨てさせる', box: 2 },
    { id: 'skl-soramo14-12', name: '星のまもり', cat: '防', mana: 1, damage: null, effect: guard(3, 'all'), text: T_BOTH, box: 2 },
    { id: 'skl-soramo14-14', name: '星影ステップ', cat: '避', mana: 2, damage: null, effect: dodge('all'), text: T_DODGE_ALL, rare: true, box: 0 },
  ],
  // ガウル（空中・LIFE 6）［箱：烈火の猛攻 16枚］
  'mon-gauul': [
    { id: 'skl-gauul14-01', name: 'つつく', cat: 'ち', mana: 0, damage: 1, text: null, box: 0 },
    { id: 'skl-gauul14-02', name: '連続つつき', cat: 'ち', mana: 1, damage: 1, text: null, box: 3 },
    { id: 'skl-gauul14-03', name: 'かぎ爪', cat: 'ち', mana: 2, damage: 2, text: null, box: 3 },
    { id: 'skl-gauul14-04', name: '急降下アタック', cat: 'ち', mana: 3, damage: 4, effect: atk({ groundOnly: true }), text: '地上の相手だけに使える', box: 0 },
    { id: 'skl-gauul14-05', name: 'スパイラルダイブ', cat: 'ち', mana: 4, damage: 5, text: null, box: 2 },
    { id: 'skl-gauul14-06', name: '火の粉', cat: 'か', mana: 1, damage: 2, effect: atk({ halfOnEvade: true }), text: T_HALF, rare: true, box: 0 },
    { id: 'skl-gauul14-07', name: 'ファイアボール', cat: 'か', mana: 3, damage: 4, text: null, box: 3 },
    { id: 'skl-gauul14-09', name: '聖なる炎', cat: 'か', mana: 4, damage: 4, effect: atk({ undodgeable: true }), text: T_UNDODGE, rare: true, box: 0 },
    { id: 'skl-gauul14-08', name: 'フレアレイ', cat: 'か', mana: 4, damage: 6, text: null, rare: true, box: 1 },
    { id: 'skl-gauul14-10', name: '威嚇', cat: '特', mana: 2, damage: null, effect: { type: 'seal' }, text: T_SEAL, box: 2 },
    { id: 'skl-gauul14-13', name: '上に飛ぶ', cat: '避', mana: 1, damage: null, effect: dodge('all', 2), text: T_DODGE_2, box: 2 },
    { id: 'skl-gauul14-14', name: '高速飛行', cat: '避', mana: 2, damage: null, effect: dodge('all'), text: T_DODGE_ALL, rare: true, box: 0 },
  ],
  // ミュロル（水中・LIFE 7）［箱：蒼海の守り 16枚］
  'mon-myurol': [
    { id: 'skl-myurol-01', name: 'たいあたり', cat: 'ち', mana: 1, damage: 1, text: null, box: 0 },
    { id: 'skl-myurol-02', name: 'しっぽたたき', cat: 'ち', mana: 2, damage: 2, text: null, box: 3 },
    { id: 'skl-myurol-03', name: 'しっぽまわし', cat: 'ち', mana: 3, damage: 3, effect: atk({ undodgeable: true }), text: T_UNDODGE, rare: true, box: 0 },
    { id: 'skl-myurol-04', name: 'アクアテール', cat: 'ち', mana: 4, damage: 5, text: null, rare: true, box: 1 },
    { id: 'skl-myurol-05', name: 'みずでっぽう', cat: 'か', mana: 2, damage: 2, text: null, box: 3 },
    { id: 'skl-myurol-07', name: 'アクアボール', cat: 'か', mana: 3, damage: 4, text: null, box: 3 },
    {
      id: 'skl-myurol-08', name: 'しめったはだ', cat: '特', mana: 1, damage: null,
      effect: { type: 'shield', against: 'force', reduce: 3, turns: 2 }, text: '次の相手のターン、受けるちから技すべて−3', box: 2,
    },
    { id: 'skl-myurol-09', name: 'みずあび', cat: '特', mana: 2, damage: null, effect: { type: 'healSelf', amount: 2 }, text: '自分のライフ＋2（もとのLIFEまで）', rare: true, box: 0 },
    { id: 'skl-myurol-10', name: 'しっぽガード', cat: '防', mana: 0, damage: null, effect: guard(3, 'force'), text: T_FORCE, box: 2 },
    { id: 'skl-myurol-11', name: 'みずのまく', cat: '防', mana: 0, damage: null, effect: guard(3, 'wisdom'), text: T_WISDOM, box: 2 },
    { id: 'skl-myurol-14', name: 'スリップガード', cat: '防', mana: 2, damage: null, effect: guard(5, 'all'), text: T_BOTH, rare: true, box: 0 },
    { id: 'skl-myurol-16', name: 'すべってよける', cat: '避', mana: 2, damage: null, effect: dodge('force'), text: T_DODGE_FORCE, box: 0 },
  ],
  // カルシェル（水中・LIFE 8）［箱：蒼海の守り 16枚］
  'mon-kalshell': [
    { id: 'skl-kalshell-01', name: 'はさむ', cat: 'ち', mana: 1, damage: 1, text: null, box: 2 },
    { id: 'skl-kalshell-02', name: 'シェルタックル', cat: 'ち', mana: 2, damage: 2, text: null, box: 3 },
    { id: 'skl-kalshell-04', name: 'コーラルスピア', cat: 'ち', mana: 3, damage: 3, effect: atk({ undodgeable: true }), text: T_UNDODGE, box: 0 },
    { id: 'skl-kalshell-03', name: 'クラッシュクロー', cat: 'ち', mana: 3, damage: 4, text: null, box: 3 },
    { id: 'skl-kalshell-05', name: 'シェルブレイカー', cat: 'ち', mana: 5, damage: 6, text: null, rare: true, box: 1 },
    { id: 'skl-kalshell-06', name: 'あわだま', cat: 'か', mana: 1, damage: 2, text: null, rare: true, box: 1 },
    { id: 'skl-kalshell-08', name: 'タイダルクラッシュ', cat: 'か', mana: 4, damage: 5, effect: atk({ doubleInWater: true }), text: '場が水中なら2倍', rare: true, box: 0 },
    { id: 'skl-kalshell-10', name: 'すなをほる', cat: '特', mana: 2, damage: null, effect: { type: 'hide' }, text: '次のターン攻撃の的にならない', box: 2 },
    // 新しい技（絵はデザイン担当に依頼中。届くまでタイダルクラッシュの絵）
    { id: 'skl-kalshell-15', name: 'みちしお', cat: '特', mana: 2, damage: null, effect: { type: 'tide' }, text: T_TIDE, box: 0, tempArt: 'kal_sk_08.png' },
    { id: 'skl-kalshell-11', name: 'からにこもる', cat: '防', mana: 1, damage: null, effect: guard(5, 'force'), text: T_FORCE, box: 2 },
    { id: 'skl-kalshell-12', name: 'あわのまく', cat: '防', mana: 1, damage: null, effect: guard(3, 'wisdom'), text: T_WISDOM, box: 2 },
    { id: 'skl-kalshell-13', name: 'てっぺきシェル', cat: '防', mana: 3, damage: null, effect: { type: 'defense', against: 'all', nullify: true }, text: T_BOTH, rare: true, box: 0 },
  ],
  // ラズック（地上・LIFE 6）［箱：仮。box は仮のラズック16枚］
  'mon-lazuck': [
    { id: 'skl-lazuck-01', name: 'ひっかき', cat: 'ち', mana: 0, damage: 1, text: null, box: 2 },
    { id: 'skl-lazuck-02', name: 'かみつき', cat: 'ち', mana: 1, damage: 1, text: null, box: 3 },
    { id: 'skl-lazuck-03', name: 'とびかかり', cat: 'ち', mana: 2, damage: 2, text: null, box: 3 },
    { id: 'skl-lazuck-04', name: 'みだれづめ', cat: 'ち', mana: 3, damage: 3, effect: atk({ undodgeable: true }), text: T_UNDODGE, box: 2 },
    { id: 'skl-lazuck-06', name: 'しっぷうタックル', cat: 'ち', mana: 4, damage: 4, text: null, box: 2 },
    { id: 'skl-lazuck-09', name: 'トリックショット', cat: 'か', mana: 2, damage: 3, text: null, rare: true },
    { id: 'skl-lazuck-10', name: 'シャドウバースト', cat: 'か', mana: 4, damage: 4, text: null, rare: true },
    { id: 'skl-lazuck-07', name: 'おびきよせ', cat: '特', mana: 2, damage: null, effect: { type: 'taunt' }, text: '相手は次のターン、ラズックしか攻撃できない', box: 1 },
    {
      id: 'skl-lazuck-08', name: 'ダストキック', cat: '特', mana: 0, damage: null,
      effect: { type: 'weaken', stat: 'force', amount: 1, duration: 'nextTurn' }, text: '相手の次のターンのちから技−1', box: 1,
    },
    { id: 'skl-lazuck-itazura', name: 'いたずら', cat: '特', mana: 2, damage: null, effect: { type: 'handToDeck' }, text: '相手の手札1枚をランダムに山札へ（補充なし）', rare: true },
    { id: 'skl-lazuck-15', name: 'シャドウスリップ', cat: '避', mana: 1, damage: null, effect: dodge('all', 2), text: T_DODGE_2, box: 2 },
    { id: 'skl-lazuck-14', name: 'フェイントステップ', cat: '避', mana: 2, damage: null, effect: dodge('all'), text: T_DODGE_ALL, rare: true },
  ],
  // ノビトン（地上・LIFE 8）［箱：仮。box は仮のノビトン16枚］
  'mon-nobiton': [
    { id: 'skl-nobiton-01', name: 'はなビンタ', cat: 'ち', mana: 1, damage: 1, text: null, box: 3 },
    { id: 'skl-nobiton-02', name: 'ずつき', cat: 'ち', mana: 2, damage: 2, text: null, box: 3 },
    { id: 'skl-nobiton-03', name: 'まきつく', cat: 'ち', mana: 3, damage: 2, effect: atk({ stunTarget: true }), text: '相手は次のターン行動できない', rare: true },
    { id: 'skl-nobiton-04', name: 'ギガントノーズ', cat: 'ち', mana: 4, damage: 5, text: null, rare: true },
    { id: 'skl-nobiton-05', name: 'くしゃみ', cat: 'か', mana: 2, damage: 1, effect: atk({ manaDrain: 1 }), text: '相手のマナ−1', box: 2 },
    { id: 'skl-nobiton-06', name: 'ミラージュノーズ', cat: 'か', mana: 2, damage: 2, effect: atk({ undodgeable: true }), text: T_UNDODGE, box: 2 },
    { id: 'skl-nobiton-07', name: 'ダウナーミスト', cat: 'か', mana: 4, damage: 2, effect: atk({ manaDrain: 3 }), text: '相手のマナ−3', rare: true },
    { id: 'skl-nobiton-08', name: '考える', cat: '特', mana: 1, damage: null, effect: { type: 'redrawHand' }, text: '手札をすべて交換', box: 1 },
    { id: 'skl-nobiton-09', name: '不思議な嗅覚', cat: '特', mana: 2, damage: null, effect: { type: 'revealHand' }, text: '相手の手札をすべて見る', rare: true },
    { id: 'skl-nobiton-10', name: '鼻でまもる', cat: '防', mana: 0, damage: null, effect: guard(3, 'force'), text: T_FORCE, box: 2 },
    { id: 'skl-nobiton-12', name: 'のびのびガード', cat: '防', mana: 2, damage: null, effect: guard(3, 'all'), text: T_BOTH, box: 2 },
    { id: 'skl-nobiton-16', name: '必死によける', cat: '避', mana: 3, damage: null, effect: dodge('all'), text: T_DODGE_ALL, box: 1 },
  ],
  // プカリム（空中・LIFE 6）
  'mon-pukarim': [
    { id: 'skl-pukarim-01', name: 'しっぽ', cat: 'ち', mana: 0, damage: 1, text: null },
    { id: 'skl-pukarim-02', name: 'たいあたり', cat: 'ち', mana: 1, damage: 1, text: null },
    { id: 'skl-pukarim-03', name: 'ころがる', cat: 'ち', mana: 2, damage: 2, text: null },
    { id: 'skl-pukarim-04', name: 'ボディプレス', cat: 'ち', mana: 4, damage: 4, text: null },
    { id: 'skl-pukarim-05', name: 'とっぷう', cat: 'か', mana: 1, damage: 1, text: null },
    { id: 'skl-pukarim-06', name: 'エアショット', cat: 'か', mana: 2, damage: 2, text: null },
    { id: 'skl-pukarim-07', name: 'ぷはーっ', cat: 'か', mana: 3, damage: 3, effect: atk({ undodgeableWhenCharged: true }), text: 'ためているときは回避されない', rare: true },
    { id: 'skl-pukarim-08', name: 'おおつむじ', cat: 'か', mana: 4, damage: 3, effect: atk({ undodgeable: true }), text: T_UNDODGE, rare: true },
    { id: 'skl-pukarim-09', name: 'ほっぺにためる', cat: '特', mana: 1, damage: null, effect: { type: 'charge', amount: 2 }, text: '次の攻撃＋2（使うまで続く）' },
    { id: 'skl-pukarim-10', name: 'おいかぜ', cat: '特', mana: 2, damage: null, effect: { type: 'tailwind', amount: 1 }, text: 'プカリム以外の味方1体、次のターンの攻撃＋1', rare: true },
    { id: 'skl-pukarim-11', name: 'ぷにぷにボディ', cat: '防', mana: 0, damage: null, effect: guard(3, 'force'), text: T_FORCE },
    { id: 'skl-pukarim-12', name: 'くうきのクッション', cat: '防', mana: 2, damage: null, effect: guard(4, 'all'), text: T_BOTH, rare: true },
  ],
  // フルーネ（地上・LIFE 10）
  'mon-flune': [
    { id: 'skl-flune-01', name: 'つたはたき', cat: 'ち', mana: 0, damage: 1, text: null },
    { id: 'skl-flune-02', name: 'ねっこづき', cat: 'ち', mana: 1, damage: 1, text: null },
    { id: 'skl-flune-03', name: 'ねっこムチ', cat: 'ち', mana: 2, damage: 2, text: null },
    { id: 'skl-flune-04', name: 'ねっこラッシュ', cat: 'ち', mana: 3, damage: 3, text: null },
    { id: 'skl-flune-05', name: 'たねとばし', cat: 'か', mana: 1, damage: 1, text: null },
    { id: 'skl-flune-06', name: 'はなびらシュート', cat: 'か', mana: 2, damage: 2, text: null },
    { id: 'skl-flune-07', name: 'かふん', cat: 'か', mana: 3, damage: 1, effect: atk({ manaDrain: 3 }), text: '相手のマナ−3', rare: true },
    { id: 'skl-flune-08', name: 'はなびらストーム', cat: 'か', mana: 4, damage: 5, text: null, rare: true },
    { id: 'skl-flune-09', name: 'フラワードレイン', cat: 'か', mana: 5, damage: 3, effect: atk({ drain: true }), text: '与えたダメージぶん回復', rare: true },
    { id: 'skl-flune-10', name: 'いやしのみつ', cat: '特', mana: 2, damage: null, effect: { type: 'healAlly', amount: 2 }, text: '味方1体のライフ＋2', rare: true },
    { id: 'skl-flune-11', name: 'はっぱのたて', cat: '防', mana: 2, damage: null, effect: guard(3, 'force'), text: T_FORCE },
    { id: 'skl-flune-12', name: 'はなびらのまく', cat: '防', mana: 2, damage: null, effect: guard(3, 'wisdom'), text: T_WISDOM },
  ],
  // セレフィーン（水中・LIFE 6）
  'mon-serephine': [
    { id: 'skl-serephine-01', name: 'ビンタ', cat: 'ち', mana: 0, damage: 1, text: null },
    { id: 'skl-serephine-02', name: 'おびれ', cat: 'ち', mana: 1, damage: 1, text: null },
    { id: 'skl-serephine-03', name: 'ウォーターウィップ', cat: 'ち', mana: 2, damage: 2, text: null },
    { id: 'skl-serephine-04', name: 'みずたま', cat: 'か', mana: 1, damage: 1, text: null },
    { id: 'skl-serephine-05', name: 'なみ打ち', cat: 'か', mana: 2, damage: 1, effect: atk({ undodgeable: true }), text: T_UNDODGE },
    { id: 'skl-serephine-07', name: 'アクアニードル', cat: 'か', mana: 3, damage: 3, effect: atk({ undodgeable: true }), text: T_UNDODGE, rare: true },
    { id: 'skl-serephine-08', name: 'ルナタイド', cat: 'か', mana: 4, damage: 5, effect: atk({ unblockableVsWater: true }), text: '水中の相手には防御されない', rare: true },
    { id: 'skl-serephine-09', name: 'オーシャンウェーブ', cat: 'か', mana: 4, damage: 5, effect: atk({ undodgeableVsWater: true }), text: '水中の相手は回避できない', rare: true },
    { id: 'skl-serephine-10', name: 'みちしお', cat: '特', mana: 2, damage: null, effect: { type: 'tide' }, text: T_TIDE },
    { id: 'skl-serephine-12', name: 'すいっとよける', cat: '避', mana: 1, damage: null, effect: dodge('force'), text: T_DODGE_FORCE },
    { id: 'skl-serephine-13', name: 'ゆらりとかわす', cat: '避', mana: 1, damage: null, effect: dodge('wisdom'), text: 'かしこさ技を回避' },
    { id: 'skl-serephine-14', name: 'ウェーブダンス', cat: '避', mana: 2, damage: null, effect: dodge('all'), text: T_DODGE_ALL, rare: true },
  ],
  // ツムジ（地上・LIFE 6）
  'mon-tsumuji': [
    { id: 'skl-tsumuji-01', name: 'ひっかく', cat: 'ち', mana: 0, damage: 1, text: null },
    { id: 'skl-tsumuji-02', name: 'Wひっかき', cat: 'ち', mana: 1, damage: 1, effect: atk({ chain: true }), text: '同じターンにもう1枚続けて使える' },
    { id: 'skl-tsumuji-05', name: 'とびかかる', cat: 'ち', mana: 2, damage: 2, text: null },
    { id: 'skl-tsumuji-07', name: 'みだれぎり', cat: 'ち', mana: 3, damage: 3, text: null },
    { id: 'skl-tsumuji-10', name: 'ストームブレイド', cat: 'ち', mana: 5, damage: 6, text: null, rare: true },
    { id: 'skl-tsumuji-03', name: 'かまいたち', cat: 'か', mana: 1, damage: 2, text: null, rare: true },
    { id: 'skl-tsumuji-04', name: 'つむじかぜ', cat: 'か', mana: 1, damage: 1, effect: atk({ undodgeable: true }), text: T_UNDODGE },
    { id: 'skl-tsumuji-06', name: 'かぜのやいば', cat: 'か', mana: 2, damage: 2, text: null },
    { id: 'skl-tsumuji-09', name: 'あらし', cat: 'か', mana: 4, damage: 4, effect: atk({ undodgeableVsAir: true }), text: '空中の相手は回避できない' },
    { id: 'skl-tsumuji-08', name: 'かぜのり', cat: '特', mana: 0, damage: null, effect: { type: 'windRide', discount: 1 }, text: '次のターン、ツムジの攻撃のマナ−1', rare: true },
    { id: 'skl-tsumuji-12', name: 'ひらりとかわす', cat: '避', mana: 1, damage: null, effect: dodge('force'), text: T_DODGE_FORCE },
    { id: 'skl-tsumuji-14', name: 'かぜよみ', cat: '避', mana: 2, damage: null, effect: dodge('all'), text: T_DODGE_ALL, rare: true },
  ],
  // ジオル（地上・LIFE 9）
  'mon-geol': [
    { id: 'skl-geol-01', name: 'いしなげ', cat: 'ち', mana: 2, damage: 2, text: null },
    { id: 'skl-geol-02', name: 'いわくだき', cat: 'ち', mana: 3, damage: 3, effect: atk({ unblockable: true }), text: T_UNBLOCK },
    { id: 'skl-geol-03', name: 'ナックル', cat: 'ち', mana: 3, damage: 5, text: null, rare: true },
    { id: 'skl-geol-04', name: 'ぶんまわし', cat: 'ち', mana: 4, damage: 6, text: null },
    { id: 'skl-geol-05', name: '地ひびき', cat: 'ち', mana: 6, damage: 3, effect: atk({ allTargets: true, groundOnly: true }), text: '地上の相手全員に当たる（守りは1体ずつ）', rare: true },
    { id: 'skl-geol-06', name: 'グランドハンマー', cat: 'ち', mana: 6, damage: 9, text: null, rare: true },
    { id: 'skl-geol-07', name: 'クリスタルショット', cat: 'か', mana: 3, damage: 3, text: null },
    { id: 'skl-geol-08', name: 'クリスタルレイ', cat: 'か', mana: 4, damage: 4, text: null },
    { id: 'skl-geol-10', name: 'エネルギーをためる', cat: '特', mana: 2, damage: null, effect: { type: 'energy' }, text: '次のターン、最初のかしこさ技を2倍に' },
    { id: 'skl-geol-11', name: 'かばう', cat: '防', mana: 1, damage: null, effect: { type: 'cover' }, text: '味方への攻撃を代わりに受ける' },
    { id: 'skl-geol-13', name: 'すいしょうのたて', cat: '防', mana: 3, damage: null, effect: guard(3, 'wisdom'), text: T_WISDOM },
    { id: 'skl-geol-14', name: 'うけとめる', cat: '防', mana: 2, damage: null, effect: guard(5, 'force'), text: T_FORCE, rare: true },
  ],
  // ヒョウズク（空中・LIFE 7）
  'mon-hyouzuku': [
    { id: 'skl-hyouzuku-01', name: 'ついばむ', cat: 'ち', mana: 1, damage: 1, text: null },
    { id: 'skl-hyouzuku-02', name: 'かぎづめ', cat: 'ち', mana: 2, damage: 2, text: null },
    { id: 'skl-hyouzuku-06', name: 'こおりわり', cat: 'ち', mana: 2, damage: 2, effect: atk({ unblockable: true }), text: T_UNBLOCK },
    { id: 'skl-hyouzuku-07', name: 'きゅうこうか', cat: 'ち', mana: 3, damage: 4, text: null },
    { id: 'skl-hyouzuku-03', name: 'こなゆき', cat: 'か', mana: 1, damage: 2, text: null },
    { id: 'skl-hyouzuku-04', name: 'つららおとし', cat: 'か', mana: 2, damage: 3, text: null },
    { id: 'skl-hyouzuku-05', name: 'こおりのいき', cat: 'か', mana: 3, damage: 2, effect: atk({ stunTarget: true, stunMark: 'frozen' }), text: '相手は次のターン行動できない', rare: true },
    { id: 'skl-hyouzuku-08', name: 'つららのあめ', cat: 'か', mana: 5, damage: 2, effect: atk({ allTargets: true }), text: '相手全員に当たる（守りは1体ずつ）' },
    { id: 'skl-hyouzuku-09', name: 'ふぶき', cat: 'か', mana: 4, damage: 3, effect: atk({ stunTarget: true, stunMark: 'frozen' }), text: '相手は次のターン行動できない', rare: true },
    { id: 'skl-hyouzuku-10', name: 'ひょうが', cat: 'か', mana: 5, damage: 6, text: null, rare: true },
    { id: 'skl-hyouzuku-13', name: 'まいあがる', cat: '避', mana: 2, damage: null, effect: dodge('all'), text: T_DODGE_ALL },
    { id: 'skl-hyouzuku-14', name: 'おとなきはばたき', cat: '避', mana: 1, damage: null, effect: dodge('all'), text: T_DODGE_ALL, rare: true },
  ],
  // シシエン（地上・LIFE 7）
  'mon-shishien': [
    { id: 'skl-shishien-01', name: 'じゃれつく', cat: 'ち', mana: 1, damage: 1, text: null },
    { id: 'skl-shishien-02', name: 'がぶり', cat: 'ち', mana: 2, damage: 2, text: null },
    { id: 'skl-shishien-07', name: 'すてみタックル', cat: 'ち', mana: 2, damage: 4, effect: atk({ selfDamageOnHit: 1 }), text: '当たると自分のライフ−1' },
    { id: 'skl-shishien-05', name: 'とっしん', cat: 'ち', mana: 3, damage: 4, text: null },
    { id: 'skl-shishien-09', name: 'れんごくのとっしん', cat: 'ち', mana: 5, damage: 9, effect: atk({ selfDamageOnHit: 3 }), text: '当たると自分のライフ−3', rare: true },
    { id: 'skl-shishien-03', name: 'ひのこ', cat: 'か', mana: 1, damage: 1, text: null },
    { id: 'skl-shishien-04', name: 'ねっぷう', cat: 'か', mana: 2, damage: 3, text: null },
    { id: 'skl-shishien-06', name: 'たてがみのひばな', cat: 'か', mana: 3, damage: 4, text: null },
    { id: 'skl-shishien-08', name: 'もえるたてがみ', cat: 'か', mana: 3, damage: 6, effect: atk({ selfDamageOnHit: 2 }), text: '当たると自分のライフ−2', rare: true },
    { id: 'skl-shishien-10', name: 'ほのおのほうこう', cat: 'か', mana: 6, damage: 8, effect: atk({ selfDamageOnHit: 2 }), text: '当たると自分のライフ−2', rare: true },
    { id: 'skl-shishien-11', name: 'たてがみでうける', cat: '防', mana: 1, damage: null, effect: guard(3, 'force'), text: T_FORCE },
    { id: 'skl-shishien-12', name: 'ねつのとばり', cat: '防', mana: 2, damage: null, effect: guard(3, 'all'), text: T_BOTH, rare: true },
  ],
  // ハクラン（地上・LIFE 7）
  'mon-hakuran': [
    { id: 'skl-hakuran-01', name: 'ひづめならし', cat: 'ち', mana: 0, damage: 1, text: null },
    { id: 'skl-hakuran-02', name: 'つのでこづく', cat: 'ち', mana: 1, damage: 1, effect: atk({ undodgeable: true }), text: T_UNDODGE },
    { id: 'skl-hakuran-04', name: 'ひづめげり', cat: 'ち', mana: 2, damage: 3, text: null },
    { id: 'skl-hakuran-07', name: 'つのつき', cat: 'ち', mana: 3, damage: 3, effect: atk({ undodgeable: true }), text: T_UNDODGE },
    { id: 'skl-hakuran-06', name: 'くもをける', cat: 'ち', mana: 3, damage: 4, text: null },
    { id: 'skl-hakuran-09', name: 'てんをかける', cat: 'ち', mana: 4, damage: 6, text: null, rare: true },
    { id: 'skl-hakuran-03', name: 'くもだま', cat: 'か', mana: 1, damage: 1, text: null },
    { id: 'skl-hakuran-05', name: 'みぬくひとみ', cat: 'か', mana: 2, damage: 2, effect: atk({ undodgeable: true }), text: T_UNDODGE },
    { id: 'skl-hakuran-08', name: 'らいうん', cat: 'か', mana: 4, damage: 4, effect: atk({ undodgeable: true }), text: T_UNDODGE, rare: true },
    { id: 'skl-hakuran-10', name: 'せいなるいかずち', cat: 'か', mana: 5, damage: 7, text: null, rare: true },
    { id: 'skl-hakuran-12', name: 'ひらりとはねる', cat: '避', mana: 1, damage: null, effect: dodge('all', 3), text: 'マナ3以上のちから技・かしこさ技を回避' },
    { id: 'skl-hakuran-14', name: 'かすみのあゆみ', cat: '避', mana: 2, damage: null, effect: dodge('all'), text: T_DODGE_ALL, rare: true },
  ],
  // デスオル（空中・LIFE 7・A）
  'mon-desuoru': [
    { id: 'skl-desuoru-01', name: 'いしづきでつく', cat: 'ち', mana: 0, damage: 1, text: null },
    { id: 'skl-desuoru-02', name: 'てっこうのつめ', cat: 'ち', mana: 1, damage: 2, text: null },
    { id: 'skl-desuoru-03', name: 'やみがらす', cat: 'か', mana: 1, damage: 2, text: null },
    { id: 'skl-desuoru-04', name: 'しのささやき', cat: 'か', mana: 2, damage: 4, text: null },
    // 新しい技（絵はデザイン担当に依頼中。届くまで、外した めいかいのかぜ の絵）
    {
      id: 'skl-desuoru-15', name: 'ししゃのたむけ', cat: 'か', mana: 3, damage: 4,
      effect: atk({ fallenAllyBonus: 2 }), text: '倒れている味方1体につき＋2', tempArt: 'desuoru_sk_05.webp',
    },
    { id: 'skl-desuoru-07', name: 'やみのやり', cat: 'ち', mana: 4, damage: 6, effect: atk({ unblockable: true }), text: T_UNBLOCK },
    { id: 'skl-desuoru-06', name: 'しのゆびさし', cat: 'か', mana: 4, damage: 5, effect: atk({ undodgeable: true }), text: T_UNDODGE, rare: true },
    { id: 'skl-desuoru-08', name: 'ヘルのもん', cat: 'か', mana: 6, damage: 10, text: null, rare: true },
    { id: 'skl-desuoru-10', name: 'カラスのめ', cat: '特', mana: 3, damage: null, effect: { type: 'discardChoice' }, text: '相手の手札をすべて見て1枚選んで捨てさせる', rare: true },
    // 新しい技（絵はデザイン担当に依頼中。届くまで、外した やみのころも の絵）
    {
      id: 'skl-desuoru-16', name: 'しのレクイエム', cat: '特', mana: 4, damage: null,
      effect: { type: 'requiem' }, text: 'ライフ1以下の、デスオル以外のモンスターをすべて倒す', tempArt: 'desuoru_sk_11.webp',
    },
    { id: 'skl-desuoru-12', name: 'ルーンのまもり', cat: '防', mana: 0, damage: null, effect: guard(3, 'wisdom'), text: T_WISDOM },
    { id: 'skl-desuoru-14', name: 'やみにまぎれる', cat: '避', mana: 2, damage: null, effect: dodge('all'), text: T_DODGE_ALL, rare: true },
  ],
};

/** 指示書 AJ で作り直した 15体（並び＝今までのモンスターの並び） */
export const AJ_MONSTER_IDS: readonly string[] = Object.keys(AJ_SKILLS);

/** レアの枠の技の名前（ガチャのシリーズの rareSkillNames） */
export function ajRareNames(monsterId: string): string[] {
  return (AJ_SKILLS[monsterId] ?? []).filter((r) => r.rare).map((r) => r.name);
}

/** 最初の箱の技の枚数（box の書いてある子だけ。[ID, 枚数] の並び） */
export function ajBoxRows(monsterId: string): [string, number][] {
  return (AJ_SKILLS[monsterId] ?? []).filter((r) => (r.box ?? 0) > 0).map((r) => [r.id, r.box ?? 0]);
}
