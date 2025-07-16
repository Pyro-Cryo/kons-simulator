class Item extends GameObject {
    /** @returns {string | null} */
    static get title() { return null; }
    /** @returns {string | null} */
    static get description() { return null; }

    /**
     * @param {string | null} title 
     * @param {string | null} description 
     */
    constructor(title = null, description = null) {
        super(0, 0);
        this._imageDirty = false;  // Not drawn.
        this.title = title ?? this.constructor.title;
        this.description = description ?? this.constructor.description;
        /** @type {Map<typeof Interface, Interface>} */
        this._interfaces = new Map();
        this._finalized = false;
    }

    /**
     * Adds an interface to the item. Only supported before finalization.
     * @param {Interface} interface_
     * @returns {this}
     */
    addInterface(interface_) {
        if (this._finalized) {
            throw new Error(`Trying to add interface ${interface_} to finalized item ${this}`);
        }
        if (this._interfaces.has(interface_.constructor)) {
            throw new Error(`Interface ${interface_} already present on item ${this}`);
        }
        this._interfaces.set(interface_.constructor, interface_);
        interface_.onAddedTo(this);
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
        for (const interface_ of this._interfaces.values()) {
            interface_.onFinalize();
        }
        this._finalized = true;
        return this;
    }

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

    get [Symbol.toStringTag]() {
        return `${this.constructor.name} (${this.title})`;
    }
}

class Interface {
    /**
     * Called when the interface is added to an item.
     * Other interfaces on which this one depends may not
     * yet have been added.
     * @param {Item} item 
     */
    onAddedTo(item) {
        this.item = item;
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
    static get NUM_USES() { return 1; }
    // The time it takes to use the item, in game minutes.
    static get MINUTES_PER_USE() { return 1; }
    // A description displayed on the NPC when the item is in use.
    // Should be on the form "Eating lunchbox" or "Washing dishes".
    static get ACTION_DESCRIPTION() { return null; }

    constructor(numUses = null, minutesPerUse = null, actionDescription = null) {
        super();
        this.remainingUses = numUses ?? this.constructor.NUM_USES;
        this.minutesPerUse = minutesPerUse ?? this.constructor.MINUTES_PER_USE;
        this.actionDescription = actionDescription ?? this.constructor.ACTION_DESCRIPTION;
        this.isInUse = false;

        if (this.remainingUses <= 0) {
            throw new Error(`Number of uses must be positive, got: ${this.remainingUses}`);
        }
        if (this.minutesPerUse < 0) {
            throw new Error(`Minutes per use must be non-negative, got: ${this.minutesPerUse}`);
        }
    }

    /**
     * Whether or not the given NPC can use the item right now.
     * @param {NPC} npc
     * @returns {boolean}
     */
    canUse(npc) {
        return !this.isInUse && !npc.isBusy() && this.item.id !== null && this.remainingUses > 0;
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
     * Decrements the remaining uses and calls the onUsed and onUsedUp methods as necessary.
     * @param {NPC} npc
     */
    use(npc) {
        if (!this.canUse(npc)) {
            throw new Error(`Item ${this.item} cannot be used by ${npc}`);
        }
        const gameMinutesToUse = this.gameMinutesToUse(npc);
        const callback = () => {
            console.log("Usable callback invoked");
            this.remainingUses--;
            this.onUsed(npc);
            if (this.remainingUses <= 0) {
                this.onUsedUp(npc);
            }
        };
        if (gameMinutesToUse <= 0) {
            callback();
            return Promise.resolve();
        }
        this.isInUse = true;
        return npc.setBusyFor(gameMinutesToUse, this.actionDescription).then(callback);
    }

    /**
     * Called when the item is used. By default, flags the item as no longer in use.
     * @param {NPC} npc
     */
    onUsed(npc) {
        this.isInUse = false;
        console.log(`${npc} used ${this.item}. ${this.remainingUses} left.`);
    }

    /**
     * Called when there are no more remaining uses. By default, deletes the item.
     * @param {NPC} npc
     */
    onUsedUp(npc) {
        console.log(`${npc} used up ${this.item}`);
        this.item.despawn();
    }
}

class Edible extends Usable {
    static get ACTION_DESCRIPTION() { return "Äter"; }
    // Hunger% som försvinner per minut för vanlig mat.
    static get BURN_RATE_STANDARD() { return 1 / 3; }
    // Hunger% som försvinner per minut för snacks och liknande.
    static get BURN_RATE_FAST() { return 1; }

    constructor(
            hungerPointsPerUse,
            numUses = null,
            minutesPerUse = null, 
            hungerPointBurnRate = Consumable.BURN_RATE_STANDARD,
            actionDescription = null,
    ) {
        super(numUses, minutesPerUse, actionDescription);
        this.hungerPointsPerUse = hungerPointsPerUse;
        this.hungerPointBurnRate = hungerPointBurnRate;
    }

    /**
     * @param {NPC} npc
     */
    onUsed(npc) {
        super.onUsed(npc);
        const duration = this.hungerPointsPerUse / this.hungerPointBurnRate;
        npc.hunger.addModifier(new LinearRampModifier(
            /*startAmount=*/-this.hungerPointsPerUse,
            /*durationMinutes=*/duration,
            /*description=*/"Åt mat",
        ));
    }
}

class Lunchbox extends Item {
    static get title() { return "Matlåda"; }
    static get description() { return "En portion mat"; }

    static create() {
        return new Lunchbox()
            .addInterface(new Edible(
                /*hungerPointsPerUse=*/20,
                /*numUses=*/5,
                /*minutesPerUse=*/3,
                Edible.BURN_RATE_STANDARD,
                "Äter matlåda"))
            .finalize();
    }
}
