import {Splines} from './splines.js';

interface GameObjectInterface {
  update(delta: number): void;
  [key: string]: unknown;
}

type Interpolation = (t: number, path: number[][]) => number[];

interface Frame {
  state: Map<string, unknown>;
  time: number;
}

interface Invocation {
  func: () => void;
  time: number;
}

interface Timeline<T> {
  // Array of single-element arrays, to make it compatible with interpolation
  // functions from Splines.
  values: [T][];
  // Contains exactly as many elements as `values`.
  times: number[];
}

class BasicAnimationBuilder {
  private keyframes: Frame[] = [];
  private funcs: Invocation[] = [];
  private timeToNext: number = 0;
  private cumulativeTime: number = 0;

  constructor(
    private obj?: GameObjectInterface,
    private interpolation: Interpolation = Splines.interpolateLinear.bind(
      Splines
    )
  ) {}

  private build(loop: boolean) {
    if (loop) {
      // TODO: hur göra med ex. y i
      // `new Animation().set({x: 0}).after(1).set({y: 1}).after(1)
      //      .set({x:2,y:3}).after(1).loop()?`
      if (this.keyframes.length !== 0) {
        this.set(this.keyframes[0].state);
      } else {
        this.call(() => null);
      }
    }

    const properties = this.keyframes.reduce((map, frame) => {
      for (const property of frame.state.keys()) {
        const isNumber = typeof frame.state.get(property) === 'number';
        if (map.has(property)) {
          map.set(property, isNumber && map.get(property));
        } else {
          map.set(property, isNumber);
        }
      }
      return map;
    }, new Map());

    const interpolatedProperties = new Map<string, Timeline<number>>();
    const uninterpolatedProperties = new Map<string, Timeline<unknown>>();
    properties.forEach((isNumber, property) => {
      const map = isNumber ? interpolatedProperties : uninterpolatedProperties;
      const relevantFrames = this.keyframes.filter((frame) =>
        frame.state.has(property)
      );
      map.set(property, {
        values: relevantFrames.map((frame) => [frame.state.get(property)]),
        times: relevantFrames.map((frame) => frame.time),
      });
    });
    const totalTime = Math.max(
      ...this.keyframes.map((frame) => frame.time),
      ...this.funcs.map((invocation) => invocation.time)
    );

    return new BasicAnimation(
      loop,
      interpolatedProperties,
      uninterpolatedProperties,
      totalTime,
      0,
      this.obj,
      this.interpolation,
      this.funcs
    );
  }

  after(time: number) {
    this.timeToNext += time;
    return this;
  }

  set(state: Map<string, unknown> | object) {
    if (this.timeToNext < 0) {
      throw new Error(`Invalid time between frames: ${this.timeToNext}`);
    }

    this.cumulativeTime += this.timeToNext;
    this.timeToNext = 0;
    this.keyframes.push({
      state: state instanceof Map ? state : new Map(Object.entries(state)),
      time: this.cumulativeTime,
    });

    return this;
  }

  call(func: () => void) {
    if (this.timeToNext < 0)
      throw new Error(`Invalid time between frames: ${this.timeToNext}`);

    this.cumulativeTime += this.timeToNext;
    this.timeToNext = 0;
    this.funcs.push({func, time: this.cumulativeTime});

    return this;
  }

  stay(time: number) {
    if (this.keyframes.length === 0) {
      throw new Error('Set a state before calling stay().');
    }
    if (this.timeToNext != 0) {
      throw new Error('Call stay() immediately after set().');
    }
    if (time < 0) {
      throw new Error(`Invalid time between frames: ${time}`);
    }

    this.cumulativeTime += time;
    this.keyframes.push({
      state: this.keyframes[this.keyframes.length - 1].state,
      time: this.cumulativeTime,
    });

    return this;
  }

  loop() {
    return this.build(/*loop =*/ true);
  }

