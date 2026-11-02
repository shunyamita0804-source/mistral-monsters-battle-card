/**
 * 序盤〜C大会後のイベント（2026-11-02 指示書 AT。正本は design-parts/story-events-at-20261102/02_events_scenario_FINAL.md）。
 *
 * - 1つのイベント＝1つのデータ（ID・章・順番・起きるきっかけ・一度だけの印・せりふ・顔の絵・挿絵・カードの見せ方）。ここは「何を見せるか」だけ。
 *   いつ起きるか（条件）は src/game/story/storyEvents.ts、画面は src/ui/components/storyEventPlayer.ts
 * - 一度だけの印は storyFlags の `storyevt:<id の小文字>`（storyEventFlag）
 * - 話し手は src/data/people.ts の人の ID（顔の絵は今の顔の絵）。'system' は地の文（名前の札なし）
 * - せりふの {nextMonth}（次の公式戦の月）・{missing}（まだ倒していない守り手）などは、画面に出すときにデータ（calendar.ts・entryCheck）から入れる。数字は焼きこまない
 * - **守り手の前の場面（guardianFront）にはカードを出さない**（tests/storyEvents.test.ts で確かめる）。守り手の戦う前のせりふは今のもの（src/data/people.ts）をそのまま使い、ここには書かない
 * - カードの見せ方：owned（持っている）／preview_only（見せるだけ。図鑑・NEW・ガチャの開放・cardsSeen を変えない）／reward（今の報酬の処理が終わったあとだけ）
 * - イベントで新しいカード・お金を渡さない（このファイルに「渡す」データは無い）
 * - 英語はすべて仮訳
 */
import type { MessageEntry } from '../i18n/i18n.ts';

/** イベントの ID（M20 は欠番。M00・M01 は今のまま〔ここには無い〕。O04 は広告の行を除いた2行・O07・O08 は作らない） */
export type StoryEventId =
  | 'M02' | 'M03' | 'M04' | 'M05' | 'M05W' | 'M06' | 'M07' | 'M08' | 'M09' | 'M10' | 'M11' | 'M11T' | 'M12'
  | 'M13' | 'M14' | 'M15' | 'M16' | 'M17' | 'M17R' | 'M18' | 'M18F' | 'M19' | 'M19R' | 'M21' | 'M22'
  | 'M23' | 'M24' | 'M24I' | 'M24R' | 'M25' | 'M25B' | 'M25R' | 'M26' | 'M27' | 'M27E' | 'M28' | 'M29' | 'M30'
  | 'O01' | 'O02' | 'O03' | 'O04' | 'O05' | 'O06' | 'O09' | 'O10' | 'O11S' | 'O11A' | 'O11W' | 'O11P';

/** 話し手：人の ID（src/data/people.ts）か地の文 */
export type EventSpeaker = 'system' | 'mireille' | 'nina' | 'lucas' | 'celia' | 'gareth' | 'martha' | 'pete' | 'rosalie' | 'harold' | 'noel' | 'viktor' | 'sienna' | 'dario' | 'isabella' | 'gordon' | 'flora';

/** 1行が出るときの条件（そのイベントの結果・状況。src/game/story/storyEvents.ts の EventContext） */
export type LineWhen = 'won' | 'lost' | 'earlyLoss' | 'forestCleared';

export interface EventLine {
  readonly speaker: EventSpeaker;
  readonly text: MessageEntry;
  readonly when?: LineWhen;
}

/** 選択肢（選んだあとの返事。action は選んだあとに画面ですること） */
export interface EventChoice {
  readonly label: MessageEntry;
  readonly reply?: readonly EventLine[];
  readonly action?: 'showWindValley' | 'openBook' | 'showWaterTemple' | 'showSpiritForest' | 'repeat';
}

/** 物語の挿絵（design-parts/story-stills-20261030/。上の3分の1に白い字。textTop は字を上に寄せる〔story_02 のセラの顔にかけない〕） */
export type StillId = 'story_01_meet_sienna' | 'story_02_silver_clasp' | 'story_04_final_sienna';

/**
 * カードの見せ方。cards は ID、または画面で決める特別な指定
 * - 'boxMonsters'：選んだ最初の箱の3体 ／ 'deckMonsters'：いまのデッキの3体 ／ 'firstOwned'：持っているカード1枚（デッキの1体目）／ 'ownedSkill'：持っている技カード1枚
 */
export type CardRef = string | 'boxMonsters' | 'deckMonsters' | 'firstOwned' | 'ownedSkill';
export interface CardShow {
  readonly mode: 'owned' | 'preview_only' | 'reward';
  readonly cards: readonly CardRef[];
  /** 見せている人（preview_only のとき。「ピートのカード」など） */
  readonly holder?: EventSpeaker;
}

export type EventStep =
  | { readonly kind: 'line'; readonly line: EventLine }
  | { readonly kind: 'still'; readonly still: StillId; readonly textTop?: boolean; readonly lines: readonly EventLine[] }
  | { readonly kind: 'cards'; readonly show: CardShow }
  | { readonly kind: 'choice'; readonly choices: readonly EventChoice[] }
  /** 世界地図でダンジョンを順に光らせる（地図を開いて印を光らせる） */
  | { readonly kind: 'map'; readonly highlight: readonly string[] }
  /** 目標の表示だけ（ゲームの決まりは変えない） */
  | { readonly kind: 'objective'; readonly text: MessageEntry };

