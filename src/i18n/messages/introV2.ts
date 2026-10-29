import type { MessageEntry } from '../i18n.ts';

/**
 * 導入イベントV2「プロのカードバトラーになる試験」（2026-10-27 ユーザー正式依頼）。
 * 台詞は「03_全台詞_UTF8.txt」（基準台本）のまま。英語は Claude の仮訳。
 * 職業の称号は「プロのカードバトラー」だけ（ほかの称号は使わない）。主人公の性別によらない言葉にする
 */
export const INTRO_V2 = {
  // 名前の札
  'introV2.speaker.bureau': { ja: 'エレノア', en: 'Eleanor' },

  // 初期デッキを選ぶ（新しく始めるとき、主人公を選んだあと）
  'introV2.deck.heading': { ja: '最初のデッキを選んでください', en: 'Choose your first deck' },
  'introV2.deck.note': {
    ja: 'モンスター3体の組み合わせを選びます。山札60枚の中身は【仮】です（正式な内容は準備中）。',
    en: 'Pick a team of three monsters. The 60-card deck list is temporary (the official list is in progress).',
  },
  'introV2.deck.balance': { ja: 'バランス', en: 'Balance' },
  'introV2.deck.attack': { ja: '攻撃', en: 'Attack' },
  'introV2.deck.defense': { ja: '防御', en: 'Defense' },
  'introV2.deck.confirmHint': { ja: 'もう一度押すと決定します', en: 'Tap again to confirm' },
  'introV2.deck.back': { ja: '主人公の選択に戻る', en: 'Back to character select' },

  // S01 家の外
  'introV2.s01.1': { ja: 'ちょっと！ なに寝坊してるの！', en: 'Hey! Why did you oversleep?!' },
  'introV2.s01.2': { ja: '今日はプロのカードバトラーになる試験の日でしょ！', en: "Today's the exam to become a pro card battler, remember?!" },
  'introV2.s01.3': { ja: 'もう時間がないってば。ほら、教習所まで一緒に行くよ！', en: "We're running out of time. Come on, let's go to the school together!" },
  'introV2.s01.sys': { ja: '幼馴染について、カードバトル教習所へ向かいます。', en: 'You follow your friend to the Card Battle School.' },
  // S02 町の徒歩イベント
  'introV2.s02.1': { ja: 'カードバトルは、聖獣をモチーフにしたカードで戦う遊びだよ。', en: 'In card battles, you fight with cards modeled on sacred beasts.' },
  'introV2.s02.2': { ja: '本物の聖獣が戦うんじゃないからね。ほら、こっち！', en: "The real beasts don't fight, okay? This way!" },
  // S03 教習所に到着
  'introV2.s03.1': { ja: 'おはよう。今日はプロのカードバトラーになるための試験だね。', en: "Good morning. Today is your exam to become a pro card battler." },
  'introV2.s03.2': { ja: 'まずは実技試験。私と一試合して、カードの使い方を見せてもらおう。', en: "First, the practical test. Play one match with me and show me how you use your cards." },
  'introV2.s03.3': { ja: '大丈夫！ 基本を思い出せば勝てるよ！', en: "You've got this! Just remember the basics!" },
  'introV2.s03.4': { ja: 'それじゃ、始めようか。', en: "All right, let's begin." },
  // S04 試験の対戦のヒント（先生。いまの場面で実際にできることだけ）
  'introV2.hint.title': { ja: '先生', en: 'Instructor' },
  'introV2.hint.monsters': { ja: 'これが君のモンスターカード。3体で戦うよ。ライフに注目してね。', en: 'These are your monster cards. You fight with three. Keep an eye on their Life.' },
  'introV2.hint.attack': {
    ja: '手札の技カードには、ちから技・かしこさ技などの分類と、必要なマナがある。手札とマナを見て、使える技を選んでごらん。',
    en: 'Skill cards have a type, like Strength or Wisdom, and a Mana cost. Check your hand and Mana, then pick a skill you can use.',
  },
  'introV2.hint.defense': { ja: '相手が攻撃したら、防御・回避カードで守れることもあるよ。', en: 'When your opponent attacks, you may be able to protect yourself with Guard or Dodge cards.' },
  'introV2.hint.mana': {
    ja: '技を使ったあと、使わないカードをマナにできる。マナは次のターンにも持ち越せるんだ。',
    en: "After using skills, you can turn cards you won't use into Mana. Mana carries over to your next turn.",
  },
  // S05 勝利
  'introV2.s05.1': { ja: '合格だ！ 基本はしっかり身についているね。', en: "You pass! You've got the basics down." },
  'introV2.s05.2': { ja: 'これでプロのカードバトラーへの第一歩を踏み出した。次は管理局で登録しておいで。', en: "That's your first step to becoming a pro card battler. Next, go register at the Bureau." },
  'introV2.s05.3': { ja: 'やった！ じゃあ、カードバトラー管理局へ行こう！', en: "Yay! Then let's head to the Card Battler Bureau!" },
  // S05b 負け・再開
  'introV2.s05b.1': { ja: '惜しかったね。大丈夫、もう一度やってみよう。次は順番に教えるよ。', en: "So close. Don't worry, let's try again. I'll walk you through it step by step." },
  'introV2.s05b.sys': { ja: '試験は合格まで再挑戦できます。', en: 'You can retry the exam until you pass.' },
  // S06 管理局の受付
  'introV2.s06.1': { ja: 'カードバトラー管理局へようこそ。実技試験の合格を確認しました。', en: "Welcome to the Card Battler Bureau. We've confirmed you passed the practical exam." },
  'introV2.s06.2': { ja: '登録記念として、ブースターパックをひとつお渡しします。', en: 'To celebrate your registration, we will give you one booster pack.' },
  'introV2.s06.3': { ja: 'こちらの3種類から、お好きなものをひとつ選んでください。', en: 'Please choose one of these three.' },
  'introV2.s06.sys': { ja: '3つのパックのうち、1つを選んでください。', en: 'Choose one of the three packs.' },
  'introV2.s06.thanks': { ja: 'お受け取りありがとうございます。大切に使ってくださいね。', en: 'Thank you. Please take good care of it.' },
  // S07 外に出て、幼馴染が案内
  'introV2.s07.1': { ja: 'これでひと区切りだね！ これからは好きな場所へ行けるよ。', en: "That's a wrap! From now on you can go wherever you like." },
  'introV2.s07.2': { ja: 'ダンジョンではカードを集めたり、バトラーと勝負したりできるよ。', en: 'In dungeons you can collect cards and battle other battlers.' },
  'introV2.s07.3': { ja: '公式戦は大会会場で参加できるんだ。まずは下のランクから挑戦して、上のランクを目指してね。', en: 'You can enter official matches at the tournament hall. Start from the lower ranks and aim higher.' },
  'introV2.s07.4': { ja: 'カードが増えたら、家の机でデッキを組み直すのも忘れずにね。', en: "When you get more cards, don't forget to rebuild your deck at the desk at home." },
  'introV2.s07.5': { ja: 'それじゃ、私は帰るね。困ったらまた話しかけて！', en: "Well, I'm heading home. Talk to me if you need anything!" },
  'introV2.s07.sys': { ja: 'チュートリアル完了。自由行動ができるようになりました。', en: 'Tutorial complete. You can now move around freely.' },

  // パックを選ぶ画面（2026-10-27 正式の箱3種・2回タップで決定。台本「02_Dialogue_And_TapRules」）
  'introV2.pack.title': { ja: 'ブースターパックを選ぶ', en: 'Choose a Booster Pack' },
  'introV2.pack.hint': { ja: '気になる箱をタップしてください。', en: 'Tap a box that catches your eye.' },
  'introV2.pack.again': { ja: '同じ箱をもう一度タップすると決定します。', en: 'Tap the same box again to decide.' },
  'introV2.pack.temp': { ja: '箱の中には、3体のモンスターカードと山札60枚が入っています。そのままあなたのデッキになります。', en: 'Each box holds 3 monster cards and a 60-card deck. It becomes your deck as it is.' },
  'introV2.pack.got': { ja: '{name} を受け取った！\nモンスターカード3枚と山札60枚が、あなたのデッキになった。', en: 'You received {name}!\nIts 3 monster cards and 60-card deck are now your deck.' },
  'introV2.pack.name.1': { ja: '旅立ちのきらめき', en: 'Sparkle of Departure' },
  'introV2.pack.name.2': { ja: '烈火の猛攻', en: 'Blazing Onslaught' },
  'introV2.pack.name.3': { ja: '蒼海の守り', en: 'Guard of the Azure Sea' },
  'introV2.pack.guide.1': {
    ja: 'これは『旅立ちのきらめき』！ ソラモたちのパックで、バランスよく戦いたい人におすすめだよ！',
    en: "This is \"Sparkle of Departure\"! It's Soramo's pack, great if you want a balanced fight!",
  },
  'introV2.pack.guide.2': {
    ja: 'これは『烈火の猛攻』！ ガウルたちのパックで、どんどん攻めたい人にぴったりだよ！',
    en: "This is \"Blazing Onslaught\"! It's Gaul's pack, perfect if you love to attack!",
  },
  'introV2.pack.guide.3': {
    ja: 'これは『蒼海の守り』！ カルシェルたちのパックで、守りを大切にしたい人におすすめだよ！',
    en: "This is \"Guard of the Azure Sea\"! It's Kalshell's pack, great if you value defense!",
  },

  // カードショップ：管理局で選ばなかった2箱（値段・中身は未定なので買えない）
  'introV2.shop.title': { ja: 'ブースターパック', en: 'Booster Packs' },
  'introV2.shop.note': { ja: '管理局で選ばなかった箱です。中身はモンスター3体と山札60枚（そのまま1つのデッキ）。各1回まで。', en: "The boxes you didn't choose at the Bureau. Each holds 3 monsters and a 60-card deck. One of each." },
  'introV2.shop.buy': { ja: '{price}G で買う', en: 'Buy {price}G' },
  'introV2.shop.owned': { ja: '購入済み', en: 'Purchased' },
  'introV2.shop.confirm': { ja: '「{name}」を {price}G で買いますか？', en: 'Buy "{name}" for {price}G?' },
  'introV2.shop.bought': { ja: '「{name}」を買った！\nモンスターカード3枚と山札60枚を手に入れた。デッキの編集で使えます。', en: 'You bought "{name}"!\nYou got 3 monster cards and 60 deck cards. Use them in deck editing.' },

  // 街の目的地・管理局
  'introV2.goal.school': { ja: '目的地：カードバトル教習所（カード練習場）', en: 'Destination: Card Battle School (Practice Hall)' },
  'introV2.goal.bureau': { ja: '目的地：カードバトラー管理局', en: 'Destination: Card Battler Bureau' },
  'introV2.bureau.after': {
    ja: '（カードバトラー管理局の受付。いまはプロのカードバトラーの登録だけを受け付けている）【仮】',
    en: '(The Card Battler Bureau reception. For now it only handles pro card battler registration.) [Temp]',
  },

  // 【仮】チュートリアルスキップ（ユーザー指示。販売前に消す予定）
  'introV2.skip.button': { ja: 'スキップ（仮）', en: 'Skip (Temp)' },
  'introV2.skip.title': { ja: 'チュートリアルをスキップしますか？', en: 'Skip the tutorial?' },
  'introV2.skip.text': {
    ja: '試験とパックの受け取りをせずに、自由行動になります（確認用の仮のボタン）。',
    en: 'You will skip the exam and the pack, and move freely (temporary button for testing).',
  },
  'introV2.exam.title': { ja: '実技試験', en: 'Practical Exam' },
  'introV2.walkFail': { ja: '（道がふさがっていたので、目的地の前まで移動しました）', en: '(The way was blocked, so you were moved in front of the destination.)' },
} as const satisfies Readonly<Record<string, MessageEntry>>;
