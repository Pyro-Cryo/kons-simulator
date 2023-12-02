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
        this.title = title ?? this.constructor.title;
        this.description = description ?? this.constructor.description;
    }
}

class Lunchbox extends Item {
    static get title() { return "Matlåda"; }
    static get description() { return "En portion mat"; }

    constructor() {
        super();
        this.temperature = new Temperature();
        this.amountLeft = 100;
    }

    canEat() {
        return this.amountLeft > 0 && this.temperature.getValue() > 40;
    }

    /**
     * @param {NPC} npc
     * @param {number | null} amount
     */
    eat(npc, amount = null) {
        amount ??= this.amountLeft;
        amount = Math.max(0, Math.min(this.amountLeft, amount));
        if (!this.canEat() || amount === 0) return;

        npc.hunger.addModifier(new LinearRampModifier(
            /*startAmount=*/amount,
            // Äter man en hel matlåda är man mätt i fem timmar.
            /*durationMinutes=*/amount * 3,
            /*description=*/"Åt av en matlåda",
        ));
        this.amountLeft -= amount;
    }
}
