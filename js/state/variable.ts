import {State} from './state.js';

export type VariableId = number;

export interface Gettable<T> {
  get(state: State): Readonly<T>;
}

export interface Settable<T> extends Gettable<T> {
  set(state: State, value: T): void;
}

export interface Storable<T> {
  id: VariableId;
  getDefault(): T;
}

export interface Serializable<T> {
  shouldSerialize(state: State, omitDefaultVariables: boolean): boolean;
  serialize(state: State): T;
  deserialize(state: State, serialized: T): void;
}

export abstract class BaseVariable<T, Stored = T, Serialized = T>
  implements Settable<T>, Storable<Stored>, Serializable<Serialized>
{
  private static nextId = 0;
  public readonly id: VariableId = BaseVariable.nextId++;
  abstract getDefault(): Stored;

  abstract get(state: State): Readonly<T>;
  abstract set(state: State, value: T): void;

  abstract shouldSerialize(
    state: State,
    omitDefaultVariables: boolean
  ): boolean;
  abstract serialize(state: State): Serialized;
  abstract deserialize(state: State, serialized: Serialized): void;
}
