const npcImg = Resource.addAsset('img/npc-placeholder.png');

class NPC extends GameObject {
    static get image() { return Resource.getAsset(npcImg); }
    static get scale() { return 0.2; }

    constructor(x, y) {
        super(x, y);
        this.hunger = new Hunger();
    }
}
