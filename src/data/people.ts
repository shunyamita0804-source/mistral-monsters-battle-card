import type { NpcId } from './maps.ts';
import type { OpponentDefinition } from './tournaments.ts';

/**
 * 登場人物40人（28人は 2026-10-27 ユーザー承認の指示書「人物の名前・名刺図鑑・カード図鑑」、29〜40 は 2026-10-28 指示書「ダンジョンの人物12人」）。
 * 名前・二つ名・肩書き・ひとことは指示書のとおり（言い回しを変えない）。英語は Claude の仮訳。
 * No. は名刺図鑑の番号。顔の絵は src/ui/components/personFace.ts（絵が無い人は人影）。
 *
 * - town：街の人（会話・対戦成績はなし）。初めて話したとき（会話の名前の札が出たとき）に名刺を登録する
 * - opponent：対戦する人。初めて対戦したとき（勝ち負けは問わない）に登録する
 * - inGame：いまゲームに出てくるか。false の人（書庫・もと住人C）はデータだけ（登場は別の指示書）
 */

export interface LocalText {
  readonly ja: string;
  readonly en: string;
}

export type PersonGroup = 'town' | 'tournament' | 'dungeon' | 'regular';

export interface Person {
  readonly id: string;
  readonly no: number;
  readonly group: PersonGroup;
  readonly name: LocalText;
  /** 二つ名（名刺の肩書きの上に小さく出す。無い人は出さない） */
  readonly epithet?: LocalText;
  readonly title: LocalText;
  readonly line: LocalText;
  /** 名前を明かさない（見えない番人：名刺でもずっと「？？？」） */
  readonly hideName?: boolean;
  /** いまゲームに出てくるか（false はデータだけ） */
  readonly inGame: boolean;
  /** 会話の話し手・街の人の ID（src/data/maps.ts の NpcId と同じ） */
  readonly speaker?: NpcId;
  /** 対戦相手の定義の ID（大会の回戦など） */
  readonly opponentIds?: readonly string[];
  /** 対戦相手の顔のキー（同じ相手の定義で見た目だけ変える：ダンジョンのバトラー・番人） */
  readonly opponentFaces?: readonly string[];
  /** その人のせりふ（ダンジョンの守り手・バトラー。無い人はいつもの決まった言葉） */
  readonly lines?: PersonLines;
}

/**
 * ダンジョンの人のせりふ（2026-10-28 指示書「ダンジョンの人物12人」。文は Claude の案、英語は仮訳）。
 * meet＝話しかけたとき（対戦の前）・start＝対戦の始め・win＝その人が勝った・lose＝その人が負けた・after＝守り手に勝ったあと（最奥の祭壇へ）
 */
export interface PersonLines {
  readonly meet: LocalText;
  readonly start: LocalText;
  readonly win: LocalText;
  readonly lose: LocalText;
  readonly after?: LocalText;
}

const lines = (
  meet: [string, string],
  start: [string, string],
  win: [string, string],
  lose: [string, string],
  after?: [string, string],
): PersonLines => ({
  meet: { ja: meet[0], en: meet[1] },
  start: { ja: start[0], en: start[1] },
  win: { ja: win[0], en: win[1] },
  lose: { ja: lose[0], en: lose[1] },
  ...(after ? { after: { ja: after[0], en: after[1] } } : {}),
});

const p = (
  no: number,
  id: string,
  group: PersonGroup,
  name: [string, string],
  title: [string, string],
  line: [string, string],
  extra: Partial<Pick<Person, 'epithet' | 'hideName' | 'speaker' | 'opponentIds' | 'opponentFaces' | 'lines'>> & { inGame?: boolean } = {},
): Person => ({
  id,
  no,
  group,
  name: { ja: name[0], en: name[1] },
  title: { ja: title[0], en: title[1] },
  line: { ja: line[0], en: line[1] },
  inGame: extra.inGame ?? true,
  ...(extra.epithet ? { epithet: extra.epithet } : {}),
  ...(extra.hideName ? { hideName: true } : {}),
  ...(extra.speaker ? { speaker: extra.speaker } : {}),
  ...(extra.opponentIds ? { opponentIds: extra.opponentIds } : {}),
  ...(extra.opponentFaces ? { opponentFaces: extra.opponentFaces } : {}),
  ...(extra.lines ? { lines: extra.lines } : {}),
});

