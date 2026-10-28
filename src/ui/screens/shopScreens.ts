import { availableGachaSeries, GACHA, type GachaSeries } from '../../data/economy.ts';
import { ITEMS } from '../../data/items.ts';
import { BOOSTER_SHOP_PRICE, BOOSTERS, type BoosterKey } from '../../data/introV2.ts';
import { boosterShelf as boosterShelfOf, buyBooster } from '../../game/story/introV2.ts';
import type { SaveData } from '../../game/save/saveData.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { boosterArtUrl } from '../components/boosterArt.ts';
import { isNewItem } from '../../game/items/items.ts';
import { purchaseSeriesPack, seriesOwned } from '../../game/economy/gachaSeries.ts';

import { randomSeed } from '../../game/rng.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { seriesPackUrl } from '../components/gachaArt.ts';
import { showGachaMachine } from '../components/gachaMachine.ts';
import { showGachaOpen } from '../components/gachaOpen.ts';
import { confirmModal, messageModal, openModal } from '../components/modal.ts';
import { coinIcon } from '../components/coinIcon.ts';
import { createScreenHeader } from '../components/screenHeader.ts';
import { button, h } from '../dom.ts';
import { newId } from '../gameStore.ts';
import type { ScreenDefinition } from './types.ts';
import { sound } from '../sound.ts';
import faceClerk from '@assets/images/characters/face_clerk.webp';

/** シリーズの名前「○○のパック」 */
const seriesName = (series: GachaSeries): string => t('gacha.series.name', { monster: cardName(series.monsterId) });

/**
 * ブースターの箱の棚（2026-10-28 ユーザー決定）：管理局で選ばなかった箱を 1箱 1,500G で買える（各箱1回まで。買ったら「購入済み」）。
 * 中身はモンスター3体＋山札60枚（その箱の初期デッキ。src/game/story/introV2.ts の boosterDeck）
 */
function boosterShelf(save: SaveData, onBuy: (key: BoosterKey) => void): HTMLElement | null {
  const shelf = boosterShelfOf(save);
  if (shelf.length === 0) return null;
  return h(
    'section',
    { class: 'shop-boosters' },
    h('h2', { class: 'shop-boosters__title', text: t('introV2.shop.title') }),
    h('p', { class: 'shop-boosters__note', text: t('introV2.shop.note') }),
    h(
      'div',
      { class: 'shop-boosters__list' },
      ...shelf.map(({ key, bought }) => {
        const b = BOOSTERS.find((x) => x.key === key) as (typeof BOOSTERS)[number];
        const buy = button(bought ? t('introV2.shop.owned') : t('introV2.shop.buy', { price: BOOSTER_SHOP_PRICE }), () => onBuy(key), 'btn btn--small');
        buy.dataset.se = 'decide';
        buy.disabled = bought;
        return h(
          'div',
          { class: `shop-boosters__item${bought ? ' is-bought' : ''}`, dataset: { pack: key } },
          h('img', { class: 'shop-boosters__art', attrs: { src: boosterArtUrl(b), alt: '', draggable: 'false' } }),
          h('span', { class: 'shop-boosters__name', text: t(`introV2.pack.name.${key.slice(-1)}` as MessageKey) }),
          buy,
        );
      }),
    ),
  );
}

/**
 * ショップの店員（カウンター）：カードを見る／売る（価格未確定のため無効）／道具を買う／ブースターの箱。
 * 2026-10-28 ユーザー決定：カウンターで買えるのはブースターの箱と道具だけ（カードはふだんは販売機のガチャで）。
 * ガチャの札と欠片の特別復元（研究所へ移した）はここから外した
 */
