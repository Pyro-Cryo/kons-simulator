import {Invocable, Entity, FunctionReference} from './entity.js';
import {State} from './state.js';
import {BaseVariable, Storable, Serializable} from './variable.js';
import {BaseState} from './stateImpl.js';

interface Copyable {
  copy(): this;
}

class SimpleVariable<T> extends BaseVariable<T> {
  private onChange?: SignalInterface<[T]>;
  constructor(public readonly defaultValue: T) {
    super();
  }

  /**
   * Gets the value of the given variable.
   * @param state The state to get the variable from.
   * @returns The variable's value, or its default value if it is not set.
   *     Consider it immutable unless you really know what you are doing.
   */
  get(state: State): Readonly<T> {
    return (state as BaseState).getVariable(this);
  }

  /**
   * Gets the value of the given variable that is safe to edit, making a copy if
   * necessary.
   * @param state The state to get the variable from.
   * @returns The variable's value, or its default value if it is not set.
   */
  getMutable(state: State): T {
    if ((state as BaseState).hasVariable(this)) {
      return this.get(state);
    }
    const original = this.get(state);
    if (original === null || original === undefined) {
      return original;
    }
    const copy = (original as T & Copyable).copy();
    this.set(state, copy);
    return copy;
  }

  /**
   * Sets the value of the given variable in the provided state.
   * @param state The state to set the variable in.
   * @param value The value to set. Prefer immutable values, or at least
   *     treating them as such.
   */
  set(state: State, value: T) {
    (state as BaseState).setVariable(this, value);
    this.onChange?.invoke(state, value);
  }

  /**
   * Gets a signal that is invoked whenever this value is `set()`. Changes to
   * mutable values (via `getMutable()`) are not captured. The result must be
   * stored on an entity to persist after serialization.
   */
  onChangeSignal(): SignalInterface<[T]> {
    this.onChange ??= signal();
    return this.onChange;
  }

  getDefault(): Readonly<T> {
    return this.defaultValue;
  }

  shouldSerialize(state: State, omitDefaultVariables: boolean): boolean {
    return !omitDefaultVariables || this.get(state) !== this.getDefault();
  }

  serialize = this.get;

  deserialize(state: State, serialized: T): void {
    // Same as get(), except we don't invoke the onChange signal.
    (state as BaseState).setVariable(this, serialized);
  }
}

// Patches for a Set variable.
interface SetPatch<T> {
  // Add the specified elements to the cumulative set.
  '+'?: Set<T>;
  // Remove the specified elements from the cumulative set.
  '-'?: Set<T>;
}

class SetVariable<T> extends BaseVariable<ReadonlySet<T>, SetPatch<T>> {
  getDefault(): SetPatch<T> {
    return {};
  }

  /** Adds the value to the set in the given state. */
  add(state: State, value: T) {
    const patch = (state as BaseState).getVariablePatch(this);
    patch['-']?.delete(value);
    (patch['+'] ??= new Set()).add(value);
  }

  /** Removes the value from the set in the given state. */
  delete(state: State, value: T) {
    const patch = (state as BaseState).getVariablePatch(this);
    patch['+']?.delete(value);
    if (state.isPlanning) {
      (patch['-'] ??= new Set()).add(value);
    }
  }

  /** Checks if the set contains the value in the given state. */
  has(state: State, value: T): boolean {
    for (const patch of (state as BaseState).getVariablePatches(this)) {
      if (patch['+']?.has(value)) {
        // Patch adds the value. Potential additions and/or deletions higher up
        // in the chain are not relevant.
        return true;
      }
      if (patch['-']?.has(value)) {
        // Patch explicitly removes the value.
        return false;
      }
    }
    // Not found in any of the patches, so it does not exist.
    return false;
  }

  /** Creates an equivalent Set based on the given state. */
  get(state: State): ReadonlySet<T> {
    if (!state.isPlanning) {
      // We don't need to assemble the cumulative set for base states.
      return (
        (state as BaseState).getVariablePatches(this).next().value?.['+'] ??
        new Set()
      );
    }

    const result = new Set<T>();
    for (const patch of (state as BaseState).getVariablePatches(this, true)) {
      patch['+']?.forEach((element) => result.add(element));
      patch['-']?.forEach((element) => result.delete(element));
    }
    return result;
  }

