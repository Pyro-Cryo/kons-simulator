class Konstroller extends Controller {
    static get STORAGE_PREFIX() { return "konssimulator_"; }

    constructor() {
        super(document.getElementById("gameboard"));
    }
}