/** イベントが起きるきっかけ（src/game/story/storyEvents.ts の pendingStoryEvent に渡す） */
export type EventTrigger =
  | 'introDone' // 導入が終わって街に出たとき（M03）
  | 'townEnter' // 街・部屋に入って落ち着いたとき（M11T・M21・M28 など。報酬・月が進む演出のあと）
  | 'talk' // 人に話しかけたとき（npc に人の ID）
  | 'desk' // 家のデッキ編集の机を調べたとき
  | 'board' // 管理局の掲示板を見たとき
  | 'gacha' // カードショップの販売機を調べたとき
  | 'mapOpen' // 世界地図（ダンジョンを選ぶ所）を開いたとき
  | 'dungeonEnter' // ダンジョンに入ったとき（入場の絵のあと。dungeon にダンジョンの ID）
  | 'battler' // ダンジョンのバトラーに初めて話しかけたとき（フローラ）
  | 'guardian' // 守り手に話しかけたとき（今のせりふだけ。ここでは何も足さない）
  | 'reward' // 守り手に初めて勝ち、今の報酬の処理が終わったあと（dungeon にダンジョンの ID）
  | 'tournamentEntry' // 大会に初めてエントリーしたとき（rank）
  | 'match' // 大会の試合の前（opponent に相手の人の ID）
  | 'final' // C 大会の決勝の前（相手がシエナのとき）
  | 'finalEnd' // C 大会の決勝が終わったとき（相手がシエナのとき）
  | 'tournamentEnd' // 大会が初めて終わったとき（rank）
  | 'season' // 季節が初めて変わったとき（season）
  | 'loss' // ふつうの対戦で初めて負けたあと、教習所でガレスに話しかけたとき（talk で扱う）
  | 'chain'; // ほかのイベントのすぐあと（after に前のイベント）

export interface StoryEventDefinition {
  readonly id: StoryEventId;
  /** 章（0〜6）と章の中の順番 */
  readonly chapter: number;
  readonly order: number;
  readonly title: MessageEntry;
  /** 必須（main）か任意（optional） */
  readonly kind: 'main' | 'optional';
  readonly trigger: EventTrigger;
  /** talk・battler のときの人の ID */
  readonly npc?: EventSpeaker | 'pete';
  /** dungeonEnter・reward のときのダンジョン */
  readonly dungeon?: string;
  /** tournamentEntry・tournamentEnd のときのランク */
  readonly rank?: 'E' | 'D' | 'C';
  /** match のときの相手（大会の相手の人の ID） */
  readonly opponent?: string;
  /** season のときの季節 */
  readonly season?: 'spring' | 'summer' | 'autumn' | 'winter';
  /** chain のとき、すぐ前のイベント */
  readonly after?: StoryEventId;
  /** 守り手の前の場面（カード・技の絵・パックを出さない） */
  readonly guardianFront?: boolean;
  /** 挿絵の場面（自動の表示は1回だけ） */
  readonly steps: readonly EventStep[];
}

const L = (speaker: EventSpeaker, ja: string, en: string, when?: LineWhen): EventStep => ({ kind: 'line', line: { speaker, text: { ja, en }, ...(when ? { when } : {}) } });
const line = (speaker: EventSpeaker, ja: string, en: string, when?: LineWhen): EventLine => ({ speaker, text: { ja, en }, ...(when ? { when } : {}) });

