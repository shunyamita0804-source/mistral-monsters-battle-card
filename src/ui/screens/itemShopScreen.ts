import { ITEM_RULES, ITEMS, type ItemDefinition } from '../../data/items.ts';
import { buyableCount, isItemUnlocked, isNewItem, itemCount, markItemsSeen, purchaseItem } from '../../game/items/items.ts';
import { itemDescription, itemName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { coinIcon } from '../components/coinIcon.ts';
import { itemIcon } from '../components/itemIcon.ts';
import { confirmModal, messageModal, openModal } from '../components/modal.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { button, h } from '../dom.ts';
import { newId } from '../gameStore.ts';
import { sound } from '../sound.ts';
import type { ScreenDefinition } from './types.ts';

/**
 * カードショップの「道具を買う」（2026-10-27 ユーザー指示書「ダンジョンの道具とショップの『道具を買う』」）。
 * - 一覧：道具の絵・名前・値段・持っている数・短い説明。まだ並ばない道具は出さない（「？」も出さない）
 * - 新しく並んだ道具は、最初に見たときだけ「NEW」
 * - 買う：数を選ぶ（1〜所持の上限まで）→ 確認 → 購入。所持金が足りない・上限のときは買えない。1回の操作で1回だけ処理（購入 ID）
 * 道具のデータ・値段は src/data/items.ts（仮）。買う処理は src/game/items/items.ts
 */
export const itemShopScreen: ScreenDefinition = {
  id: 'itemShop',
  titleKey: 'items.title',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen item-shop' });
    // この画面を開いたときの NEW（見た印はすぐ付けるが、開いている間は印を出したままにする）
    const fresh = new Set(ITEMS.filter((i) => isNewItem(store.save, i.id)).map((i) => i.id));
    store.update(markItemsSeen);

    const chooseCount = (item: ItemDefinition): void => {
      const save = store.save;
      const max = buyableCount(save, item.id);
      if (max <= 0) {
        messageModal(element, t('items.atLimit', { max: ITEM_RULES.maxOwned }), undefined, undefined, undefined, 'ng');
        return;
      }
      if (save.coins < item.price) {
        messageModal(element, t('items.notEnough'), undefined, undefined, undefined, 'ng');
        return;
      }
      // 買える数：上限までのうち、所持金で足りる数まで
      const affordable = Math.min(max, Math.floor(save.coins / item.price));
      let n = 1;
      const countEl = h('span', { class: 'item-qty__count' });
      const totalEl = h('p', { class: 'modal__text item-qty__total' });
      const less = button('−', () => setCount(n - 1), 'btn item-qty__btn');
      const more = button('+', () => setCount(n + 1), 'btn item-qty__btn');
      less.setAttribute('aria-label', t('items.less'));
      more.setAttribute('aria-label', t('items.more'));
      const setCount = (v: number): void => {
        n = Math.max(1, Math.min(affordable, v));
        countEl.textContent = t('items.count', { n });
        totalEl.textContent = t('items.total', { price: item.price * n });
        less.disabled = n <= 1;
        more.disabled = n >= affordable;
      };
      setCount(1);
      const handle = openModal(element, {
        title: itemName(item),
        className: 'item-qty',
        body: [
          h('p', { class: 'modal__text', text: t('items.howMany') }),
          h('div', { class: 'item-qty__row' }, less, countEl, more),
          totalEl,
        ],
        actions: [
          { label: t('common.cancel'), onTap: () => handle.close() },
          {
            label: t('items.next'),
            primary: true,
            onTap: () => {
              handle.close();
              confirmBuy(item, n);
            },
          },
        ],
      });
    };

    const confirmBuy = (item: ItemDefinition, n: number): void => {
      const save = store.save;
      const price = item.price * n;
      // 確認を開いた時点で購入 ID を1つ作る。同じ ID の購入は1回しか処理されない（二重タップ防止）
      const tx = newId('item');
      confirmModal(
        element,
        t('gacha.confirmTitle'),
        [
          h('p', { class: 'modal__text', text: t('items.confirmText', { item: itemName(item), n, price }) }),
          h('p', { class: 'modal__text', text: t('gacha.confirmCoins', { before: save.coins, after: save.coins - price }) }),
          h('p', { class: 'modal__text modal__text--sub', text: t('gacha.confirmNote') }),
        ],
        () => {
          const r = purchaseItem(store.save, item.id, n, tx);
          if (r.status === 'ok') {
            store.update(() => r.save);
            sound.play('register');
            render();
            messageModal(element, t('items.bought', { item: itemName(item), n }), undefined, undefined, itemIcon(item), 'ok');
          } else if (r.status === 'error') {
            render();
            messageModal(element, r.reason === 'coins' ? t('items.notEnough') : t('items.atLimit', { max: ITEM_RULES.maxOwned }), undefined, undefined, undefined, 'ng');
          }
        },
      );
    };

    const render = (): void => {
      const save = store.save;
      const rows = ITEMS.filter((i) => isItemUnlocked(save, i.id)).map((item) => {
        const owned = itemCount(save, item.id);
        const full = buyableCount(save, item.id) <= 0;
        const buy = button(full ? t('items.full') : t('items.buy'), () => chooseCount(item), 'btn btn--primary btn--small item-shop__buy');
        buy.disabled = full || save.coins < item.price;
        return h(
          'div',
          { class: 'item-shop__row', dataset: { id: item.id } },
          // 道具の絵と、右下に持っている数の丸い札（デザイン33点の 15）
          h('span', { class: 'item-shop__art' }, itemIcon(item), owned > 0 ? h('span', { class: 'item-shop__owned-tag', text: String(owned) }) : null),
          h(
            'div',
            { class: 'item-shop__info' },
            h(
              'p',
              { class: 'item-shop__name' },
              itemName(item),
              fresh.has(item.id) ? h('span', { class: 'item-shop__new', text: t('items.new') }) : null,
            ),
            h('p', { class: 'item-shop__desc', text: itemDescription(item) }),
            h(
              'p',
              { class: 'item-shop__meta' },
              h('span', { class: 'item-shop__price', text: t('items.price', { price: item.price }) }),
              h('span', { class: 'item-shop__owned', text: t('items.owned', { n: owned, max: ITEM_RULES.maxOwned }) }),
            ),
          ),
          buy,
        );
      });
      element.replaceChildren(
        createScreenHeader({ title: t('items.title'), back: { label: t('common.back'), onTap: () => ctx.back('shopMenu') } }),
        h('p', { class: 'item-shop__coins' }, coinIcon(), t('shop.coins', { n: save.coins })),
        h('p', { class: 'notice', text: t('items.greeting') }),
        h('div', { class: 'item-shop__list' }, ...rows),
        h('p', { class: 'item-shop__note', text: t('items.note') }),
      );
    };

    render();
    return { element };
  },
};
