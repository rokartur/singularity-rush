import { Game } from './game/Game.js';
import { MetaState } from './game/MetaState.js';
import { StationScreen } from './ui/StationScreen.js';
import sectorsData from './data/sectors.js';
import resourcesData from './data/resources.js';

const metaState = new MetaState();
const game = new Game(metaState);
const station = new StationScreen(game, metaState, sectorsData);

window.station = station;
window.gameUI = {
  startExpedition() {
    station.launch();
  },
  closeRunSummary() {
    station.returnToStation();
  },
  switchTab() {}
};

game.resourcesData = resourcesData;

function initStation() {
  station.init();
}

game._stationInit = initStation;
game._metaState = metaState;

game.init();
