import worldMapArt from '@assets/images/ui/worldmap/world_map.webp';
import story01 from '@assets/images/backgrounds/story_01_meet_sienna.webp';
import story02 from '@assets/images/backgrounds/story_02_silver_clasp.webp';
import story04 from '@assets/images/backgrounds/story_04_final_sienna.webp';
import ev2S01 from '@assets/images/backgrounds/event_ev2_s01_last_card.webp';
import ev2S02 from '@assets/images/backgrounds/event_ev2_s02_travel_notebook.webp';
import ev2S04 from '@assets/images/backgrounds/event_ev2_s04_promise.webp';
import ev2N02 from '@assets/images/backgrounds/event_ev2_n02_shop_keepsake.webp';
import ev2N03 from '@assets/images/backgrounds/event_ev2_n03_pete_sorting.webp';
import ev2N07 from '@assets/images/backgrounds/event_ev2_n07_florist.webp';
import ev2N08 from '@assets/images/backgrounds/event_ev2_n08_card_case.webp';
import tutShop from '@assets/images/backgrounds/tutorial_shop_and_packs.webp';
import tutDungeon from '@assets/images/backgrounds/tutorial_dungeon_overview.webp';
import tutTowerDoors from '@assets/images/backgrounds/tutorial_tower_doors.webp';
import tutTournament from '@assets/images/backgrounds/tutorial_tournament_overview.webp';
import tutBoard from '@assets/images/backgrounds/tutorial_bureau_board.webp';
import siennaSmile from '@assets/images/characters/talk_sienna_smile.webp';
import siennaHappy from '@assets/images/characters/talk_sienna_happy.webp';
import siennaNormal from '@assets/images/characters/talk_sienna_normal.webp';
import siennaWorried from '@assets/images/characters/talk_sienna_worried.webp';
import guideSmile from '@assets/images/characters/neighbor_guide_talk_smile.webp';
import { cardCatalog } from '../../data/cards.ts';
import { DUNGEONS } from '../../data/dungeons.ts';
import { getPerson } from '../../data/people.ts';
import { SQUARE_PICTURES, type CardShow, type EventChoice, type EventLine, type EventStep, type PictureId, type StillId, type StoryEventDefinition, type TalkFace } from '../../data/storyEvents.ts';
import { DUNGEON_SPOTS } from '../../data/worldMap.ts';
import { eventText, lineVisible, resolveCards, type EventContext } from '../../game/story/storyEvents.ts';
import type { SaveData } from '../../game/save/saveData.ts';
import { dungeonName } from '../../i18n/content.ts';
import { getLanguage, t } from '../../i18n/i18n.ts';
import { button, h } from '../dom.ts';
import { once } from '../gameStore.ts';
import { createCardView } from './cardView.ts';
import { openModal } from './modal.ts';
import { personFace } from './personFace.ts';

/**
 * 序盤〜C大会後のイベントを画面に出す（2026-11-02 指示書 AT）。データは src/data/storyEvents.ts、条件は src/game/story/storyEvents.ts。
 * - せりふ：顔の絵（今の顔の絵）・名前・文の窓。タップ・「次へ」で進む。「スキップ」で残りを飛ばす（印は呼ぶ側が先に付ける）
 * - 挿絵：画面いっぱいの絵の上の3分の1に白い字（プロローグと同じ）。story_02 は字を上に寄せる（セラの顔にかけない）
 * - カード：owned／preview_only／reward の3つの見せ方を札で分ける。preview_only は見せるだけ（セーブには触らない・NEW・取得の音・報酬の帯は出さない）。
 *   見せている間は、うしろのゲームを止める（窓の外を押しても進むだけ）。絵の無いカードは飛ばして会話を続ける
 * - 守り手の前の場面（guardianFront）では、どんなときもカードを出さない（データの点検は tests/storyEvents.test.ts、ここでも二重に止める）
 * - この部品はセーブを書きかえない（一度だけの印は呼ぶ側の GameStore.update で付ける）
 */

export type EventAction = NonNullable<EventChoice['action']>;

export interface PlayStoryEventOptions {
  readonly ctx?: EventContext;
  /** 選択肢の action（地図を見る・図鑑を開く など）。終わったら next を呼ぶ */
  readonly onAction?: (action: EventAction, next: () => void) => void;
  /** 地図の場面：画面に本物の地図があれば、その印を光らせる（無ければ小さな地図の窓を出す） */
  readonly onMap?: (highlight: readonly string[], next: () => void) => boolean;
  /** 目標の表示（目標の帯に出す） */
  readonly onObjective?: (text: string) => void;
  readonly onDone: () => void;
}

