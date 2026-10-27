import type { MessageEntry } from '../i18n.ts';

/**
 * ランダム生成のダンジョン（2026-10-26 試作。src/ui/screens/dungeonRunScreen.ts）。
 * 宝箱の中身・クリアの報酬などは仮（docs/handoff.md の「ダンジョン試作の未決事項」）
 */
export const DUNGEON_RUN_MESSAGES = {
  'dungeonRun.title': { ja: 'ダンジョン探索', en: 'Dungeon' },
  'dungeonRun.floorName': { ja: '地下{n}階', en: 'B{n}' },
  'dungeonRun.losses': { ja: '負け {n}/{max}', en: 'Losses {n}/{max}' },
  'dungeonRun.gained': { ja: '獲得 {n}枚', en: 'Cards {n}' },
  'dungeonRun.minimap': { ja: '地図', en: 'Map' },
  'dungeonRun.buttonA': { ja: 'しらべる・話す', en: 'Check / Talk' },
  'dungeonRun.buttonB': { ja: 'メニュー', en: 'Menu' },
  'dungeonRun.omen': { ja: 'なにかの気配がする…', en: 'You sense something nearby...' },
  'dungeonRun.omenMark': { ja: '！', en: '!' },
  'dungeonRun.npcTalk': { ja: '{name}が勝負を挑んできた！\n（{monsters}）', en: '{name} challenges you!\n({monsters})' },
  'dungeonRun.guardianAppear': { ja: '{name}が姿を現した！\n（{monsters}）', en: '{name} reveals itself!\n({monsters})' },
  'dungeonRun.bossTalk': { ja: '{name}が立ちはだかる！\n（{monsters}）', en: '{name} blocks your way!\n({monsters})' },
  'dungeonRun.stairsTitle': { ja: '階段を下りますか？', en: 'Go down the stairs?' },
  'dungeonRun.stairsBody': { ja: '下りると、この階には戻れません。', en: 'You cannot come back to this floor.' },
  'dungeonRun.chestOpened': { ja: '宝箱を開けた。\n中身はまだ決まっていません（仮）。', en: 'You opened the chest.\nIts contents are not decided yet (Temp).' },
  'dungeonRun.win': { ja: '勝利！\n技カード「{card}」を手に入れた。', en: 'Victory!\nGot the skill card "{card}".' },
  'dungeonRun.winNoCard': { ja: '勝利！', en: 'Victory!' },
  'dungeonRun.lose': {
    ja: '負けてしまった…\nあと{n}回負けると、街の入り口へ戻されます。',
    en: 'You lost...\n{n} more losses and you will be sent back to town.',
  },
  'dungeonRun.expelled': {
    ja: '負けてしまった…\n力尽きて、街の入り口へ戻された。\nこの挑戦で手に入れた技カード{n}枚を失った。',
    en: 'You lost...\nExhausted, you were sent back to the town entrance.\nYou lost the {n} skill cards you got on this run.',
  },
  'dungeonRun.menuTitle': { ja: 'メニュー（仮）', en: 'Menu (Temp)' },
  'dungeonRun.menuLosses': { ja: '負けた回数：{n}／{max}（{max}回負けると街へ戻されます）', en: 'Losses: {n}/{max} (at {max} you go back to town)' },
  'dungeonRun.menuGained': { ja: 'この挑戦で手に入れた技カード', en: 'Skill cards got on this run' },
  'dungeonRun.menuNone': { ja: 'まだありません', en: 'None yet' },
  'dungeonRun.menuCard': { ja: '{name} ×{n}', en: '{name} ×{n}' },
} as const satisfies Readonly<Record<string, MessageEntry>>;