const ep = (ja: string, en: string): LocalText => ({ ja, en });

export const PEOPLE: readonly Person[] = [
  // ---------- 街の人 ----------
  p(1, 'mireille', 'town', ['ミレイユ', 'Mireille'], ['となりに住むカードバトラー', 'Card battler next door'], ['困ったら、いつでも声をかけてね。', "If you're ever in trouble, just call out to me."], { speaker: 'neighbor_guide' }),
  p(2, 'nina', 'town', ['ニーナ', 'Nina'], ['カードショップの店員', 'Card shop clerk'], ['新しいパック、入ってますよ！', 'New packs just came in!'], { speaker: 'clerk' }),
  p(3, 'lucas', 'town', ['ルーカス', 'Lucas'], ['カード研究所の研究員', 'Card Lab researcher'], ['カードには、聖獣の記録が眠っているんです。', 'Records of the sacred beasts sleep within the cards.'], { speaker: 'researcher' }),
  p(4, 'celia', 'town', ['セリア', 'Celia'], ['大会会場の受付', 'Tournament Hall receptionist'], ['公式ランク戦の受付はこちらです。', 'Official ranked matches are registered here.'], { speaker: 'receptionist' }),
  p(5, 'gareth', 'town', ['ガレス', 'Gareth'], ['練習場の先生・元大会選手', 'Practice Hall instructor, former tournament player'], ['負けた数だけ、強くなれるぞ。', 'Every loss makes you stronger.'], { speaker: 'teacher' }),
  p(6, 'eleanor', 'town', ['エレノア', 'Eleanor'], ['カードバトラー管理局の職員', 'Card Battler Bureau officer'], ['登録の手続きは、こちらで承ります。', 'Registration procedures are handled here.'], { speaker: 'bureau_clerk' }),
  p(7, 'martha', 'town', ['マルタ', 'Martha'], ['花屋のおかみさん', 'Florist'], ['今日もいい花が咲いたわ。', 'Lovely flowers bloomed again today.'], { speaker: 'resident_a' }),
  p(8, 'pete', 'town', ['ピート', 'Pete'], ['カード集めが趣味の青年', 'Young card collector'], ['図鑑、どこまで埋まった？', "How far along is your card book?"], { speaker: 'resident_b' }),
  // ブルーノ（もと住人C）：2026-10-27 に住宅C をカードバトラー管理局に置き換えたので、いまはゲームに出てこない（データだけ）
  p(9, 'bruno', 'town', ['ブルーノ', 'Bruno'], ['街の大工', 'Town carpenter'], ['大会会場の観客席は、おれが建てたんだ。', 'I built the stands in the Tournament Hall.'], { inGame: false }),
  p(10, 'rosalie', 'town', ['ロザリー', 'Rosalie'], ['仕立て屋', 'Tailor'], ['勝負服、仕立ててあげましょうか？', 'Shall I tailor you an outfit for battle?'], { speaker: 'resident_d' }),
  p(11, 'harold', 'town', ['ハロルド', 'Harold'], ['元新聞記者', 'Former newspaper reporter'], ['大会の記事は、昔から欠かさず読んでおる。', "I've never missed a tournament article, not once."], { speaker: 'resident_e' }),
  // ---------- 大会の相手（E・D） ----------
  p(12, 'noel', 'tournament', ['ノエル', 'Noel'], ['駆け出しのカードバトラー', 'Rookie card battler'], ['わたしも、今日が初めての大会なんです。', "Today's my first tournament, too."], { opponentIds: ['e-1'] }),
  p(13, 'viktor', 'tournament', ['ヴィクトル', 'Viktor'], ['ベルモント商会の跡取り', 'Heir to the Belmont Trading Company'], ['カードは、いちばん高いのを集めているよ。', 'I only collect the most expensive cards.'], { opponentIds: ['e-2'] }),
  p(14, 'sienna', 'tournament', ['シエナ', 'Sienna'], ['旅のカード使い・ノルディス地方出身', 'Traveling card user from Nordis'], ['次の街でも、また会えるといいわね。', 'I hope we meet again in the next town.'], { opponentIds: ['e-3', 'reg-sienna'] }),
  p(15, 'dario', 'tournament', ['ダリオ', 'Dario'], ['港町の漁師・港町カードクラブ', 'Port town fisherman, Port Town Card Club'], ['網もカードも、引きが大事だ！', "Nets or cards, it's all about the draw!"], { opponentIds: ['d-1'] }),
  p(16, 'isabella', 'tournament', ['イザベラ', 'Isabella'], ['ローゼンベルク家の夫人', 'Lady of the House of Rosenberg'], ['優雅に勝つのが、わたくしの流儀ですの。', 'Winning gracefully is my way.'], { opponentIds: ['d-2'] }),
  p(17, 'gordon', 'tournament', ['ゴードン', 'Gordon'], ['かつての大会の常連', 'Former tournament regular'], ['昔はもっと上で戦っていたものだ。', 'I used to fight at a much higher level.'], { opponentIds: ['d-3', 'c-gordon'] }),
  // ---------- ダンジョン ----------
  p(18, 'flora', 'dungeon', ['フローラ', 'Flora'], ['遺跡探検家', 'Ruins explorer'], ['この奥には、まだ誰も見ていない部屋があるの。', "Deeper in, there's a room no one has seen yet."], { opponentFaces: ['battler-1'] }),
  p(19, 'oscar', 'dungeon', ['オスカー', 'Oscar'], ['古代史の学者', 'Scholar of ancient history'], ['遺跡の石は、百年前の言葉を語っている。', 'The stones of the ruins speak words from a century ago.'], { opponentFaces: ['battler-2'] }),
  p(20, 'kyle', 'dungeon', ['カイル', 'Kyle'], ['腕試しの旅人', 'Traveler testing his skill'], ['強いやつを探して、ここまで来た。', 'I came all this way looking for strong opponents.'], { opponentFaces: ['battler-3'] }),
  p(21, 'guardian', 'dungeon', ['？？？', '???'], ['ダンジョンを見回る者', 'One who patrols the dungeon'], ['……。', '...'], { hideName: true, opponentFaces: ['guardian'] }),
  // ---------- 大会の常連（C〜S のトーナメントに出る。2026-10-27 指示書「大会の新しい形」）。エルンスト（書庫）はデータだけ ----------
  p(22, 'dolf', 'regular', ['ドルフ', 'Dolf'], ['鍛冶屋', 'Blacksmith'], ['細かいことは考えねえ。叩いて勝つ！', "I don't think about details. I smash and win!"], { epithet: ep('ごり押しの剛腕', 'The Brute Force'), opponentIds: ['reg-dolf'] }),
  p(23, 'leonard', 'regular', ['レナード', 'Leonard'], ['自称カード評論家', 'Self-proclaimed card critic'], ['力だけで勝てると思っているのかね？', 'Do you think strength alone will win?'], { epithet: ep('からめ手の策士', 'The Trickster'), opponentIds: ['reg-leonard'] }),
  p(24, 'greta', 'regular', ['グレタ', 'Greta'], ['元衛兵', 'Former guard'], ['守りきれば、勝ちは向こうからやってくる。', 'Hold your defense, and victory will come to you.'], { epithet: ep('鉄壁の守り手', 'The Iron Wall'), opponentIds: ['reg-greta'] }),
  p(25, 'julius', 'regular', ['ユリウス', 'Julius'], ['人気No.1の若手', 'Most popular young player'], ['みんなが見てる。最高の試合にしよう！', "Everyone's watching. Let's make it the best match ever!"], { epithet: ep('若き天才', 'The Young Prodigy'), opponentIds: ['reg-julius'] }),
  p(26, 'camilla', 'regular', ['カミラ', 'Camilla'], ['各地の大会を制した実力者', 'Champion of tournaments far and wide'], ['あなたの次の一手、もう見えているわ。', 'I can already see your next move.'], { epithet: ep('勝率9割の女王', 'The 90% Queen'), opponentIds: ['reg-camilla'] }),
  p(27, 'ernst', 'regular', ['エルンスト', 'Ernst'], ['書庫守の一族の末裔', 'Descendant of the archive keepers'], ['書庫の記録を求めるなら、腕を示せ。', 'If you seek the archive records, show me your skill.'], { inGame: false }),
  p(28, 'alvin', 'regular', ['アルヴィン', 'Alvin'], ['現チャンピオン', 'Reigning champion'], ['ここまで来た者は久しぶりだ。', "It's been a long time since anyone made it this far."], { epithet: ep('無敗の王者', 'The Undefeated King'), opponentIds: ['reg-alvin'] }),
  // ---------- ダンジョンの守り手（ボス）7人（2026-10-28 指示書「ダンジョンの人物12人」）。聖地を守る一族。勝つと最奥の祭壇からカードを受け取る ----------
  p(29, 'grant', 'dungeon', ['グラント', 'Grant'], ['遺跡の守り手・一族の長老', 'Keeper of the Ruins, Elder of the clan'], ['この遺跡の石は、まだ眠っておるだけじゃ。', 'The stones of these ruins are merely sleeping.'], {
    opponentIds: ['enc-b3-boss'],
    lines: lines(
      ['よう来たのう。この遺跡がおぬしを通してよいか、わしが確かめよう。', 'Welcome. Let me see whether these ruins should let you pass.'],
      ['さて、おぬしの力、見せてもらおうかの。', "Now then, show me what you're made of."],
      ['ほっほ。焦らずとも、遺跡は逃げはせんよ。', "Ho ho. No need to hurry. The ruins aren't going anywhere."],
      ['見事じゃ。おぬしなら、遺跡も認めよう。', 'Splendid. The ruins will accept you.'],
      ['最奥の祭壇へ進むがよい。カードが、おぬしを待っておる。', 'Go on to the innermost altar. The cards await you.'],
    ),
  }),
  p(30, 'sera', 'dungeon', ['セラ', 'Sera'], ['森の守り手・森の巫女', 'Keeper of the Forest, Forest priestess'], ['森はね、ちゃんと見てるのよ。', 'The forest is always watching, you know.'], {
    opponentIds: ['enc-forest-boss'],
    lines: lines(
      ['あら、こんな奥まで来たのね。でも、森を通すかどうかは、わたしが決めるの。', "Oh, you came all this way. But I'm the one who decides if the forest lets you through."],
      ['ゆっくりでいいわ。でも、手は抜かないから。', "Take your time. But I won't go easy."],
      ['ふふ。森はまだ、あなたを見ているところよ。', 'Hehe. The forest is still watching you.'],
      ['……うん。森の声も、あなたを認めてる。', '...Yes. The forest\'s voice accepts you too.'],
      ['奥の祭壇へどうぞ。森からの贈りものよ。', 'Please, go to the altar. A gift from the forest.'],
    ),
  }),
  p(31, 'lucia', 'dungeon', ['ルシア', 'Lucia'], ['神殿の守り手・神殿の司祭', 'Keeper of the Temple, Temple priest'], ['水の音に、耳をすませてみてください。', 'Try listening to the sound of the water.'], {
    opponentIds: ['enc-water-boss'],
    lines: lines(
      ['ようこそ、水の神殿へ。守り手として、あなたの力を確かめさせていただきます。', 'Welcome to the Water Temple. As its keeper, allow me to test your strength.'],
      ['では、始めましょう。どうぞ、全力で。', 'Then let us begin. Please, give it your all.'],
      ['水は、急ぐ者を拒みます。また、いらしてください。', 'Water turns away those who rush. Please come again.'],
      ['お見事です。神殿は、あなたを迎え入れます。', 'Well done. The temple welcomes you.'],
      ['最奥の祭壇へお進みください。カードがあなたを待っています。', 'Please proceed to the innermost altar. The cards await you.'],
    ),
  }),
  p(32, 'ivan', 'dungeon', ['イヴァン', 'Ivan'], ['洞窟の守り手・ノルディス出身', 'Keeper of the Cavern, from Nordis'], ['……寒さには、慣れている。', "...I'm used to the cold."], {
    opponentIds: ['enc-ice-boss'],
    lines: lines(
      ['……ここから先は、通さない。', "...You won't pass beyond here."],
      ['……来い。', '...Come.'],
      ['……まだだ。', '...Not yet.'],
      ['……認めよう。', '...I acknowledge you.'],
      ['……祭壇は、奥だ。', '...The altar is further in.'],
    ),
  }),
  p(33, 'balka', 'dungeon', ['バルカ', 'Balka'], ['火山の守り手', 'Keeper of the Volcano'], ['勝負ってのは、熱いほどいい！', 'The hotter the battle, the better!'], {
    opponentIds: ['enc-fire-boss'],
    lines: lines(
      ['はっはっは！ よくここまで登ってきたな！ さあ、熱い勝負をしようじゃないか！', "Hahaha! You climbed all the way up here! Come on, let's have a fiery battle!"],
      ['火山より熱くいくぞ！', "Let's burn hotter than the volcano!"],
      ['はっはっは！ いい勝負だった！ また来い！', 'Hahaha! That was a good match! Come again!'],
      ['はっはっは！ やるじゃないか！ 気に入ったぞ！', 'Hahaha! Not bad at all! I like you!'],
      ['奥の祭壇へ行きな！ 火山からの土産だ！', "Head to the altar in back! It's a souvenir from the volcano!"],
    ),
  }),
  p(34, 'teo', 'dungeon', ['テオ', 'Teo'], ['塔の守り手・一族でいちばん若い発明家', 'Keeper of the Tower, the youngest inventor of the clan'], ['この歯車、どこにつながってると思う？', 'Where do you think this gear connects to?'], {
    opponentIds: ['enc-machine-boss'],
    lines: lines(
      ['わあ、ほんとに来た！ ねえねえ、きみのカード、もっと近くで見せてよ！', 'Whoa, you really made it! Hey, hey, show me your cards up close!'],
      ['よーし、塔の守り手として、がんばるぞ！', "Alright, I'll do my best as the tower's keeper!"],
      ['やったー！ でも、きみの戦い方、おもしろかった！', 'Yay! But the way you fight was really interesting!'],
      ['うわー、負けちゃった！ すごいや、どうやったの？', 'Waah, I lost! That was amazing, how did you do it?'],
      ['祭壇はこの先だよ！ 塔のてっぺんの、とっておき！', 'The altar is just ahead! The best treasure at the top of the tower!'],
    ),
  }),
  p(35, 'aurelio', 'dungeon', ['アウレリオ', 'Aurelio'], ['聖域の守り手・一族の当主', 'Keeper of the Sanctuary, Head of the clan'], ['聖域は、力だけでは開かぬ。', 'The sanctuary does not open to strength alone.'], {
    opponentIds: ['enc-holy-boss'],
    lines: lines(
      ['ここは天の聖域。守り手の当主として、そなたの覚悟を問おう。', 'This is the Celestial Sanctuary. As head of the keepers, I shall test your resolve.'],
      ['来るがよい。', 'Come.'],
      ['まだ、聖域の扉は開かぬ。', 'The sanctuary\'s door will not open yet.'],
      ['……見事だ。聖域は、そなたを受け入れる。', '...Splendid. The sanctuary accepts you.'],
      ['最奥の祭壇へ。聖域が、そなたに託すものがある。', 'Go to the innermost altar. The sanctuary has something to entrust to you.'],
    ),
  }),
  // ---------- 新しいダンジョンのバトラー5人（探検に来ている人。守り手ではない） ----------
  p(36, 'pia', 'dungeon', ['ピア', 'Pia'], ['潜りが得意な探検家', 'Explorer who loves diving'], ['神殿の水路、ぜんぶ泳いでみたいな！', "I want to swim every channel in the temple!"], {
    opponentFaces: ['battler-pia'],
    lines: lines(
      ['やっほー！ 神殿の奥まで潜ってきたの？ 勝負しよっ！', 'Hiya! Did you dive all the way into the temple too? Let\'s battle!'],
      ['いっくよー！', 'Here I go!'],
      ['やったね！ 息つぎしてから、また来てね！', 'Yes! Catch your breath and come back again!'],
      ['あちゃー、負けちゃった！ でも楽しかった！', 'Aww, I lost! But that was fun!'],
    ),
  }),
  p(37, 'hans', 'dungeon', ['ハンス', 'Hans'], ['雪山の登山家', 'Snowy mountain climber'], ['山でも洞窟でも、足もとがいちばん大事さ。', "Mountain or cave, your footing matters most."], {
    opponentFaces: ['battler-hans'],
    lines: lines(
      ['やあ、寒くないかい？ 体があたたまるように、ひと勝負どうだい。', 'Hey, aren\'t you cold? How about a battle to warm up?'],
      ['よろしく頼むよ。', 'Go easy on me.'],
      ['おっと、勝っちまった。足もと、気をつけてな。', 'Oops, I won. Watch your step out there.'],
      ['いやあ、まいった。君は強いな。', "Well, you got me. You're strong."],
    ),
  }),
  p(38, 'zack', 'dungeon', ['ザック', 'Zack'], ['火山の鉱石掘り', 'Volcano ore miner'], ['いい鉱石は、熱い所に眠ってんだよ。', 'The best ore sleeps where it\'s hottest.'], {
    opponentFaces: ['battler-zack'],
    lines: lines(
      ['おい、ここは鉱石掘りの縄張りだぞ。……まあいい、ひと勝負していけ。', "Hey, this is miners' turf. ...Fine, have a battle before you go."],
      ['手加減なんかしねえぞ。', "I ain't holding back."],
      ['へっ、まだまだだな。……ほら、水でも飲んどけ。', 'Heh, not good enough. ...Here, drink some water.'],
      ['ちっ、やるじゃねえか。……気をつけて進めよ。', 'Tch, not bad. ...Be careful up ahead.'],
    ),
  }),
  p(39, 'otto', 'dungeon', ['オットー', 'Otto'], ['時計職人', 'Clockmaker'], ['この塔の歯車は、一秒も狂っておりません。', 'Not one gear in this tower is a second off.'], {
    opponentFaces: ['battler-otto'],
    lines: lines(
      ['ふむ、予定より三分早い到着ですな。では、勝負を一局。', 'Hmm, you arrived three minutes early. Then, one match, if you please.'],
      ['正確に、参りましょう。', 'Let us proceed with precision.'],
      ['予定どおりの結果ですな。', 'Exactly as scheduled.'],
      ['ほう、私の計算が狂いましたか。お見事。', 'Oh? My calculations were off. Well done.'],
    ),
  }),
  p(40, 'mina', 'dungeon', ['ミナ', 'Mina'], ['聖域を目指す巡礼の見習い', 'Apprentice pilgrim bound for the sanctuary'], ['一歩ずつ、ていねいに進みます。', "I'll keep going, one careful step at a time."], {
    opponentFaces: ['battler-mina'],
    lines: lines(
      ['こんにちは。わたしも聖域を目指している途中なんです。よければ、一戦お願いできますか。', "Hello. I'm on my way to the sanctuary too. Would you battle with me?"],
      ['よろしくお願いします。', 'Nice to meet you.'],
      ['ありがとうございました。あなたの旅に、光がありますように。', 'Thank you. May light be with you on your journey.'],
      ['負けてしまいました……。でも、いい勝負でした。', 'I lost... But it was a good match.'],
    ),
  }),
];

export const PEOPLE_TOTAL = PEOPLE.length;

export function getPerson(id: string): Person | undefined {
  return PEOPLE.find((x) => x.id === id);
}

/** 対戦する人か（名刺に対戦成績・使うモンスター・もらえるカードを出す） */
export function isOpponentPerson(person: Person): boolean {
  return person.group !== 'town';
}

/** 会話の話し手 → 人物 */
export function personOfSpeaker(speaker: string): Person | undefined {
  return PEOPLE.find((x) => x.speaker === speaker && x.inGame);
}

/** 対戦相手の定義 → 人物（大会の回戦の ID、ダンジョンのバトラー・番人は顔のキーで） */
export function personOfOpponent(opponent: Pick<OpponentDefinition, 'id' | 'face'>): Person | undefined {
  return PEOPLE.find(
    (x) => isOpponentPerson(x) && (x.opponentIds?.includes(opponent.id) || (opponent.face !== undefined && x.opponentFaces?.includes(opponent.face))),
  );
}