export const shopMenuScreen: ScreenDefinition = {
  id: 'shopMenu',
  titleKey: 'shop.title',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen shop-menu' });
    const render = (): void => {
      const save = store.save;
      const sell = button(t('shop.sell'), () => undefined, 'shop-menu__item shop-menu__item--sell');
      sell.disabled = true;
      element.replaceChildren(
        createScreenHeader({ title: t('shop.title'), back: { label: t('common.back'), onTap: () => ctx.back('world') } }),
        h(
          'div',
          { class: 'shop-menu__clerk' },
          h('img', { class: 'shop-menu__clerk-figure shop-menu__face', attrs: { src: faceClerk, alt: t('shop.clerk'), draggable: 'false' } }),
          h('p', { class: 'shop-menu__bubble', text: t('shop.greeting') }),
        ),
        h('p', { class: 'shop-menu__coins' }, coinIcon(), t('shop.coins', { n: save.coins })),
        h(
          'nav',
          { class: 'shop-menu__items' },
          button(t('shop.viewCards'), () => ctx.navigate('cardList'), 'shop-menu__item shop-menu__item--browse'),
          h('div', { class: 'shop-menu__disabled' }, sell, h('span', { class: 'shop-menu__note', text: t('shop.sellNote') })),
          // 4つ目の札「道具を買う」（2026-10-27。札の絵はデザイン33点の 15。新しく並んだ道具があれば NEW）
          h(
            'button',
            { class: 'shop-menu__item shop-menu__item--items', attrs: { type: 'button' }, on: { click: () => ctx.navigate('itemShop') } },
            t('items.shopButton'),
            ITEMS.some((i) => isNewItem(save, i.id)) ? h('span', { class: 'shop-menu__item-new', text: t('items.new') }) : null,
          ),
        ),
        boosterShelf(save, buyBox) ?? '',
      );
    };

    /** 箱を買う（値段の確認を開いたときに購入 ID を1つ作る。連打で二重に払わない） */
    const buyBox = (key: BoosterKey): void => {
      const save = store.save;
      const name = t(`introV2.pack.name.${key.slice(-1)}` as MessageKey);
      if (save.coins < BOOSTER_SHOP_PRICE) {
        messageModal(element, t('gacha.notEnough', { price: BOOSTER_SHOP_PRICE }));
        return;
      }
      const tx = newId('booster-buy');
      const b = BOOSTERS.find((x) => x.key === key) as (typeof BOOSTERS)[number];
      confirmModal(
        element,
        t('gacha.confirmTitle'),
        [
          h('img', { class: 'shop-boosters__confirm-art', attrs: { src: boosterArtUrl(b), alt: '', draggable: 'false' } }),
          h('p', { class: 'modal__text', text: t('introV2.shop.confirm', { name, price: BOOSTER_SHOP_PRICE }) }),
          h('p', { class: 'modal__text', text: t('gacha.confirmCoins', { before: save.coins, after: save.coins - BOOSTER_SHOP_PRICE }) }),
        ],
        () => {
          const r = buyBooster(store.save, key, tx);
          if (r.status === 'ok') {
            store.update(() => r.save);
            sound.play('register');
            render();
            messageModal(element, t('introV2.shop.bought', { name }), undefined, undefined, undefined, 'ok');
          } else if (r.status === 'error') {
            messageModal(element, r.message);
          }
        },
      );
    };

    render();
    return { element };
  },
};

/**
 * カードショップのガチャ（2026-10-28 作り直し。指示書 design-parts/gacha-20261028/00_instructions_for_claude_code.txt。記録 docs/gacha-20261028.md）。
 * 販売機を調べる → シリーズを選ぶ（1回タップで光って少し浮く、同じパックをもう1回で決定）→ 値段の確認 → 払って機械の画面（gachaMachine.ts）
 * → つまみを1周 → 取り出し口からパックを取り出す → 開けてめくる（gachaOpen.ts）→「もう1回」（同じシリーズ。値段の確認あり）か「もどる」
 * 中身・確率・値段は data/economy.ts の GACHA・GACHA_SERIES（すべて仮）
 */
