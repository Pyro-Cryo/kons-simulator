'use strict';

class Item extends GameObject {
  /** @returns {string | null} */
  static get title() {
    return null;
  }
  /** @returns {string | null} */
  static get description() {
    return null;
  }

  /**
   * Sent after all interfaces have been added to an item.
   * Can be used to set up dependencies on other interfaces.
   */
  static FINALIZE = 'Item:FINALIZE';
  /** Sent each update with the delta, measured in game minutes. */
  static UPDATE = 'Item:UPDATE';

  constructor(x = 0, y = 0) {
    super(x, y);
    this.title = this.constructor.title;
    this.description = this.constructor.description;
    /** @type {Map<typeof Interface, Interface>} */
    this._interfaces = new Map();
    this._observer = new SignalObserver();
    this._finalized = false;
    this.on(Item.FINALIZE, this.onFinalize.bind(this).bind(this));

    this.hidden = this.constructor.image === null;
    /** @type {NPC|null} */
    this.carriedBy = null;
  }

  /**
   * Registers a callback to be invoked when `signalName` is sent.
   * @param {string} signalName
   * @param {function(any):any} callback
   */
  on(signalName, callback) {
    this._observer.register(signalName, callback);
  }

  /**
   * Sends the given signal with the provided data.
   * @param {string} name
   * @param {any} data
   */
  send(name, data = null) {
    this._observer.send(name, data);
  }

  /**
   * Adds an interface to the item. Only supported before finalization.
   * @param {Interface} interface_
   * @returns {this}
   */
  addInterface(interface_) {
    if (this._finalized) {
      throw new Error(
        `Trying to add interface ${interface_} to finalized item ${this}`
      );
    }
    if (this._interfaces.has(interface_.constructor)) {
      throw new Error(
        `Interface ${interface_} already present on item ${this}`
      );
    }
    this._interfaces.set(interface_.constructor, interface_);
    interface_.item = this;
    this.on(Item.FINALIZE, interface_.onFinalize.bind(interface_));
    return this;
  }

  /**
   * Finalizes the interfaces added to the item. After this, no more interfaces may be added.
   * @returns {this}
   */
  finalize() {
    if (this._finalized) {
      throw new Error(`Item already finalized: ${this}`);
    }
    this.send(Item.FINALIZE);
    this._finalized = true;
    return this;
  }

  onFinalize() {}

  /**
   * @param {typeof Interface} type
   * @returns {Interface}
   */
  getInterface(type) {
    if (!this._interfaces.has(type)) {
      throw new Error(`Item ${this} has no ${type.name}`);
    }
    return this._interfaces.get(type);
  }

  /**
   * @param {typeof Interface} type
   * @returns {Interface|null}
   */
  maybeGetInterface(type) {
    return this._interfaces.get(type) ?? null;
  }

  update(delta) {
    super.update(delta);
    if (this.carriedBy !== null) {
      const xOffset =
        0.5 *
        ((this.carriedBy.heldInRightHand === this) -
          (this.carriedBy.heldInLeftHand === this));
      this.x = this.carriedBy.x + xOffset;
      this.y = this.carriedBy.y - 0.5;
    }
    this.send(Item.UPDATE, delta / Clock.realMillisecondsPerGameMinute);
  }

  draw(gameArea) {
    if (!this.hidden) {
      super.draw(gameArea);
    }
  }

  toString() {
    return `${this.constructor.name} (${this.title})`;
  }
}

/**
 * An aspect of an item. Interfaces should not inherit from one another as
 * this messes with the signaling.
 */
class Interface {
  /**
   * The item to which this interface belongs.
   * Populated when the interface is added to an item.
   *  @type {Item} */
  item;

  /** Creates a new signal name prefixed with the class name. */
  static signal(name) {
    return `${this.name}:${name}`;
  }

  /**
   * Called after all interfaces have been added to an item.
   * Can be used to set up dependencies on other interfaces.
   */
  onFinalize() {}
}

/**
 * Interface for NPCs using an object.
 */
class Usable extends Interface {
  // Number of times the item can be used before it is deleted.
  static get numUses() {
    return 1;
  }
  // The time it takes to use the item, in game minutes.
  static get minutesPerUse() {
    return 1;
  }
  // A description displayed on the NPC when the item is in use.
  // Should be on the form "Eating lunchbox" or "Washing dishes".
  static get actionDescription() {
    return null;
  }

  /** Sent when the item is used, with the npc that used it. */
  static USED = this.signal('USED');
  /** Sent when the item has no more uses, with the npc that used it last. */
  static USED_UP = this.signal('USED_UP');

