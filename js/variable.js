import {Minheap, LinkedList} from './engine/containers.js';
import {Clock} from './clock.js';

/**
 * Something that affects a variable's value. If a description is set, the
 * modifier is user-facing.
 */
export class Modifier {
  /** @param {string|null} description */
  constructor(description = null) {
    this._description = description;
  }

  get description() {
    return this._description;
  }

  /** @returns {number} */
  value() {
    throw new Error('Not implemented');
  }

  /**
   * Whether the modifier no longer affects the variable, that is,
   * value() will always return 0 from now on.
   * @returns {boolean}
   * */
  canBeRemoved() {
    throw new Error('Not implemented');
  }
}

/**
 * Applies a flat bonus or malus until it (optionally) expires.
 */
export class FixedModifier extends Modifier {
  /**
   * @param {number} amount
   * @param {number|null} duration
   * @param {string} description
   */
  constructor(amount, duration = Clock.NEVER, description = null) {
    super(description);
    this.amount = amount;
    this.duration = duration;
    this.createdAt = Clock.now();
  }

  value() {
    return this.canBeRemoved() ? 0 : this.amount;
  }

  canBeRemoved() {
    return (
      this.duration !== null && Clock.now() - this.createdAt >= this.duration
    );
  }
}

/**
 * A modifier that is defined as a function of the "progress". By default, the
 * progress is measured in game minutes from when the instance was created and
 * the function is defined on [0, duration]. The modifier is zero-valued
 * outside this range.
 */
export class FunctionalModifier extends Modifier {
  /**
   * @param {function(number):number} func
   * @param {number} duration
   * @param {string|null} description
   */
  constructor(func, duration, description = null) {
    super(description);
    this.func = func;
    this.duration = duration;
    this.createdAt = Clock.now();

    if (this.duration < 0) {
      throw new Error(`Duration must be non-negative, got: ${this.duration}`);
    }
  }

  get progress() {
    return Clock.now() - this.createdAt;
  }

  value() {
    return this.canBeRemoved() ? 0 : this.func(this.progress);
  }

  canBeRemoved() {
    return this.progress >= this.duration;
  }

  /**
   * @param {number} initialValue Initial value of the modifier.
   * @param {number} halfLife Game minutes until the modifier has decayed to
   *    half the initial value.
   * @param {number} insignificantValue Time after which the modifier is rounded
   *    to zero and can be removed.
   * @param {string|null} description
   * @returns {FunctionalModifier}
   */
  static decaying(
    initialValue,
    halfLife,
    description = null,
    insignificantValue = null
  ) {
    if (halfLife <= 0) {
      throw new Error(`Half life must be positive, got: ${halfLife}`);
    }
    if (insignificantValue === null) {
      // By default, round to zero below 0.5.
      insignificantValue = Math.sign(initialValue) * 0.5;
    }
    if (Math.sign(initialValue) !== Math.sign(insignificantValue)) {
      throw new Error(
        `Modifier decaying from ${initialValue} will never ` +
          ` reach ${insignificantValue}`
      );
    }
    const duration =
      initialValue === 0
        ? 0
        : Math.max(0, -halfLife * Math.log2(insignificantValue / initialValue));
    return new FunctionalModifier(
      (t) => initialValue * Math.pow(2, -t / halfLife),
      duration,
      description
    );
  }
}

/**
 * A functional modifier where the progress is manually managed.
 */
export class ManualModifier extends FunctionalModifier {
  /**
   * @param {function(number):number} func
   * @param {number} progressMax
   * @param {string|null} description
   */
  constructor(func, progressMax = 1, description = null) {
    super(func, progressMax, description);
    this._progress = 0;
  }

  set progress(value) {
    if (value < this._progress) {
      throw new Error(
        `Progress cannot be lowered, got: ${value} < ${this._progress}`
      );
    }
    this._progress = value;
  }

  get progress() {
    return this._progress;
  }
}

/**
 * Monitors other variables to compute its own value.
 */
export class MonitoringModifier extends Modifier {
  /**
   * @param {BaseVariable[]|BaseVariable} variables
   * @param {function(...number):number} func
   * @param {string|(function(number):string|null)|null} description
   */
  constructor(variables, func, description = null) {
    const descriptionFunc =
      typeof description === 'function' ? description : null;
    super(descriptionFunc === null ? description : null);
    this.func = func;
    this.variables =
      variables instanceof BaseVariable ? [variables] : variables;
    this.descriptionFunc = descriptionFunc;
  }