export const STORY_EVENTS: readonly StoryEventDefinition[] = [
  // ---------- 第0章 街とカード ----------
  {
    id: 'M02', chapter: 0, order: 2, kind: 'main', trigger: 'chain', title: { ja: '最初の箱', en: 'Your First Box' },
    // 管理局で箱を受け取った直後（今の「受け取った」お知らせのあと）。3体を1枚ずつ大きく見せる（もう持っているカード。二重に渡さない）
    steps: [
      { kind: 'cards', show: { mode: 'owned', cards: ['boxMonsters'] } },
      L('system', 'あなたの最初のカードたち。これから、どんなデッキになるだろう。', 'Your very first cards. What kind of deck will they become?'),
    ],
  },
  {
    id: 'M03', chapter: 0, order: 3, kind: 'main', trigger: 'introDone', title: { ja: 'ミレイユの案内（風の渓谷へ）', en: "Mireille's Guidance" },
    steps: [
      L('mireille', 'これであなたも、プロのカードバトラーだね！ 大会にも出られるよ。', "Now you're a pro card battler too! You can enter cups now."),
      L('mireille', 'でも、公式戦にはひとつ条件があるの。いまのランクの試練を越えていること。', "But official cups have one condition: you must clear your rank's trial."),
      { kind: 'map', highlight: ['dungeon-08'] },
      L('mireille', '最初の試練は『{firstDungeon}』。いちばん奥の守り手に勝てたら、大会に出られるようになるよ。', "The first trial is the {firstDungeon}. Beat the keeper deep inside and you can enter the cups."),
      L('mireille', '大会は毎月じゃなくて、決まった月にだけ開かれるの。次は{nextMonth}だよ。', 'Cups are held only in certain months, not every month. The next one is in {nextMonth}.'),
      L('mireille', 'お知らせは管理局の掲示板、公式戦のくわしいことは大会会場で聞いてね。', 'News goes up on the Bureau notice board. Ask at the cup hall for details on official cups.'),
      {
        kind: 'choice',
        choices: [
          { label: { ja: '風の渓谷の場所を地図で見る', en: "Show the Wind Valley on the map" }, action: 'showWindValley' },
          { label: { ja: 'いまは大丈夫', en: "I'm fine for now" } },
        ],
      },
      { kind: 'objective', text: { ja: '風の渓谷を探検しよう', en: 'Explore the Wind Valley' } },
    ],
  },
  // ---------- 第1章 カードを好きになる街（どれも任意） ----------
  {
    id: 'M04', chapter: 1, order: 4, kind: 'optional', trigger: 'talk', npc: 'nina', title: { ja: 'ニーナのおすすめ', en: "Nina's Pick" },
    steps: [
      L('nina', 'いらっしゃいませ！ 登録したばかりのカードバトラーさんですね。', "Welcome! You must be a newly registered card battler."),
      L('nina', 'カードを集めて、技を組み合わせるのが楽しいんですよ。', "Collecting cards and combining skills is the fun part."),
      L('nina', 'たとえば、これ。プカリムのカードです。', "For example, this one. It's a Pukarim card."),
      { kind: 'cards', show: { mode: 'preview_only', cards: ['mon-pukarim'], holder: 'nina' } },
      L('nina', '同じモンスターでも、どんな技を集めるかで戦い方が変わるんです。', "Even with the same monster, the skills you collect change how you fight."),
      L('nina', 'プカリムが好きな人なら……店の外にいるピートさんがくわしいかも。', "If you like Pukarim... Pete outside the shop might know a lot."),
    ],
  },
  {
    id: 'M05', chapter: 1, order: 5, kind: 'optional', trigger: 'talk', npc: 'pete', title: { ja: 'ピートのカード自慢', en: "Pete's Prized Card" },
    // 今の対戦の前に足す。ピートは守り手ではないので、自分のプカリムを見せてよい（ピートの持ち物。見せるだけ）
    steps: [
      L('pete', 'その箱、きみの最初のデッキ？ いいな、新しいカードってわくわくするよな！', "Is that box your first deck? Nice, new cards are so exciting!"),
      L('pete', '見てくれよ、これがぼくのお気に入り、プカリム！', "Check it out, this is my favorite, Pukarim!"),
      { kind: 'cards', show: { mode: 'preview_only', cards: ['mon-pukarim'], holder: 'pete' } },
      L('pete', '技を集めるのにずいぶん苦労したんだ。', "It took me ages to collect its skills."),
      L('pete', '勝負しよう！ きみが勝ったら、プカリムのカードを1枚ゆずってやるよ。', "Let's battle! If you win, I'll give you a Pukarim card."),
    ],
  },
  {
    id: 'M05W', chapter: 1, order: 5.5, kind: 'optional', trigger: 'chain', after: 'M05', title: { ja: 'ピートに初めて勝ったあと', en: 'After Beating Pete' },
    // 初めて勝ったあと（今の報酬の処理のあと）。報酬は今のまま（初めて＝プカリムのモンスターカード）
    steps: [L('pete', '持ってるだけじゃ、カードの面白さは分からないからな。思いきり使ってくれ！', "Just owning a card won't show you how fun it is. Use it as much as you like!")],
  },
  {
    id: 'M06', chapter: 1, order: 6, kind: 'optional', trigger: 'talk', npc: 'lucas', title: { ja: '研究所のルーカス', en: 'Lucas at the Lab' },
    steps: [
      L('lucas', 'ようこそ、カード研究所へ。君の最初のカード、見せてもらえるかな？', 'Welcome to the Card Lab. May I see your first card?'),
      { kind: 'cards', show: { mode: 'owned', cards: ['firstOwned'] } },
      L('lucas', 'カードには、聖獣の姿や特徴を伝えるための工夫がたくさん詰まっているんだ。', "Cards are full of little touches that convey a sacred beast's form and traits."),
      L('lucas', '集めたカードは、図鑑でも確かめられるよ。', 'You can review the cards you collect in the card book, too.'),
      L('lucas', 'まだ知らない聖獣がいるなら、ぜひ探してみてほしい。', "If there are sacred beasts you don't know yet, I hope you'll seek them out."),
      { kind: 'choice', choices: [{ label: { ja: '図鑑を開く', en: 'Open the card book' }, action: 'openBook' }, { label: { ja: 'またあとで', en: 'Maybe later' } }] },
    ],
  },
  {
    id: 'M07', chapter: 1, order: 7, kind: 'optional', trigger: 'talk', npc: 'celia', title: { ja: '大会受付のセリア', en: 'Celia at the Desk' },
    steps: [
      L('celia', 'ようこそ、公式大会へ。初めての方ですね。', "Welcome to the official cups. This is your first time, isn't it?"),
      L('celia', 'EランクとDランクは4人の総当たり。3人と戦って、1位を目指します。', 'Ranks E and D are 4-player round robins. Battle 3 opponents and aim for first place.'),
      L('celia', 'Cランクからは8人のトーナメントです。', 'From Rank C, it is an 8-player tournament.'),
      L('celia', '出場するには、いまのランクの試練を越えていることが必要です。', "To enter, you must have cleared your current rank's trial."),
      L('celia', '次の公式戦は{nextMonth}。{missingLine}', 'The next official cup is in {nextMonth}. {missingLine}'),
    ],
  },
  {
    id: 'M08', chapter: 1, order: 8, kind: 'optional', trigger: 'desk', title: { ja: '家の机', en: 'Your Desk' },
    steps: [
      { kind: 'cards', show: { mode: 'owned', cards: ['deckMonsters'] } },
      L('system', 'ガレス先生に借りたカードではない。いまここにあるのは、あなた自身のデッキだ。', "These aren't cards borrowed from Gareth. This is your very own deck."),
      L('system', 'デッキはモンスター3体と山札60枚。新しいカードが手に入ったら、組み合わせを考えてみよう。', 'A deck is 3 monsters and 60 cards. When you get new cards, try new combinations.'),
    ],
  },
  // ---------- 第2章 はじめてのダンジョン＝風の渓谷 ----------
  {
    id: 'M09', chapter: 2, order: 9, kind: 'main', trigger: 'dungeonEnter', dungeon: 'dungeon-08', title: { ja: '風の渓谷に初めて入る', en: 'Into the Wind Valley' },
    steps: [
      L('system', '風の渓谷。つり橋の下を、強い風が吹き抜けていく。', 'The Wind Valley. A strong wind blows beneath the rope bridges.'),
      L('system', 'ダンジョンでは、奥へ続く階段を探して進みます。宝箱やカードバトラーに出会うこともあります。', 'In a dungeon, look for stairs leading deeper. You may find chests or meet card battlers.'),
      L('system', '風の吹くマスに乗ると、体が押し流されます。進む向きに気をつけましょう。', 'Step on a windy tile and you will be pushed along. Watch which way you go.'),
      L('system', 'いちばん奥には守り手がいます。負けても、準備してまた挑めます。', 'A keeper waits at the very end. Even if you lose, you can prepare and try again.'),
      {
        kind: 'choice',
        choices: [
          { label: { ja: '進む', en: 'Go on' } },
          { label: { ja: '説明をもう一度', en: 'Explain again' }, action: 'repeat' },
        ],
      },
    ],
  },
  {
    id: 'M10', chapter: 2, order: 10, kind: 'main', trigger: 'guardian', dungeon: 'dungeon-08', guardianFront: true, title: { ja: '守り手ゼフィラ', en: 'Keeper Zephyra' },
    // 今のせりふのまま（src/data/people.ts の zephyra。「……あっ、今のなし！」を必ず残す）。ここでは何も足さない・カードは見せない
    steps: [],
  },
  {
    id: 'M11', chapter: 2, order: 11, kind: 'main', trigger: 'reward', dungeon: 'dungeon-08', title: { ja: 'ウズリオの報酬', en: "Uzurio's Reward" },
    steps: [
      { kind: 'cards', show: { mode: 'reward', cards: ['mon-uzurio'] } },
      L('system', 'ウズリオのカードを手に入れた！', 'You got the Uzurio card!'),
    ],
  },
  {
    id: 'M11T', chapter: 2, order: 11.5, kind: 'main', trigger: 'townEnter', title: { ja: '風の渓谷のあと（ミレイユ）', en: 'After the Wind Valley' },
    steps: [L('mireille', '風の渓谷、越えたんだ！ これで大会に出られるね。', 'You made it through the Wind Valley! Now you can enter the cups.')],
  },
  {
    id: 'M12', chapter: 2, order: 12, kind: 'optional', trigger: 'board', title: { ja: '管理局の掲示板', en: 'The Notice Board' },
    steps: [
      L('system', '公式大会は決まった月にだけ開かれる。次は{nextMonth}。', 'Official cups are held only in certain months. The next is in {nextMonth}.'),
      L('system', '家のベッドで休むと、月が進みます。ダンジョンから戻ったときや、大会が終わったときにも月が進みます。', 'Resting in your bed at home moves time forward a month. Returning from a dungeon or finishing a cup does too.'),
    ],
  },
  // ---------- 第3章 はじめての公式戦＝E大会 ----------
  {
    id: 'M13', chapter: 3, order: 13, kind: 'main', trigger: 'tournamentEntry', rank: 'E', title: { ja: 'シエナとの出会い', en: 'Meeting Sienna' },
    steps: [
      {
        kind: 'still', still: 'story_01_meet_sienna',
        lines: [line('sienna', 'あなたも、今日が初めての公式戦？', 'Is today your first official cup too?')],
      },
      L('sienna', '私はシエナ。いろんな土地を旅しながら、カードバトルをしているの。', "I'm Sienna. I travel from place to place, playing card battles."),
      L('sienna', '知らない街に来ると、知らない組み合わせに出会えるでしょう？ それが楽しみなんだ。', 'In a new town you meet combinations you have never seen, right? I love that.'),
      L('sienna', '勝負は遠慮なしでね。いい試合にしましょう。', "Don't hold back. Let's have a good match."),
      {
        kind: 'choice',
        choices: [
          { label: { ja: 'よろしく！', en: 'Nice to meet you!' }, reply: [line('sienna', 'うん、こちらこそ！', 'Yes, same here!')] },
          { label: { ja: '負けないよ', en: "I won't lose" }, reply: [line('sienna', 'ふふ、私もそのつもり。', "Heh, that's my plan too.")] },
        ],
      },
    ],
  },
  {
    id: 'M14', chapter: 3, order: 14, kind: 'main', trigger: 'tournamentEnd', rank: 'E', title: { ja: 'E大会のあと', en: 'After the Rank E Cup' },
    steps: [
      L('sienna', 'すごいね！ 最初の大会で優勝なんて。あなたのデッキ、もっと見てみたくなった。', "Amazing! Winning your very first cup. I want to see more of your deck.", 'won'),
      L('sienna', 'お疲れさま。いいところもあったよ。また会場で会いましょう。', 'Good work. You had some great moments. See you at the hall again.', 'lost'),
      L('sienna', '旅をしていると、同じ相手にまた出会うことがあるの。そのときは、前より強くなっていたいな。', "When you travel, you sometimes meet the same opponent again. I want to be stronger by then."),
      L('mireille', 'Dランクだね！ 水の神殿と精霊の森、どっちから行く？', 'Rank D! The Water Temple or the Spirit Forest, which will you try first?', 'won'),
      L('mireille', '渓谷を越えたんだもん。デッキを少し整えて、また挑戦しよう！', "You made it through the valley. Tune your deck a little and try again!", 'lost'),
    ],
  },
  // ---------- 第4章 水と森＝D ランク ----------
  {
    id: 'M15', chapter: 4, order: 15, kind: 'main', trigger: 'mapOpen', rank: 'D', title: { ja: 'Dランクの新しい場所', en: 'New Places for Rank D' },
    steps: [
      { kind: 'map', highlight: ['dungeon-03', 'dungeon-02'] },
      L('mireille', '新しい場所が開いたね。湖のそばの『水の神殿』と、花の舞う『精霊の森』。', 'New places opened up: the Water Temple by the lake, and the flower-filled Spirit Forest.'),
      L('mireille', '次の大会に出るには、両方の守り手に勝たないとね。', 'To enter the next cup, you need to beat both keepers.'),
      {
        kind: 'choice',
        choices: [
          { label: { ja: '水の神殿を見る', en: 'Look at the Water Temple' }, action: 'showWaterTemple' },
          { label: { ja: '精霊の森を見る', en: 'Look at the Spirit Forest' }, action: 'showSpiritForest' },
          { label: { ja: '閉じる', en: 'Close' } },
        ],
      },
    ],
  },
  {
    id: 'M16', chapter: 4, order: 16, kind: 'main', trigger: 'dungeonEnter', dungeon: 'dungeon-03', title: { ja: '水の神殿に初めて入る', en: 'Into the Water Temple' },
    steps: [
      L('system', '水音が、石造りの神殿の奥まで響いている。', 'The sound of water echoes deep into the stone temple.'),
      L('system', '水路は歩けません。進める道と階段を探しましょう。', "You can't walk on the water channels. Look for paths and stairs."),
    ],
  },
  {
    id: 'M17', chapter: 4, order: 17, kind: 'main', trigger: 'guardian', dungeon: 'dungeon-03', guardianFront: true, title: { ja: '守り手ルシア', en: 'Keeper Lucia' },
    steps: [],
  },
  {
    id: 'M17R', chapter: 4, order: 17.5, kind: 'main', trigger: 'reward', dungeon: 'dungeon-03', title: { ja: 'セレフィーンの報酬', en: "Serephine's Reward" },
    steps: [{ kind: 'cards', show: { mode: 'reward', cards: ['mon-serephine'] } }, L('system', 'セレフィーンのカードを手に入れた！', 'You got the Serephine card!')],
  },
  {
    id: 'M18', chapter: 4, order: 18, kind: 'main', trigger: 'dungeonEnter', dungeon: 'dungeon-02', title: { ja: '精霊の森に初めて入る', en: 'Into the Spirit Forest' },
    steps: [
      L('system', '精霊の森。木々のあいだを、花びらがゆっくり流れている。', 'The Spirit Forest. Petals drift slowly between the trees.'),
      L('system', '見た目より奥が深い森だ。階段を見つけて、一歩ずつ進もう。', 'This forest runs deeper than it looks. Find the stairs and go one step at a time.'),
    ],
  },
  {
    id: 'M18F', chapter: 4, order: 18.5, kind: 'optional', trigger: 'battler', npc: 'flora', dungeon: 'dungeon-02', title: { ja: '森のフローラ', en: 'Flora in the Forest' },
    steps: [
      L('flora', '花を追いかけていたら、さっきいた場所が分からなくなっちゃって。', "I was chasing flowers and lost track of where I'd been."),
      L('flora', 'でも不思議。怖いっていうより、もっと歩いてみたくなる森だね。', "But it's strange. Instead of scary, this forest makes me want to keep walking."),
    ],
  },
  {
    id: 'M19', chapter: 4, order: 19, kind: 'main', trigger: 'guardian', dungeon: 'dungeon-02', guardianFront: true, title: { ja: '守り手セラ', en: 'Keeper Sera' },
    steps: [],
  },
  {
    id: 'M19R', chapter: 4, order: 19.5, kind: 'main', trigger: 'reward', dungeon: 'dungeon-02', title: { ja: 'フルーネの報酬', en: "Flune's Reward" },
    steps: [{ kind: 'cards', show: { mode: 'reward', cards: ['mon-flune'] } }, L('system', 'フルーネのカードを手に入れた！', 'You got the Flune card!')],
  },
  {
    id: 'M21', chapter: 4, order: 21, kind: 'main', trigger: 'townEnter', title: { ja: '銀の留め具', en: 'The Silver Clasp' },
    steps: [
      {
        kind: 'still', still: 'story_02_silver_clasp', textTop: true,
        lines: [
          line('system', '旅のあいだ、ふと思い出したものがあった。', 'Along the way, something suddenly came back to you.'),
          line('system', '森のセラと、神殿のルシア。二人の胸元には、よく似た銀の留め具があった。', "Sera of the forest and Lucia of the temple. Both wore a very similar silver clasp at their chest."),
        ],
      },
      L('system', 'そういえば、風の渓谷のゼフィラも……『ほかの聖地のみんな』と言っていた。', 'Come to think of it, Zephyra of the Wind Valley also mentioned "everyone at the other sacred sites."'),
      L('mireille', 'どうしたの？ さっきから考えごと？', "What's wrong? You've been lost in thought."),
      {
        kind: 'choice',
        choices: [
          { label: { ja: '銀の留め具のことを話す', en: 'Tell her about the silver clasps' }, reply: [line('mireille', 'へえ、そんなところまで見てたんだ。昔から伝わる印なのかな？', 'Huh, you noticed that? Maybe it is some mark handed down from long ago?')] },
          { label: { ja: '何でもない', en: "It's nothing" }, reply: [line('mireille', 'そっか。気になることがあったら、覚えておくといいよ。', "I see. If something's on your mind, it's good to remember it.")] },
        ],
      },
      L('system', '同じものかどうかは分からない。その印だけが、心に残った。', "You can't say whether they were the same. Only that mark stayed with you."),
    ],
  },
  {
    id: 'M22', chapter: 4, order: 22, kind: 'main', trigger: 'tournamentEntry', rank: 'D', title: { ja: 'D大会', en: 'The Rank D Cup' },
    steps: [
      L('dario', 'おお、初めて見る顔だな！ 港町じゃ、カードも網も引きが大事って言うんだ！', "Oh, a new face! Down at the port we say it's all about the pull, cards and nets alike!"),
      L('isabella', 'ごきげんよう。どんなデッキをお使いになるのか、楽しみですわ。', 'Good day. I look forward to seeing what deck you use.'),
      L('gordon', 'ここまで来たからには、小細工だけじゃ勝てんぞ。', "Now that you've come this far, tricks alone won't win."),
      L('celia', 'それでは、Dランク大会を始めます。', 'Now, the Rank D cup begins.'),
    ],
  },
  // ---------- 第5章・第6章 氷と炎＝C ランク、そしてシエナ ----------
  {
    id: 'M23', chapter: 5, order: 23, kind: 'main', trigger: 'mapOpen', rank: 'C', title: { ja: 'Cランクの新しい場所', en: 'New Places for Rank C' },
    steps: [
      { kind: 'map', highlight: ['dungeon-04', 'dungeon-05'] },
      L('mireille', 'Cランクだね！ ここからは、相手も本格的に強くなるよ。', 'Rank C! From here, opponents get seriously strong.'),
      L('mireille', '氷の洞窟と炎の火山。どっちも、足もとに気をつけないといけないみたい。', 'The Ice Cave and the Flame Volcano. Both look like you need to watch your step.'),
      L('mireille', 'カードの組み合わせも、よく考えていこうね。', "Let's think hard about card combinations, too."),
    ],
  },
  {
    id: 'M24', chapter: 5, order: 24, kind: 'main', trigger: 'dungeonEnter', dungeon: 'dungeon-04', title: { ja: '氷の洞窟に初めて入る', en: 'Into the Ice Cave' },
    steps: [L('system', '冷たい空気が満ちている。氷に足をのせると、思ったより遠くまですべってしまう。', 'Cold air fills the cave. Step onto the ice and you slide farther than you expect.')],
  },
  {
    id: 'M24I', chapter: 5, order: 24.3, kind: 'main', trigger: 'guardian', dungeon: 'dungeon-04', guardianFront: true, title: { ja: '守り手イヴァン', en: 'Keeper Ivan' },
    steps: [],
  },
  {
    id: 'M24R', chapter: 5, order: 24.5, kind: 'main', trigger: 'reward', dungeon: 'dungeon-04', title: { ja: 'ヒョウズクの報酬', en: "Hyozuku's Reward" },
    steps: [{ kind: 'cards', show: { mode: 'reward', cards: ['mon-hyouzuku'] } }, L('system', 'ヒョウズクのカードを手に入れた！', 'You got the Hyozuku card!')],
  },
  {
    id: 'M25', chapter: 5, order: 25, kind: 'main', trigger: 'dungeonEnter', dungeon: 'dungeon-05', title: { ja: '炎の火山に初めて入る', en: 'Into the Flame Volcano' },
    steps: [
      L('system', '足もとから、熱い空気がのぼってくる。', 'Hot air rises from beneath your feet.'),
      L('system', '溶岩の明かりで遠くまで見えるが、見えない番人がよく現れる。用心して上へ向かおう。', 'The lava glow lets you see far, but unseen guardians appear often. Head up with care.'),
    ],
  },
  {
    id: 'M25B', chapter: 5, order: 25.3, kind: 'main', trigger: 'guardian', dungeon: 'dungeon-05', guardianFront: true, title: { ja: '守り手バルカ', en: 'Keeper Balka' },
    steps: [],
  },
  {
    id: 'M25R', chapter: 5, order: 25.5, kind: 'main', trigger: 'reward', dungeon: 'dungeon-05', title: { ja: 'シシエンの報酬', en: "Shishien's Reward" },
    steps: [{ kind: 'cards', show: { mode: 'reward', cards: ['mon-shishien'] } }, L('system', 'シシエンのカードを手に入れた！', 'You got the Shishien card!')],
  },
  {
    id: 'M26', chapter: 6, order: 26, kind: 'main', trigger: 'tournamentEntry', rank: 'C', title: { ja: 'C大会の前のシエナ', en: 'Sienna Before the Rank C Cup' },
    steps: [
      L('sienna', 'また会えたね！ Eランクのころより、ずっといい顔をしてる。', 'We meet again! You look so much more confident than back at Rank E.'),
      L('sienna', 'この大会はトーナメント。勝ち続けないと、決勝には行けない。', "This cup is a tournament. You have to keep winning to reach the final."),
      L('sienna', 'もし決勝で会えたら、そのときは全力で勝負しよう。', "If we meet in the final, let's give it everything."),
      L('sienna', '……旅をしているとね、たまに寄り道をしたくなることがあるの。', '...When you travel, sometimes you feel like taking a detour.'),
      {
        kind: 'choice',
        choices: [
          { label: { ja: 'どうしたの？', en: "What's wrong?" }, reply: [line('sienna', 'ううん、まだ何でもない。今日は試合に集中しよう。', "No, it's nothing yet. Let's focus on today's matches.")] },
          { label: { ja: '決勝で会おう', en: 'See you in the final' }, reply: [line('sienna', 'うん。約束だね。', "Yes. It's a promise.")] },
        ],
      },
    ],
  },
  {
    id: 'M27', chapter: 6, order: 27, kind: 'main', trigger: 'final', rank: 'C', title: { ja: 'C大会の決勝のシエナ', en: 'Sienna in the Final' },
    steps: [
      {
        kind: 'still', still: 'story_04_final_sienna',
        lines: [line('sienna', 'やっぱり、ここまで来たんだね。', 'I knew you would make it this far.')],
      },
      L('sienna', '私、カードを集めるのと同じくらい、こうして人と戦う時間が好きなの。', 'I love battling people like this just as much as collecting cards.'),
      L('sienna', 'だから、今日はいちばんいい試合にしたい。いくよ！', "So I want today to be our best match ever. Here I come!"),
    ],
  },
  {
    id: 'M27E', chapter: 6, order: 27.5, kind: 'main', trigger: 'finalEnd', rank: 'C', title: { ja: '決勝のあとのシエナ', en: 'Sienna After the Final' },
    steps: [
      L('sienna', 'お見事。次に会うときは、私ももっと強くなっていたいな。', 'Well played. Next time we meet, I want to be even stronger.', 'won'),
      L('sienna', 'いい試合だったよ。また会えるのを楽しみにしてる。', "That was a great match. I'm looking forward to seeing you again.", 'lost'),
    ],
  },
  {
    id: 'M28', chapter: 6, order: 28, kind: 'main', trigger: 'townEnter', title: { ja: 'シエナがいない', en: 'Sienna Is Gone' },
    steps: [
      L('mireille', 'シエナさん、もう出発したのかな。さっきまでここにいたのに。', 'Did Sienna leave already? She was right here a moment ago.'),
      L('mireille', '大会の途中から、ずっと見かけなくなっちゃった。', "I haven't seen her since partway through the cup.", 'earlyLoss'),
      L('mireille', '次の街の大会にも出るって言ってたけど……ちょっと気になるね。', "She said she'd enter the next town's cup too... I'm a little worried."),
      L('system', 'シエナの姿は、どこにもなかった。', 'Sienna was nowhere to be seen.'),
    ],
  },
  {
    id: 'M29', chapter: 6, order: 29, kind: 'main', trigger: 'talk', npc: 'lucas', title: { ja: '次の物語の入口', en: 'The Next Story Begins' },
    steps: [
      L('lucas', 'シエナさんのことを探しているのかい？', 'Are you looking for Sienna?'),
      L('lucas', '彼女は旅の途中で、古い土地の言い伝えにも興味を持っていたようだね。', 'On her travels, she seemed interested in old local legends.'),
      // 「西の山あい」は仮の言葉（霧の廃坑の場所が世界地図で決まったら合わせる）
      L('lucas', '西の山あいに、霧が出て人が近づかなくなった古い廃坑がある、という話も聞いたことがある。', "I've also heard of an old mine in the western hills where mist rolls in and people no longer go."),
      L('lucas', 'でも、いま分かることはまだ少ない。あわてて危ない場所へ行く必要はないよ。', "But there's still little we know. There's no need to rush somewhere dangerous."),
      L('system', 'シエナの行方、守り手たちの銀の留め具。つながりがあるのかさえ、まだ分からない。', "Sienna's whereabouts, the keepers' silver clasps. You can't even tell yet whether they are connected."),
    ],
  },
  {
    id: 'M30', chapter: 6, order: 30, kind: 'main', trigger: 'chain', after: 'M29', title: { ja: '章の終わり', en: 'End of the Chapter' },
    steps: [
      L('system', 'はじめは、一枚のカードを手に入れることがうれしかった。', 'At first, just getting a single card made you happy.'),
      L('system', 'いまは、そのカードに描かれた世界のことも、少しだけ知りたくなっている。', 'Now you find yourself wanting to know a little more about the world drawn on those cards.'),
    ],
  },
  // ---------- 任意の小さなイベント ----------
  {
    id: 'O01', chapter: 1, order: 101, kind: 'optional', trigger: 'talk', npc: 'martha', title: { ja: 'マルタの花屋', en: "Martha's Flower Shop" },
    steps: [
      L('martha', 'いらっしゃい。花を見に来たの？', 'Welcome. Did you come to see the flowers?'),
      L('martha', 'この街には、花の好きなカードバトラーも多いのよ。あの絵の花、何の花だろうって話す人もいるわ。', 'Lots of card battlers in this town love flowers. Some wonder what flower is in a card picture.'),
      L('martha', 'カードは戦う道具でもあるけれど、きれいな絵を眺めるのも楽しいものね。', 'Cards are for battling, but admiring the pretty art is fun too.'),
      L('martha', '精霊の森まで行ったんだって？ 本当にいい景色だったでしょう。', 'I hear you made it to the Spirit Forest? The scenery is lovely, isn\'t it?', 'forestCleared'),
    ],
  },
  {
    id: 'O02', chapter: 1, order: 102, kind: 'optional', trigger: 'talk', npc: 'rosalie', title: { ja: 'ロザリーの仕立て屋', en: "Rosalie's Tailor Shop" },
    steps: [
      L('rosalie', 'その姿、カードバトラーさんね。大会に出るなら、服のほころびには気をつけて。', 'You look like a card battler. If you enter cups, mind any loose threads.'),
      L('rosalie', '勝ち負けも大事だけど、胸を張って舞台に立つことも大事よ。', 'Winning matters, but so does standing on stage with your head held high.'),
      L('rosalie', '次の大会、応援しているわ。', "I'll be cheering for you at the next cup."),
    ],
  },
  {
    id: 'O03', chapter: 1, order: 103, kind: 'optional', trigger: 'talk', npc: 'harold', title: { ja: 'ハロルドの新聞', en: "Harold's Newspaper" },
    steps: [
      L('harold', 'ほう、新しいカードバトラーか。大会の記事を書くのが昔から好きでな。', "Oh, a new card battler. I've always loved writing about the cups."),
      L('harold', '強い者だけが話題になるわけじゃない。昨日の初心者が、今日は見事な一手を見せたりする。', "It's not only the strong who make the news. Yesterday's beginner can make a brilliant move today."),
      L('harold', '君にも、いつか記事にしたくなるような試合をしてほしいものだ。', "I hope you'll give me a match worth writing about someday."),
    ],
  },
  {
    id: 'O04', chapter: 1, order: 104, kind: 'optional', trigger: 'gacha', title: { ja: 'ニーナのカードの選び方', en: "Nina's Advice on Packs" },
    // 広告の話の行は入れない（広告はまだ無い）
    steps: [
      L('nina', '気になるモンスターが決まっているなら、そのシリーズを選ぶと分かりやすいですよ。1回{gachaPrice}です。', 'If you already have a favorite monster, picking its series makes things easy. One pull is {gachaPrice}.'),
      L('nina', 'ただ、最初は今のデッキを遊びながら、どんな技が欲しいか見つけるのがおすすめです。', 'But at first I suggest playing your current deck to find out which skills you want.'),
    ],
  },
  {
    id: 'O05', chapter: 1, order: 105, kind: 'optional', trigger: 'talk', npc: 'lucas', title: { ja: 'ルーカスの研究ノート', en: "Lucas's Research Notes" },
    // M06 のあと、研究所でルーカスにもう一度話しかけたとき（持っている技カードがあるとき。技の絵を見せるのは持っている技カードだけ）
    steps: [
      L('lucas', '同じ聖獣でも、表現する技が違うと印象が変わるね。', 'Even the same sacred beast leaves a different impression depending on the skill shown.'),
      { kind: 'cards', show: { mode: 'owned', cards: ['ownedSkill'] } },
      L('lucas', '攻撃だけじゃなく、防御や特殊な力にも注目してみて。', 'Pay attention not just to attacks, but to guards and special powers too.'),
      L('lucas', 'どんなカードを組み合わせるか、考えるのが楽しくなるはずだよ。', 'Thinking about which cards to combine should become even more fun.'),
    ],
  },
  {
    id: 'O06', chapter: 1, order: 106, kind: 'optional', trigger: 'talk', npc: 'gareth', title: { ja: 'ガレスのひと言', en: "Gareth's Advice" },
    steps: [
      L('gareth', '負けたのか。悪くない。負けたときに分かることもある。', 'You lost? Not bad. Losing can teach you things.'),
      L('gareth', 'いまのデッキで何が足りなかった？ マナか、それとも守る技か。', 'What did your deck lack? Mana, or guarding skills?'),
      L('gareth', '一度試してみるといい。同じカードでも、手順を変えれば結果は変わる。', 'Give it a try. Even with the same cards, changing the order changes the result.'),
    ],
  },
  {
    id: 'O09', chapter: 3, order: 109, kind: 'optional', trigger: 'match', opponent: 'noel', rank: 'E', title: { ja: 'ノエルの初大会', en: "Noel's First Cup" },
    steps: [
      L('noel', 'わたしも今日が初めてなんです。緊張して、手札を落としそう……。', "It's my first time today too. I'm so nervous I might drop my cards..."),
      L('noel', 'でも、お互いがんばりましょうね！', "But let's both do our best!"),
    ],
  },
  {
    id: 'O10', chapter: 3, order: 110, kind: 'optional', trigger: 'match', opponent: 'viktor', rank: 'E', title: { ja: 'ヴィクトルの高級カード', en: "Viktor's Fine Cards" },
    steps: [
      L('viktor', 'ぼくのカードは、どれもいい物ばかりだよ。手に入れるのに苦労したんだ。', 'My cards are all top quality. They were hard to get.'),
      L('viktor', 'でも……ま、値段だけで勝負が決まるわけじゃないのは知ってるさ。', 'But... well, I know price alone does not decide a match.'),
      L('viktor', 'それを証明してみせてよ。', 'Go ahead and prove it.'),
    ],
  },
  { id: 'O11S', chapter: 1, order: 111, kind: 'optional', trigger: 'season', season: 'summer', title: { ja: '夏の街', en: 'Summer in Town' }, steps: [L('martha', '暑くなると、花の水やりも忙しいのよ。', 'When it gets hot, watering the flowers keeps me busy.')] },
  { id: 'O11A', chapter: 1, order: 112, kind: 'optional', trigger: 'season', season: 'autumn', title: { ja: '秋の街', en: 'Autumn in Town' }, steps: [L('harold', '今年の大会の話も、ずいぶん増えたのう。', "There's been a lot more talk about this year's cups.")] },
  { id: 'O11W', chapter: 1, order: 113, kind: 'optional', trigger: 'season', season: 'winter', title: { ja: '冬の街', en: 'Winter in Town' }, steps: [L('rosalie', '寒いときこそ、温かい服で出かけなさいね。', 'When it is cold, be sure to go out in warm clothes.')] },
  { id: 'O11P', chapter: 1, order: 114, kind: 'optional', trigger: 'season', season: 'spring', title: { ja: '春の街', en: 'Spring in Town' }, steps: [L('mireille', 'また新しい春だね。今年はどんなカードに出会えるかな。', "Another new spring. I wonder what cards we'll meet this year.")] },
];

/** 一度だけの印（storyFlags） */
export const storyEventFlag = (id: StoryEventId): string => `storyevt:${id.toLowerCase()}`;

export function getStoryEvent(id: StoryEventId): StoryEventDefinition {
  const ev = STORY_EVENTS.find((e) => e.id === id);
  if (!ev) throw new Error(`イベントが見つかりません: ${id}`);
  return ev;
}
