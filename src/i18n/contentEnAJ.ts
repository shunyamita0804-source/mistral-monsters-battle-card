import { AJ_SKILLS } from '../data/skillRebuildAJ.ts';

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

/** 効果の文（日本語 → 英語の仮訳） */
const TEXTS: Readonly<Record<string, string>> = {
  回避されても半分のダメージ: 'Half damage even if dodged.',
  回避されない: "Can't be dodged.",
  防御されない: "Can't be guarded.",
  相手1体は次の攻撃を行えない: "1 enemy can't make its next attack.",
  ちから技に効く: 'Works on POW skills.',
  かしこさ技に効く: 'Works on INT skills.',
  'ちから技・かしこさ技に効く': 'Works on POW and INT skills.',
  'マナに関係なく、ちから技・かしこさ技を回避': 'Dodge any POW or INT skill.',
  'マナ2以上のちから技・かしこさ技を回避': 'Dodge POW and INT skills that cost 2+ mana.',
  'マナ3以上のちから技・かしこさ技を回避': 'Dodge POW and INT skills that cost 3+ mana.',
  ちから技を回避: 'Dodge POW skills.',
  かしこさ技を回避: 'Dodge INT skills.',
  '次の自分のターンの終わりまで、全モンスターを水中にする': 'Until the end of your next turn, all monsters are underwater.',
  相手の手札からランダムに1枚捨てさせる: 'The opponent discards 1 random card from their hand.',
  地上の相手だけに使える: 'Can only target ground enemies.',
  '次の相手のターン、受けるちから技すべて−3': 'Next enemy turn, every POW skill you take is -3.',
  '自分のライフ＋2（もとのLIFEまで）': 'Restore 2 of your own life (up to max).',
  場が水中なら2倍: 'Double damage while the field is underwater.',
  次のターン攻撃の的にならない: "Can't be targeted by attacks next turn.",
  'ちから技・かしこさ技のダメージを0に': 'Reduce POW and INT damage to 0.',
  '相手は次のターン、ラズックしか攻撃できない': 'Next turn, the enemy can only attack Lazuck.',
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
  味方への攻撃を代わりに受ける: 'Take an attack aimed at an ally.',
  '相手全員に当たる（守りは1体ずつ）': 'Hits every enemy (each guards separately).',
  '当たると自分のライフ−1': 'On hit, you lose 1 life.',
  '当たると自分のライフ−2': 'On hit, you lose 2 life.',
  '当たると自分のライフ−3': 'On hit, you lose 3 life.',
  '倒れている味方1体につき＋2': '+2 for each fallen ally.',
  相手の手札をすべて見て1枚選んで捨てさせる: "See the opponent's hand and make them discard 1 card you choose.",
  'ライフ1以下の、デスオル以外のモンスターをすべて倒す': 'Knock out every monster with 1 life or less, except Desuoru.',
  // 2026-11-02 指示書 AK リリル（仮訳）
  '相手は次のターン、リリルしか攻撃できない': 'Next turn, the enemy can only attack Lilil.',
  '相手は次のターン、リリルを攻撃できない': "Next turn, the enemy can't attack Lilil.",
};

export const AJ_EN: Readonly<Record<string, string>> = Object.fromEntries(
  Object.values(AJ_SKILLS).flatMap((rows) =>
    rows.flatMap((r) => [
      ...(NAMES[r.id] ? [[`card:${r.id}:name`, NAMES[r.id] as string]] : []),
      [`card:${r.id}:effect`, r.text ? (TEXTS[r.text] ?? r.text) : ''],
    ]),
  ),
);

/** 英語の仮訳が無い効果の文（テストで 0 件を確かめる） */
export const AJ_EN_MISSING: readonly string[] = Object.values(AJ_SKILLS).flatMap((rows) => rows.filter((r) => r.text && !TEXTS[r.text]).map((r) => r.id));