  get description() {
    if (this.descriptionFunc !== null) {
      return this.descriptionFunc(this.value());
    }
    return super.description;
  }

  value() {
    return this.func(...this.variables.map((v) => v.getValue()));
  }

  canBeRemoved() {
    return false;
  }

  /**
   * @param {BaseVariable} variable
   * @param {number} min The value of the modifier when the variable is at its
   *    minimum.
   * @param {number} max The value of the modifier when the variable is at its
   *    maximum.
   * @param {...string|null} descriptions
   */
  static linearMapOnto(variable, min, max, ...descriptions) {
    if (!variable.hasBothBounds()) {
      throw new Error(`Variable is missing min and/or max: ${variable}`);
    }

    let description;
    if (descriptions.length === 0) {
      description = null;
    } else if (descriptions.length === 1) {
      description = descriptions[0];
    } else if (max === min) {
      throw new Error(
        `Min and max must differ when multiple descriptions are used.`
      );
    } else {
      const indexMultiplier = descriptions.length / (max - min);
      description = (value) =>
        descriptions[
          Math.min(
            descriptions.length - 1,
            Math.floor(indexMultiplier * (value - min))
          )
        ];
    }

    const multiplier = (max - min) / (variable.max - variable.min);
    const offset = min - variable.min * multiplier;
    return new MonitoringModifier(
      variable,
      (value) => offset + multiplier * value,
      description
    );
  }

  /** @param {...BaseVariable} terms */
  static sumOf(...terms) {
    if (terms.length === 0) {
      throw new Error('Expected at least one variable');
    }
    return new MonitoringModifier(terms, (...values) =>
      values.reduce((a, b) => a + b)
    );
  }

  /** @param {...BaseVariable} terms */
  static maxOf(...terms) {
    if (terms.length === 0) {
      throw new Error('Expected at least one variable');
    }
    return new MonitoringModifier(terms, Math.max);
  }

  /** @param {...BaseVariable} terms */
  static minOf(...terms) {
    if (terms.length === 0) {
      throw new Error('Expected at least one variable');
    }
    return new MonitoringModifier(terms, Math.min);
  }
}

/**
 * A scalar value that measures some aspect of an NPC or item.
 * Base class with properties for displaying.
 */
export class BaseVariable {
  /** @returns {string | null} */
  static get title() {
    return null;
  }
  /** @returns {string | null} */
  static get description() {
    return null;
  }
  /** @returns {number} */
  static get min() {
    return -Infinity;
  }
  /** @returns {number} */
  static get max() {
    return Infinity;
  }
  /** @returns {string} */
  static get unit() {
    return '';
  }

  /**
   * @param {string | null} title
   * @param {string | null} description
   * @param {number | null} min
   * @param {number | null} max
   * @param {string} unit
   */
  constructor(
    title = null,
    description = null,
    min = null,
    max = null,
    unit = ''
  ) {
    this.title = title ?? this.constructor.title;
    this.description = description ?? this.constructor.description;
    this.min = min ?? this.constructor.min;
    this.max = max ?? this.constructor.max;
    this.unit = unit || this.constructor.unit;

    if (this.min >= this.max) {
      throw new Error(
        `Min must be less than max, got: ${this.min} >= ${this.max}`
      );
    }
  }

  /**
   * To be implemented in subclasses.
   * @returns {number}
   * */
  _computeValue() {
    throw new Error('Not implemented');
  }

  /** @returns {number} The current value of the variable. */
  getValue() {
    return Math.min(this.max, Math.max(this.min, this._computeValue()));
  }

  /** @returns {string} Formats a value as a string with the unit appended. */
  formatValue(value) {
    const rounded = value.toFixed(0);
    return this.unit ? rounded + this.unit : rounded;
  }

  /** @returns {string} The current value of the variable, formatted. */
  getFormattedValue() {
    return this.formatValue(this.getValue());
  }

  /** @returns {boolean} Whether both min and max are finite. */
  hasBothBounds() {
    return Number.isFinite(this.min) && Number.isFinite(this.max);
  }

