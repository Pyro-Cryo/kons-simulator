"use strict";

class Hunger extends FurnaceVariable {
    static get title() { return "Hunger"; }
    static get description() { return "Personens behov att äta"; }
    static get baseValue() { return 100; }
    static get min() { return 0; }
    static get max() { return 100; }
    static get unit() { return "%"; }
}

class Temperature extends Variable {
    static get title() { return "Temperatur"; }
    static get description() { return "Hur varmt något eller någon är"; }
    static get unit() { return " \u00b0C"; }
    static get baseValue() { return 20; }
    static get min() { return -273; }
    static get max() { return 1000; }
}
