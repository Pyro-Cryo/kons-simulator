class BusyMetadata {
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
        this.hunger = new Hunger();
        this.moodModifiers = new CachedVariable(
            /*title=*/null,
            /*baseValue=*/0,
            /*description=*/null,
            /*min=*/-Infinity,
            /*max=*/Infinity,
            /*unit=*/null,
        );
        this.mood = new DerivedVariable(
            (hunger, modifiers) => Math.max(Math.min(hunger + modifiers, 100), 0), 
            [this.hunger, this.moodModifiers]
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
            console.log("Unbusying immediately");
            return this;
        }
        this.busyMetadata = new BusyMetadata(description, Clock.now(), Clock.after(gameMinutes));
        console.log(`Waiting for ${gameMinutes} game minutes`);
        await Clock.waitFor(gameMinutes);
        console.log("Done");
        this.busyMetadata = null;
        return this;
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
}
