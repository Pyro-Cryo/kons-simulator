import {State} from './state.js';
import {
  Entity,
  EntityId,
  EntityConstructor,
  ENTITY_TYPES,
  FunctionReference,
} from './entity.js';
import {Clock} from './clock.js';
import {JsonSerializer, NativelySerializable} from '../engine/serialization.js';
import {BaseVariable, VariableId, Serializable, Storable} from './variable.js';
import {Minheap} from '../engine/containers.js';

type VariableMapping = Map<VariableId, Serializable<unknown>>;

interface SerializedEntity {
  id: EntityId;
  [key: string]: VariableId;
}

interface SerializedState {
  variables: [VariableId, NativelySerializable][];
  entities: SerializedEntity[];
  // Maybe store some version id if we want to be super backwards
  // compatible.
}

interface SerializerConfig {
  /**
   * Configures entity serialization to only include an entity ID, omitting all
   * variables, and deserialization to look up an existing entity based on the
   * ID. Used to handle entity references stored in variables.
   */
  minimalEntities: boolean;
  /**
   * Maps serialized variable IDs to newly created variable instances. Used
   * during deserialization to populate variables with their stored values.
   */
  variableMapping: VariableMapping;
  stringifyParams?: StringifyParams;
}

export interface StringifyParams {
  /**
   * Do not serialize variables that are equal to their default value. Results
   * in a smaller serialized string which is equivalent as long as the default
   * values do not change between serialization and deserialization.
   */
  omitDefaultVariables: boolean;
}

function getVariables(entity: Entity): [string, BaseVariable<unknown>][] {
  return Object.entries(entity).filter(
    ([_, value]) => value instanceof BaseVariable
  );
}

const STORED_UNDEFINED = Symbol('undefined');

export class BaseState implements State {
  readonly isPlanning: boolean = false;
  protected readonly variables = new Map<VariableId, unknown>();
  protected readonly entities = new Map<EntityId, Entity>();

  protected nextId: EntityId = 0;
  private clockInstance?: Clock;

  constructor({addClock}: {addClock: boolean}) {
    if (addClock) {
      this.clockInstance = this.create(Clock);
    }
  }

  get clock() {
    if (this.clockInstance === undefined) {
      // Find the clock instance after restoring a saved state via parse().
      for (const entity of this.entities.values()) {
        if (entity instanceof Clock) {
          this.clockInstance = entity;
          break;
        }
      }
      throw new Error(`Base state does not define a clock`);
    }
    return this.clockInstance;
  }

  /** Returns whether the given variable is overridden in the current state. */
  hasVariable<T>(variable: Storable<T>): boolean {
    return this.variables.has(variable.id);
  }

  /**
   * Gets the value of the given variable.
   * @param variable The variable to get the value of.
   * @returns The variable's value, or its default value if it is not set.
   *     Consider it immutable unless you really know what you are doing.
   */
  getVariable<T>(variable: Storable<T>): Readonly<T> {
    const value = this.variables.get(variable.id) as T;
    if (value === undefined) {
      // Behövs nog inte? Iallafall inte så länge defaultValue bara är en const.
      // this.variables.set(variable.id, variable.defaultValue);
      return variable.getDefault();
    }
    return value === STORED_UNDEFINED ? (undefined as T) : value;
  }

