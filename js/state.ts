import {JsonSerializer} from './serialization.js';

// export interface State {
//   // create(/* TODO */): EntityReference;
//   // lookup(reference: EntityReference): Entity<never>;
//   // branch(): DerivedState;
//   // advance(delta: number): void;
//   getVariable<T>(variable: Var<T>): T;
//   setVariable<T>(variable: Var<T>, value: T): void;
// }

type EntityId = number;
type VariableId = number;

// class EntityReference {
//   constructor(readonly id: EntityId) {}
// }

type EntityConstructor<E extends Entity = Entity> = new (id: EntityId) => E;
type RecordOrArray<T> = T[] | Record<string, T>;

interface SerializedEntity {
  id: EntityId;
  [key: string]: VariableId;
}

interface SerializedState {
  variables: [VariableId, unknown][];
  entities: Entity[];
  // Maybe store some version id if we want to be super backwards
  // compatible.
}

export class Entity {
  constructor(readonly id: EntityId) {}
}

const entityTypes = new Set<EntityConstructor>();

/** Makes the provided Entity subclass (de-)serializable. */
export function registerEntity<E extends Entity>(
  entityClass: EntityConstructor<E>
) {
  entityTypes.add(entityClass);
}

/**
 * Makes all provided Entity subclasses (de-)serializable. Intended for
 * convenient registration of all exported Entities in an entire module.
 */
export function registerEntities(
  entities: RecordOrArray<EntityConstructor | unknown>
) {
  if (!(entities instanceof Array)) {
    entities = Object.values(entities);
  }
  for (const entityClass of entities) {
    if (isEntityClass(entityClass)) {
      registerEntity(entityClass);
    }
  }
}

function isEntityClass(object: unknown): object is EntityConstructor {
  if (typeof object !== "function") {
    return false;
  }
  while (object !== null) {
    if (object === Entity) {
      return true;
    }
    object = Object.getPrototypeOf(object);
  }
  return false;
}

function getVariables(
  entity: Entity
): [string, Var<unknown> | SetVar<unknown>][] {
  return Object.entries(entity).filter(
    ([_, value]) => value instanceof Var || value instanceof SetVar
  );
}

const STORED_UNDEFINED = Symbol('undefined');

class BaseState {
  protected readonly variables = new Map<VariableId, unknown>();
  protected readonly entities = new Set<Entity>();

  protected nextId: EntityId = 0;

  /**
   * Gets the value of the given variable.
   * @param variable The variable to get the value of.
   * @returns The variable's value, or its default value if it is not set.
   *     Consider it immutable unless you really know what you are doing.
   */
  getVariable<T>(variable: Var<T>): Readonly<T> {
    const value = this.variables.get(variable.id) as T;
    if (value === undefined) {
      // Behövs nog inte? Iallafall inte så länge defaultValue bara är en const.
      // this.variables.set(variable.id, variable.defaultValue);
      return variable.defaultValue;
    }
    return value === STORED_UNDEFINED ? (undefined as T) : value;
  }

  /**
   * Sets the value of the given variable in the current state.
   * @param variable The variable to set the value of.
   * @param value The value to set. Prefer immutable values, or at least
   *     treating them as such.
   */
  setVariable<T>(variable: Var<T>, value: T): void {
    this.variables.set(
      variable.id,
      value === undefined ? STORED_UNDEFINED : value
    );
  }

  /**
   * Gets a "variable patch" from the current state, creating a new one if none
   * exists. Variable patches are used to form collections by combining the
   * patches in the state chain. For example:
   * - BaseState A: `backpackContents = {pencil, lunchbox, book}`
   *   - DerivedState B: `backpackContents = {-lunchbox}`
   *     - DerivedState C: `backpackContents = {+emptyLunchbox, -book}`
   *
   * In B, the `backpackContents` are effectively `{pencil, book}`, and in C
   * they are `{pencil, emptyLunchbox}`.
   * @param variable The variable to get the patch for.
   * @returns The variable patch, or undefined if none exists.
   */
  getVariablePatch<T extends object>(variable: Var<T>): Partial<T> {
    let patch = this.variables.get(variable.id) as Partial<T> | undefined;
    if (patch === undefined) {
      patch = {};
      this.variables.set(variable.id, patch);
    }
    return patch;
  }

  /**
   * Yields the variable patch from the current state, if one exists.
   * @param variable The variabe to get the patch for.
   * @param _ Only relevant in the subclass.
   */
  *getVariablePatches<T extends object>(
    variable: Var<T>,
    _: boolean = false
  ): Generator<Partial<T>, void, unknown> {
    const value = this.variables.get(variable.id);
    if (value !== undefined) {
      yield value as T;
    }
  }

