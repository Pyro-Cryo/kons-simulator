import {State} from './state.js';
import {Settable} from './variable.js';
import {SignalInterface} from './variableImpl.js';

export type CoordinatePair = [number, number];
export type Position = CoordinatePair | null | Positionable;

export interface Positionable {
  readonly position: Settable<Position>;
}

export interface PositionableSignals {
  readonly onPosition: SignalInterface<[Position]>;
}

export interface Containable {
  readonly container: Settable<Container | null>;
}

export interface ContainableSignals {
  readonly onContainer: SignalInterface<[Container | null]>;
}

export interface Container {
  /** Whether the item could be added to the container. */
  fits(state: State, item: Containable): boolean;
  /** Adds the item to the container and updates the item's `container`. */
  add(state: State, item: Containable): void;
  /** Whether the item is in the container. */
  has(state: State, item: Containable): boolean;
  /** Removes the item from the container and updates item's `container`. */
  remove(state: State, item: Containable): void;
}

export interface ContainerSignals {
  readonly onItemAdded: SignalInterface<[Containable]>;
  readonly onItemRemoved: SignalInterface<[Containable]>;
}
