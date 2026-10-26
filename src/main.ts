import './style.css';
import './ui/styles/components.css';
import './ui/styles/cards.css';
import './ui/styles/screens.css';
import './ui/styles/world.css';
import './ui/styles/dungeonRun.css';
import './ui/styles/battle.css';
import './ui/styles/dialogue.css';
import './ui/styles/uiFrames.css';
import './ui/styles/uiParts.css';
import './ui/styles/battleTable.css';
import './ui/styles/walkLab.css';
import './ui/styles/battlePs.css';
import './ui/styles/uiParts8.css';
import './ui/styles/uiParts9.css';
import './ui/styles/uiParts10.css';
import './ui/styles/uiParts11.css';
import { startApp } from './ui/app.ts';

const root = document.querySelector<HTMLElement>('#app');
if (root) {
  startApp(root);
}
