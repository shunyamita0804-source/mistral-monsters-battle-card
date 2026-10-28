import type { ScreenId } from '../../config/screens.ts';
import { battleScreen } from './battleScreen.ts';
import { cardListScreen, collectionScreen } from './collectionScreens.ts';
import { deckScreen } from './deckScreen.ts';
import { dungeonRunScreen } from './dungeonRunScreen.ts';
import { dungeonSelectScreen } from './dungeonSelectScreen.ts';
import { peopleBookScreen } from './peopleBookScreen.ts';
import { newGameScreen } from './newGameScreen.ts';
import { optionsScreen } from './optionsScreen.ts';
import { settingsScreen } from './settingsScreen.ts';
import { itemShopScreen } from './itemShopScreen.ts';
import { gachaScreen, shopMenuScreen } from './shopScreens.ts';
import { titleScreen } from './titleScreen.ts';
import { tournamentScreen } from './tournamentScreen.ts';
import { walkLabScreen } from './walkLabScreen.ts';
import { pukarimLabScreen } from './pukarimLabScreen.ts';
import type { ScreenDefinition } from './types.ts';
import { worldScreen } from './worldScreen.ts';

/**
 * 画面IDと画面定義の対応表。
 * ScreenId に画面を足すと、ここに登録しない限り型チェックでエラーになる。
 */
export const SCREENS: Readonly<Record<ScreenId, ScreenDefinition>> = {
  title: titleScreen,
  newGame: newGameScreen,
  world: worldScreen,
  deck: deckScreen,
  collection: collectionScreen,
  peopleBook: peopleBookScreen,
  shopMenu: shopMenuScreen,
  cardList: cardListScreen,
  gacha: gachaScreen,
  itemShop: itemShopScreen,
  dungeonSelect: dungeonSelectScreen,
  dungeonRun: dungeonRunScreen,
  tournament: tournamentScreen,
  battle: battleScreen,
  settings: settingsScreen,
  options: optionsScreen,
  walkLab: walkLabScreen,
  pukarimLab: pukarimLabScreen,
};