  /**
   * @typedef {{numUses?: number,minutesPerUse?: number, actionDescription?: string}} UsableConfig
   * */
  /** 
   * @param {UsableConfig} config
   * */
  constructor(config) {
    super();
    this.remainingUses = config.numUses ?? this.constructor.numUses;
    this.minutesPerUse = config.minutesPerUse ?? this.constructor.minutesPerUse;
    this.actionDescription =
      config.actionDescription ?? this.constructor.actionDescription;
    this.isInUse = false;

    if (this.remainingUses <= 0) {
      throw new Error(
        `Number of uses must be positive, got: ${this.remainingUses}`
      );
    }
    if (this.minutesPerUse < 0) {
      throw new Error(
        `Minutes per use must be non-negative, got: ${this.minutesPerUse}`
      );
    }
  }

  onFinalize() {
    this.item.on(Usable.USED, this.onUsed.bind(this));
    this.item.on(Usable.USED_UP, this.onUsedUp.bind(this));
  }

  /**
   * Whether or not the given NPC can use the item right now.
   * @param {NPC} npc
   * @returns {boolean}
   */
  canUse(npc) {
    return (
      !this.isInUse &&
      !npc.isBusy() &&
      this.item.id !== null &&
      this.remainingUses > 0
    );
  }

  /**
   * How long it would take the NPC to use the item.
   * @param {NPC} npc
   * @returns {number}
   */
  gameMinutesToUse(npc) {
    return this.minutesPerUse;
  }

  /**
   * Decrements the remaining uses and calls the onUsed and onUsedUp methods as
   * necessary.
   * @param {NPC} npc
   */
  use(npc) {
    if (!this.canUse(npc)) {
      throw new Error(`Item ${this.item} cannot be used by ${npc}`);
    }
    const gameMinutesToUse = this.gameMinutesToUse(npc);
    const callback = () => {
      this.remainingUses--;
      this.isInUse = false;
      this.item.send(Usable.USED, npc);

      if (this.remainingUses <= 0) {
        this.item.send(Usable.USED_UP, npc);
      }
    };
    if (gameMinutesToUse <= 0) {
      callback();
      return Promise.resolve();
    }
    this.isInUse = true;
    return npc
      .setBusyFor(gameMinutesToUse, this.actionDescription)
      .then(callback);
  }

  /**
   * Called when the item is used.
   * @param {NPC} npc
   */
  onUsed(npc) {}

  /**
   * Called when there are no more remaining uses. By default, deletes the item.
   * @param {NPC} npc
   */
  onUsedUp(npc) {
    this.item.despawn();
  }
}

class Edible extends Interface {
  // Hunger% som försvinner per minut för vanlig mat.
  static get BURN_RATE_STANDARD() {
    return 1 / 3;
  }
  // Hunger% som försvinner per minut för snacks och liknande.
  static get BURN_RATE_FAST() {
    return 1;
  }

  static get actionDescription() {
    return 'Äter';
  }
  static get hungerPointsPerUse() {
    return null;
  }
  static get hungerPointBurnRate() {
    return Edible.BURN_RATE_STANDARD;
  }

  /** @typedef {{hungerPointsPerUse?: number, hungerPointBurnRate?: number}} EdibleConfig */
  /** @param {EdibleConfig} config */
  constructor(config) {
    super();
    this.hungerPointsPerUse =
      config.hungerPointsPerUse ?? this.constructor.hungerPointsPerUse;
    this.hungerPointBurnRate =
      config.hungerPointBurnRate ?? this.constructor.hungerPointBurnRate;
    if (this.hungerPointsPerUse === null) {
      throw new Error(`Hunger points per use must be specified: ${this}`);
    }
  }

  onFinalize() {
    this.item.on(Usable.USED, this.onUsed.bind(this));
  }

  /**
   * @param {NPC} npc
   */
  onUsed(npc) {
    const duration = this.hungerPointsPerUse / this.hungerPointBurnRate;
    npc.hunger.addFuel(-this.hungerPointsPerUse, duration, 'Åt mat');
  }
}

/**
 * NPCs can place items in or remove them from this item.
 */
class Container extends Interface {
  /**
   * Sent when an item was added, with data =
   *    {container: Container, containable: Containable, npc: NPC|null}.
   */
  static ITEM_ADDED = this.signal('ITEM_ADDED');
  /**
   * Sent when an item was removed, with data =
   *    {container: Container, containable: Containable, npc: NPC|null}.
   */
  static ITEM_REMOVED = this.signal('ITEM_REMOVED');

