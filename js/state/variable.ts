import {State} from './state.js';

export type VariableId = number;

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
  implements Storable<Stored>, Serializable<Serialized>
{
  private static nextId = 0;
  public readonly id: VariableId = BaseVariable.nextId++;
  abstract getDefault(): Stored;

  abstract get(state: State): T;
  abstract set(state: State, value: T): void;

  abstract shouldSerialize(
    state: State,
    omitDefaultVariables: boolean
  ): boolean;
  abstract serialize(state: State): Serialized;
  abstract deserialize(state: State, serialized: Serialized): void;
}