  /**
   * Sets the value of the given variable in the current state.
   * @param variable The variable to set the value of.
   * @param value The value to set. Prefer immutable values, or at least
   *     treating them as such.
   */
  setVariable<T>(variable: Storable<T>, value: T): void {
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
  getVariablePatch<T>(variable: Storable<T>): T {
    let patch = this.variables.get(variable.id) as T | undefined;
    if (patch === undefined) {
      patch = variable.getDefault();
      this.variables.set(variable.id, patch);
    }
    return patch;
  }

  /**
   * Yields the variable patch from the current state, if one exists.
   * @param variable The variabe to get the patch for.
   * @param _ Only relevant in the subclass.
   */
  *getVariablePatches<T>(
    variable: Storable<T>,
    _: boolean = false
  ): Generator<T, void, unknown> {
    const value = this.variables.get(variable.id);
    if (value !== undefined) {
      yield value as T;
    }
  }

  create<E extends Entity>(entityClass: EntityConstructor<E>): E {
    const entity = new entityClass(this.nextId++);
    this.entities.set(entity.id, entity);
    return entity;
  }

  destroy(entity: Entity) {
    if (!this.entities.delete(entity.id)) {
      throw new Error(`Entity does not exist in this state: ${entity.id}`);
    }
    for (const [_, variable] of getVariables(entity)) {
      this.variables.delete(variable.id);
    }
  }

  get(id: EntityId) {
    const entity = this.entities.get(id);
    if (!entity) {
      throw new Error(`Entity does not exist in this state: ${id}`);
    }
    return entity;
  }

  *iterate(): Generator<Entity, void, unknown> {
    yield* this.entities.values();
  }

  advance(delta: number) {
    for (const entity of this.iterate()) {
      entity.advance?.(this, delta);
    }
  }

  fork(): State {
    return new DerivedState(this);
  }

  private serializeEntity(
    entity: Entity,
    {minimalEntities, stringifyParams}: SerializerConfig
  ): SerializedEntity {
    if (minimalEntities) {
      return {id: entity.id};
    }
    if (!stringifyParams) {
      throw new Error('Expected stringifyParams to be provided');
    }

    const {omitDefaultVariables} = stringifyParams;
    const variables = getVariables(entity)
      .filter(([_, v]) => v.shouldSerialize(this, omitDefaultVariables))
      .map(([k, v]) => [k, v.id]);
    return {
      id: entity.id,
      ...Object.fromEntries(variables),
    };
  }

  private deserializeEntity(
    entityClass: EntityConstructor,
    serialized: SerializedEntity,
    {minimalEntities, variableMapping}: SerializerConfig
  ): Entity {
    if (minimalEntities) {
      // The entity has already been reconstructed, we just want a reference to
      // it.
      const entity = this.entities.get(serialized.id);
      if (entity === undefined) {
        throw new Error(
          `Expected an object with id ${serialized.id} to already have been ` +
            'serialized'
        );
      }
      if (!(entity instanceof entityClass)) {
        const name = (entity as object).constructor.name;
        throw new Error(
          `Expected object with id ${serialized.id} to have type ` +
            `${entityClass.name}, but got ${name}`
        );
      }
      return entity;
    }

    // Creating a new entity also creates new Var instances, which will likely
    // have other IDs than the ones in `serialized`. The `variableMapping` lets
    // us assign the correct values.
    const entity = new entityClass(serialized.id);
    for (const [key, variable] of getVariables(entity)) {
      const serializedId = serialized[key];
      if (serializedId !== undefined) {
        variableMapping.set(serializedId, variable);
      }
    }
    // Ensure new entities don't get overlapping IDs.
    this.nextId = Math.max(this.nextId, entity.id + 1);
    this.entities.set(entity.id, entity);
    return entity;
  }

  private getSerializer(config: SerializerConfig): JsonSerializer {
    const serializer = new JsonSerializer();
    serializer.addSymbol(STORED_UNDEFINED);
    ENTITY_TYPES.forEach((entityClass) =>
      serializer.addClass(
        entityClass,
        (entity: Entity) => this.serializeEntity(entity, config),
        (serialized) => this.deserializeEntity(entityClass, serialized, config)
      )
    );
    serializer.addSerializableClass(FunctionReference);
    serializer.addSerializableClass(Minheap);
    return serializer;
  }

  stringify({
    omitDefaultVariables = true,
  }: Partial<StringifyParams> = {}): string {
    const entities = Array.from(this.iterate());
    const variables = entities.flatMap((e) =>
      getVariables(e)
        .map(([_, v]) => v)
        .filter((v) => v.shouldSerialize(this, omitDefaultVariables))
        .map((v) => [v.id, v.serialize(this)] as [number, unknown])
    );

    const serializerConfig: SerializerConfig = {
      minimalEntities: false,
      variableMapping: new Map(),
      stringifyParams: {omitDefaultVariables},
    };
    const serializer = this.getSerializer(serializerConfig);
    const serializedEntities = serializer.toNative(entities);
    // Only include the variable ID on entity references stored in variables.
    serializerConfig.minimalEntities = true;
    const serializedVariables = serializer.toNative(variables);
    const serialized = {
      entities: serializedEntities,
      variables: serializedVariables,
    } as SerializedState;

    return JSON.stringify(serialized);
  }

  /**
   * Recreates a state given a string returned from stringify().
   * @param string The serialized state.
   * @returns The recreated state.
   */
  static parse(string: string): State {
    const state = new BaseState({addClock: false});
    const serializerConfig: SerializerConfig = {
      minimalEntities: false,
      variableMapping: new Map(),
    };
    const serializer = state.getSerializer(serializerConfig);

    const serialized = JSON.parse(string) as SerializedState;
    serializer.fromNative(serialized.entities);
    // Entity references in variables only store the ID.
    serializerConfig.minimalEntities = true;
    const variables = new Map(
      serializer.fromNative(serialized.variables) as typeof serialized.variables
    );
    // Entities are automatically added to the state during deserialization, but
    // variables are copied over manually.
    for (const [
      serializedId,
      deserialized,
    ] of serializerConfig.variableMapping.entries()) {
      deserialized.deserialize(state, variables.get(serializedId));
    }
    return state;
  }
}

/**
 * State that has been forked from another, original state (which may, in turn,
 * be a DerivedState as well).
 */
class DerivedState extends BaseState {
  override readonly isPlanning = true;
  private deleted = new Set<EntityId>();

