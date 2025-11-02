import {Controller} from './engine/controller.js';
import {GridOrigin} from './engine/gameArea.js';
import {Inspector} from './inspector.js';
import {Clock} from './clock.js';
import {NPC} from './npc.js';
import {Lunchbox, Microwave, Container, Usable} from './item.js';

export class Konstroller extends Controller {
  STORAGE_PREFIX = 'konssimulator_';
  static get VERSION() {
    return [0, 1];
  }

  constructor() {
    super(
      document.getElementById('gameboard'),
      /*updateInterval=*/ null,
      /*gridWidth=*/ 32,
      /*gridHeight=*/ 48,
      /*gridOrigin=*/ GridOrigin.LOWER_LEFT,
      /*fastForwardFactor=*/ 4
    );
    this.elements = {
      time: document.getElementById('time'),
      day: document.getElementById('day'),
      version: document.getElementById('version'),
      loadButton: document.getElementById('loadButton'),
      saveButton: document.getElementById('saveButton'),
      modal: document.getElementById('modal'),
      modalTitle: document.getElementById('modalTitle'),
      modalMessage: document.getElementById('modalMessage'),
      buttonTemplate: document.getElementById('buttonTemplate'),
    };
    this.setupElements();
    this.inspector = new Inspector();
  }

  setupElements() {
    this.elements.loadButton.addEventListener(
      'click',
      this.loadSave.bind(this)
    );
    this.elements.saveButton.addEventListener('click', this.save.bind(this));
    this.elements.version.innerText = this.constructor.VERSION.join('.');
  }

  onAssetsLoaded() {
    new Clock(this.elements.time);
    this.setMessage('> _');
    this.startDrawLoop();
    // TODO: Maybe remove (start paused)?
    this.onPlay();

    this.npc = new NPC(
      this.gameArea.gridWidth / 2,
      this.gameArea.gridHeight / 2
    );
    this.inspector.open(this.npc);
    this.testScript();
  }

  async testScript() {
    const microwave = Microwave.create(10, 30);
    const lunchbox = Lunchbox.create(20, 28);
    for (const thing of [this.npc, lunchbox, microwave]) {
      const button = document.createElement('button');
      button.innerText = thing.title ?? thing.constructor.name;
      button.onclick = () => this.inspector.open(thing);
      this.inspector.root.after(button);
    }

    await this.npc.walkTowards(lunchbox);
    this.npc.pickUp(lunchbox);
    await this.npc.walkTowards(microwave);
    microwave.getInterface(Container).emplace(lunchbox);
    await this.npc.setBusyFor(2, 'Värmer mat i mikro');
    this.npc.pickUp(lunchbox);
    await this.npc.walkTowardsCoordinates(
      this.gameArea.gridWidth / 2,
      this.gameArea.gridHeight / 2
    );

    const tryEatLunchbox = () => {
      if (lunchbox.id === null) {
        console.log('Ate lunch box');
        return;
      }
      lunchbox
        .getInterface(Usable)
        .use(this.npc)
        .then(() => {
          Clock.waitFor(2).then(tryEatLunchbox);
        });
    };
    tryEatLunchbox();
  }

  onAssetsLoadFailure(reason) {
    console.error(reason);

    let errorData;
    if (reason instanceof Response) {
      errorData = [
        `${reason.constructor.name}: ${reason.status} ${reason.statusText}`,
        reason.text(),
      ];
    } else if (reason instanceof Error) {
      errorData = [`${reason.name}: ${reason.message}`, JSON.stringify(reason)];
    } else if (reason !== undefined && reason !== null) {
      errorData = [`${reason.constructor.name}: ${JSON.stringify(reason)}`];
    } else {
      errorData = null;
    }
    const errorMessage = [
      'Spelet är trasigt :(',
      'Hör gärna av dig till utvecklarna eller Cyberföhs',
    ]
      .concat(
        errorData !== null
          ? [
              'Inkludera den här informationen:',
              ...errorData.map((line) => '  ' + line),
              'Tack!',
            ]
          : []
      )
      .join('\n');

    this.setMessage(errorMessage);
    alert(errorMessage);
    this.messageBox.classList.add('selectable');
  }

  loadSave() {
    alert('Load save');
  }

  save() {
    alert('Save');
  }
}
