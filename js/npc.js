"use strict";

class BusyMetadata {
    /**
     * @param {string|null} actionDescription 
     * @param {number|null} startedAt 
     * @param {number|null} endsAt 
     */
    constructor(
        actionDescription = null,
        startedAt = null,
        endsAt = null,
    ) {
        this.actionDescription = actionDescription;
        this.startedAt = startedAt;
        this.endsAt = endsAt;
        this.duration = null;
        if (this.startedAt !== null && this.endsAt !== null) {
            this.duration = this.endsAt - this.startedAt;
        }
    }

    getProgress() {
        if (this.duration === null) {
            return null;
        }
        return Math.max(0, Math.min(1, (Clock.now() - this.startedAt) / this.duration));
    }
}

const npcImg = Resource.addAsset('img/npc-placeholder.png');
class NPC extends GameObject {
    static get image() { return Resource.getAsset(npcImg); }
    static get scale() { return 0.2; }

    constructor(x, y) {
        super(x, y);
        /** @type {BusyMetadata|null} */
        this.busyMetadata = null;
        /** @type {Item|null} */
        this.heldInLeftHand = null;
        /** @type {Item|null} */
        this.heldInRightHand = null;
        this.walkingSpeed = 10 / Clock.realMillisecondsPerGameMinute;
        /** @type {{x: number, y: number}|Item|NPC|null} */
        this.walkingTowards = null;
        /** @type {{resolve: function():any, reject: function():any}|null} */
        this._walkingHandles = null;

        this.hunger = new Hunger();
        this.mood = new Variable(
            "Humör",
            "Hur lycklig personen är",
            /*baseValue=*/100,
        );
        this.mood.addModifier(
            MonitoringModifier.linearMapOnto(
                this.hunger,
                20,
                -20,
                "Mätt",
                "Hyfsat mätt",
                "Småhungrig",
                "Hungrig"
            )
        );
    }

    isBusy() {
        return this.busyMetadata !== null;
    }

    /**
     * Flags the NPC as busy and schedules it to be unbusy again
     * after the given duration. The returned promise is resolved
     * once the NPC is no longer busy.
     * @param {number} gameMinutes 
     * @param {string|null} description
     * @returns {Promise<NPC>}
     */
    async setBusyFor(gameMinutes, description = null) {
        if (this.isBusy()) {
            throw new Error(`NPC ${this} already busy: ${this.busyMetadata}`);
        }
        if (gameMinutes <= 0) {
            return this;
        }
        this.busyMetadata = new BusyMetadata(description, Clock.now(), Clock.after(gameMinutes));
        await Clock.waitFor(gameMinutes);
        this.busyMetadata = null;
        return this;
    }

    walkTowards(thing) {
        if (this._walkingHandles !== null) {
            this._walkingHandles.reject();
        }

        this.walkingTowards = thing;
        return new Promise((resolve, reject) => {
            this._walkingHandles = {resolve: resolve, reject: reject};
        });
    }

    walkTowardsCoordinates(x, y) {
        return this.walkTowards({x: x, y: y});
    }

    update(delta) {
        super.update(delta);
        if (this.walkingTowards === null) return;

        // TODO: Fancy pathfinding.
        const step = delta * this.walkingSpeed;
        const diffX = this.walkingTowards.x - this.x;
        const diffY = this.walkingTowards.y - this.y;
        const diffSum2 = diffX * diffX + diffY * diffY;
        if (step * step >= diffSum2) {
            // Reached target.
            this.x = this.walkingTowards.x;
            this.y = this.walkingTowards.y;
            this._walkingHandles.resolve();
            this._walkingHandles = null;
            this.walkingTowards = null;
        } else {
            // Step towards target.
            const multiplier = step / Math.sqrt(diffSum2);
            this.x += diffX * multiplier;
            this.y += diffY * multiplier;
        }
    }

    /** @param {GameArea} gameArea */
    draw(gameArea) {
        super.draw(gameArea);
        const progress = this.busyMetadata?.getProgress();
        if (progress != null) {
            gameArea.bar(
                this.x,
                this.y,
                /*offset=*/0.8,
                /*length=*/3,
                /*width=*/8,
                progress,
                /*fgColor=*/"#CBAB55",
                /*bgColor=*/"#444444",
            );
        }
    }

    /** @param {Item} item */
    pickUp(item) {
        if (item.carriedBy !== null) {
            item.carriedBy.putDown(item);
        }
        const containedBy = item.maybeGetInterface(Containable)?.containedBy ?? null;
        if (containedBy !== null) {
            containedBy.remove(item);
        }
        if (this.heldInRightHand === null) {
            this.heldInRightHand = item;
            item.carriedBy = this;
        } else if (this.heldInLeftHand === null) {
            this.heldInLeftHand = item;
            item.carriedBy = this;
        } else {
            throw new Error(`Hands of ${this} are full, cannot pick up ${item}`);
        }
    }

    /** @param {Item} item */
    putDown(item) {
        if (this.heldInRightHand === item) {
            this.heldInRightHand = null;
            item.carriedBy = null;
        } else if (this.heldInLeftHand === item) {
            this.heldInLeftHand = null;
            item.carriedBy = null;
        } else {
            throw new Error(`${this} is not holding item ${item}`);
        }
    }
}
