import type { NpcId } from './maps.ts';
import type { OpponentDefinition } from './tournaments.ts';

/**
 * 登場人物28人（2026-10-27 ユーザー承認の指示書「人物の名前・名刺図鑑・カード図鑑」）。
 * 名前・二つ名・肩書き・ひとことは指示書のとおり（言い回しを変えない）。英語は Claude の仮訳。
 * No. は名刺図鑑の番号。顔の絵は src/ui/components/personFace.ts（絵が無い人は人影）。
 *
 * - town：街の人（会話・対戦成績はなし）。初めて話したとき（会話の名前の札が出たとき）に名刺を登録する
 * - opponent：対戦する人。初めて対戦したとき（勝ち負けは問わない）に登録する
 * - inGame：いまゲームに出てくるか。false の人（管理局の職員・C〜S ランクの常連・書庫・再戦）はデータだけ（登場は別の指示書）
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
}

const p = (
  no: number,
  id: string,
  group: PersonGroup,
  name: [string, string],
  title: [string, string],
  line: [string, string],
  extra: Partial<Pick<Person, 'epithet' | 'hideName' | 'speaker' | 'opponentIds' | 'opponentFaces'>> & { inGame?: boolean } = {},
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
});

const ep = (ja: string, en: string): LocalText => ({ ja, en });

export const PEOPLE: readonly Person[] = [
  // ---------- 街の人 ----------
  p(1, 'mireille', 'town', ['ミレイユ', 'Mireille'], ['となりに住むカードバトラー', 'Card battler next door'], ['困ったら、いつでも声をかけてね。', "If you're ever in trouble, just call out to me."], { speaker: 'neighbor_guide' }),
  p(2, 'nina', 'town', ['ニーナ', 'Nina'], ['カードショップの店員', 'Card shop clerk'], ['新しいパック、入ってますよ！', 'New packs just came in!'], { speaker: 'clerk' }),
  p(3, 'lucas', 'town', ['ルーカス', 'Lucas'], ['カード研究所の研究員', 'Card Lab researcher'], ['カードには、聖獣の記録が眠っているんです。', 'Records of the sacred beasts sleep within the cards.'], { speaker: 'researcher' }),
  p(4, 'celia', 'town', ['セリア', 'Celia'], ['大会会場の受付', 'Tournament Hall receptionist'], ['公式ランク戦の受付はこちらです。', 'Official ranked matches are registered here.'], { speaker: 'receptionist' }),
  p(5, 'gareth', 'town', ['ガレス', 'Gareth'], ['練習場の先生・元大会選手', 'Practice Hall instructor, former tournament player'], ['負けた数だけ、強くなれるぞ。', 'Every loss makes you stronger.'], { speaker: 'teacher' }),
  p(6, 'eleanor', 'town', ['エレノア', 'Eleanor'], ['カードバトラー管理局の職員', 'Card Battler Bureau officer'], ['登録の手続きは、こちらで承ります。', 'Registration procedures are handled here.'], { inGame: false }),
  p(7, 'martha', 'town', ['マルタ', 'Martha'], ['花屋のおかみさん', 'Florist'], ['今日もいい花が咲いたわ。', 'Lovely flowers bloomed again today.'], { speaker: 'resident_a' }),
  p(8, 'pete', 'town', ['ピート', 'Pete'], ['カード集めが趣味の青年', 'Young card collector'], ['図鑑、どこまで埋まった？', "How far along is your card book?"], { speaker: 'resident_b' }),
  p(9, 'bruno', 'town', ['ブルーノ', 'Bruno'], ['街の大工', 'Town carpenter'], ['大会会場の観客席は、おれが建てたんだ。', 'I built the stands in the Tournament Hall.'], { speaker: 'resident_c' }),
  p(10, 'rosalie', 'town', ['ロザリー', 'Rosalie'], ['仕立て屋', 'Tailor'], ['勝負服、仕立ててあげましょうか？', 'Shall I tailor you an outfit for battle?'], { speaker: 'resident_d' }),
  p(11, 'harold', 'town', ['ハロルド', 'Harold'], ['元新聞記者', 'Former newspaper reporter'], ['大会の記事は、昔から欠かさず読んでおる。', "I've never missed a tournament article, not once."], { speaker: 'resident_e' }),
  // ---------- 大会の相手（E・D） ----------
  p(12, 'noel', 'tournament', ['ノエル', 'Noel'], ['駆け出しのカードバトラー', 'Rookie card battler'], ['わたしも、今日が初めての大会なんです。', "Today's my first tournament, too."], { opponentIds: ['e-1'] }),
  p(13, 'viktor', 'tournament', ['ヴィクトル', 'Viktor'], ['ベルモント商会の跡取り', 'Heir to the Belmont Trading Company'], ['カードは、いちばん高いのを集めているよ。', 'I only collect the most expensive cards.'], { opponentIds: ['e-2'] }),
  p(14, 'sienna', 'tournament', ['シエナ', 'Sienna'], ['旅のカード使い・ノルディス地方出身', 'Traveling card user from Nordis'], ['次の街でも、また会えるといいわね。', 'I hope we meet again in the next town.'], { opponentIds: ['e-3'] }),
  p(15, 'dario', 'tournament', ['ダリオ', 'Dario'], ['港町の漁師・港町カードクラブ', 'Port town fisherman, Port Town Card Club'], ['網もカードも、引きが大事だ！', "Nets or cards, it's all about the draw!"], { opponentIds: ['d-1'] }),
  p(16, 'isabella', 'tournament', ['イザベラ', 'Isabella'], ['ローゼンベルク家の夫人', 'Lady of the House of Rosenberg'], ['優雅に勝つのが、わたくしの流儀ですの。', 'Winning gracefully is my way.'], { opponentIds: ['d-2'] }),
  p(17, 'gordon', 'tournament', ['ゴードン', 'Gordon'], ['かつての大会の常連', 'Former tournament regular'], ['昔はもっと上で戦っていたものだ。', 'I used to fight at a much higher level.'], { opponentIds: ['d-3'] }),
  // ---------- ダンジョン ----------
  p(18, 'flora', 'dungeon', ['フローラ', 'Flora'], ['遺跡探検家', 'Ruins explorer'], ['この奥には、まだ誰も見ていない部屋があるの。', "Deeper in, there's a room no one has seen yet."], { opponentFaces: ['battler-1'] }),
  p(19, 'oscar', 'dungeon', ['オスカー', 'Oscar'], ['古代史の学者', 'Scholar of ancient history'], ['遺跡の石は、百年前の言葉を語っている。', 'The stones of the ruins speak words from a century ago.'], { opponentFaces: ['battler-2'] }),
  p(20, 'kyle', 'dungeon', ['カイル', 'Kyle'], ['腕試しの旅人', 'Traveler testing his skill'], ['強いやつを探して、ここまで来た。', 'I came all this way looking for strong opponents.'], { opponentFaces: ['battler-3'] }),
  p(21, 'guardian', 'dungeon', ['？？？', '???'], ['ダンジョンを見回る者', 'One who patrols the dungeon'], ['……。', '...'], { hideName: true, opponentFaces: ['guardian'] }),
  // ---------- 大会の常連（C〜S）・イベント（データだけ） ----------
  p(22, 'dolf', 'regular', ['ドルフ', 'Dolf'], ['鍛冶屋', 'Blacksmith'], ['細かいことは考えねえ。叩いて勝つ！', "I don't think about details. I smash and win!"], { epithet: ep('ごり押しの剛腕', 'The Brute Force'), inGame: false }),
  p(23, 'leonard', 'regular', ['レナード', 'Leonard'], ['自称カード評論家', 'Self-proclaimed card critic'], ['力だけで勝てると思っているのかね？', 'Do you think strength alone will win?'], { epithet: ep('からめ手の策士', 'The Trickster'), inGame: false }),
  p(24, 'greta', 'regular', ['グレタ', 'Greta'], ['元衛兵', 'Former guard'], ['守りきれば、勝ちは向こうからやってくる。', 'Hold your defense, and victory will come to you.'], { epithet: ep('鉄壁の守り手', 'The Iron Wall'), inGame: false }),
  p(25, 'julius', 'regular', ['ユリウス', 'Julius'], ['人気No.1の若手', 'Most popular young player'], ['みんなが見てる。最高の試合にしよう！', "Everyone's watching. Let's make it the best match ever!"], { epithet: ep('若き天才', 'The Young Prodigy'), inGame: false }),
  p(26, 'camilla', 'regular', ['カミラ', 'Camilla'], ['各地の大会を制した実力者', 'Champion of tournaments far and wide'], ['あなたの次の一手、もう見えているわ。', 'I can already see your next move.'], { epithet: ep('勝率9割の女王', 'The 90% Queen'), inGame: false }),
  p(27, 'ernst', 'regular', ['エルンスト', 'Ernst'], ['書庫守の一族の末裔', 'Descendant of the archive keepers'], ['書庫の記録を求めるなら、腕を示せ。', 'If you seek the archive records, show me your skill.'], { inGame: false }),
  p(28, 'alvin', 'regular', ['アルヴィン', 'Alvin'], ['現チャンピオン', 'Reigning champion'], ['ここまで来た者は久しぶりだ。', "It's been a long time since anyone made it this far."], { epithet: ep('無敗の王者', 'The Undefeated King'), inGame: false }),
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