  /**
   * @param {number} capacity
   * @param {function(Container,Item):boolean} emplacementFilter
   */
  constructor(capacity = Infinity, emplacementFilter = () => true) {
    super();
    this.capacity = capacity;
    this.load = 0;
    this.emplacementFilter = emplacementFilter;
    /** @type {Containable[]} */
    this._containables = [];
  }

  /** @param {Item} item */
  contains(item) {
    return item.maybeGetInterface(Containable)?.containedBy ?? null === this;
  }

  /** @param {Item} item */
  canEmplace(item) {
    const containable = item.maybeGetInterface(Containable);
    return (
      containable !== null &&
      this.load + containable.size <= this.capacity &&
      containable.containedBy === null &&
      this.emplacementFilter(this, item)
    );
  }

  /**
   * @param {Item} item
   * @param {NPC|null} npc
   * */
  emplace(item, npc = null) {
    if (!this.canEmplace(item)) {
      throw new Error(`Cannot place item ${item} in container ${this}`);
    }
    if (item.carriedBy !== null) {
      item.carriedBy.putDown(item);
    }
    const containable = item.getInterface(Containable);
    this.load += containable.size;
    containable.containedBy = this;
    this._containables.push(containable);

    const data = {container: this, containable: containable, npc: npc};
    this.item.send(Container.ITEM_ADDED, data);
    containable.item.send(Containable.INSERTED, data);
  }

  /**
   * @param {Item} item
   * @param {NPC|null} npc
   * */
  remove(item, npc = null) {
    const containable = item.getInterface(Containable);
    const index = this._containables.findIndex((c) => c === containable);
    if (index === -1) {
      throw new Error(`Item ${item} is not in container ${this}`);
    }
    this.load -= containable.size;
    containable.containedBy = null;
    this._containables.splice(index, 1);

    const data = {container: this, containable: containable, npc: npc};
    this.item.send(Container.ITEM_REMOVED, data);
    containable.item.send(Containable.OUTSERTED, data);
  }

  getItems() {
    return this._containables.map((c) => c.item);
  }

  isEmpty() {
    return !this._containables.length;
  }
}

class Containable extends Interface {
  // A small item fits in a pocket.
  static get SIZE_SMALL() {
    return 1;
  }
  // A medium item can be carried in one hand.
  static get SIZE_MEDIUM() {
    return 5;
  }
  // A large item can be carried with two hands.
  static get SIZE_LARGE() {
    return 25;
  }

  /**
   * Sent when this item was added to a container, with data =
   *    {container: Container, containable: Containable, npc: NPC|null}.
   */
  static INSERTED = this.signal('INSERTED');
  /**
   * Sent when this item was removed from a container, with data =
   *    {container: Container, containable: Containable, npc: NPC|null}.
   */
  static OUTSERTED = this.signal('OUTSERTED');

  /**
   * @param {number} size
   * @param {Container|null} containedBy
   */
  constructor(size = Containable.POCKET_SIZE, containedBy = null) {
    super();
    this.size = size;
    if (this.size <= 0) {
      throw new Error(`Size must be positive, got: ${this.size}`);
    }
    /**
     * This is set iff this can be found in containedBy._containables.
     * @type {Container|null}
     */
    this._containedBy = containedBy;
  }

  set containedBy(value) {
    this._containedBy = value;
    this.item.hidden = this._containedBy !== null;
  }

  get containedBy() {
    return this._containedBy;
  }
}

// TODO: Ska man bara förenkla allt detta till att vara en skala
// [Iskallt, Kyligt, Svalt, Ljummet (default), Varmt, Hett, Skållhett, Brinner]
// och låta en mikro ticka saker åt höger en gång / minut och en frys åt
// vänster?
class Heatable extends Interface {
  // Finns fler på https://www.engineeringtoolbox.com/specific-heat-capacity-d_391.html
  // och https://en.wikipedia.org/wiki/Table_of_specific_heat_capacities.
  // Material.
  static get SPECIFIC_HEAT_WATER() {
    return 4184;
  }
  static get SPECIFIC_HEAT_IRON() {
    return 449;
  }
  static get SPECIFIC_HEAT_WOOD() {
    return 1700;
  }
  static get SPECIFIC_HEAT_AIR() {
    return 1000;
  }
  // Ätbart.
  static get SPECIFIC_HEAT_ETHANOL() {
    return 2440;
  }
  static get SPECIFIC_HEAT_MEAT() {
    return 3500;
  }
  static get SPECIFIC_HEAT_POTATOES() {
    return 3430;
  }
  static get SPECIFIC_HEAT_COOKING_OIL() {
    return 1790;
  }
  static get SPECIFIC_HEAT_FAT() {
    return 900;
  }
  static get SPECIFIC_HEAT_SALT() {
    return 880;
  }

