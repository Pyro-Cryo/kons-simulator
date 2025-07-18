"use strict";

class Hunger extends FurnaceVariable {
    static get title() { return "Hunger"; }
    static get description() { return "Personens behov att äta"; }
    static get baseValue() { return 100; }
    static get min() { return 0; }
    static get max() { return 100; }
    static get unit() { return "%"; }
}

class Temperature extends Variable {
    static get title() { return "Temperatur"; }
    static get description() { return "Hur varmt något eller någon är"; }
    static get unit() { return " \u00b0C"; }
    static get min() { return -273; }
    static get baseValue() { return 20; }
    static get halfLife() { return 20; }

    /**
     * @param {number|null} halfLife Game minutes until the temperature difference between the item and the environment is halved.
     * @param {number|null} environment Temperature of the surrounding environment.
     * @param {number|null} initial Initial temperature of this item. Defaults to the environment temperature.
     */
    constructor(halfLife = null, environment = null, initial = null) {
        super(null, null, /*baseValue=*/environment);
        this._halfLife = halfLife ?? this.constructor.halfLife;
        if (this._halfLife <= 0) {
            throw new Error(`Half life must be positive, got: ${this._halfLife}`);
        }

        const initialValue = initial ?? this.baseValue;
        if (initialValue !== this.baseValue) {
            this.setCurrent(initialValue);
        }
    }

    adjustCurrent(change) {
        this.setCurrent(this.getValue() + change);
    }

    /** @param {number} newValue */
    setCurrent(newValue) {
        this.clearModifiers();

        const decayModifier = FunctionalModifier.decaying(
            newValue - this.baseValue, this._halfLife
        );
        // In case of small adjustments, keep the decay for at least one game minute.
        decayModifier.duration = Math.max(1, decayModifier.duration);
        this.addModifier(decayModifier);
    }

    /**
     * Updates the environment temperature without changing the current temperature
     * of the item.
     * @param {number} value
     * */
    setEnvironment(value) {
        if (value === this.baseValue) return;
        const currentTemperature = this.getValue();
        this.baseValue = value;
        this.setCurrent(currentTemperature);
    }
}