/** 選択肢の「地図で見る」と、光らせるダンジョン */
const SHOW_ON_MAP: Partial<Record<EventAction, string>> = { showWindValley: 'dungeon-08', showWaterTemple: 'dungeon-03', showSpiritForest: 'dungeon-02' };

const STILLS: Readonly<Record<StillId, string>> = {
  story_01_meet_sienna: story01,
  story_02_silver_clasp: story02,
  story_04_final_sienna: story04,
};

/** 会話の窓の上の額の絵（2026-11-05 指示書 AX：小挿絵7枚・説明の絵4枚） */
const PICTURES: Readonly<Record<PictureId, string>> = {
  ev2_s01_last_card: ev2S01,
  ev2_s02_travel_notebook: ev2S02,
  ev2_s04_promise: ev2S04,
  ev2_n02_shop_keepsake: ev2N02,
  ev2_n03_pete_sorting: ev2N03,
  ev2_n07_florist: ev2N07,
  ev2_n08_card_case: ev2N08,
  tutorial_shop_and_packs: tutShop,
  tutorial_dungeon_overview: tutDungeon,
  tutorial_tower_doors: tutTowerDoors,
  tutorial_tournament_overview: tutTournament,
  tutorial_bureau_board: tutBoard,
};

/** 話し手の顔の代わりの会話の絵（2026-11-05 指示書 AX【4】）と、その絵の人 */
const TALK_FACES: Readonly<Record<TalkFace, { readonly person: string; readonly url: string }>> = {
  sienna_smile: { person: 'sienna', url: siennaSmile },
  sienna_happy: { person: 'sienna', url: siennaHappy },
  sienna_normal: { person: 'sienna', url: siennaNormal },
  sienna_worried: { person: 'sienna', url: siennaWorried },
  mireille_smile: { person: 'mireille', url: guideSmile },
};

/** 金の細い縁の額に入れた絵（会話の窓の中のいちばん上。顔と文字には重ねない） */
function pictureFrame(picture: PictureId): HTMLElement {
  const square = SQUARE_PICTURES.includes(picture);
  const img = h('img', { class: 'story-picture__art', attrs: { src: PICTURES[picture], alt: '', draggable: 'false', decoding: 'async' } }) as HTMLImageElement;
  const frame = h('div', { class: `story-picture${square ? ' story-picture--square' : ''}`, dataset: { picture } }, img);
  // 絵が読めなくても会話は止めない（額ごと消す）
  img.addEventListener('error', () => frame.remove());
  return frame;
}

const speakerName = (line: EventLine): string | null => {
  if (line.speaker === 'system') return null;
  const p = getPerson(line.speaker);
  return p ? (getLanguage() === 'en' ? p.name.en : p.name.ja) : null;
};

/** 窓の見た目（イベントの小挿絵・会話の絵） */
interface LineLook {
  readonly picture?: PictureId;
  readonly face?: TalkFace;
}

/** 話し手の顔：イベントの会話の絵（その人の行だけ）か、今の顔の絵 */
function faceOf(line: EventLine, look: LineLook): HTMLElement | null {
  const person = line.speaker === 'system' ? null : getPerson(line.speaker) ?? null;
  if (!person) return null;
  const talk = look.face ? TALK_FACES[look.face] : undefined;
  if (talk && talk.person === line.speaker) {
    return h('span', { class: 'person-face person-face--portrait', attrs: { 'aria-hidden': 'true' } }, h('img', { class: 'person-face__img', attrs: { src: talk.url, alt: '', draggable: 'false', decoding: 'async' } }));
  }
  return personFace(person);
}

/** せりふ1つの窓 */
function lineModal(root: HTMLElement, save: SaveData, line: EventLine, next: () => void, skip: () => void, look: LineLook = {}): void {
  const name = speakerName(line);
  const person = line.speaker === 'system' ? null : getPerson(line.speaker) ?? null;
  const go = once(next);
  const picture = line.picture ?? look.picture;
  const handle = openModal(root, {
    className: `story-event${person ? '' : ' story-event--narration'}${picture ? ' story-event--picture' : ''}`,
    body: [
      picture ? pictureFrame(picture) : null,
      person ? h('div', { class: 'story-event__who' }, faceOf(line, look), name ? h('span', { class: 'story-event__name', text: name }) : null) : null,
      ...eventText(line.text, save).split('\n').map((s) => h('p', { class: 'story-event__text', text: s })),
    ],
    actions: [
      { label: t('storyEvent.skip'), onTap: () => { handle.close(); skip(); } },
      { label: t('storyEvent.next'), primary: true, onTap: () => { handle.close(); go(); } },
    ],
    // 窓の外を押しても次へ（閉じたまま止まらない）
    onClose: go,
  });
}

