import {Signal} from './signaling';

export type VariableId = number;

export interface Gettable<T> {
  get(): Readonly<T>;
}

export interface Settable<T> extends Gettable<T> {
  set(value: T): void;
}

export interface Serializable<T> {
  shouldSerialize(omitDefaultVariables: boolean): boolean;
  serialize(): T;
  deserialize(serialized: T): void;
}

export abstract class BaseVariable<T, Serialized = Readonly<T>>
  implements Settable<T>, Serializable<Serialized>
{
  private static nextId = 0;
  public readonly id: VariableId = BaseVariable.nextId++;

  abstract get(): Readonly<T>;
  abstract set(value: T): void;

  abstract shouldSerialize(omitDefaultVariables: boolean): boolean;
  abstract serialize(): Serialized;
  abstract deserialize(serialized: Serialized): void;
}

export interface VariableUpdate<T> {
  readonly from: T;
  readonly to: T;
}

export class Variable<T> extends BaseVariable<T> {
  private value: T;
  public readonly onValue = new Signal<Readonly<T>>();
  public readonly onChange = new Signal<VariableUpdate<Readonly<T>>>();

  constructor(private initialValue: T) {
    super();
    this.value = initialValue;
  }

  get(): Readonly<T> {
    return this.value;
  }
  set(value: T): void {
    const update = {from: this.value, to: value};
    this.value = value;
    this.onValue.invoke(value);
    this.onChange.invoke(update);
  }

  shouldSerialize(omitDefaultVariables: boolean): boolean {
    return !(omitDefaultVariables && this.value === this.initialValue);
  }
  serialize(): Readonly<T> {
    return this.get();
  }
  deserialize(serialized: Readonly<T>): void {
    this.value = serialized;
  }
}
