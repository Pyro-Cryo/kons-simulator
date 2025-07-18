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
        /** @type {{variable: BaseVariable, element: HTMLDivElement}[]} */
        this._monitoredVariables = [];
    }

    isOpen() {
        return this.currentlyInspecting !== null;
    }

    /** @param {BaseVariable} variable */
    static _summarizeModifiers(variable) {
        /** @type {Map<string, {count: number, sum: number}>} */
        const summarizedModifiers = new Map();
        for (const modifier of variable.iterateModifiers()) {
            const description = modifier.description;
            if (description === null) continue;
            const summary = summarizedModifiers.get(description);
            if (summary === undefined) {
                summarizedModifiers.set(description, {count: 1, sum: modifier.value()});
            } else {
                summary.count += 1;
                summary.sum += modifier.value();
            }
        }

        return Array.from(
            summarizedModifiers.entries(),
            // Formats like "Ate cold food (-4)" or "Ate food x3 (+15)".
            entry => `${entry[0]} ${entry[1].count > 1 ? `x${entry[1].count} ` : ''}(${entry[1].sum > 0 ? '+' : ''}${variable.formatValue(entry[1].sum)})`,
        );
    }

    /** @param {BaseVariable[]} variables */
    _monitorVariables(variables) {
        this._monitoredVariables = [];
        for (const variable of variables) {
            /** @type {HTMLDivElement} */
            const variableRoot = this.variableTemplate.cloneNode(true);
            this.variables.appendChild(variableRoot);

            variableRoot.getElementsByClassName("title").item(0).innerText = variable.title;
            const valueElement = variableRoot.getElementsByClassName("value").item(0);
            valueElement.innerText = variable.getFormattedValue();
            variableRoot.classList.remove("hidden", "template");
            variableRoot.onclick = e => {
                console.log(this.constructor._summarizeModifiers(variable).join('\n'));
                e.preventDefault();
            };

            this._monitoredVariables.push({variable: variable, element: valueElement});
        }
    }

    /** @param {HTMLImageElement|null} image */
    setSprite(image) {
        if (image !== null) {
            this.sprite.width = image.width;
            this.sprite.height = image.height;
            const ctx = this.sprite.getContext("bitmaprenderer");
            window.createImageBitmap(image).then(bitmap => {
                ctx.transferFromImageBitmap(bitmap);
                if (this.spriteContainer.classList.contains("hidden")) {
                    this.spriteContainer.classList.remove("hidden");
                }
            });
        } else if (!this.spriteContainer.classList.contains("hidden")) {
            this.spriteContainer.classList.add("hidden");
        }
    }

    /** @param {Item} item */
    updateStaticItemInfo(item) {
        this.title.innerText = item.title;
        this.description.innerText = item.description;
        this.setSprite(item.image);

        const variables = [
            item.maybeGetInterface(Heatable)?.temperature,
        ].filter(v => !!v);
        this._monitorVariables(variables);
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
        this.setSprite(npc.image);

        this._monitorVariables([npc.mood, npc.hunger]);
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

        for (const monitoredVariable of this._monitoredVariables) {
            const stringValue = monitoredVariable.variable.getFormattedValue();
            if (stringValue != monitoredVariable.element.innerText) {
                monitoredVariable.element.innerText = stringValue;
            }
        }
    }

    close() {
        this.root.classList.add("hidden");
        this.spriteContainer.classList.add("hidden");
        this.currentAction.classList.add("hidden");
        this.currentlyInspecting = null;
        this._monitoredVariables = [];
        while (this.variables.lastElementChild !== this.variableTemplate) {
            this.variables.removeChild(this.variables.lastElementChild);
        }
    }
}