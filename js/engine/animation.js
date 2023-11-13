"use strict";

class BasicAnimation {
    constructor(obj = null, interpolation = Splines.interpolateLinear.bind(Splines)) {
        this.obj = obj;
        this.keyframes = [];
        this.funcs = [];
        this.timeToNext = 0;
        this.cumulativeTime = 0;
        this.loopOnEnd = null;

        this.interpolatedProperties = null;
        this.uninterpolatedProperties = null;

        this.interpolation = interpolation;
        this.objUpdate = null;
    }

    get constructionComplete() {
        return this.loopOnEnd !== null;
    }

    _assertConstructionNotComplete() {
        if (this.constructionComplete)
            throw new Error("Construction has completed for this animation");
    }

    _completeConstruction() {
        const properties = this.keyframes.reduce((map, frame) => {
            for (const property of frame[0].keys()) {
                const isNumber = typeof frame[0].get(property) === "number";
                if (map.has(property))
                    map.set(property, isNumber && map.get(property));
                else
                    map.set(property, isNumber);
            }
            return map;
        }, new Map());

        this.interpolatedProperties = new Map();
        this.uninterpolatedProperties = new Map();
        properties.forEach((isNumber, property) => {
            const map = isNumber ? this.interpolatedProperties : this.uninterpolatedProperties;
            const relevantFrames = this.keyframes.filter(frame => frame[0].has(property));
            map.set(property, {
                values: relevantFrames.map(frame => [frame[0].get(property)]),
                times: relevantFrames.map(frame => frame[1])
            });
        });
        this.totalTime = Math.max(...this.keyframes.map(frame => frame[1]), ...this.funcs.map(frame => frame[1]));

        delete this.keyframes;
        delete this.cumulativeTime;
        delete this.timeToNext;
    }

    after(time) {
        this._assertConstructionNotComplete();
        this.timeToNext += time;

        return this;
    }

    set(state) {
        this._assertConstructionNotComplete();
        if (this.timeToNext < 0)
            throw new Error(`Invalid time between frames: ${this.timeToNext}`);
        
        this.cumulativeTime += this.timeToNext;
        this.timeToNext = 0;
        this.keyframes.push([
            state instanceof Map ? state : new Map(Object.entries(state)),
            this.cumulativeTime]);
        
        return this;
    }

    call(func) {
        this._assertConstructionNotComplete();
        if (this.timeToNext < 0)
            throw new Error(`Invalid time between frames: ${this.timeToNext}`);
        
        this.cumulativeTime += this.timeToNext;
        this.timeToNext = 0;
        this.funcs.push([func, this.cumulativeTime]);

        return this;
    }

    stay(time) {
        this._assertConstructionNotComplete();
        if (this.keyframes.length === 0)
            throw new Error("Set a state before calling stay().");
        
        if (this.timeToNext != 0)
            throw new Error("Call stay() immediately after set().")

        if (time < 0)
            throw new Error(`Invalid time between frames: ${time}`);

        this.cumulativeTime += time;
        this.keyframes.push([
            this.keyframes[this.keyframes.length - 1][0],
            this.cumulativeTime]);

        return this;
    }

    loop() {
        this._assertConstructionNotComplete();
        // TODO: hur göra med ex. y i new Animation().set({x: 0}).after(1).set({y: 1}).after(1).set({x:2,y:3}).after(1).loop()?
        if (this.keyframes.length !== 0)
            this.set(this.keyframes[0][0]);
        else
            this.call(null);
            
        this.loopOnEnd = true;
        this._completeConstruction();

        return this;
    }

    done() {
        this._assertConstructionNotComplete();
        this.loopOnEnd = false;
        this._completeConstruction();

        return this;
    }

    clone() {
        const animation = new Animation(this.obj);
        if (this.constructionComplete) {
            animation.interpolatedProperties = this.interpolatedProperties.slice();
            animation.uninterpolatedProperties = this.uninterpolatedProperties.slice();
            animation.funcs = this.funcs.slice();
            animation.totalTime = this.totalTime;
            animation.time = this.time;
            animation.loopOnEnd = this.loopOnEnd;
        } else {
            animation.keyframes = this.keyframes.slice();
            animation.funcs = this.funcs.slice();
            animation.timeToNext = this.timeToNext;
            animation.cumulativeTime = this.cumulativeTime;
        }
        return animation;
    }

    start(obj = null) {
        if (!this.constructionComplete)
            throw new Error("Cannot start animation before it has been completed with loop() or done()");
        if (obj !== null)
            this.obj = obj;
        
        if (this.obj === null)
            throw new Error("Specify an object to apply the animation to.");
        
        this.time = 0;  
        this.objUpdate = this.obj.update.bind(this.obj);
        this.obj.update = delta => {
            const timeNext = this.time + delta / 1000;
            const timeNextInLoop = timeNext % this.totalTime;
            for (const [property, timeline] of this.interpolatedProperties) {
                // TODO: optimize
                for (let t = 0; t < timeline.times.length - 1; t++) {
                    if (timeline.times[t] <= timeNextInLoop && timeNextInLoop < timeline.times[t + 1]) {
                        const interpol = (t + (timeNextInLoop - timeline.times[t]) / (timeline.times[t + 1] - timeline.times[t])) / (timeline.times.length - 1);
                        this.obj[property] = this.interpolation(interpol, timeline.values)[0];
                        break;
                    }
                }
            }
            for (const [property, timeline] of this.uninterpolatedProperties) {
                for (const [value, timeToSet] of timeline) {
                    if (this.time < timeToSet && timeToSet <= timeNext)
                        this.obj[property] = value;
                }
            }
            for (const [func, timeToRun] of this.funcs) {
                if (func && this.time < timeToRun && timeToRun <= timeNext)
                    func();
            }

            this.time = timeNextInLoop;
            if (this.loopOnEnd === false && this.time >= this.totalTime)
                this.cancel();

            this.objUpdate(delta);
        };
    }

    cancel() {
        if (this.objUpdate === null)
            throw new Error("Animation not currently playing");

        this.obj.update = this.objUpdate;
        this.objUpdate = null;
    }
}