  /**
   * Gets the value as a coordinate in the [0, 1] range,
   * where 0 represents the minimum value and 1 the maximum.
   * If either of `min` and `max` are infinite, null is returned.
   * @returns {number | null}
   */
  getValueAsRatio() {
    if (!this.hasBothBounds()) {
      return null;
    }
    return (this.getValue() - this.min) / (this.max - this.min);
  }

  /** String representation of the variable itself. */
  toString() {
    return (
      `${this.constructor.name}(title='${this.title}', ` +
      `min=${this.min}, max=${this.max})`
    );
  }

  /** @yields {Modifier} */
  *iterateModifiers() {}
}

/** A variable that accepts modifiers to its base value. */
export class Variable extends BaseVariable {
  /** @returns {number} */
  static get baseValue() {
    return 0;
  }

  constructor(
    title = null,
    description = null,
    baseValue = null,
    min = null,
    max = null,
    unit = null
  ) {
    super(title, description, min, max, unit);
    this.baseValue = baseValue ?? this.constructor.baseValue;
    /** @type {LinkedList<Modifier>} */
    this._modifiers = new LinkedList();
    /** @type {number | null} */
    this._cachedValue = null;
    this._lastRecomputed = Clock.NEVER;
  }

  _computeValue() {
    if (this._lastRecomputed !== Clock.now()) {
      this._cachedValue = this.baseValue;
      for (const modifier of this._modifiers.filterIterate(
        (modifier) => !modifier.canBeRemoved()
      )) {
        this._cachedValue += modifier.value();
      }
      this._lastRecomputed = Clock.now();
    }

    return this._cachedValue;
  }

  /**
   * @param {Modifier} modifier
   */
  addModifier(modifier) {
    this._modifiers.push(modifier);
    this._lastRecomputed = Clock.NEVER;
  }

  /**
   * @param {Modifier} modifier
   */
  removeModifier(modifier) {
    this._modifiers.remove(modifier);
    this._lastRecomputed = Clock.NEVER;
  }

  clearModifiers() {
    this._modifiers.clear();
    this._lastRecomputed = Clock.NEVER;
  }

  /** @yields {Modifier} */
  *iterateModifiers() {
    yield* this._modifiers;
  }
}

/**
 * Variable where modifiers are consumed one by one based on some sorting order.
 */
export class FurnaceVariable extends BaseVariable {
  /** @returns {number} */
  static get baseValue() {
    return 0;
  }

  constructor(
    title = null,
    description = null,
    baseValue = null,
    min = null,
    max = null,
    unit = null
  ) {
    super(title, description, min, max, unit);
    this.baseValue = baseValue ?? this.constructor.baseValue;
    /** @type {Minheap<ManualModifier>} */
    this._modifiers = new Minheap();
    this._lastRecomputed = Clock.now();
  }

  /**
   * Adds a modifier to the variable.
   * @param {number} quantity Value added to the variable.
   * @param {number} duration The number of game minutes until the fuel is
   *    consumed.
   * @param {string | null} description
   * @param {number | null} weight The priority for this modifier. Smaller
   *    weights are consumed first. Defaults to the rate at which the value
   *    diminishes.
   */
  addFuel(quantity, duration, description = null, weight = null) {
    if (duration <= 0) {
      throw new Error(`Burn rate must be positive, got: ${duration}`);
    }
    if (quantity === 0) return;

    const burnRate = quantity / duration;
    this._modifiers.push(
      new ManualModifier((t) => quantity - t * burnRate, duration, description),
      weight ?? -burnRate
    );
  }

  getValue() {
    // Remove spent modifiers.
    let timeToProgress = Clock.now() - this._lastRecomputed;
    while (timeToProgress > 0 && !this._modifiers.isEmpty()) {
      const currentModifier = this._modifiers.peek();
      if (
        currentModifier.duration - currentModifier.progress >
        timeToProgress
      ) {
        currentModifier.progress += timeToProgress;
        timeToProgress = 0;
      } else {
        this._modifiers.pop();
        timeToProgress -= currentModifier.duration - currentModifier.progress;
      }
    }
    this._lastRecomputed = Clock.now();

    let value = this.baseValue;
    for (const modifier of this._modifiers) {
      value += modifier.value();
    }

    return value;
  }

  /** @yields {Modifier} */
  *iterateModifiers() {
    yield* this._modifiers;
  }
}
