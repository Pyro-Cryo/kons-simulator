class Variable {
    /** @returns {string | null} */
    static get title() { return null; }
    /** @returns {string | null} */
    static get description() { return null; }

    /**
     * @param {string | null} title 
     * @param {string | null} description 
     */
    constructor(title = null, description = null) {
        this.title = title ?? this.constructor.title;
        this.description = description ?? this.constructor.description;
    }

    /** @returns {number} The current value of the variable. */
    getValue() {
        throw new Error('Not implemented');
    }

    /** @returns {string} The current value of the variable, formatted. */
    toString() {
        return this.getValue().toFixed(0);
    }
}


class Modifier {
    static get RECOMPUTE_NEVER() { return 0; }
    static get RECOMPUTE_EACH_UPDATE() { return 1; }
    static get HIGHEST_RECOMPUTE_CADENCY() { return this.RECOMPUTE_EACH_UPDATE; }

    constructor(description = null, zeroAfter = Clock.NEVER, recomputePolicy = Modifier.RECOMPUTE_EACH_UPDATE) {
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
        return this.zeroAfter !== Clock.NEVER && Clock.now() >= this.zeroAfter;
    }
}


/** Simple variable implementation that does no caching. */
class SimpleVariable extends Variable {
    /** @returns {number} */
    static get baseValue() { return 0; }
    /** @returns {number} */
    static get min() { return 0; }
    /** @returns {number} */
    static get max() { return 100; }
    /** @returns {string | null} */
    static get unit() { return '%'; }

    constructor(title = null, baseValue = null, description = null, min = null, max = null, unit = null) {
        super(title, description);
        this.baseValue = baseValue ?? this.constructor.baseValue;
        this.min = min ?? this.constructor.min;
        this.max = max ?? this.constructor.max;
        this.unit = unit ?? this.constructor.unit;
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
        const rounded = this.getValue().toFixed(0);
        return this.unit ? rounded + this.unit : rounded;
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
    constructor(title = null, baseValue = null, description = null, min = null, max = null, unit = null) {
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
                        && this._lastRecomputed !== Clock.now())
                
        ) {
            this._cachedValue = super.getValue();
            this._lastRecomputed = Clock.now();
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
        return this.startAmount * (this.zeroAfter - Clock.now()) / this.durationMinutes;
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
     * @param {string | null} title 
     * @param {string | null} description 
     */
    constructor(combiner, variables, title = null, description = null) {
        super(title, description);
        this.combiner = combiner;
        this.variables = variables;
    }

    getValue() {
        return this.combiner(...this.variables.map(v => v.getValue()));
    }

    /**
     * @param {string | null} title 
     * @param {string | null} description 
     * @param {...Variable} terms
     * @returns {DerivedVariable}
     */
    static sumOf(title, description, ...terms) {
        if (terms.length === 0) {
            throw new Error('Expected at least one variable');
        }
        return new DerivedVariable(
            (...values) => values.reduce((a, b) => a + b),
            terms,
            title,
            description,
        );
    }

    /**
     * @param {string | null} title 
     * @param {string | null} description 
     * @param {...Variable} terms
     * @returns {DerivedVariable}
     */
    static maxOf(title, description, ...terms) {
        if (terms.length === 0) {
            throw new Error('Expected at least one variable');
        }
        return new DerivedVariable(Math.max, terms, title, description);
    }

    /**
     * @param {string | null} title 
     * @param {string | null} description 
     * @param {...Variable} terms
     * @returns {DerivedVariable}
     */
    static minOf(title, description, ...terms) {
        if (terms.length === 0) {
            throw new Error('Expected at least one variable');
        }
        return new DerivedVariable(Math.min, terms, title, description);
    }
}