  /**
   * Creates an instance of the specified entity class.
   * @param entityClass The class to instantiate.
   * @returns The new instance.
   */
  create<E extends Entity>(entityClass: EntityConstructor<E>): E {
    const entity = new entityClass(this.nextId++);
    this.entities.add(entity);
    return entity;
  }

  /**
   * Destroys the specified entity instance.
   * @param entity The entity to delete.
   */
  destroy(entity: Entity) {
    // TODO: Handle entity references
    // TODO: Clean up its variables?
    if (!this.entities.delete(entity)) {
      throw new Error(`Entity does not exist in this state: ${entity.id}`);
    }
  }

  /** Iterates over all entities that exist in the current state. */
  *iterate(): Generator<Entity, void, unknown> {
    yield* this.entities;
  }

  /**
   * Creates a new derived state based on the current state. It is assumed that
   * the current state is not modified as long as the derived state is in use.
   * @returns A new state that can be updated independently of this state.
   */
  fork(): State {
    return new DerivedState(this);
  }

  private serializeEntity(entity: Entity): SerializedEntity {
    return {
      id: entity.id,
      ...Object.fromEntries(
        getVariables(entity).map(([key, variable]) => [key, variable.id])
      ),
    };
  }

  private deserializeEntity(
    entityClass: EntityConstructor,
    serialized: SerializedEntity,
    variableMapping: Map<VariableId, VariableId>
  ): Entity {
    // Creating a new entity also creates new Var instances, which will likely
    // have other IDs than the ones in `serialized`. The `variableMapping` lets
    // us assign the correct values.
    const entity = new entityClass(serialized.id);
    for (const [key, variable] of getVariables(entity)) {
      const serializedId = serialized[key];
      if (serializedId !== undefined) {
        variableMapping.set(serializedId, variable.id);
      }
    }
    // Ensure new entities don't get overlapping IDs.
    this.nextId = Math.max(this.nextId, entity.id + 1);
    this.entities.add(entity);
    return entity;
  }

  private getSerializer(): [JsonSerializer, Map<VariableId, VariableId>] {
    const serializer = new JsonSerializer();
    const variableMapping = new Map<VariableId, VariableId>();
    serializer.addSymbol(STORED_UNDEFINED);
    entityTypes.forEach((entityClass) =>
      serializer.addClass(
        entityClass,
        (entity: Entity) => this.serializeEntity(entity),
        (serialized) =>
          this.deserializeEntity(entityClass, serialized, variableMapping)
      )
    );
    return [serializer, variableMapping];
  }

  /**
   * Serializes the current state to a JSON string. Use createState() to
   * recreate it.
   * @returns A string that can be used to restore this state.
   */
  stringify(): string {
    const entities = Array.from(this.iterate());
    // TODO: Handle SetVar (and future others).
    const variables = entities.flatMap((e) =>
      getVariables(e).map(
        ([_, variable]) =>
          [variable.id, variable.get(this)] as [number, unknown]
      )
    );
    const serializedState: SerializedState = {variables, entities};
    const [serializer, _] = this.getSerializer();
    return serializer.stringify(serializedState);
  }

  /**
   * Recreates a state given a string returned from stringify().
   * @param string The serialized state.
   * @returns The recreated state.
   */
  static parse(string: string): State {
    const state = new BaseState();
    const [serializer, variableMapping] = state.getSerializer();
    const variables = new Map(
      (serializer.parse(string) as SerializedState).variables
    );
    // Entities are automatically added to the state during deserialization, but
    // variables are copied over manually.
    for (const [serializedId, deserializedId] of variableMapping.entries()) {
      // TODO: This will not work for SetVar.
      state.variables.set(deserializedId, variables.get(serializedId));
    }
    return state;
  }
}

/**
 * State that has been forked from another, original state (which may, in turn,
 * be a DerivedState as well).
 */
class DerivedState extends BaseState {
  private deleted = new Set<EntityId>();

  constructor(private readonly original: BaseState) {
    super();
    // Typescript har tydligen en väldigt konstig tolkning av "protected".
    this.nextId = (original as DerivedState).nextId;
  }

  /**
   * Gets the value of the given variable. If it is not set in this state, it is
   * evaluated in the original state instead.
   * @param variable The variable to get the value of.
   * @returns The variable's value.
   */
  override getVariable<T>(variable: Var<T>): Readonly<T> {
    const value = this.variables.get(variable.id) as T;
    if (value === undefined) {
      return this.original.getVariable(variable);
    }
    return value === STORED_UNDEFINED ? (undefined as T) : value;
  }

  override *iterate(): Generator<Entity, void, unknown> {
    for (const entity of this.original.iterate()) {
      if (!this.deleted.has(entity.id)) {
        yield entity;
      }
    }
    yield* this.entities;
  }