  /** Removes all elements from the set. */
  clear(state: State) {
    const patch = (state as BaseState).getVariablePatch(this);
    delete patch['+'];
    patch['-'] = this.get(state) as Set<T>;
    if (patch['-'].size === 0) {
      delete patch['-'];
    }
  }

  /** Overwrites the set. */
  set(state: State, values: Set<T>) {
    this.clear(state);
    const patch = (state as BaseState).getVariablePatch(this);
    patch['+'] = values;
  }

  shouldSerialize(state: State, _: boolean): boolean {
    // The empty set is always the default, so only serialize this variable if
    // it actually contains anything.
    for (const _ of (state as BaseState).getVariablePatches(this)) {
      return true;
    }
    return false;
  }

  serialize = this.get;
  deserialize = this.set;
}

// Patches for a Map variable.
interface MapPatch<K, V> {
  // Add the specified elements to the cumulative map.
  '+'?: Map<K, V>;
  // Remove the specified keys from the cumulative map.
  '-'?: Set<K>;
}

class MapVariable<K, V> extends BaseVariable<
  ReadonlyMap<K, V>,
  MapPatch<K, V>
> {
  getDefault(): MapPatch<K, V> {
    return {};
  }

  // We need set() to match the BaseVariable protocol, so this gets a different
  // name.
  /** Adds the value to the map in the given state (`Map.set()` equivalent). */
  setValue(state: State, key: K, value?: V) {
    const patch = (state as BaseState).getVariablePatch(this);
    patch['-']?.delete(key);
    (patch['+'] ??= new Map()).set(key, value);
  }

  /** Removes the key from the map in the given state. */
  delete(state: State, key: K) {
    const patch = (state as BaseState).getVariablePatch(this);
    patch['+']?.delete(key);
    if (state.isPlanning) {
      (patch['-'] ??= new Set()).add(key);
    }
  }

  /** Checks if the map contains the key in the given state. */
  has(state: State, key: K): boolean {
    for (const patch of (state as BaseState).getVariablePatches(this)) {
      if (patch['+']?.has(key)) {
        // Patch adds the key. Potential additions and/or deletions higher up in
        // the chain are not relevant.
        return true;
      }
      if (patch['-']?.has(key)) {
        // Patch explicitly removes the value.
        return false;
      }
    }
    // Not found in any of the patches, so it does not exist.
    return false;
  }

  /** Creates an equivalent Map based on the given state. */
  get(state: State): ReadonlyMap<K, V> {
    if (!state.isPlanning) {
      // We don't need to assemble the cumulative set for base states.
      return (
        (state as BaseState).getVariablePatches(this).next().value?.['+'] ??
        new Map()
      );
    }

    const result = new Map<K, V>();
    for (const patch of (state as BaseState).getVariablePatches(this, true)) {
      patch['+']?.forEach((value, key) => result.set(key, value));
      patch['-']?.forEach((key) => result.delete(key));
    }
    return result;
  }

  /** Removes all elements from the set. */
  clear(state: State) {
    const patch = (state as BaseState).getVariablePatch(this);
    delete patch['+'];
    patch['-'] = new Set(this.get(state).keys());
    if (patch['-'].size === 0) {
      delete patch['-'];
    }
  }

  /** Overwrites the map. */
  set(state: State, map: Map<K, V>) {
    this.clear(state);
    const patch = (state as BaseState).getVariablePatch(this);
    patch['+'] = map;
  }

  shouldSerialize(state: State, _: boolean): boolean {
    // The empty set is always the default, so only serialize this variable if
    // it actually contains anything.
    for (const _ of (state as BaseState).getVariablePatches(this)) {
      return true;
    }
    return false;
  }

  serialize = this.get;
  deserialize = this.set;
}