/** 挿絵（上の3分の1に白い字）。タップで字を全部出す → もう一度で次へ */
function showStill(root: HTMLElement, save: SaveData, step: Extract<EventStep, { kind: 'still' }>, ctx: EventContext, next: () => void): void {
  const lines = step.lines.filter((l) => lineVisible(l, ctx, save));
  const close = once(() => {
    el.classList.add('is-leaving');
    setTimeout(() => {
      el.remove();
      next();
    }, 500);
  });
  const lineEls = lines.map((l) => {
    const name = speakerName(l);
    return h('p', { class: 'story-still__line', text: name ? `${name}「${eventText(l.text, save)}」` : eventText(l.text, save) });
  });
  const art = h('img', { class: 'story-still__art', attrs: { src: STILLS[step.still], alt: '', draggable: 'false' } }) as HTMLImageElement;
  // 絵が読めなくても止めない（字だけで進む）
  art.addEventListener('error', () => art.remove());
  const el = h(
    'div',
    { class: `story-still${step.textTop ? ' story-still--top' : ''}`, attrs: { role: 'button' } },
    art,
    h('div', { class: 'story-still__text' }, ...lineEls),
    button(t('storyEvent.skip'), () => close(), 'btn btn--small story-still__skip'),
  );
  el.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.story-still__skip')) return;
    const hidden = lineEls.filter((x) => !x.classList.contains('is-shown'));
    if (hidden.length > 0) for (const x of hidden) x.classList.add('is-shown');
    else close();
  });
  root.append(el);
  requestAnimationFrame(() => {
    el.classList.add('is-active');
    lineEls.forEach((x, i) => setTimeout(() => x.classList.add('is-shown'), 400 + i * 1600));
  });
}

/** カードを1枚ずつ大きく見せる（owned／preview_only／reward） */
function showCards(root: HTMLElement, save: SaveData, show: CardShow, next: () => void): void {
  const ids = resolveCards(save, show).filter((id) => !!cardCatalog.get(id));
  if (ids.length === 0) {
    next();
    return;
  }
  const label = (): string => {
    if (show.mode === 'owned') return t('storyEvent.card.owned');
    if (show.mode === 'reward') return t('storyEvent.card.reward');
    const holder = show.holder ? getPerson(show.holder) : undefined;
    return holder ? t('storyEvent.card.previewBy', { name: getLanguage() === 'en' ? holder.name.en : holder.name.ja }) : t('storyEvent.card.preview');
  };
  const width = Math.min(220, Math.floor((root.clientWidth || 390) * 0.58));
  const one = (i: number): void => {
    const card = cardCatalog.get(ids[i] as string);
    if (!card) {
      if (i + 1 < ids.length) one(i + 1);
      else next();
      return;
    }
    let view: HTMLElement;
    try {
      view = createCardView(card, width, true);
    } catch {
      // 絵・データの読みこみに失敗しても会話は止めない
      if (i + 1 < ids.length) one(i + 1);
      else next();
      return;
    }
    const go = once(() => (i + 1 < ids.length ? one(i + 1) : next()));
    const handle = openModal(root, {
      className: `story-card story-card--${show.mode}`,
      body: [
        h('p', { class: 'story-card__label', text: label() }),
        h('div', { class: 'story-card__view' }, view),
        ids.length > 1 ? h('p', { class: 'story-card__count', text: t('storyEvent.card.count', { i: i + 1, n: ids.length }) }) : null,
      ],
      actions: [{ label: t(i + 1 < ids.length ? 'storyEvent.next' : 'storyEvent.close'), primary: true, onTap: () => { handle.close(); go(); } }],
      onClose: go,
    });
  };
  one(0);
}