  /**
   * Destroys the specified entity instance. It will remain in the original
   * state.
   * @param entity The entity to delete.
   */
  override destroy(entity: Entity): void {
    if (this.entities.has(entity)) {
      // Entity created in this derived state, we can simply remove it.
      super.destroy(entity);
    }
    // Entity in parent state, register it as removed.
    this.deleted.add(entity.id);
  }

  /**
   * Yields all variable patches from the state chain. Unset patches are
   * omitted.
   * @param variable The variabe to get the patches for.
   * @param originalFirst If true, the patches are yielded first from the
   *     original state, then the first derived state, and so on. The default is
   *     to iterate "backwards", i.e. yield the current state's patch before its
   *     original.
   */
  override *getVariablePatches<T extends object>(
    variable: Var<T>,
    originalFirst: boolean = false
  ): Generator<Partial<T>, void, unknown> {
    if (originalFirst) {
      yield* super.getVariablePatches(variable);
      yield* this.original.getVariablePatches(variable, originalFirst);
    } else {
      yield* this.original.getVariablePatches(variable, originalFirst);
      yield* super.getVariablePatches(variable);
    }
  }
}

/**
 * Public API of states. Must be created via createState or State.fork().
 */
export type State = Pick<
  BaseState,
  'create' | 'destroy' | 'iterate' | 'stringify' | 'fork'
>;

/**
 * Creates a new State, optionally based on a previously stringified state.
 * @param serialized The output of State.stringify(). If provided, the original
 *     state will be recreated.
 */
export function createState(serialized?: string): State {
  if (serialized !== undefined) {
    return BaseState.parse(serialized);
  }
  return new BaseState();
}

// Variable definition
export class Var<T> {
  private static nextId = 0;

  public readonly id: number = Var.nextId++;

  constructor(public readonly defaultValue: T) {}

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
   * Sets the value of the given variable in the provided state.
   * @param state The state to set the variable in.
   * @param value The value to set. Prefer immutable values, or at least
   *     treating them as such.
   */
  set(state: State, value: T) {
    (state as BaseState).setVariable(this, value);
  }
}

/** Frozen empty patch, to prevent accidental modification. */
const DEFAULT_FOR_PATCH = Object.freeze({});

// Patches for a Set variable.
interface SetPatch<T> {
  // Add the specified elements from the cumulative set.
  '+'?: Set<T>;
  // Remove the specified elements from the cumulative set.
  '-'?: Set<T>;
}

/**
 * Unordered collection that requires less memory overhead when forking states,
 * given that the collection is fairly large in the original state and the
 * derived state chain makes fairly small adjustments.
 *
 * You are probably better off with a plain `Var<Set<T>>` if any of the
 * following apply:
 * - The collection is known to be small (so that copying it incurs little
 *   overhead).
 * - Derived states are likely to replace most of its content.
 * - You need anything other than addition, removal, and checking for presence.
 *   For example, checking the size of the collection.
 */
export class SetVar<T> {
  private readonly variable = new Var<SetPatch<T>>(DEFAULT_FOR_PATCH);
  public readonly id = this.variable.id;

  /** Add the value to the set in the given state. */
  add(state: State, value: T) {
    let patch = (state as BaseState).getVariablePatch(this.variable);
    if (patch === undefined) {
      patch = {'+': new Set()};
    }
    patch['-']?.delete(value);
    (patch['+'] ??= new Set()).add(value);
  }

  /** Remove the value from the set in the given state. */
  delete(state: State, value: T) {
    let patch = (state as BaseState).getVariablePatch(this.variable);
    if (patch === undefined) {
      patch = {'-': new Set()};
    }
    patch['+']?.delete(value);
    (patch['-'] ??= new Set()).add(value);
  }

  /** Check if the set contains the value in the given state. */
  has(state: State, value: T): boolean {
    for (const patch of (state as BaseState).getVariablePatches<SetPatch<T>>(
      this.variable
    )) {
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
  get(state: State): Set<T> {
    const result = new Set<T>();
    for (const patch of (state as BaseState).getVariablePatches(
      this.variable,
      true
    )) {
      patch['+']?.forEach((element) => result.add(element));
      patch['-']?.forEach((element) => result.delete(element));
    }
    return result;
  }
  // TODO: Borde gå att implementera en hyfsat okej *iterate().
}

/** Only for use in tests. */
export const TEST_ONLY = {BaseState, DerivedState};

// Test

export class Lunchbox extends Entity {
  readonly temperature = new Var(20);
  // advance(state: State, delta: number) {}

  heat(state: State) {
    this.temperature.set(state, 30);
  }
}

export class TastyLunchbox extends Lunchbox {
  readonly tasteRating = new Var(5);
}

// Register exported entities.
import * as thisModule from './state.js';
registerEntities(thisModule);
