class Hunger extends CachedVariable {
    static get title() { return "Hunger"; }
    static get description() { return "Personens behov att äta"; }
    static get baseValue() { return 100; }
}

class Temperature extends CachedVariable {
    static get title() { return "Temperatur"; }
    static get description() { return "Hur varmt något eller någon är"; }
    static get unit() { return " \u00b0C"; }
    static get baseValue() { return 20; }
    static get min() { return -273; }
    static get max() { return 1000; }
}
