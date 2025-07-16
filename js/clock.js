let __clock_instance = null;
const __CLOCK_NEVER = Symbol('never');

class Clock extends GameObject {
    /** @returns {Clock | null} */
    static get instance() { return __clock_instance; }
    static get realMillisecondsPerGameMinute() { return 2000; }
    static get NEVER() { return __CLOCK_NEVER; }

    constructor() {
        super(0, 0);
        this._imageDirty = false;  // Not drawn.
        this.elapsedRealMilliseconds = 0;
        this.elapsedGameMinutes = 0;
        /** @type {Minheap<function():void>} */
        this.callbacks = new Minheap();

        if (Clock.instance) {
            throw new Error('Cannot create multiple clocks');
        }
        __clock_instance = this;
    }

    /**
     * The current time, in minutes from the game start.
     * @returns {number}
     */
    static now() {
        return __clock_instance.elapsedGameMinutes;
    }

    /**
     * @param {number} minutes 
     * @returns {number} The timestamp `minutes` into the future.
     */
    static after(minutes) {
        return this.now() + minutes;
    }

    /**
     * Schedule a callback to be invoked at a certain time.
     * If the timestamp has already passed, the callback is immediately invoked.
     * @param {function():any} callback 
     * @param {number} time 
     */
    static schedule(callback, time) {
        if (time <= this.now()) {
            callback();
        } else if (time !== __CLOCK_NEVER) {
            this.instance.callbacks.push(callback, time);
        }
    }

    /**
     * Create a promise that is resolved after the given number of game minutes.
     * @param {number} minutes 
     * @returns {Promise<void>}
     */
    static waitFor(minutes) {
        return this.waitUntil(this.after(minutes));
    }

    /**
     * Create a promise that is resolved at a certain time.
     * If the timestamp has already passed, the promise is immediately resolved.
     * @param {number} time
     * @returns {Promise<void>}
     */
    static waitUntil(time) {
        if (time === __CLOCK_NEVER) {
            return Promise.reject(new Error("Promise would wait indefinitely"));
        }
        return new Promise(resolve => this.schedule(resolve, time));
    }

    update(delta) {
        this.elapsedRealMilliseconds += delta;
        this.elapsedGameMinutes = this.elapsedRealMilliseconds / Clock.realMillisecondsPerGameMinute;

        while (!this.callbacks.isEmpty() && this.callbacks.peekWeight() <= this.elapsedGameMinutes) {
            this.callbacks.pop()();
        }
    }
}