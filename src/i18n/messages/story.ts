import type { MessageEntry } from '../i18n.ts';

/**
 * 序盤イベント（となりの家の女性・カード練習場・練習試合）の会話とヒント。
 *
 * - 台詞は「セイモン序盤会話台本 V1」（Seimon_Opening_Tutorial_DesignPack_20261022）の【仮】。ユーザー承認前は正式シナリオではない
 * - 英語は同じ資料の仮訳（正式な英文は未承認）
 * - 女性の正式な名前は未定。名前の札には仮の呼び名「となりの家の女性」を出す
 */
export const STORY = {
  // 名前の札（話している人）
  // 2026-10-27 導入イベントV2：となりの家の女性は主人公の幼馴染（名前は未定なので「幼馴染」）
  'story.speaker.neighborGuide': { ja: '幼馴染', en: 'Childhood Friend' },
  // 【仮】街の人の呼び名（正式な名前は未定。2026-10-23）
  'story.speaker.clerk': { ja: '店員', en: 'Clerk' },
  'story.speaker.researcher': { ja: '研究員', en: 'Researcher' },
  'story.speaker.receptionist': { ja: '受付', en: 'Receptionist' },
  'story.speaker.teacher': { ja: '練習場の先生', en: 'Instructor' },
  'story.speaker.residentA': { ja: '花かごの婦人', en: 'Flower Lady' },
  'story.speaker.residentB': { ja: 'カード好きの青年', en: 'Card Fan' },
  'story.speaker.residentD': { ja: '赤い服の女性', en: 'Woman in Red' },
  'story.speaker.residentE': { ja: '新聞を読む紳士', en: 'Gentleman' },

  // 会話の操作
  'story.ui.skip': { ja: 'スキップ', en: 'Skip' },
  'story.ui.next': { ja: '次へ', en: 'Next' },
  'story.ui.portraitTemp': { ja: '仮', en: 'Temp' },
  'story.ui.portraitNote': { ja: '会話の絵は制作中', en: 'Portrait in progress' },
  'story.expr.normal': { ja: '通常', en: 'Normal' },
  'story.expr.smile': { ja: '笑顔', en: 'Smile' },
  'story.expr.explain': { ja: '説明', en: 'Explain' },
  'story.expr.surprised': { ja: '驚き', en: 'Surprised' },
  'story.expr.troubled': { ja: '困り', en: 'Troubled' },
  'story.expr.happy': { ja: '喜び', en: 'Happy' },

  // 街の目的地の案内（練習場へ向かう間だけ）
  'story.goal.practice': { ja: '目的地：カード練習場（北西）', en: 'Go to: Practice Hall (northwest)' },
  'story.npc.marker': { ja: '人', en: 'NPC' },

  // E01 家から出た直後
  'story.T001': { ja: 'あ、おはよう。ちょうど会いたいと思ってたの。', en: 'Hey, good morning. I was just hoping to see you.' },
  'story.T002': {
    ja: '最近、街でもカードバトルの話ばかり。あなたはもう遊んでみた？',
    en: 'Everyone in town has been talking about card battles lately. Have you tried one yet?',
  },
  'story.T003.a': { ja: 'まだ', en: 'Not yet' },
  'story.T003.b': { ja: '少しだけ', en: 'Just a little' },
  'story.T004A': { ja: 'それなら、ちょうどよかった。', en: "Then I've got perfect timing." },
  'story.T004B': { ja: 'じゃあ、今度一緒にやってみない？', en: "Then why don't we try it together sometime?" },

  // E02 世界と遊びへの誘い
  'story.T005': {
    ja: '聖獣をモチーフにしたカードで対戦するの。いま、あちこちで人気なんだよ。',
    en: "You battle using cards inspired by sacred beasts. It's catching on everywhere.",
  },
  'story.T006': { ja: '本物の聖獣が戦うわけじゃないから、そこは安心して。', en: "The real beasts don't fight, so there's no need to worry." },
  'story.T007': { ja: 'よかったら、練習場で一度やってみない？', en: 'Would you like to try a practice match?' },
  'story.T008.a': { ja: '練習してみる', en: "Let's practice" },
  'story.T008.b': { ja: 'あとで', en: 'Maybe later' },
  'story.T009A': { ja: '決まり！　じゃあ、練習場へ行こう。', en: "It's a deal! Let's head to the practice hall." },
  'story.T009B': { ja: 'もちろん。気が向いたら声をかけてね。', en: 'Of course. Just let me know whenever you feel like it.' },

  // E04 練習場への案内
  'story.T010': {
    ja: '練習場は街の北西側。噴水のある広場を通っていけるよ。',
    en: 'The practice hall is in the northwest part of town. You can get there through the fountain square.',
  },
  'story.T011': { ja: '急がなくていいから、景色を見ながら行こう。', en: 'No need to rush. We can enjoy the walk.' },

  // E05 カード練習場の入口・練習開始
  'story.T012': { ja: '着いたね。ここなら、初めてでも気軽に試せるよ。', en: 'Here we are. This is a great place to give it a try.' },
  'story.T013': { ja: '難しく考えなくて大丈夫。カードを使いながら覚えていこう。', en: "Don't worry about remembering everything. You'll learn as you play." },
  'story.T014.a': { ja: '対戦してみる', en: 'Start a match' },
  'story.T014.b': { ja: '今はやめる', en: 'Not right now' },

  // E06 対戦開始前
  'story.T015': { ja: '対戦では、三体の聖獣カードを場に出すんだ。', en: 'In a card battle, you start with three sacred beast cards in play.' },
  'story.T016': {
    ja: '手札の技を使って、相手のカードのライフを減らしていくの。',
    en: "You use cards from your hand to reduce the Life of your opponent's cards.",
  },
  'story.T017': {
    ja: 'カードをマナに変えるか、技として使うか。その選び方が大事だよ。',
    en: 'Choosing which cards to play and which to turn into Mana makes a big difference.',
  },

  // E07 対戦後
  'story.T018W': { ja: '初めてとは思えないね。なかなかやるじゃない。', en: 'Not bad at all for your first match.' },
  'story.T018L': {
    ja: 'いい勝負だったね。最初は少しずつ慣れれば大丈夫。',
    en: "That was a good match! You'll get the hang of it with practice.",
  },
  'story.T019': {
    ja: 'ほかのカードを集めたり、デッキを工夫したりすると、戦い方も変わってくるよ。',
    en: 'Collecting more cards and building new decks opens up all kinds of strategies.',
  },
  'story.T020': {
    ja: '街にはほかにもいろんな場所があるし、自由に見て回ってね。',
    en: "There's plenty more to see around town, so feel free to explore.",
  },
  // 2026-10-23：最初の練習試合のあと、案内役は家に戻る（ユーザー決定。台詞は仮）
  'story.T021': {
    ja: 'じゃあ、私はそろそろ家に戻るね。また練習したくなったら、となりの家に声をかけに来て。',
    en: "I'll head back home now. If you want another practice match, come knock on my door next door.",
  },
  'story.T024': { ja: 'おつかれさま。また練習したくなったら、いつでも声をかけて。', en: 'Good game. Come find me whenever you want to practice again.' },

  // 後日の再開
  'story.T022': { ja: 'カードの練習、またしてみる？', en: 'Want to practice card battles again?' },
  'story.T023.a': { ja: '練習する', en: 'Practice' },
  'story.T023.b': { ja: 'やめておく', en: 'Not now' },

  // 案内役がいないときの練習テーブル（地の文）
  'story.sys.tableOffer': { ja: '練習テーブルだ。練習試合をしてみる？', en: 'A practice table. Play a practice match?' },
  // 【仮】店員・受付・研究員のひと言（2026-10-23。正式な台詞は未定）
  'story.greet.clerk': { ja: 'いらっしゃいませ。新しいパックも入っていますよ。', en: 'Welcome! We have new packs in stock.' },
  'story.greet.receptionist': { ja: '大会会場へようこそ。出場の受付はこちらです。', en: 'Welcome to the tournament hall. Entries are taken here.' },
  'story.greet.researcher': {
    ja: 'カードの記録はここにまとめてあります。ゆっくり見ていってください。',
    en: 'All our card records are kept here. Take your time.',
  },
  // 【仮】練習場の先生の台詞（2026-10-23。正式な台詞は未定）
  'story.teacher.offer': { ja: '練習試合をしていくかい？ 相手ならいつでも用意してあるよ。', en: 'Up for a practice match? I always have an opponent ready.' },
  'story.sys.tableYes': { ja: '練習試合をする', en: 'Play a match' },
  'story.sys.tableNo': { ja: 'やめておく', en: 'Not now' },
  'story.sys.practiceDone': { ja: '練習試合が終わった。', en: 'The practice match is over.' },

  // 練習試合
  'story.practice.title': { ja: '練習試合', en: 'Practice Match' },

  // 練習試合のヒント（バトルの場面に合わせて1回ずつ）
  'story.hint.title': { ja: 'ヒント', en: 'Tip' },
  'story.hint.ok': { ja: 'わかった', en: 'Got it' },
  'story.hint.monsters': {
    ja: '下の3体があなたのモンスター、上の3体が相手。絵の下の数字がライフです。',
    en: "The three monsters at the bottom are yours; the top three are your opponent's. The number under each one is its Life.",
  },
  'story.hint.firstMana': {
    ja: '先攻の最初のターンは攻撃できません。手札を2枚までマナにできます（カード1枚＝1マナ）。選んだら「マナにする」、終わったら「ターン終了」。',
    en: "On the first player's first turn you can't attack. You can turn up to 2 cards into Mana (1 card = 1 Mana). Pick them, tap Make Mana, then End Turn.",
  },
  'story.hint.attack': {
    ja: '攻撃：手札の技カードを選んで「使う」。マナが足りる技だけ使えます（1体につき1ターン1回）。攻撃を終えるときは、下の「攻撃終了」。',
    en: "Attack: pick a skill card in your hand and tap Use. You can only use skills you have enough Mana for (once per monster per turn). To finish attacking, tap End Attack at the bottom.",
  },
  'story.hint.mana': {
    ja: 'マナ化：使わないカードを選んで「マナにする」。カード1枚＝1マナで、マナは次のターンにも残ります。終わったら「ターン終了」。',
    en: 'Mana: pick cards you won\'t use and tap Make Mana. 1 card = 1 Mana, and Mana carries over to later turns. Tap End Turn when you\'re done.',
  },
  'story.hint.defense': {
    ja: '相手の攻撃！狙われたモンスターの防御・回避カードで、ダメージを減らせます。使わないときは「守備しない」。',
    en: "Enemy attack! Use the targeted monster's Guard or Dodge cards to reduce the damage. Tap Pass if you don't want to.",
  },
  // 【仮】住人A〜E の会話（2026-10-23 ユーザー指示「それっぽい会話」。話しかけるたびに1と2を交互に）
  'story.residentA.1a': { ja: '庭の花がちょうど見ごろでね。朝のうちに摘んできたの。', en: 'The flowers in my garden are at their best. I picked these this morning.' },
  'story.residentA.1b': { ja: '噴水のそばのベンチで休むと、気持ちがいいわよ。', en: 'Take a rest on the benches by the fountain. It\'s lovely there.' },
  'story.residentA.2a': { ja: '若い人たちは、みんなカードに夢中ね。', en: 'All the young people are crazy about cards these days.' },
  'story.residentA.2b': { ja: 'うちの息子も、昔は大会に出ていたのよ。', en: 'My son used to enter the tournaments too, back in the day.' },
  'story.residentB.1a': { ja: '見てくれよ。この前のパックで出たカードなんだ。', en: 'Check this out. I pulled it from a pack the other day.' },
  'story.residentB.1b': { ja: 'ショップの販売機、たまにすごいのが出るんだよな。', en: 'The pack machine at the shop gives you something amazing once in a while.' },
  'story.residentB.2a': { ja: '大会で勝ち上がるには、デッキの組み方が大事らしい。', en: 'They say deck building is the key to winning tournaments.' },
  'story.residentB.2b': { ja: '出かける前に、家の机でデッキを見直すといいよ。', en: 'Check your deck at the desk at home before you head out.' },
  'story.residentD.1a': { ja: '今度の大会、友だちと見に行く約束をしているの。', en: 'My friends and I are going to watch the next tournament.' },
  'story.residentD.1b': { ja: '会場の丸い天井、近くで見るととてもきれいなのよ。', en: 'The dome of the hall is beautiful up close.' },
  'story.residentD.2a': { ja: '研究所って、いつも遅くまで明かりがついているわね。', en: 'The lights at the lab are always on until late.' },
  'story.residentD.2b': { ja: '何をそんなに調べているのかしら。', en: 'I wonder what they\'re researching so hard.' },
  'story.residentE.1a': { ja: '新聞によると、今年の大会は参加者が多いそうだ。', en: 'The paper says this year\'s tournament has a lot of entrants.' },
  'story.residentE.1b': { ja: '腕に覚えがあるなら、会場の受付で話を聞いてみるといい。', en: 'If you\'re confident in your skills, ask at the tournament hall\'s front desk.' },
  'story.residentE.2a': { ja: '街のあちこちに、光る欠片が落ちていることがあるらしい。', en: 'They say glowing fragments turn up here and there around town.' },
  'story.residentE.2b': { ja: '……まあ、ただの噂かもしれんがね。', en: '...Then again, it might just be a rumor.' },

  'story.hint.result': {
    ja: '相手のモンスター3体をすべて倒すか、相手が山札からカードを引けなくなると勝ちです。',
    en: "You win by knocking out all three of your opponent's monsters, or when your opponent can't draw a card from their deck.",
  },
} as const satisfies Record<string, MessageEntry>;