/** 絵だけの窓（M07 の大会の説明の絵） */
function figureModal(root: HTMLElement, picture: PictureId, next: () => void, skip: () => void): void {
  const go = once(next);
  const handle = openModal(root, {
    className: 'story-event story-event--picture story-event--figure',
    body: [pictureFrame(picture)],
    actions: [
      { label: t('storyEvent.skip'), onTap: () => { handle.close(); skip(); } },
      { label: t('storyEvent.next'), primary: true, onTap: () => { handle.close(); go(); } },
    ],
    onClose: go,
  });
}

/** 小さな地図の窓：ダンジョンの印を光らせる */
function showMiniMap(root: HTMLElement, highlight: readonly string[], next: () => void): void {
  const map = h('div', { class: 'story-map' }, h('img', { class: 'story-map__art', attrs: { src: worldMapArt, alt: '', draggable: 'false' } }));
  for (const id of highlight) {
    const spot = DUNGEON_SPOTS[id];
    const d = DUNGEONS.find((x) => x.id === id);
    if (!spot || !d) continue;
    const pin = h('span', { class: 'story-map__pin' }, h('span', { class: 'story-map__dot' }), h('span', { class: 'story-map__label', text: dungeonName(d) }));
    pin.style.left = `${spot.x * 100}%`;
    pin.style.top = `${spot.y * 100}%`;
    map.append(pin);
  }
  const go = once(next);
  const handle = openModal(root, {
    className: 'story-event story-event--map',
    body: [map],
    actions: [{ label: t('storyEvent.next'), primary: true, onTap: () => { handle.close(); go(); } }],
    onClose: go,
  });
}

/** 選択肢の窓 */
function choiceModal(root: HTMLElement, choices: readonly EventChoice[], pick: (c: EventChoice) => void, picture?: PictureId): void {
  const handle = openModal(root, {
    className: `story-event story-event--choice${picture ? ' story-event--picture' : ''}`,
    body: picture ? [pictureFrame(picture)] : [],
    actions: choices.map((c, i) => ({ label: getLanguage() === 'en' ? c.label.en : c.label.ja, primary: i === 0, onTap: () => { handle.close(); pick(c); } })),
    closeOnBackdrop: false,
  });
}

/** イベント1つを最後まで出す */
export function playStoryEvent(screen: HTMLElement, save: SaveData, ev: StoryEventDefinition, options: PlayStoryEventOptions): void {
  // 窓・挿絵は、画面がスクロールしていても見える所に出す（390×844 の舞台。無ければ渡された画面）
  const root = (screen.closest('.stage') as HTMLElement | null) ?? screen;
  const ctx = options.ctx ?? {};
  const done = once(options.onDone);
  const steps = ev.steps;
  const look: LineLook = { ...(ev.picture ? { picture: ev.picture } : {}), ...(ev.face ? { face: ev.face } : {}) };
  const run = (i: number): void => {
    if (i >= steps.length) {
      done();
      return;
    }
    const step = steps[i] as EventStep;
    const next = (): void => run(i + 1);
    switch (step.kind) {
      case 'line':
        if (!lineVisible(step.line, ctx, save)) return next();
        return lineModal(root, save, step.line, next, done, look);
      case 'still':
        return showStill(root, save, step, ctx, next);
      case 'cards':
        // 守り手の前では、どんなときもカードを出さない
        if (ev.guardianFront) return next();
        return showCards(root, save, step.show, next);
      case 'map':
        if (options.onMap?.(step.highlight, next)) return;
        return showMiniMap(root, step.highlight, next);
      case 'objective':
        options.onObjective?.(eventText(step.text, save));
        return next();
      case 'figure':
        return figureModal(root, step.picture, next, done);
      case 'choice':
        return choiceModal(root, step.choices, (c) => {
          const after = (): void => {
            if (c.action === 'repeat') return run(Math.max(0, steps.findIndex((s) => s.kind === 'line')));
            // 「○○を地図で見る」：画面に本物の地図があればその印を光らせ、無ければ小さな地図の窓
            const show = c.action ? SHOW_ON_MAP[c.action] : undefined;
            if (show) {
              if (options.onMap?.([show], next)) return;
              return showMiniMap(root, [show], next);
            }
            if (c.action && options.onAction) return options.onAction(c.action, next);
            next();
          };
          const replies = (c.reply ?? []).filter((l) => lineVisible(l, ctx, save));
          const reply = (k: number): void => (k >= replies.length ? after() : lineModal(root, save, replies[k] as EventLine, () => reply(k + 1), done, look));
          reply(0);
        }, look.picture);
    }
  };
  run(0);
}
