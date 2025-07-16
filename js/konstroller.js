"use strict";

class Konstroller extends Controller {
    static get STORAGE_PREFIX() { return 'konssimulator_'; }
    static get VERSION() { return [0, 1]; }

    constructor() {
        super(
            document.getElementById('gameboard'),
            /*updateInterval=*/ null,
            /*gridWidth=*/ 32,
            /*gridHeight=*/ 48,
            /*gridOrigin=*/ GameArea.GRID_ORIGIN_LOWER_LEFT
        );
        this.elements = {
            time: document.getElementById('time'),
            day: document.getElementById('day'),
            version: document.getElementById('version'),
            loadButton: document.getElementById('loadButton'),
            saveButton: document.getElementById('saveButton'),
            modal: document.getElementById('modal'),
            modalTitle: document.getElementById('modalTitle'),
            modalMessage: document.getElementById('modalMessage'),
            buttonTemplate: document.getElementById('buttonTemplate'),
        };
        this.setupElements();
    }

    setupElements() {
        this.elements.loadButton.addEventListener('click', this.loadSave.bind(this));
        this.elements.saveButton.addEventListener('click', this.save.bind(this));
        this.elements.version.innerText = this.constructor.VERSION.join(".");
    }

    onAssetsLoaded() {
        new Clock();
        this.npc = new NPC(this.gameArea.gridWidth / 2, this.gameArea.gridHeight / 2);
        this.setMessage('> _');
        this.startDrawLoop();
        // TODO: Maybe remove (start paused)?
        this.onPlay();
        
        const lunchbox = Lunchbox.create();
        const tryEatLunchbox = () => {
            console.log("Trying to eat lunch box");
            if (lunchbox.id === null) {
                console.log("Lunch box is null");
                return;
            }
            lunchbox.getInterface(Usable).use(this.npc).then(() => {
                console.log("Waiting two minutes");
                Clock.waitFor(2).then(tryEatLunchbox);
            });
        };
        tryEatLunchbox();
    }

    onAssetsLoadFailure(reason) {
        console.error(reason);

        let errorData;
        if (reason instanceof Response) {
            errorData = [
                `${reason.constructor.name}: ${reason.status} ${reason.statusText}`,
                reason.text(),
            ];
        }
        else if (reason instanceof Error) {
            errorData = [
                `${reason.name}: ${reason.message}`,
                JSON.stringify(reason),
            ];
        }
        else if (reason !== undefined && reason !== null) {
            errorData = [
                `${reason.constructor.name}: ${JSON.stringify(reason)}`
            ];
        } else {
            errorData = null;
        }
        const errorMessage = [
            "Spelet är trasigt :(",
            "Hör gärna av dig till utvecklarna eller Cyberföhs",
        ].concat(
            errorData !== null ? [
                "Inkludera den här informationen:",
                ...errorData.map(line => "  " + line),
                "Tack!"
            ] : []
        ).join('\n');

        this.setMessage(errorMessage);
        alert(errorMessage);
        this.messageBox.classList.add('selectable');
    }

    loadSave() {
        alert("Load save");
    }

    save() {
        alert("Save");
    }
}
