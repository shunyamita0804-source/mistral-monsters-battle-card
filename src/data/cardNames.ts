/**
 * モンスターカードの名前をゲームが書く（2026-11-05 指示書 AY：ユーザー決定「名前は絵から消し、ゲームが1つの字体で上に書く」）。
 * NAMELESS_OFFICIAL_ART：正式カードの絵（*_official.webp）から名前の文字を消した版に差し替え済みのモンスター。
 * ここにあるモンスターだけ、正式カードの上に名前の層（src/ui/components/cardNameLayer.ts）を重ねる（名前が2つ重ならないように）。
 * これから増えるモンスターも、名前の無い絵で入れてここに足す
 */
export const NAMELESS_OFFICIAL_ART: ReadonlySet<string> = new Set<string>([
  // 2026-11-05 指示書 AY：20体（原本 design-parts/card-names-20261105/noname/。前の名前入りの絵は old/）
  'mon-soramo', 'mon-gauul', 'mon-lazuck', 'mon-nobiton', 'mon-myurol', 'mon-kalshell', 'mon-pukarim', 'mon-geol', 'mon-flune', 'mon-serephine',
  'mon-tsumuji', 'mon-hyouzuku', 'mon-shishien', 'mon-hakuran', 'mon-desuoru', 'mon-lilil', 'mon-forn', 'mon-uzurio', 'mon-tyrant', 'mon-gearos',
]);

/* 字体の3案（指示書 AY【4】）は 2026-11-05 指示書 AZ でやめた。日本語は名前のロゴの絵（src/data/cardNameLogos.generated.ts）、英語も名前のロゴの絵（2026-11-05 指示書 BC。仮の字体 Bangers はやめた） */

/**
 * 名前の置き場所（カードの幅・高さに対する割合。正式カード 508×849。前の太い文字の16体〔ツムジなど〕の名前の位置を測った値）。
 * 左＝枠の内側（4.3％）、右のはし＝LIFE の札の手前（74％）。文字の高さはカードの幅の 14％ くらい
 */
export const CARD_NAME_BOX = { left: 0.043, top: 0.022, right: 0.74, fontSize: 0.15 } as const;
