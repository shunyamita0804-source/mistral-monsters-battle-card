import type { MessageEntry } from '../i18n.ts';

/** 歩行画面（街・家・ショップ・大会会場・ダンジョン）・マップの固有名以外の文字・ダンジョン選択 */
export const WORLD = {
  // 画面名
  'world.title': { ja: '街', en: 'Town' },

  // 建物の名前ラベル（街マップの上に出す）
  'world.building.hall': { ja: '大会会場', en: 'Tournament Hall' },
  'world.building.home': { ja: '家', en: 'Home' },
  'world.building.shop': { ja: 'カードショップ', en: 'Card Shop' },
  'world.building.practice': { ja: 'カード練習場', en: 'Practice Hall' },
  'world.building.neighbor': { ja: 'となりの家', en: 'Neighbor\'s House' },
  'world.building.lab': { ja: 'カード研究所', en: 'Card Lab' },
  // 英語名は仮訳（正式名称は未定）
  'world.building.bureau': { ja: 'カードバトラー管理局', en: 'Card Battler Bureau' },

  // 上の帯・操作
  'world.placeDungeon': { ja: '{dungeon} {floor}', en: '{dungeon} {floor}' },
  'world.placeNote': { ja: '仮マップ', en: 'Temp map' },
  'world.escape': { ja: '脱出', en: 'Escape' },
  'world.menu': { ja: 'メニュー', en: 'Menu' },
  'world.player': { ja: 'プレイヤー', en: 'Player' },
  'world.hint': {
    ja: '画面をなぞって移動\n近くの人や家具は\nタップか右下のボタンで\n話す・調べる',
    en: 'Slide to walk\nTap nearby people or\nfurniture, or the button,\nto talk or check',
  },
  'world.examine': { ja: '調べる', en: 'Check' },
  'world.researcher.title': { ja: 'カード研究所', en: 'Card Laboratory' },
  'world.researcher.text': { ja: '図鑑を見ますか？ 欠片がそろっていれば、解析台で特別復元もできますよ。', en: 'Would you like to see the album? If you have all the shards, we can also do a special restoration at the analysis table.' },
  'world.researcher.collection': { ja: '図鑑を見る', en: 'View Album' },
  'world.leagueBoard.title': { ja: '大会の対戦表', en: 'Cup Match Board' },
  'world.leagueBoard.empty': { ja: '大会の対戦表を貼る板。まだ何も貼られていない。', en: 'A board for cup match tables. Nothing is posted yet.' },
  // 話せる人のそばでは、右下のボタンの文字を「話す」に（2026-10-24 改訂R2 フェーズ1）
  'world.talk': { ja: '話す', en: 'Talk' },

  // マップ上の物
  'world.enemy': { ja: '敵', en: 'Enemy' },
  'world.boss': { ja: 'BOSS', en: 'BOSS' },
  'world.chest': { ja: '宝箱', en: 'Treasure chest' },
  'world.chestEmptyLabel': { ja: '空の宝箱', en: 'Empty treasure chest' },

  // しらべる・宝箱・欠片
  'world.nothingHere': { ja: '特に何もない。', en: 'Nothing special here.' },
  'world.fragmentItem': { ja: '不思議な欠片 {n}/{total}', en: 'Mysterious Shard {n}/{total}' },
  'world.bannerClear': { ja: 'ダンジョン クリア！', en: 'Dungeon Cleared!' },
  'world.bannerRetreat': { ja: '入り口へ戻された…', en: 'Sent Back to the Entrance…' },
  'world.fragmentFound': {
    ja: '不思議な欠片を見つけた！（{n}/{total}）\n10個集めるとショップで特別な復元ができるらしい。',
    en: 'Found a Mysterious Shard! ({n}/{total})\nThey say collecting 10 lets the shop do a special restoration.',
  },
  'world.chestAlreadyEmpty': { ja: '宝箱は空だ。', en: 'The treasure chest is empty.' },
  'world.chestOpened': { ja: '宝箱を開けた！\n{items} を手に入れた。', en: 'Opened the treasure chest!\nGot {items}.' },
  'world.chestCardSkill': { ja: 'カード（技）×{n}', en: 'Skill card ×{n}' },
  'world.chestCardMonster': { ja: 'カード（モンスター）×{n}', en: 'Monster card ×{n}' },
  'world.rewardSeparator': { ja: '、', en: ', ' },

  // 敵とのバトル
  'world.deckInvalidBattle': {
    ja: 'デッキの構成が正しくないため戦えない。家の机でデッキを確認しよう。',
    en: "Your deck isn't valid, so you can't fight. Check it at the desk at home.",
  },
  'world.encounter': { ja: '{name}が現れた！\n（{monsters}）', en: '{name} appeared!\n({monsters})' },
  'world.bossBattle': { ja: 'ボス戦', en: 'Boss Battle' },
  'world.dungeonBattle': { ja: 'ダンジョン戦', en: 'Dungeon Battle' },
  'world.victory': { ja: '勝利！ {coins} を手に入れた。', en: 'Victory! Got {coins}.' },
  // 2026-10-30 点検 L：クリアのあとは街の南の門の前に戻るので「家に」→「街に」
  'world.dungeonCleared': {
    ja: 'ボスを倒した！ダンジョンクリア！\n{coins} を手に入れた。\n街に帰ってきた。',
    en: 'You beat the boss! Dungeon cleared!\nGot {coins}.\nYou returned to town.',
  },
  'world.dungeonClearedFirst': {
    ja: 'ボスを倒した！ダンジョンクリア！\n{coins} を手に入れた。（初回クリア報酬）\n街に帰ってきた。',
    en: 'You beat the boss! Dungeon cleared!\nGot {coins}. (First-clear reward)\nYou returned to town.',
  },
  // 2026-10-28：カードはボスから奪うのではなく、最奥の祭壇から受け取る（ボスが認めてくれる）
  'world.bossCards': { ja: '最奥の祭壇から、カードを受け取った！\n{cards}', en: 'Received cards from the innermost altar!\n{cards}' },
  'world.defeat': {
    ja: '敗北した。\n家に戻ってきた。（ダンジョンには何度でも挑戦できます）',
    en: 'You lost...\nYou returned home. (You can retry the dungeon any time.)',
  },

  // ダンジョンから帰る
  'world.leaveTitle': { ja: '街へ帰りますか？', en: 'Return to town?' },
  'world.leaveText': {
    ja: '探索を終えて家に戻ります。倒した敵は次の探索で復活します。',
    en: 'You will stop exploring and go home. Defeated enemies come back next time.',
  },

  // メニュー
  'world.menuStatus': { ja: 'ランク：{rank}　所持金：{coins}', en: 'Rank: {rank} · Money: {coins}' },
  'world.menuDeckOk': { ja: 'デッキ：使用可能', en: 'Deck: Ready' },
  'world.menuDeckNg': { ja: 'デッキ：構成に問題あり（家の机で確認）', en: 'Deck: Has problems (check at the desk at home)' },
  'world.menuFragments': { ja: '不思議な欠片：{n}/{total}', en: 'Mysterious Shards: {n}/{total}' },
  'world.autoSave': { ja: '進行状況は自動で保存されます', en: 'Your progress is saved automatically' },
  'world.autoSaveFailed': {
    ja: '進行状況は自動で保存されます（※保存に失敗しています）',
    en: 'Your progress is saved automatically (* saving is failing right now)',
  },

  // ダンジョン選択（家の壁の地図・街のダンジョン入口）
  'world.dungeonSelect.title': { ja: '世界地図', en: 'World Map' },
  'world.dungeonSelect.header': { ja: '世界地図', en: 'World Map' },
  'world.dungeonSelect.notice': {
    ja: 'ダンジョンの印を押すと出発します。街の印で街に戻ります。',
    en: 'Tap a dungeon marker to set out. Tap the town marker to go back to town.',
  },
  'world.dungeonSelect.viewNotice': {
    ja: 'ダンジョンへは、街の南の出口から出発します。',
    en: 'Dungeons are reached from the south exit of town.',
  },
  'world.dungeonSelect.locked': { ja: 'まだ行けない場所です。', en: "You can't go there yet." },
  'world.dungeonSelect.lockedName': { ja: '？？？', en: '???' },
  // イベントのダンジョン3つの名前（2026-10-29。まだダンジョンとしては足していない。いまは確認用の画面だけ。英語は仮訳）
  'world.eventDungeon.mistMine': { ja: '霧の廃坑', en: 'Misty Mine' },
  'world.eventDungeon.archive': { ja: '忘れられた書庫', en: 'Forgotten Archive' },
  'world.eventDungeon.altar': { ja: '静かなる祭壇', en: 'Silent Altar' },
  'world.dungeonSelect.viewOnly': { ja: '街の南の出口から出発できます', en: 'Set out from the south exit of town' },
  'world.dungeonSelect.town': { ja: '街', en: 'Town' },
  // 地方の名前（ミスモン本編の世界地図と同じ。英語は仮訳）
  'world.region.ferna': { ja: 'フェルナ地方', en: 'Ferna' },
  'world.region.nordis': { ja: 'ノルディス地方', en: 'Nordis' },
  'world.region.asteria': { ja: 'アステリア地方', en: 'Asteria' },
  'world.region.ortiga': { ja: 'オルティガ地方', en: 'Ortiga' },
  'world.region.seiran': { ja: 'セイラン地方', en: 'Seiran' },
  'world.region.nebrasia': { ja: 'ネブラシア地方', en: 'Nebrasia' },
  'world.dungeonSelect.deckInvalid': {
    ja: 'デッキの構成が正しくありません。机でデッキを確認してください。',
    en: "Your deck isn't valid. Please check it at the desk.",
  },
} as const satisfies Readonly<Record<string, MessageEntry>>;