  done() {
    return this.build(/*loop =*/ false);
  }

  clone() {
    const animation = new BasicAnimationBuilder(this.obj, this.interpolation);
    animation.keyframes = this.keyframes.slice();
    animation.funcs = this.funcs.slice();
    animation.timeToNext = this.timeToNext;
    animation.cumulativeTime = this.cumulativeTime;
    return animation;
  }
}

export class BasicAnimation {
  private objUpdate?: (delta: number) => void;

  /** Don't call this directly, use `BasicAnimationBuilder.build()` instead. */
  constructor(
    private readonly loopOnEnd: boolean,
    private readonly interpolatedProperties: Map<string, Timeline<number>>,
    private readonly uninterpolatedProperties: Map<string, Timeline<unknown>>,
    private totalTime: number,
    private time: number = 0,
    private obj?: GameObjectInterface,
    private readonly interpolation: (
      t: number,
      path: number[][]
    ) => number[] = Splines.interpolateLinear.bind(Splines),
    private readonly funcs: Invocation[] = []
  ) {}

  clone(obj?: GameObjectInterface) {
    return new BasicAnimation(
      this.loopOnEnd,
      new Map(this.interpolatedProperties.entries()),
      new Map(this.uninterpolatedProperties.entries()),
      this.totalTime,
      this.time,
      obj ?? this.obj,
      this.interpolation,
      this.funcs.slice()
    );
  }

  start(obj?: GameObjectInterface) {
    this.obj = obj ?? this.obj;
    if (!this.obj)
      throw new Error('Specify an object to apply the animation to.');

    this.time = 0;
    this.objUpdate = this.obj.update.bind(this.obj);
    this.obj.update = (delta) => {
      if (!this.obj) {
        this.objUpdate?.(delta);
        return;
      }
      const timeNext = this.time + delta / 1000;
      const timeNextInLoop = timeNext % this.totalTime;
      for (const [property, timeline] of this.interpolatedProperties) {
        // TODO: optimize. This linearly searches for the correct time interval,
        // use binsearch instead of leverage that most of the time it will be
        // the same as the last.
        for (let t = 0; t < timeline.times.length - 1; t++) {
          if (
            timeline.times[t] <= timeNextInLoop &&
            timeNextInLoop < timeline.times[t + 1]
          ) {
            const interpol =
              (t +
                (timeNextInLoop - timeline.times[t]) /
                  (timeline.times[t + 1] - timeline.times[t])) /
              (timeline.times.length - 1);
            this.obj[property] = this.interpolation(
              interpol,
              timeline.values
            )[0];
            break;
          }
        }
      }
      for (const [property, timeline] of this.uninterpolatedProperties) {
        // TODO: See above note regarding optimization.
        for (let i = 0; i < timeline.times.length; i++) {
          const value = timeline.values[i];
          const timeToSet = timeline.times[i];
          if (this.time < timeToSet && timeToSet <= timeNext)
            this.obj[property] = value;
        }
      }
      for (const {func, time} of this.funcs) {
        if (this.time < time && time <= timeNext) {
          func();
        }
      }

      this.time = timeNextInLoop;
      if (this.loopOnEnd === false && this.time >= this.totalTime)
        this.cancel();

      this.objUpdate?.(delta);
    };
  }

  cancel() {
    if (!this.objUpdate || !this.obj)
      throw new Error('Animation not currently playing');

    this.obj.update = this.objUpdate;
    this.objUpdate = undefined;
  }
}

/**
 * Define a new animation via a fluent interface.
 * @param obj The object to be animated. Can also be specified later.
 * @param interpolation The interpolation to use between keyframes.
 * @returns A builder that can be used to define the animation.
 */
export function defineAnimation(
  obj?: GameObjectInterface,
  interpolation: Interpolation = Splines.interpolateLinear.bind(Splines)
) {
  return new BasicAnimationBuilder(obj, interpolation);
}
