import { createNewSave, type SaveData } from '../../game/save/saveData.ts';
import { storyEventsInOrder, type EventContext } from '../../game/story/storyEvents.ts';
import type { StoryEventDefinition } from '../../data/storyEvents.ts';
import { getLanguage, t } from '../../i18n/i18n.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { playStoryEvent } from '../components/storyEventPlayer.ts';
import { button, h } from '../dom.ts';
import type { ScreenDefinition } from './types.ts';

/**
 * イベントの確かめ用の入口（2026-11-02 指示書 AT。?qa=1 のときだけ、設定の「QA用」か ?qa=1&lab=events から。ふつうに遊んでいる人には出ない）。
 * イベントを章と順番に並べ、押すとその場で出す。セーブは変えない（一度だけの印も付けない）。セーブが無ければ新しく始めたときのセーブで見せる。
 * カードを見せる場面は、見せるだけの写し（持っているカードはそのときのセーブ。無ければ最初の箱の旅立ちを持っているとして見せる）
 */
export const storyEventLabScreen: ScreenDefinition = {
  id: 'storyEventLab',
  titleKey: 'storyEvent.lab.title',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen story-event-lab' });

    /** 見せるためのセーブの写し（変更はしない） */
    const sample = (): SaveData => {
      const base = store.hasSave ? store.save : createNewSave(new Date(2026, 10, 2));
      const collection = { ...base.collection };
      for (const id of ['mon-uzurio', 'mon-serephine', 'mon-flune', 'mon-hyouzuku', 'mon-shishien', ...base.deck.monsters]) collection[id] = Math.max(1, collection[id] ?? 0);
      return { ...base, collection, story: { ...base.story, introV2: { ...base.story.introV2, selectedBoosterKey: base.story.introV2.selectedBoosterKey ?? 'booster-1' } } };
    };

    const play = (ev: StoryEventDefinition, extra: EventContext): void => {
      playStoryEvent(element, sample(), ev, { ctx: { firstClear: true, ...extra }, onDone: () => undefined });
    };

    const branches = (ev: StoryEventDefinition): boolean => ev.steps.some((s) => s.kind === 'line' && (s.line.when === 'won' || s.line.when === 'lost'));

    const row = (ev: StoryEventDefinition): HTMLElement => {
      const title = getLanguage() === 'en' ? ev.title.en : ev.title.ja;
      const buttons = ev.steps.length === 0
        ? [h('span', { class: 'story-event-lab__note', text: t('storyEvent.lab.existing') })]
        : branches(ev)
          ? [button(t('storyEvent.lab.won'), () => play(ev, { won: true }), 'btn btn--small'), button(t('storyEvent.lab.lost'), () => play(ev, { won: false, earlyLoss: true }), 'btn btn--small')]
          : [button('▶', () => play(ev, { earlyLoss: true }), 'btn btn--small')];
      return h(
        'li',
        { class: 'story-event-lab__row', dataset: { id: ev.id } },
        h('span', { class: 'story-event-lab__id', text: ev.id }),
        h('span', { class: 'story-event-lab__title', text: `${title}${ev.guardianFront ? t('storyEvent.lab.guardianFront') : ''}` }),
        ...buttons,
      );
    };

    element.append(
      createScreenHeader({ title: t('storyEvent.lab.title'), back: { label: t('storyEvent.lab.back'), onTap: () => ctx.back(store.hasSave ? 'settings' : 'title') } }),
      h('p', { class: 'notice', text: t('storyEvent.lab.note') }),
      h('ul', { class: 'story-event-lab__list' }, ...storyEventsInOrder().map(row)),
    );
    return { element };
  },
};
