import type { MessageEntry } from '../i18n.ts';

/**
 * 序盤〜C大会後のイベント（2026-11-02 指示書 AT）の画面の文字。イベントのせりふそのものは src/data/storyEvents.ts（日英を並べて書く）
 */
export const STORY_EVENT_MESSAGES = {
  'storyEvent.missing': { ja: 'まだ倒していない守り手：{list}', en: 'Keepers not yet beaten: {list}' },
  'storyEvent.missingNone': { ja: '試練はもう越えています。', en: 'You have already cleared the trial.' },
  'storyEvent.objective': { ja: '目標：{text}', en: 'Goal: {text}' },
  'storyEvent.next': { ja: '次へ', en: 'Next' },
  'storyEvent.close': { ja: '閉じる', en: 'Close' },
  'storyEvent.skip': { ja: 'スキップ', en: 'Skip' },
  // カードの見せ方（2026-11-02 指示書 AT：owned／preview_only／reward）
  'storyEvent.card.owned': { ja: 'あなたのカード', en: 'Your card' },
  'storyEvent.card.preview': { ja: '見せてもらったカード（まだ持っていない）', en: 'A card you were shown (not yours yet)' },
  'storyEvent.card.previewBy': { ja: '{name}のカード（見せてもらっただけ）', en: "{name}'s card (just a look)" },
  'storyEvent.card.reward': { ja: '手に入れたカード', en: 'Card obtained' },
  'storyEvent.card.count': { ja: '{i} / {n}', en: '{i} / {n}' },
  // 確かめ用の入口（?qa=1&lab=events）
  'storyEvent.lab.title': { ja: 'イベントの確かめ（確認用）', en: 'Event Check (QA)' },
  'storyEvent.lab.note': {
    ja: '確認用の画面です。イベントを順に見られます。ここで見てもセーブは変わりません（一度だけの印も付きません）。',
    en: 'QA screen. Play events in order. Nothing here changes your save (no one-time flags are set).',
  },
  'storyEvent.lab.back': { ja: '戻る', en: 'Back' },
  'storyEvent.lab.won': { ja: '勝ち・優勝のとき', en: 'When won' },
  'storyEvent.lab.lost': { ja: '負けのとき', en: 'When lost' },
  'storyEvent.lab.existing': { ja: '（今のせりふのまま・カードは出さない）', en: '(Existing lines only. No cards shown)' },
  'storyEvent.lab.guardianFront': { ja: '（守り手の前）', en: ' (before a keeper)' },
} as const satisfies Readonly<Record<string, MessageEntry>>;