  constructor(private readonly original: BaseState) {
    super({addClock: false});
    // Typescript har tydligen en väldigt konstig tolkning av "protected".
    this.nextId = (original as DerivedState).nextId;
  }

  override get clock() {
    return this.original.clock;
  }

  /**
   * Gets the value of the given variable. If it is not set in this state, it is
   * evaluated in the original state instead.
   * @param variable The variable to get the value of.
   * @returns The variable's value.
   */
  override getVariable<T>(variable: Storable<T>): Readonly<T> {
    const value = this.variables.get(variable.id) as T;
    if (value === undefined) {
      return this.original.getVariable(variable);
    }
    return value === STORED_UNDEFINED ? (undefined as T) : value;
  }

  get(id: EntityId) {
    if (this.deleted.has(id)) {
      throw new Error(`Entity does not exist in this state: ${id}`);
    }
    return this.entities.get(id) ?? this.original.get(id);
  }

  override *iterate(): Generator<Entity, void, unknown> {
    for (const entity of this.original.iterate()) {
      if (!this.deleted.has(entity.id)) {
        yield entity;
      }
    }
    yield* this.entities.values();
  }

  /**
   * Destroys the specified entity instance. It will remain in the original
   * state.
   * @param entity The entity to delete.
   */
  override destroy(entity: Entity): void {
    if (this.entities.has(entity.id)) {
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
  override *getVariablePatches<T>(
    variable: Storable<T>,
    originalFirst: boolean = false
  ): Generator<T, void, unknown> {
    if (originalFirst) {
      yield* this.original.getVariablePatches(variable, originalFirst);
      yield* super.getVariablePatches(variable);
    } else {
      yield* super.getVariablePatches(variable);
      yield* this.original.getVariablePatches(variable, originalFirst);
    }
  }
}

/**
 * Creates a new State, optionally based on a previously stringified state.
 * @param serialized The output of State.stringify(). If provided, the original
 *     state will be recreated.
 */
 export function createState(serialized?: string): State {
  if (serialized !== undefined) {
    return BaseState.parse(serialized);
  }
  return new BaseState({addClock: true});
}
