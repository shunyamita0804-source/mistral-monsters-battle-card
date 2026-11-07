import { AJ_QA_SKILLS, AJ_SKILLS } from '../data/skillRebuildAJ.ts';

/**
 * 指示書 AJ（2026-11-01）の技カードの英語【仮訳】。名前を変えた技・新しい技の名前と、効果の文（表の日本語の文ごとの訳）。
 * src/i18n/contentEnOfficialDraft.ts の最後に重ねる（同じキーはこちらが勝つ）。効果の文の無い技は、前の英語の効果の文を消す（''）
 */
const NAMES: Readonly<Record<string, string>> = {
  'skl-soramo14-04': 'Tail Slap',
  'skl-myurol-03': 'Tail Spin',
  'skl-lazuck-07': 'Lure',
  'skl-kalshell-15': 'High Tide',
  'skl-desuoru-15': 'Offering of the Dead',
  'skl-desuoru-16': 'Requiem of Death',
  'skl-desuoru-14': 'Fade into Darkness',
};

/**
 * 防御・回避の文（2026-11-06 指示書 BK【2】でそろえた形。src/data/skillRebuildAJ.ts の tGuard・tDodge）の英語。英語も同じ考え方でそろえる：
 * 防御「Take 3 less damage from POW skills.」・回避「Dodge POW skills.」「Dodge POW and INT skills that cost 2+ mana.」
 */
const STAT_EN = { 'ちから技': 'POW skills', 'かしこさ技': 'INT skills', 'ちから技、かしこさ技': 'POW and INT skills' } as const;
const GUARD_DODGE_TEXTS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(STAT_EN).flatMap(([ja, en]) => [
    ...Array.from({ length: 10 }, (_, n) => [`${ja}の受けるダメージを${n}減らす。`, `Take ${n} less damage from ${en}.`]),
    [`${ja}を回避する。`, `Dodge ${en}.`],
    ...[2, 3, 4].map((n) => [`マナ${n}以上の${ja}を回避する。`, `Dodge ${en} that cost ${n}+ mana.`]),
  ]),
);

