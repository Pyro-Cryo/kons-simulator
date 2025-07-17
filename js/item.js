"use strict";

class Item extends GameObject {
    /** @returns {string | null} */
    static get title() { return null; }
    /** @returns {string | null} */
    static get description() { return null; }

    constructor(x = 0, y = 0) {
        super(x, y);
        this.title = this.constructor.title;
        this.description = this.constructor.description;
        /** @type {Map<typeof Interface, Interface>} */
        this._interfaces = new Map();
        this._finalized = false;
        this.hidden = this.constructor.image === null;
        /** @type {NPC|null} */
        this.carriedBy = null;
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

    update(delta) {
        super.update(delta);
        if (this.carriedBy !== null) {
            const xOffset = 0.5 * (
                (this.carriedBy.heldInLeftHand === this) - (this.carriedBy.heldInRightHand === this)
            );
            this.x = this.carriedBy.x + xOffset;
            this.y = this.carriedBy.y - 0.5;
        }
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
            this.remainingUses--;
            this.isInUse = false;
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
        npc.hunger.addFuel(
            -this.hungerPointsPerUse,
            duration,
            "Åt mat",
        );
    }
}

/**
 * NPCs can place items in or remove them from this item.
 */
class Container extends Interface {
    /**
     * @param {number} capacity
     * @param {function(Container,Item,NPC|null):any} onItemAdded
     * @param {function(Container,Item,NPC|null):any} onItemRemoved
     * @param {function(Container,Item):boolean} emplacementFilter 
     */
    constructor(
            capacity = Infinity,
            onItemAdded = () => null,
            onItemRemoved = () => null,
            emplacementFilter = () => true,
    ) {
        super();
        this.capacity = capacity;
        this.load = 0;
        this.onItemAdded = onItemAdded;
        this.onItemRemoved = onItemRemoved;
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
        return containable !== null
            && this.load + containable.size <= this.capacity
            && containable.containedBy === null
            && this.emplacementFilter(this, item);
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
        this.onItemAdded(this, item, npc);
    }

    /**
     * @param {Item} item
     * @param {NPC|null} npc
     * */
    remove(item, npc = null) {
        const containable = item.getInterface(Containable);
        const index = this._containables.findIndex(c => c === containable);
        if (index === -1) {
            throw new Error(`Item ${item} is not in container ${this}`);
        }
        this.load -= containable.size;
        containable.containedBy = null;
        this._containables.splice(index, 1);
        this.onItemRemoved(this, item, npc);
    }

    getItems() {
        return Array.from(this._items);
    }
}

class Containable extends Interface {
    // A small item fits in a pocket.
    static get SIZE_SMALL() { return 1; }
    // A medium item can be carried in one hand.
    static get SIZE_MEDIUM() { return 5; }
    // A large item can be carried with two hands.
    static get SIZE_LARGE() { return 25; }

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
         * This is set iff the item can be found in containedBy._items.
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

const lunchboxImg = Resource.addAsset('img/matlada.png');
class Lunchbox extends Item {
    static get image() { return Resource.getAsset(lunchboxImg); }
    static get scale() { return 0.2; }
    static get title() { return "Matlåda"; }
    static get description() { return "En portion mat"; }

    static create(x, y) {
        return new Lunchbox(x, y)
            .addInterface(new Edible(
                /*hungerPointsPerUse=*/20,
                /*numUses=*/5,
                /*minutesPerUse=*/3,
                Edible.BURN_RATE_STANDARD,
                "Äter matlåda"))
            .addInterface(new Containable(/*size=*/Containable.SIZE_MEDIUM))
            .finalize();
    }
}

const microwaveImg = Resource.addAsset('img/mikro.png');
class Microwave extends Item {
    static get image() { return Resource.getAsset(microwaveImg); }
    static get scale() { return 0.2; }
    static get title() { return "Mikrovågsugn"; }
    static get description() { return "Värmer mat"; }

    static create(x, y) {
        return new Microwave(x, y)
            .addInterface(new Container(
                /*capacity=*/Containable.SIZE_MEDIUM,
            ))
            .addInterface(new Containable(
                /*size=*/Containable.SIZE_LARGE,
            ))
            .finalize();
    }
}
