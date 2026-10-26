import cardBackUrl from '@assets/images/ui/card_back.webp';
import { cardCatalog, getMonster, MONSTERS, skillsOf, SUPPORTS } from '../../data/cards.ts';
import { DECK_RULES } from '../../data/rules.ts';
import { describePlayCard, effectLabel, categoryLabel, skillCategory, type MonsterCard, type PlayCard } from '../../game/cards/cardTypes.ts';
import { cardDescription, cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { buildDeckFromCollection, countCards, countRoles, validateDeck, type Deck } from '../../game/deck/deck.ts';
import { confirmModal, messageModal, openModal } from '../components/modal.ts';
import { createMonsterCard } from '../components/monsterCard.ts';
import { createMonsterPortrait } from '../components/monsterPortrait.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { createPlayCard } from '../components/skillCard.ts';
import { button, h } from '../dom.ts';
import type { ScreenDefinition } from './types.ts';

/** 技カードの組「サポート」の印（モンスターIDと重ならない値） */
const SUPPORT_GROUP = '__support';

/** 画面の段：表（全体）→ モンスターを選ぶ／技カードを選ぶ */
type View = 'menu' | 'monsters' | 'skills';

/**
 * デッキ編集（家の机）。モンスター3体＋山札60枚（適合技とサポート。仮ルール：同じカード3枚まで）。
 * 2026-10-26 ユーザー指示「デッキ編成は PS版（モンスターファーム バトルカード）の動画のように」で3段にした：
 * - 表：デッキ全体と、モンスターごと・サポートの「攻撃・守り・計」の枚数。下に「モンスターを選ぶ・技カードを選ぶ・おまかせ・中止・終了」
 * - モンスターを選ぶ：3つの枠から入れかえる枠を選び、持っているモンスターの一覧から入れる（上に大きな絵）
 * - 技カードを選ぶ：モンスター（またはサポート）ごとの一覧に「使う・残り」の枚数。タップしたカードを上に大きく出す
 * 不正な構成は保存できない。所持枚数を超えては入れられない。デッキは1つだけ（複数のデッキは今回は作らない）
 */
export const deckScreen: ScreenDefinition = {
  id: 'deck',
  titleKey: 'deck.title',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen deck' });
    let draft: Deck = { monsters: [...store.save.deck.monsters], skills: [...store.save.deck.skills] };
    let dirty = false;
    let view: View = 'menu';
    /** 技カードを選ぶ：いま見ている組（モンスターID か SUPPORT_GROUP） */
    let group: string | null = null;
    /** 上に大きく出すカード（モンスター・技・サポート） */
    let focus: string | null = null;
    /** モンスターを選ぶ：入れかえる枠（0〜2） */
    let slot = 0;
    let listScroll = 0;

    const collection = (): Readonly<Record<string, number>> => store.save.collection;

    const setDraft = (next: Deck): void => {
      draft = next;
      dirty = true;
      render();
    };

    const go = (next: View): void => {
      view = next;
      listScroll = 0;
      render();
    };

    /** デッキからいなくなったモンスターの技を外す（外した枚数を知らせる） */
    const withMonsters = (monsters: readonly string[]): void => {
      const gone = [...new Set(draft.monsters)].filter((m) => !monsters.includes(m));
      const goneSkills = new Set(gone.flatMap((m) => skillsOf(m).map((s) => s.id)));
      const removed = draft.skills.filter((s) => goneSkills.has(s)).length;
      setDraft({ monsters, skills: draft.skills.filter((s) => !goneSkills.has(s)) });
      if (removed > 0) messageModal(element, t('deck.removedSkills', { name: gone.map((m) => cardName(getMonster(m))).join('・'), n: removed }));
    };

    /** 選んだ枠に入れる（空きの枠なら後ろに足す）。持っている数より多くは入れない */
    const putMonster = (id: string): void => {
      const next = [...draft.monsters];
      if (slot < next.length) next[slot] = id;
      else next.push(id);
      const used = next.filter((m) => m === id).length;
      if (used > (collection()[id] ?? 0) || (!DECK_RULES.allowDuplicateMonsters && used > 1)) {
        messageModal(element, t('deck.issue.notOwned', { name: cardName(getMonster(id)), owned: collection()[id] ?? 0, count: used }));
        return;
      }
      withMonsters(next);
    };

    const removeMonster = (): void => {
      if (slot >= draft.monsters.length) return;
      withMonsters(draft.monsters.filter((_, i) => i !== slot));
    };

    const changeSkill = (id: string, delta: 1 | -1): void => {
      focus = id;
      if (delta === 1) {
        setDraft({ ...draft, skills: [...draft.skills, id] });
      } else {
        const i = draft.skills.lastIndexOf(id);
        if (i < 0) return;
        const skills = [...draft.skills];
        skills.splice(i, 1);
        setDraft({ ...draft, skills });
      }
    };

    const auto = (): void => {
      if (draft.monsters.length !== DECK_RULES.monsterCount) {
        messageModal(element, t('deck.chooseMonstersFirst', { n: DECK_RULES.monsterCount }));
        return;
      }
      const built = buildDeckFromCollection(draft.monsters, collection());
      setDraft(built);
      if (built.skills.length < DECK_RULES.skillCount) {
        messageModal(element, t('deck.autoShort', { n: built.skills.length }));
      }
    };

    /** 終了：変えていれば保存して戻る（決まりに合わなければ問題を見せて残る） */
    const finish = (): void => {
      if (!dirty) {
        ctx.back('world');
        return;
      }
      if (validateDeck(draft, collection()).length > 0) {
        showIssues();
        return;
      }
      store.update((s) => ({ ...s, deck: draft }));
      dirty = false;
      messageModal(element, t('deck.saved'), () => ctx.back('world'));
    };

    const showIssues = (): void => {
      const issues = validateDeck(draft, collection());
      const handle = openModal(element, {
        title: t(issues.length === 0 ? 'deck.valid' : 'deck.problems'),
        body:
          issues.length === 0
            ? [h('p', { class: 'modal__text', text: t('deck.validText') })]
            : [h('ul', { class: 'rule-list' }, ...issues.slice(0, 12).map((i) => h('li', { text: i.message })))],
        actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
      });
    };

    /** 中止：変えていれば、捨ててよいか聞いてから戻る */
    const leave = (): void => {
      if (!dirty) {
        ctx.back('world');
        return;
      }
      confirmModal(element, t('deck.leaveConfirm'), [h('p', { class: 'modal__text', text: t('deck.leaveConfirmText') })], () => ctx.back('world'));
    };

    const groupsOf = (): string[] => [...new Set(draft.monsters), SUPPORT_GROUP];

    /** 組のカード（サポートは持っているか入っているものだけ） */
    const groupCards = (g: string): PlayCard[] => {
      if (g !== SUPPORT_GROUP) return skillsOf(g);
      const counts = countCards(draft.skills);
      return SUPPORTS.filter((c) => (collection()[c.id] ?? 0) > 0 || (counts[c.id] ?? 0) > 0);
    };

    const openSkills = (g: string): void => {
      group = g;
      focus = null;
      go('skills');
    };

    const statusBar = (): HTMLElement => {
      const issues = validateDeck(draft, collection());
      return h(
        'button',
        { class: `deck__status${issues.length === 0 ? ' is-ok' : ' is-ng'}`, attrs: { type: 'button' }, on: { click: showIssues } },
        h('span', { text: t('deck.statusMonsters', { n: draft.monsters.length, max: DECK_RULES.monsterCount }) }),
        h('span', { text: t('deck.statusDeck', { n: draft.skills.length, max: DECK_RULES.skillCount }) }),
        h('span', { class: 'deck__status-state', text: issues.length === 0 ? t('deck.statusOk') : t('deck.statusNg', { n: issues.length }) }),
      );
    };

    const hint = (text: string): HTMLElement => h('p', { class: 'deck__hint', text });

    /** サポートの組の印（モンスターの絵の代わりにカードの裏面） */
    const supportIcon = (size: number): HTMLElement => {
      const img = h('img', { class: 'deck__support-icon', attrs: { src: cardBackUrl, alt: '', draggable: 'false' } });
      img.style.width = `${size}px`;
      img.style.height = `${size}px`;
      return img;
    };

    // ===== 表（全体） =====
    const renderMenu = (): HTMLElement[] => {
      const num = (n: number | null): HTMLElement => h('span', { class: 'deck-table__num', text: n === null ? t('deck.table.none') : String(n) });
      const all = countRoles(draft.skills);
      const team = h(
        'div',
        { class: 'deck-table__row deck-table__row--team' },
        h('span', { class: 'deck-table__name', text: t('deck.table.team') }),
        num(all.atk),
        num(all.guard),
        h('span', { class: 'deck-table__num', text: `${all.total}/${DECK_RULES.skillCount}` }),
      );
      const rows = groupsOf().map((g) => {
        const cards = draft.skills.filter((id) => (g === SUPPORT_GROUP ? cardCatalog.get(id)?.kind === 'support' : skillsOf(g).some((s) => s.id === id)));
        const c = countRoles(cards);
        const copies = g === SUPPORT_GROUP ? 0 : draft.monsters.filter((m) => m === g).length;
        return h(
          'button',
          { class: 'deck-table__row', attrs: { type: 'button' }, dataset: { group: g }, on: { click: () => openSkills(g) } },
          h(
            'span',
            { class: 'deck-table__name' },
            g === SUPPORT_GROUP ? supportIcon(28) : createMonsterPortrait(getMonster(g), 28),
            h('span', { class: 'deck-table__label', text: g === SUPPORT_GROUP ? t('card.kind.support') : cardName(getMonster(g)) }),
            copies > 1 ? h('span', { class: 'deck-table__copies', text: `×${copies}` }) : null,
          ),
          num(g === SUPPORT_GROUP ? null : c.atk),
          num(g === SUPPORT_GROUP ? null : c.guard),
          num(c.total),
        );
      });
      const head = h(
        'div',
        { class: 'deck-table__head' },
        h('span', {}),
        h('span', { text: t('deck.table.atk') }),
        h('span', { text: t('deck.table.guard') }),
        h('span', { text: t('deck.table.total') }),
      );
      const firstGroup = groupsOf()[0] ?? SUPPORT_GROUP;
      return [
        statusBar(),
        h('div', { class: 'deck-table' }, head, team, ...rows),
        h(
          'div',
          { class: 'deck__menu' },
          button(t('deck.menu.monsters'), () => {
            slot = Math.min(draft.monsters.length, DECK_RULES.monsterCount - 1);
            focus = draft.monsters[slot] ?? null;
            go('monsters');
          }, 'btn'),
          button(t('deck.menu.skills'), () => openSkills(firstGroup), 'btn'),
          button(t('deck.auto'), auto, 'btn'),
          button(t('deck.menu.cancel'), leave, 'btn'),
          button(t('deck.menu.finish'), finish, 'btn btn--primary deck__menu-finish'),
        ),
        h('div', { class: 'deck__spacer' }),
        hint(t('deck.hint.menu')),
        h('p', { class: 'deck__note', text: t('deck.rulesNote') }),
      ];
    };

    // ===== モンスターを選ぶ =====
    const renderMonsters = (): HTMLElement[] => {
      const coll = collection();
      const owned = MONSTERS.filter((m) => (coll[m.id] ?? 0) > 0);
      const focused = focus ? cardCatalog.get(focus) : undefined;
      const monster = focused?.kind === 'monster' ? focused : undefined;
      const info = (m: MonsterCard): HTMLElement =>
        h(
          'div',
          { class: 'deck-preview__info' },
          h('p', { class: 'deck-preview__name', text: cardName(m) }),
          h('p', { class: 'deck-preview__meta', text: t('deck.monsterInfo', { life: m.life, n: skillsOf(m.id).length, owned: coll[m.id] ?? 0 }) }),
          h('p', { class: 'deck-preview__text', text: cardDescription(m) }),
        );
      const put = button(t('deck.put'), () => monster && putMonster(monster.id), 'btn btn--primary btn--small');
      put.disabled = !monster || draft.monsters[slot] === monster.id;
      const remove = button(t('deck.removeSlot'), removeMonster, 'btn btn--small');
      remove.disabled = slot >= draft.monsters.length;
      const preview = h(
        'div',
        { class: 'deck-preview' },
        monster ? createMonsterCard(monster, { width: 104 }) : h('img', { class: 'deck-preview__back', attrs: { src: cardBackUrl, alt: '', draggable: 'false' } }),
        monster ? info(monster) : h('div', { class: 'deck-preview__info' }, h('p', { class: 'deck-preview__text', text: t('deck.previewEmpty') })),
      );
      const slots = h(
        'div',
        { class: 'deck__slots' },
        ...Array.from({ length: DECK_RULES.monsterCount }, (_, i) => {
          const id = draft.monsters[i];
          // 空きの枠は、いま入っている数のすぐ後ろの1つだけ選べる（間を空けない）
          const selectable = i <= draft.monsters.length;
          const b = h(
            'button',
            {
              class: `deck__slot${i === slot ? ' is-selected' : ''}${id ? '' : ' is-empty'}`,
              attrs: { type: 'button', 'aria-pressed': String(i === slot) },
              on: {
                click: () => {
                  slot = i;
                  focus = id ?? focus;
                  render();
                },
              },
            },
            h('span', { class: 'deck__slot-no', text: t('deck.slot', { n: i + 1 }) }),
            id ? createMonsterPortrait(getMonster(id), 52) : h('span', { class: 'deck__slot-empty', text: t('deck.slotEmpty') }),
            h('span', { class: 'deck__slot-name', text: id ? cardName(getMonster(id)) : '' }),
          );
          (b as HTMLButtonElement).disabled = !selectable;
          return b;
        }),
      );
      const list = h(
        'div',
        { class: 'deck__list' },
        h('div', { class: 'deck__list-head' }, h('span', { text: t('deck.col.name') }), h('span', { text: t('deck.col.stock') })),
        ...owned.map((m) => {
          const left = (coll[m.id] ?? 0) - draft.monsters.filter((x) => x === m.id).length;
          return h(
            'button',
            {
              class: `deck__item${focus === m.id ? ' is-focused' : ''}`,
              attrs: { type: 'button' },
              dataset: { id: m.id },
              on: {
                click: () => {
                  focus = m.id;
                  render();
                },
              },
            },
            createMonsterPortrait(m, 32),
            h('span', { class: 'deck__item-name', text: cardName(m) }),
            h('span', { class: 'deck__item-num', text: String(left) }),
          );
        }),
      );
      return [preview, h('div', { class: 'deck__actions' }, put, remove), slots, list, hint(t('deck.hint.monsters'))];
    };

    // ===== 技カードを選ぶ =====
    const renderSkills = (): HTMLElement[] => {
      const coll = collection();
      const counts = countCards(draft.skills);
      const groups = groupsOf();
      if (!group || !groups.includes(group)) group = groups[0] ?? SUPPORT_GROUP;
      const g = group;
      const cards = groupCards(g);
      const focused = focus ? cardCatalog.get(focus) : undefined;
      const card = focused && focused.kind !== 'monster' ? focused : undefined;
      const known = card ? (coll[card.id] ?? 0) > 0 || (counts[card.id] ?? 0) > 0 : false;
      const meta = (c: PlayCard): string =>
        c.kind === 'skill'
          ? c.stat
            ? t('deck.metaSkill', { effect: effectLabel(c.effect.type), cost: c.cost, stat: categoryLabel(skillCategory(c)), v: c.stat.value })
            : t('deck.metaSkillNoValue', { category: categoryLabel(skillCategory(c)), cost: c.cost })
          : t('deck.metaSupport', { kind: t(c.duration === 'field' ? 'card.supportKind.field' : 'card.kind.support'), cost: c.cost });
      const preview = h(
        'div',
        { class: 'deck-preview' },
        card && known ? createPlayCard(card, { width: 104 }) : h('img', { class: 'deck-preview__back', attrs: { src: cardBackUrl, alt: '', draggable: 'false' } }),
        card && known
          ? h(
              'div',
              { class: 'deck-preview__info' },
              h('p', { class: 'deck-preview__name', text: cardName(card) }),
              h('p', { class: 'deck-preview__meta', text: meta(card) }),
              h('p', { class: 'deck-preview__text', text: describePlayCard(card) }),
            )
          : h('div', { class: 'deck-preview__info' }, h('p', { class: 'deck-preview__text', text: t(card ? 'deck.previewUnknown' : 'deck.previewEmpty') })),
      );
      const tabs = h(
        'div',
        { class: 'deck__tabs' },
        ...groups.map((id) =>
          button(id === SUPPORT_GROUP ? t('card.kind.support') : cardName(getMonster(id)), () => {
            group = id;
            focus = null;
            listScroll = 0;
            render();
          }, `deck__tab${g === id ? ' is-active' : ''}`),
        ),
      );
      const rows = cards.map((c) => {
        const owned = coll[c.id] ?? 0;
        const inDeck = counts[c.id] ?? 0;
        const plus = button('＋', () => changeSkill(c.id, 1), 'deck__step deck__step--plus');
        plus.disabled = inDeck >= owned || inDeck >= DECK_RULES.maxCopies || draft.skills.length >= DECK_RULES.skillCount;
        const minus = button('－', () => changeSkill(c.id, -1), 'deck__step deck__step--minus');
        minus.disabled = inDeck === 0;
        const unknown = owned === 0 && inDeck === 0;
        return h(
          'div',
          { class: `deck__item deck__item--card${focus === c.id ? ' is-focused' : ''}${unknown ? ' is-unowned' : ''}`, dataset: { id: c.id } },
          h(
            'button',
            {
              class: 'deck__item-name',
              attrs: { type: 'button', 'aria-label': t('deck.detail', { name: unknown ? t('deck.unknownCard') : cardName(c) }) },
              on: {
                click: () => {
                  focus = c.id;
                  render();
                },
              },
            },
            unknown ? t('deck.unknownCard') : cardName(c),
          ),
          minus,
          h('span', { class: 'deck__row-count', text: String(inDeck) }),
          plus,
          h('span', { class: 'deck__item-num', text: String(Math.max(0, owned - inDeck)) }),
        );
      });
      const inGroup = cards.reduce((n, c) => n + (counts[c.id] ?? 0), 0);
      return [
        preview,
        tabs,
        h(
          'div',
          { class: 'deck__list' },
          h(
            'div',
            { class: 'deck__list-head deck__list-head--card' },
            h('span', { text: t('deck.col.name') }),
            h('span', { text: t('deck.col.use') }),
            h('span', { text: t('deck.col.stock') }),
          ),
          ...(rows.length > 0 ? rows : [h('p', { class: 'deck__empty', text: t('deck.noSupports') })]),
        ),
        h('p', { class: 'deck__group-count', text: t('deck.groupCount', { n: inGroup, d: draft.skills.length, max: DECK_RULES.skillCount }) }),
        hint(t('deck.hint.skills', { n: DECK_RULES.maxCopies })),
      ];
    };

    const render = (): void => {
      listScroll = element.querySelector('.deck__list')?.scrollTop ?? listScroll;
      const title = view === 'monsters' ? t('deck.menu.monsters') : view === 'skills' ? t('deck.menu.skills') : t('deck.title');
      const back = view === 'menu' ? leave : () => go('menu');
      element.dataset.view = view;
      element.replaceChildren(
        createScreenHeader({ title, back: { label: t('common.back'), onTap: back } }),
        ...(view === 'monsters' ? renderMonsters() : view === 'skills' ? renderSkills() : renderMenu()),
      );
      const list = element.querySelector('.deck__list');
      if (list) list.scrollTop = listScroll;
    };

    render();
    return { element };
  },
};
