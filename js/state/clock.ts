import {Minheap} from '../engine/containers.js';
import {
  Advancable,
  Entity,
  FunctionReference,
  Invocable,
  registerEntities,
} from './entity.js';
import {variable} from './variableImpl.js';
import type {State} from './state.js';

export class Clock extends Entity implements Advancable {
  private readonly scheduled = variable(new Minheap<Invocable<[]>>());
  private readonly elapsed = variable(0);

  getElapsed(state: State): number {
    return this.elapsed.get(state);
  }

  after(state: State, delta: number): number {
    return this.elapsed.get(state) + delta;
  }

  scheduleAt<
    E extends Entity & {[P in Name]: (state: State) => void},
    Name extends keyof E
  >(state: State, entity: E, member: Name, timestamp: number): void {
    const invocable = new FunctionReference(entity, member);
    this.scheduled.getMutable(state).push(invocable, timestamp);
  }

  scheduleAfter<
    E extends Entity & {[P in Name]: (state: State) => void},
    Name extends keyof E
  >(state: State, entity: E, member: Name, delta: number): void {
    this.scheduleAt(state, entity, member, this.after(state, delta));
  }

  advance(state: State, delta: number): void {
    const elapsed = this.elapsed.get(state) + delta;
    this.elapsed.set(state, elapsed);

    let scheduled = this.scheduled.get(state);
    if (!scheduled.isEmpty() && scheduled.peekWeight() <= elapsed) {
      // We will need to modify the heap.
      scheduled = this.scheduled.getMutable(state);
    }
    while (!scheduled.isEmpty() && scheduled.peekWeight() <= elapsed) {
      scheduled.pop().invoke(state);
    }
  }
}

import * as thisModule from './clock.js';
registerEntities(thisModule);
