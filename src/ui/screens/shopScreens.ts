import { getMonster, HIDDEN_MONSTER_ID } from '../../data/cards.ts';
import { GACHA, GACHA_SERIES, type GachaSeries } from '../../data/economy.ts';
import { FRAGMENT_TOTAL } from '../../data/fragments.ts';
import { ITEMS } from '../../data/items.ts';
import { BOOSTER_SHOP_PRICE, BOOSTERS } from '../../data/introV2.ts';
import type { SaveData } from '../../game/save/saveData.ts';
import type { MessageKey } from '../../i18n/messages/index.ts';
import { boosterArtUrl } from '../components/boosterArt.ts';
import { isNewItem } from '../../game/items/items.ts';
import { purchaseSeriesPack, seriesOwned } from '../../game/economy/gachaSeries.ts';
import { canRestoreHidden, fragmentCount, restoreHidden } from '../../game/progress/fragments.ts';
import restoreSceneArt from '@assets/images/ui/restore/restore_scene.webp';
import restoreFxArt from '@assets/images/effects/fx_restore.webp';

import { randomSeed } from '../../game/rng.ts';
import { cardName } from '../../i18n/content.ts';
import { t } from '../../i18n/i18n.ts';
import { createCardView } from '../components/cardView.ts';
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

/** 特別復元の光を見せる時間 */
const RESTORE_FX_MS = 1600;

/** ショップの店員メニュー：カードを見る／売る（価格未確定のため無効）／ガチャ／道具を買う／特別復元（欠片を持っているときだけ） */
/**
 * 管理局で選ばなかったブースターパック2種（2026-10-27 ユーザー方針「少し高い値段でショップで買える」）。
 * 値段・中身が決まるまでは並べるだけ（買うボタンは押せない・コインは減らない）。管理局で受け取ったあとだけ出す
 */
function boosterShelf(save: SaveData): HTMLElement | null {
  const v = save.story.introV2;
  if (!v.boosterClaimed || !v.selectedBoosterKey) return null;
  const others = BOOSTERS.filter((b) => b.key !== v.selectedBoosterKey);
  return h(
    'section',
    { class: 'shop-boosters' },
    h('h2', { class: 'shop-boosters__title', text: t('introV2.shop.title') }),
    h('p', { class: 'shop-boosters__note', text: t('introV2.shop.note') }),
    h(
      'div',
      { class: 'shop-boosters__list' },
      ...others.map((b) => {
        // 値段が決まるまで押せない（購入・コインを減らす処理はまだ作らない）
        const buy = button(t('introV2.shop.buy'), () => undefined, 'btn btn--small');
        buy.disabled = BOOSTER_SHOP_PRICE === null;
        return h(
          'div',
          { class: 'shop-boosters__item', dataset: { pack: b.key } },
          h('img', { class: 'shop-boosters__art', attrs: { src: boosterArtUrl(b), alt: '', draggable: 'false' } }),
          h('span', { class: 'shop-boosters__name', text: t(`introV2.pack.name.${b.key.slice(-1)}` as MessageKey) }),
          buy,
        );
      }),
    ),
  );
}

export const shopMenuScreen: ScreenDefinition = {
  id: 'shopMenu',
  titleKey: 'shop.title',
  create(ctx) {
    const store = ctx.store;
    const element = h('main', { class: 'screen shop-menu' });
    const render = (): void => {
      const save = store.save;
      const fragments = fragmentCount(save);
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
          button(t('shop.gacha'), () => ctx.navigate('gacha'), 'shop-menu__item shop-menu__item--gacha'),
          // 4つ目の札「道具を買う」（2026-10-27。札の絵はデザイン33点の 15。新しく並んだ道具があれば NEW）
          h(
            'button',
            { class: 'shop-menu__item shop-menu__item--items', attrs: { type: 'button' }, on: { click: () => ctx.navigate('itemShop') } },
            t('items.shopButton'),
            ITEMS.some((i) => isNewItem(save, i.id)) ? h('span', { class: 'shop-menu__item-new', text: t('items.new') }) : null,
          ),
          fragments > 0 || save.hiddenRestored ? button(t('shop.restore', { n: fragments, total: FRAGMENT_TOTAL }), () => openRestore(), 'shop-menu__item shop-menu__item--special') : null,
        ),
        boosterShelf(save) ?? '',
      );
    };

    const openRestore = (): void => {
      const save = store.save;
      if (save.hiddenRestored) {
        messageModal(element, t('shop.restoreDone'));
        return;
      }
      if (!canRestoreHidden(save)) {
        messageModal(element, t('shop.restoreNotReady', { n: fragmentCount(save), total: FRAGMENT_TOTAL }), undefined, t('shop.restoreTitle'));
        return;
      }
      const tx = newId('restore');
      // 特別復元の場面（2026-10-26 デザイン第11弾）：欠片の祭壇の絵を確認の窓に、復元したら祭壇に光があふれてから結果を出す
      const scene = (): HTMLElement => h('img', { class: 'restore-scene', attrs: { src: restoreSceneArt, alt: '', draggable: 'false' } });
      confirmModal(element, t('shop.restoreTitle'), [scene(), h('p', { class: 'modal__text', text: t('shop.restoreConfirm') })], () => {
        const r = restoreHidden(store.save, tx);
        if (r.status !== 'ok') return;
        store.update(() => r.save);
        sound.play('reward');
        const fx = h('div', { class: 'restore-fx', attrs: { 'aria-hidden': 'true' } }, scene(), h('img', { class: 'restore-fx__light', attrs: { src: restoreFxArt, alt: '', draggable: 'false' } }));
        element.append(fx);
        setTimeout(() => {
          fx.remove();
          showResult();
        }, RESTORE_FX_MS);
      });
      const showResult = (): void => {
        const monster = getMonster(HIDDEN_MONSTER_ID);
        const handle = openModal(element, {
          title: t('shop.restoreSuccess'),
          body: [
            h('div', { class: 'card-detail__card' }, createCardView(monster, 150, true)),
            h('p', { class: 'modal__text', text: t('shop.restoreGot', { name: cardName(monster) }) }),
            h('p', { class: 'modal__text modal__text--sub', text: t('shop.restoreNote') }),
          ],
          actions: [{ label: t('common.close'), primary: true, onTap: () => handle.close() }],
          onClose: render,
        });
      };
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
      const tiles = GACHA_SERIES.map((series) => {
        const { owned, total } = seriesOwned(save, series);
        const on = picked === series.id;
        return h(
          'button',
          {
            class: `gacha-select__tile${on ? ' is-picked' : ''}`,
            attrs: { type: 'button', 'aria-pressed': on ? 'true' : 'false' },
            dataset: { series: series.id },
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
