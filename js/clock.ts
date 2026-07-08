import {GameObject} from './engine/gameObject.js';
import {Minheap} from './engine/containers.js';

export class Watch extends GameObject {
  constructor(
    private readonly element?: HTMLSpanElement,
    private readonly realMillisecondsPerGameMinute: number = 2000
  ) {
    super(0, 0);
    this['_imageDirty'] = false; // Not drawn.
  }

  formatTime(time: number) {
    const hours = Math.floor(time / 60);
    const minutes = Math.floor(time % 60);
    return `${hours < 10 ? '0' + hours : hours}:${
      minutes < 10 ? '0' + minutes : minutes
    }`;
  }

  // Updates the time on the element but does not advance the clock.
  update(_: number): void {
    if (this.element) {
      const timeString = this.formatTime(
        CLOCK.now() / this.realMillisecondsPerGameMinute
      );
      if (this.element.innerText !== timeString) {
        this.element.innerText = timeString;
      }
    }
  }
}

export class Clock {
  constructor(
    private elapsed: number = 0,
    private callbacks: Minheap<() => void> = new Minheap()
  ) {}

  /** The current time since the game started. */
  now() {
    return this.elapsed;
  }

  /** The timestamp a certain amount of time into the future. */
  after(delta: number) {
    return this.now() + delta;
  }

  /**
   * Schedule a callback to be invoked at a certain time.
   * If the timestamp has already passed, the callback is immediately invoked.
   */
  schedule(callback: () => void, time: number) {
    if (time <= this.now()) {
      callback();
    } else {
      this.callbacks.push(callback, time);
    }
  }

  /**
   * Create a promise that is resolved after the given amount of time.
   * If the amount is non-positive, the promise is immediately resolved.
   */
  async waitFor(minutes: number): Promise<void> {
    return await this.waitUntil(this.after(minutes));
  }

  /**
   * Create a promise that is resolved at a certain time.
   * If the timestamp has already passed, the promise is immediately resolved.
   */
  waitUntil(time: number): Promise<void> {
    return new Promise((resolve) => this.schedule(resolve, time));
  }

  advance(delta: number) {
    this.elapsed += delta;

    while (
      !this.callbacks.isEmpty() &&
      this.callbacks.peekWeight() <= this.elapsed
    ) {
      try {
        this.callbacks.pop()();
      } catch (e) {
        console.error(e);
      }
    }
  }
}

export const CLOCK = new Clock();