// TODO: Add helpers for making derived signals?
class Signal<T extends Array<unknown>>
  extends MapVariable<number, Invocable<T>>
  implements Invocable<T>
{
  protected nextId = 0;

  // Assuming that derived signals are always stored as fields on entities, and
  // never created dynamically, we can use a regular field here.
  private ephemeralCallbacks = new Set<(state: State, ...args: T) => void>();

  override setValue(
    state: State,
    key: number,
    value?: Invocable<T> | undefined
  ): void {
    if (key >= this.nextId) {
      this.nextId++;
    }
    super.setValue(state, key, value);
  }

  override set(state: State, map: Map<number, Invocable<T>>): void {
    let max = this.nextId - 1;
    for (const key of map.keys()) {
      max = key > max ? key : max;
    }
    this.nextId = max + 1;
    super.set(state, map);
  }

  // TODO: Add a oneshot variant?
  attach<
    E extends Entity & {[P in Name]: (state: State, ...args: T) => void},
    Name extends keyof E,
  >(state: State, entity: E, member: Name): number {
    const handle = this.nextId;
    this.setValue(state, handle, new FunctionReference(entity, member));
    return handle;
  }

  detach(state: State, handle: number) {
    this.delete(state, handle);
  }

  invoke(state: State, ...data: T) {
    for (const invocable of this.get(state).values()) {
      try {
        invocable.invoke(state, ...data);
      } catch (e) {
        console.error(e);
      }
    }
  }

  derive<R extends Array<unknown> = T>({
    filter,
    map,
  }: {
    filter?: (state: State, ...args: T) => boolean;
    map?: (state: State, ...args: T) => R;
  }): SignalInterface<R> {
    const derivedSignal = signal<R>();
    this.ephemeralCallbacks.add((state: State, ...args: T) => {
      if (filter && !filter(state, ...args)) {
        return;
      }
      const mappedArgs = map ? map(state, ...args) : args;
      derivedSignal.invoke(state, ...mappedArgs as R);
    });

    return derivedSignal;
  }
}

export type MutableSimpleVariableInterface<
  T extends Copyable | null | undefined,
> = Omit<SimpleVariable<T>, keyof (Serializable<T> & Storable<T>)>;
export type SimpleVariableInterface<T> = Omit<
  SimpleVariable<T>,
  keyof (Serializable<T> & Storable<T>) | 'getMutable'
>;
export type SetVariableInterface<T> = Omit<
  SetVariable<T>,
  keyof (Serializable<ReadonlySet<T>> & Storable<SetPatch<T>>)
>;
export type MapVariableInterface<K, V> = Omit<
  MapVariable<K, V>,
  keyof (Serializable<ReadonlyMap<K, V>> & Storable<MapPatch<K, V>>)
>;
export type SignalInterface<T extends Array<unknown> = []> = Pick<
  Signal<T>,
  'attach' | 'delete' | 'invoke'
>;

/** Variable storing a serializable value. */
export function variable<T extends Copyable | null | undefined>(
  defaultValue: T
): MutableSimpleVariableInterface<T>;
export function variable<T>(defaultValue: T): SimpleVariableInterface<T>;
export function variable<T>(defaultValue: T): unknown {
  return new SimpleVariable(defaultValue);
}

/**
 * Unordered collection that requires less memory overhead when forking states,
 * given that the collection is fairly large in the original state and the
 * derived state chain makes fairly small adjustments.
 *
 * You are probably better off with a plain `variable<Set<T>>()` if any of the
 * following apply:
 * - The collection is known to be small (so that copying it incurs little
 *   overhead).
 * - Derived states are likely to replace most of its content.
 * - You need anything other than addition, removal, and checking for presence.
 *   For example, checking the size of the collection.
 */
export function setVariable<T>(): SetVariableInterface<T> {
  return new SetVariable();
}

/** Map equivalent of `setVariable()`. The same considerations apply. */
export function mapVariable<K, V>(): MapVariableInterface<K, V> {
  return new MapVariable();
}

/** A set of references to entity methods, which may be invoked together. */
export function signal<T extends Array<unknown> = []>(): SignalInterface<T> {
  return new Signal<T>();
}
