"use strict";

class Inspector extends GameObject {
    constructor() {
        super(0, 0);
        this._imageDirty = false; // Not drawn.
        this.root = document.getElementById("inspector");
        this.title = document.getElementById("inspectorTitle");
        this.description = document.getElementById("inspectorDescription");
        this.currentAction = document.getElementById("inspectorCurrentAction");
        this.spriteContainer = document.getElementById("inspectorSpriteContainer");
        /** @type {HTMLCanvasElement} */
        this.sprite = document.getElementById("inspectorSprite");
        this.secondaryInfo = document.getElementById("inspectorSecondaryInfo");
        this.variables = document.getElementById("inspectorVariables");
        this.variableTemplate = this.variables.getElementsByClassName("template").item(0);

        /** @type {Item|NPC|null} */
        this.currentlyInspecting = null;
        /** @type {{variable: Variable, element: HTMLDivElement}[]} */
        this._monitoredVariables = [];
    }

    isOpen() {
        return this.currentlyInspecting !== null;
    }

    /** @param {Item} item */
    updateStaticItemInfo(item) {
        this.title.innerText = item.title;
        this.description.innerText = item.description;
        this.currentAction.classList.add("hidden");
        this._monitoredVariables = [];
    }

    /** @param {Item} item */
    updateDynamicItemInfo(item) {

    }

    /** @param {NPC} npc */
    updateStaticNpcInfo(npc) {
        this.title.innerText = "Fysiker Matematikersson";
        this.description.innerText = "Helt vanlig student";
        this.currentAction.classList.remove("hidden");

        // TODO: This should maybe be dynamically updated instead.
        if (npc.image !== null) {
            this.sprite.width = npc.image.width;
            this.sprite.height = npc.image.height;
            const ctx = this.sprite.getContext("bitmaprenderer");
            window.createImageBitmap(npc.image).then(bitmap => {
                ctx.transferFromImageBitmap(bitmap);
                if (this.spriteContainer.classList.contains("hidden")) {
                    this.spriteContainer.classList.remove("hidden");
                }
            });
        } else if (!this.spriteContainer.classList.contains("hidden")) {
            this.spriteContainer.classList.add("hidden");
        }

        this._monitoredVariables = [];
        for (const variable of [npc.hunger, npc.mood]) {
            /** @type {HTMLDivElement} */
            const variableRoot = this.variableTemplate.cloneNode(true);
            this.variables.appendChild(variableRoot);
            variableRoot.getElementsByClassName("title").item(0).innerText = variable.title;
            const valueElement = variableRoot.getElementsByClassName("value").item(0);
            valueElement.innerText = variable.toString();
            variableRoot.classList.remove("hidden", "template");
            this._monitoredVariables.push({variable: variable, element: valueElement});
        }
    }

    /** @param {NPC} npc */
    updateDynamicNpcInfo(npc) {
        if (npc.isBusy()) {
            let infoText = npc.busyMetadata.actionDescription ?? "Upptagen";
            const progress = npc.busyMetadata.getProgress();
            if (progress !== null) {
                infoText = `${infoText} (${(progress * 100).toFixed(0)}%)`;
            }
            if (this.currentAction.innerText !== infoText) {
                this.currentAction.innerText = infoText;
            }
        } else if (this.currentAction.innerText) {
            this.currentAction.innerText = "";
        }

        for (const monitoredVariable of this._monitoredVariables) {
            const stringValue = monitoredVariable.variable.toString();
            if (stringValue != monitoredVariable.element.innerText) {
                monitoredVariable.element.innerText = stringValue;
            }
        }
    }

    /**
     * @param {Item|NPC} thing 
     */
    open(thing) {
        if (this.isOpen()) this.close();

        if (thing instanceof Item) {
            this.updateStaticItemInfo(thing);
        } else if (thing instanceof NPC) {
            this.updateStaticNpcInfo(thing);
        } else {
            console.warn("Cannot inspect", thing);
            return;
        }

        this.currentlyInspecting = thing;
        this.root.classList.remove("hidden");
    }

    update(delta) {
        super.update(delta);
        if (this.currentlyInspecting === null) return;
        if (this.currentlyInspecting instanceof Item) {
            this.updateDynamicItemInfo(this.currentlyInspecting);
        } else {
            this.updateDynamicNpcInfo(this.currentlyInspecting);
        }
    }

    close() {
        this.root.classList.add("hidden");
        this.currentlyInspecting = null;
    }
}