  /**
   * @param {number} heatCapacity The energy in joules required to heat the
   *    object one degree. Defaults to that of 1 kg of water.
   * @param {number|null} halfLife Game minutes until the temperature difference
   *    between the item and the environment is halved. Defaults to the heat
   *    capacity / 200.
   */
  constructor(heatCapacity = Heatable.SPECIFIC_HEAT_WATER, halfLife = null) {
    super();
    this.heatCapacity = heatCapacity;
    this.temperature = new Temperature(halfLife ?? heatCapacity / 200);
    /** @type {Temperature|null} */
    this._environment = null;
  }

  onFinalize() {
    this.item.on(Containable.INSERTED, this.onInserted.bind(this));
    this.item.on(Containable.OUTSERTED, this.onOutserted.bind(this));
    this.item.on(Item.UPDATE, this.onUpdate.bind(this));
  }

  /**
   * @param {{container: Container, containable: Containable, npc: NPC|null}} data
   */
  onInserted(data) {
    this._environment =
      data.container.item.maybeGetInterface(Heatable)?.temperature ?? null;
  }

  onOutserted() {
    this._environment = null;
    this.temperature.setEnvironment(Temperature.baseValue);
  }

  onUpdate() {
    if (this._environment !== null) {
      // TODO: Not necessary to do every frame.
      this.temperature.setEnvironment(this._environment.getValue());
    }
  }

  addEnergy(joules) {
    if (joules === 0) return;
    this.temperature.adjustCurrent(joules / this.heatCapacity);
  }
}

const lunchboxImg = Resource.addAsset('img/matlada.png');
class Lunchbox extends Item {
  static get image() {
    return Resource.getAsset(lunchboxImg);
  }
  static get scale() {
    return 0.2;
  }
  static get title() {
    return 'Matlåda';
  }
  static get description() {
    return 'En portion mat';
  }

  static create(x, y) {
    return new Lunchbox(x, y)
      .addInterface(
        new Usable({
          numUses: 5,
          minutesPerUse: 3,
          actionDescription: 'Äter matlåda',
        })
      )
      .addInterface(
        new Edible({
          hungerPointsPerUse: 20,
        })
      )
      .addInterface(new Containable(/*size=*/ Containable.SIZE_MEDIUM))
      .addInterface(new Heatable(Heatable.SPECIFIC_HEAT_WATER * 0.4))
      .finalize();
  }

  onFinalize() {
    /** @type {Heatable} */
    this.heatable = this.getInterface(Heatable);
    this.on(Usable.USED, this.onUsed.bind(this));
  }

  /** @param {NPC} npc */
  onUsed(npc) {
    const temperature = this.heatable.temperature.getValue();
    npc.mood.addModifier(new FixedModifier(2, /*duration=*/ 60, 'Åt god mat'));
    if (temperature < 40) {
      npc.mood.addModifier(
        new FixedModifier(-3, /*duration=*/ 60, 'Åt kall mat')
      );
    }
  }
}

const microwaveImg = Resource.addAsset('img/mikro.png');
class Microwave extends Item {
  static get image() {
    return Resource.getAsset(microwaveImg);
  }
  static get scale() {
    return 0.2;
  }
  static get title() {
    return 'Mikrovågsugn';
  }
  static get description() {
    return 'Värmer mat';
  }

  constructor(x = 0, y = 0, wattage = 1000) {
    super(x, y);
    this.wattage = wattage;
  }

  static create(x, y) {
    return new Microwave(x, y)
      .addInterface(new Container(/*capacity=*/ Containable.SIZE_MEDIUM))
      .addInterface(new Containable(/*size=*/ Containable.SIZE_LARGE))
      .finalize();
  }

  onFinalize() {
    /** @type {Container} */
    this.container = this.getInterface(Container);
  }

  update(delta) {
    super.update(delta);
    // TODO: Fixa nån slags signalering mellan interfaces.
    if (!this.container.isEmpty()) {
      const energy =
        (this.wattage * delta * 60) / Clock.realMillisecondsPerGameMinute;
      for (const item of this.container.getItems()) {
        item.maybeGetInterface(Heatable)?.addEnergy(energy);
      }
    }
  }
}