export const gachaScreen: ScreenDefinition = {
  id: 'gacha',
  titleKey: 'shop.gacha',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen gacha-select' });
    // 選ぶ画面の中身（描き直すのはここだけ。機械・開ける画面は element に重ねるので、描き直しで消えない）
    const body = h('div', { class: 'gacha-select__body' });
    element.append(body);
    let picked: string | null = null;

    // 提供割合（レアの文字・技ごとの％は出さない）
    const showRates = (): void => {
      const handle = openModal(element, {
        title: t('gacha.ratesTitle'),
        className: 'gacha-rates',
        body: [
          h('p', { class: 'modal__text', text: t('gacha.ratesMonster', { rate: Math.round(GACHA.monsterRate * 1000) / 10 }) }),
          h('p', { class: 'modal__text', text: t('gacha.ratesSkills') }),
        ],
        actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
      });
    };

    /**
     * 値段の確認 → 払う。確認を開いた時点で購入 ID を1つ作る（同じ ID の購入は1回しか処理されない＝連打で二重に払わない）。
     * 払えたら onPaid（中身と、払う前に持っていたカード）
     */
    const askPay = (series: GachaSeries, onPaid: (cards: readonly string[], before: Readonly<Record<string, number>>) => void): void => {
      const save = store.save;
      if (save.coins < GACHA.price) {
        messageModal(element, t('gacha.notEnough', { price: GACHA.price }));
        return;
      }
      const tx = newId('purchase');
      confirmModal(
        element,
        t('gacha.confirmTitle'),
        [
          h('img', { class: 'gacha-select__confirm-pack', attrs: { src: seriesPackUrl(series), alt: '', draggable: 'false' } }),
          h('p', { class: 'modal__text', text: t('gacha.confirmText', { pack: seriesName(series), price: GACHA.price }) }),
          h('p', { class: 'modal__text', text: t('gacha.confirmCoins', { before: save.coins, after: save.coins - GACHA.price }) }),
          h('p', { class: 'modal__text modal__text--sub', text: t('gacha.confirmNote') }),
        ],
        () => {
          const before = store.save.collection;
          const r = purchaseSeriesPack(store.save, series.id, tx, randomSeed());
          if (r.status === 'ok') {
            sound.play('register');
            store.update(() => r.save);
            render();
            onPaid(r.cards, before);
          } else if (r.status === 'error') {
            messageModal(element, r.message);
          }
        },
      );
    };

    /** 機械の画面（paid＝払ってある。払う前は「パックを選び直す」が出て、つまみをさわると値段の確認） */
    const openMachine = (series: GachaSeries, paid: { cards: readonly string[]; before: Readonly<Record<string, number>> } | null): (() => void) => {
      let result = paid;
      const requestPay = (): void =>
        askPay(series, (cards, before) => {
          result = { cards, before };
          machine.markPaid();
        });
      const machine = showGachaMachine(element, {
        series,
        paid: !!paid,
        collection: paid ? paid.before : store.save.collection,
        onReselect: () => {
          machine.close();
          render();
        },
        onRequestPay: requestPay,
        onRates: showRates,
        onTake: () => {
          if (!result) return;
          showGachaOpen(element, {
            series,
            cards: result.cards,
            before: result.before,
            owned: (id) => store.save.collection[id] ?? 0,
            // 同じシリーズをもう1回：機械の画面（払う前）に戻して、値段の確認を出す
            onAgain: () => openMachine(series, null)(),
            onBack: render,
          });
        },
      });
      return requestPay;
    };

    const decide = (series: GachaSeries): void => {
      askPay(series, (cards, before) => {
        picked = null;
        render();
        openMachine(series, { cards, before });
      });
    };

    const render = (): void => {
      const save = store.save;
      // 並ぶシリーズ：プカリムはピートに勝ったあと（2026-10-29）
      const tiles = availableGachaSeries(save.storyFlags).map((series) => {
        const { owned, total } = seriesOwned(save, series);
        const on = picked === series.id;
        return h(
          'button',
          {
            class: `gacha-select__tile${on ? ' is-picked' : ''}`,
            attrs: { type: 'button', 'aria-pressed': on ? 'true' : 'false' },
            // 選んだパックをもう1回押す＝決める（ボタンの音 ui_decide。src/ui/buttonSound.ts）
            dataset: { series: series.id, ...(on ? { se: 'decide' } : {}) },
            on: {
              click: () => {
                // 1回目で光って少し浮く、同じパックをもう1回で決定（別のパックを押すと選び直し）
                if (picked === series.id) {
                  decide(series);
                  return;
                }
                picked = series.id;
                sound.tap();
                render();
              },
            },
          },
          h('img', { class: 'gacha-select__pack', attrs: { src: seriesPackUrl(series), alt: '', draggable: 'false' } }),
          h('b', { class: 'gacha-select__name', text: seriesName(series) }),
          h('small', { class: 'gacha-select__owned', text: t('gacha.series.owned', { n: owned, total }) }),
        );
      });
      body.replaceChildren(
        createScreenHeader({ title: t('shop.gacha'), back: { label: t('common.back'), onTap: () => ctx.back('shopMenu') } }),
        h('h1', { class: 'gacha-select__title', text: t('gacha.select.title') }),
        h('p', { class: 'gacha-select__lead', text: t('gacha.select.lead', { price: GACHA.price }) }),
        h('p', { class: 'gacha-select__coins' }, coinIcon(), t('shop.coins', { n: save.coins })),
        h('div', { class: 'gacha-select__grid' }, ...tiles),
        button(t('gacha.rates'), showRates, 'gacha-select__rates'),
      );
    };

    render();
    return { element };
  },
};
