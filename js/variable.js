class Variable {
    /** @returns {number} The current value of the variable. */
    getValue() {
        throw new Error('Not implemented');
    }
}


class Modifier {
    static get RECOMPUTE_NEVER() { return 0; }
    static get RECOMPUTE_EACH_UPDATE() { return 1; }
    static get HIGHEST_RECOMPUTE_CADENCY() { return this.RECOMPUTE_EACH_UPDATE; }

    constructor(description = null, zeroAfter = Clock.NEVER, recomputePolicy = Modifier.RECOMPUTE_ALWAYS) {
        this.description = description;
        this.recomputePolicy = recomputePolicy;
        this.zeroAfter = zeroAfter;
    }

    /**
     * @returns {number}
     */
    value() {
        throw new Error('Not implemented');
    }

    canBeRemoved() {
        return this.zeroAfter !== Clock.NEVER && Clock.now >= this.zeroAfter;
    }
}


/** Simple variable implementation that does no caching. */
class SimpleVariable extends Variable {
    constructor(title, baseValue = 0, description = null, min = 0, max = 100, unit = '%') {
        super();
        this.baseValue = baseValue;
        this.title = title;
        this.description = description;
        this.min = min;
        this.max = max;
        this.unit = unit;
        /** @type {LinkedList<Modifier>} */
        this._modifiers = new LinkedList();
    }

    getValue() {
        let value = this.baseValue;
        let modifiersWereRemoved = false;
        for (const modifier of this._modifiers.filterIterate(modifier => {
                const canBeRemoved = modifier.canBeRemoved();
                modifiersWereRemoved |= canBeRemoved;
                return !canBeRemoved;
        })) {
            value += modifier.value();
        }
        if (modifiersWereRemoved) {
            this.onModifiersWereRemoved();
        }

        return Math.max(Math.min(value, this.max), this.min);
    }

    toString() {
        return this.currentValue.toFixed(0) + this.unit;
    }

    /**
     * @param {Modifier} modifier 
     */
    addModifier(modifier) {
        this._modifiers.push(modifier);
    }

    /**
     * @param {Modifier} modifier 
     */
    removeModifier(modifier) {
        this._modifiers.remove(modifier);
        this.onModifiersWereRemoved();
    }

    onModifiersWereRemoved() {}
}


/**
 * A variable whose value is only recomputed once per update.
 */
class CachedVariable extends SimpleVariable {
    constructor(title, baseValue = 0, description = null, min = 0, max = 100, unit = '%') {
        super(title, baseValue, description, min, max, unit);
        /** @type {number | null} */
        this._cachedValue = null;
        this._lastRecomputed = Clock.NEVER;
        this._recomputePolicy = Modifier.RECOMPUTE_NEVER;
    }

    get recomputePolicy() {
        return this._recomputePolicy;
    }

    getValue() {
        if (this._cachedValue === null
                || (this._recomputePolicy === Modifier.RECOMPUTE_EACH_UPDATE
                        && this._lastRecomputed !== Clock.now)
                
        ) {
            this._cachedValue = super.getValue();
            this._lastRecomputed = Clock.now;
        }
        return this._cachedValue;
    }

    /**
     * @param {Modifier} modifier 
     */
    addModifier(modifier) {
        super.addModifier(modifier);
        this._cachedValue = null;
        if (modifier.recomputePolicy > this._recomputePolicy) {
            this._recomputePolicy = modifier.recomputePolicy;
        }
    }

    onModifiersWereRemoved() {
        this._cachedValue = null;
        this._recomputePolicy = Modifier.RECOMPUTE_NEVER;
        for (const modifier of this._modifiers) {
            if (modifier.recomputePolicy > this._recomputePolicy) {
                this._recomputePolicy = modifier.recomputePolicy;
                if (this._recomputePolicy === Modifier.HIGHEST_RECOMPUTE_CADENCY) {
                    break;
                }
            }
        }
    }
}


/**
 * Applies a flat bonus or malus until it (optionally) expires.
 */
class FixedModifier extends Modifier {
    /**
     * @param {number} amount
     * @param {string} description
     * @param {number} zeroAfter
     */
    constructor(amount, description = null, zeroAfter = Clock.NEVER) {
        super(description, zeroAfter, Modifier.RECOMPUTE_NEVER);
        this.amount = amount;
    }

    value() {
        return this.amount;
    }
}


/**
 * Adds `startAmount` when it is created and linearly ramps down to 0 over `durationMinutes`.
 */
class LinearRampModifier extends Modifier {
    /**
     * @param {number} startAmount 
     * @param {number} durationMinutes
     * @param {string} description
     */
    constructor(startAmount, durationMinutes, description = null) {
        super(description, zeroAfter = Clock.after(durationMinutes), Modifier.RECOMPUTE_EACH_UPDATE);
        this.startAmount = startAmount;
        this.durationMinutes = durationMinutes;
    }

    value() {
        return this.startAmount * (this.zeroAfter - Clock.now) / this.durationMinutes;
    }
}


/**
 * A variable whose value is a combination of other variables.
 * No circular dependencies, please.
 */
class DerivedVariable extends Variable {
    /**
     * @param {function(...number):number} combiner 
     * @param {Variable[]} variables 
     */
    constructor(combiner, variables) {
        this.combiner = combiner;
        this.variables = variables;
    }

    getValue() {
        return this.combiner(...this.variables);
    }

    /**
     * @param {...Variable} terms
     * @returns {DerivedVariable}
     */
    static sumOf(...terms) {
        if (terms.length === 0) {
            throw new Error('Expected at least one variable');
        }
        return new DerivedVariable(
            (...values) => values.reduce((a, b) => a + b),
            terms,
        );
    }

    /**
     * @param {...Variable} terms
     * @returns {DerivedVariable}
     */
    static maxOf(...terms) {
        if (terms.length === 0) {
            throw new Error('Expected at least one variable');
        }
        return new DerivedVariable(Math.max, terms);
    }

    /**
     * @param {...Variable} terms
     * @returns {DerivedVariable}
     */
    static minOf(...terms) {
        if (terms.length === 0) {
            throw new Error('Expected at least one variable');
        }
        return new DerivedVariable(Math.min, terms);
    }
}