/** 効果の文（日本語 → 英語の仮訳） */
const TEXTS: Readonly<Record<string, string>> = {
  ...GUARD_DODGE_TEXTS,
  // 2026-11-06 指示書 BK【2】：特別な守りの文（防御・回避の形に近づけた案。意味は前と同じ）
  '次の相手のターン、ちから技の受けるダメージを3減らす。': 'Next enemy turn, take 3 less damage from POW skills.',
  'ちから技、かしこさ技の受けるダメージを0にする。': 'Reduce damage from POW and INT skills to 0.',
  '味方への攻撃を代わりに受ける。': 'Take an attack aimed at an ally.',
  '味方への攻撃を代わりに受け、受けるダメージを2減らす。': 'Take an attack aimed at an ally, and take 2 less damage.',
  'フォルン以外の味方1体は、次の相手のターン、受けるダメージを1減らす。': '1 ally other than Forn takes 1 less damage during the next enemy turn.',
  回避されても半分のダメージ: 'Half damage even if dodged.',
  回避されない: "Can't be dodged.",
  防御されない: "Can't be guarded.",
  相手1体は次の攻撃を行えない: "1 enemy can't make its next attack.",
  '次の自分のターンの終わりまで、全モンスターを水中にする': 'Until the end of your next turn, all monsters are underwater.',
  相手の手札からランダムに1枚捨てさせる: 'The opponent discards 1 random card from their hand.',
  地上の相手だけに使える: 'Can only target ground enemies.',
  '自分のライフ＋2（もとのLIFEまで）': 'Restore 2 of your own life (up to max).',
  場が水中なら2倍: 'Double damage while the field is underwater.',
  次のターン攻撃の的にならない: "Can't be targeted by attacks next turn.",
  'ちから技・かしこさ技のダメージを0に': 'Reduce POW and INT damage to 0.',
  '相手は次のターン、ラズックしか攻撃できない': 'Next turn, the enemy can only attack Lazuck.',
  // 2026-11-06 指示書 BK：クロシオ（英語は仮訳）
  // 2026-11-06 指示書 BM：フギン（英語は仮訳）
  '回避されなければ、相手は次の攻撃を行えない': "If not evaded, the enemy can't attack next turn.",
  // 2026-11-07 指示書 BN：ノウス（英語は仮訳）
  '回避されなければ、相手のマナを1減らす': "If not evaded, the opponent's mana -1.",
  '回避されなければ、相手のマナを2減らす': "If not evaded, the opponent's mana -2.",
  '回避されなければ、相手のマナを0にする': "If not evaded, the opponent's mana becomes 0.",
  '手札をすべて山札に戻し、同じ枚数を引く': 'Return your whole hand to the deck and draw the same number of cards.',
  '相手の山札の上から2枚を捨て札にする': "Put the top 2 cards of the opponent's deck into the discard pile.",
  '山札から好きなカードを1枚選んで手札に加える': 'Choose any card from your deck and add it to your hand.',
  // 2026-11-07 指示書 BP：ベニオウ（英語は仮訳）
  '自分のLIFEが半分以下ならダメージ＋3': 'If your LIFE is half or less, damage +3.',
  '自分のLIFEが半分以下ならダメージ＋4': 'If your LIFE is half or less, damage +4.',
  '次の自分の手番の終わりまでに使う次のちから技のダメージを2倍': 'Your next STR skill used by the end of your next turn deals double damage.',
  '相手1体は次の自分の手番の終わりまで回避できない': "One enemy can't evade until the end of your next turn.",
  '山札から回避の技カードを1枚選んで手札に加える。なければ1枚引く': 'Choose an Evade skill card from your deck and add it to your hand. If there is none, draw 1 card.',
  'このあと自分が使う回避の技1回のマナを0にする': 'The next Evade skill this monster uses costs 0 mana.',
  // 2026-11-06 指示書 BL：ロウガ（英語は仮訳）
  '相手は次のターン行動できない（凍る）': "The enemy can't act next turn (frozen).",
  '次の自分のターンの終わりまで、次の攻撃＋2': 'Until the end of your next turn, your next attack +2.',
  '相手は次のターン、クロシオしか攻撃できない': 'Next turn, the enemy can only attack Kuroshio.',
  '当たった相手1体を、次の自分の手番の終わりまで水中にする': 'If it hits, that enemy counts as underwater until the end of your next turn.',
  '水中の相手全員に当たる（守りは1体ずつ）。水中の相手がいないと使えない': "Hits every underwater enemy (each guards separately). Can't be used if no enemy is underwater.",
  '相手の次のターンのちから技−1': "The enemy's POW skills are -1 next turn.",
  '相手の手札1枚をランダムに山札へ（補充なし）': "Shuffle 1 random card from the enemy's hand into their deck (no redraw).",
  相手は次のターン行動できない: "The target can't act next turn.",
  '相手のマナ−1': "Opponent's mana -1.",
  '相手のマナ−3': "Opponent's mana -3.",
  '相手のマナ−4': "Opponent's mana -4.", // 2026-11-02 指示書 AK リリルのあまいかおり（仮訳）
  手札をすべて交換: 'Swap your whole hand.',
  相手の手札をすべて見る: "See the opponent's whole hand.",
  ためているときは回避されない: "Can't be dodged while charged.",
  '次の攻撃＋2（使うまで続く）': 'Next attack +2 (lasts until used).',
  'プカリム以外の味方1体、次のターンの攻撃＋1': 'An ally other than Pukarim gets +1 attack next turn.',
  与えたダメージぶん回復: 'Heal as much as the damage dealt.',
  '味方1体のライフ＋2': 'Restore 2 life to 1 ally.',
  水中の相手には防御されない: "Underwater enemies can't guard it.",
  水中の相手は回避できない: "Underwater enemies can't dodge it.",
  同じターンにもう1枚続けて使える: 'You can use another copy right after it this turn.',
  空中の相手は回避できない: "Airborne enemies can't dodge it.",
  '次のターン、ツムジの攻撃のマナ−1': "Next turn, Tsumuji's attacks cost 1 less mana.",
  '地上の相手全員に当たる（守りは1体ずつ）': 'Hits every ground enemy (each guards separately).',
  '次のターン、最初のかしこさ技を2倍に': 'Next turn, your first INT skill deals double.',
  '相手全員に当たる（守りは1体ずつ）': 'Hits every enemy (each guards separately).',
  '当たると自分のライフ−1': 'On hit, you lose 1 life.',
  '当たると自分のライフ−2': 'On hit, you lose 2 life.',
  '当たると自分のライフ−3': 'On hit, you lose 3 life.',
  '倒れている味方1体につき＋2': '+2 for each fallen ally.',
  相手の手札をすべて見て1枚選んで捨てさせる: "See the opponent's hand and make them discard 1 card you choose.",
  'ライフ1以下の、デスオル以外のモンスターをすべて倒す': 'Knock out every monster with 1 life or less, except Desorl.',
  // 2026-11-02 指示書 AK リリル（仮訳）
  '相手は次のターン、リリルしか攻撃できない': 'Next turn, the enemy can only attack Lilil.',
  '相手は次のターン、リリルを攻撃できない': "Next turn, the enemy can't attack Lilil.",
  // 2026-11-02 指示書 AL フォルン（仮訳）
  'フォルン以外の味方1体、次のターンの攻撃＋1': "1 ally other than Forn deals +1 with its attack next turn.",
  '山札から手札が5枚になるまで引き、そのあと手札から1枚捨てる': 'Draw until you have 5 cards in hand, then discard 1 card.',
  // 2026-11-02 指示書 AQ ウズリオ（仮訳）
  '相手が空中なら +2（ダメージ4）': '+2 if the target is airborne (4 dmg).',
  '相手全員に1ダメージ。空中の相手には2ダメージ': '1 dmg to every enemy, 2 dmg to airborne enemies.',
  '相手の手札1枚をランダムに山札へもどす': "Return 1 random card from the enemy's hand to their deck.",
  // 2026-11-05 指示書 AX タイラント・ギアロス（仮訳）
  相手全員にダメージ: 'Damages every enemy.',
  次のターン回避されない: "Next turn, your first attack can't be dodged.",
  次のターン防御されない: "Next turn, your first attack can't be guarded.",
  '手札から1枚山札に戻し、1枚引いて、そのあと山札をシャッフル': 'Return 1 card from your hand to your deck, draw 1, then shuffle your deck.',
  山札の上から3枚まで確かめる: 'Look at up to 3 cards from the top of your deck.',
  // 2026-11-05 指示書 BH：クヨウ（英語は仮訳）
  '味方1体の悪い状態をすべて消し、ライフ＋1（もとのLIFEまで）': 'Remove all bad statuses from 1 ally and restore 1 life (up to max).',
  '次の相手のターンの終わりまで、味方全員に悪い状態がつかない': 'Until the end of the next enemy turn, your monsters cannot get bad statuses.',
  // 2026-11-05 指示書 BI：ラディエル（英語は仮訳）
  '相手1体は次の攻撃を行えない。相手のマナ−1': 'One enemy cannot attack next time. The enemy loses 1 mana.',
  'おたがいの手札を山札に戻し、同じ枚数を引いて山札をシャッフル': 'Both players return their hands to their decks, draw the same number, then shuffle.',
  '自分の捨て札から3枚をマナにする': 'Turn 3 cards from your discard pile into mana.',
};

export const AJ_EN: Readonly<Record<string, string>> = Object.fromEntries(
  [...Object.values(AJ_SKILLS), ...Object.values(AJ_QA_SKILLS)].flatMap((rows) =>
    rows.flatMap((r) => [
      ...(NAMES[r.id] ? [[`card:${r.id}:name`, NAMES[r.id] as string]] : []),
      [`card:${r.id}:effect`, r.text ? (TEXTS[r.text] ?? r.text) : ''],
    ]),
  ),
);

/** 英語の仮訳が無い効果の文（テストで 0 件を確かめる） */
export const AJ_EN_MISSING: readonly string[] = [...Object.values(AJ_SKILLS), ...Object.values(AJ_QA_SKILLS)].flatMap((rows) => rows.filter((r) => r.text && !TEXTS[r.text]).map((r) => r.id));
