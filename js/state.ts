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

const ROOT_PROTOTYPE = Object.getPrototypeOf(Object);

function isEntityClass(object: unknown): object is EntityConstructor {
  while (object !== ROOT_PROTOTYPE) {
    if (object === Entity) {
      return true;
    }
    object = Object.getPrototypeOf(object);
  }
  return false;
}

function getVariables(entity: Entity): [string, Var<unknown>][] {
  return Object.entries(entity).filter(([_, value]) => value instanceof Var);
}

const STORED_UNDEFINED = Symbol('undefined');

export class State {
  protected readonly variables = new Map<VariableId, unknown>();
  protected readonly entities = new Set<Entity>();

  protected nextId: EntityId = 0;

  getVariable<T>(variable: Var<T>): T {
    const value = this.variables.get(variable.id) as T;
    if (value === undefined) {
      // Behövs nog inte? Iallafall inte så länge defaultValue bara är en const.
      // this.variables.set(variable.id, variable.defaultValue);
      return variable.defaultValue;
    }
    return value === STORED_UNDEFINED ? (undefined as T) : value;
  }

  setVariable<T>(variable: Var<T>, value: T): void {
    this.variables.set(
      variable.id,
      value === undefined ? STORED_UNDEFINED : value
    );
  }

  create<E extends Entity>(entityClass: EntityConstructor<E>): E {
    const entity = new entityClass(this.nextId++);
    this.entities.add(entity);
    return entity;
  }

  destroy(entity: Entity) {
    // TODO: Handle entity references
    if (!this.entities.delete(entity)) {
      throw new Error(`Entity does not exist in this state: ${entity.id}`);
    }
  }

  *iterate() {
    yield* this.entities;
  }

  fork(): DerivedState {
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

  stringify(): string {
    const entities = Array.from(this.iterate());
    const variables = entities.flatMap((e) =>
      getVariables(e).map(
        ([_, variable]) =>
          [variable.id, this.getVariable(variable)] as [number, unknown]
      )
    );
    const serializedState: SerializedState = {variables, entities};
    const [serializer, _] = this.getSerializer();
    return serializer.stringify(serializedState);
  }

  static parse(string: string): State {
    const state = new State();
    const [serializer, variableMapping] = state.getSerializer();
    const variables = new Map(
      (serializer.parse(string) as SerializedState).variables
    );
    // Entities are automatically added to the state during deserialization, but
    // variables are copied over manually.
    for (const [serializedId, deserializedId] of variableMapping.entries()) {
      state.variables.set(deserializedId, variables.get(serializedId));
    }
    return state;
  }
}

class DerivedState extends State {
  private deleted = new Set<EntityId>();

  constructor(private readonly original: State) {
    super();
    // Typescript har tydligen en väldigt konstig tolkning av "protected".
    this.nextId = (original as DerivedState).nextId;
  }

  override getVariable<T>(variable: Var<T>): T {
    const value = this.variables.get(variable.id) as T;
    if (value === undefined) {
      return this.original.getVariable(variable);
    }
    return value === STORED_UNDEFINED ? (undefined as T) : value;
  }

  override *iterate() {
    for (const entity of this.original.iterate()) {
      if (!this.deleted.has(entity.id)) {
        yield entity;
      }
    }
    yield* this.entities;
  }

  override destroy(entity: Entity): void {
    if (this.entities.has(entity)) {
      // Entity created in this derived state, we can simply remove it.
      super.destroy(entity);
    }
    // Entity in parent state, register it as removed.
    this.deleted.add(entity.id);
  }
}

// Variable definition
export class Var<T> {
  private static nextId = 0;

  public readonly id: number;

  constructor(public readonly defaultValue: T) {
    this.id = Var.nextId++;
  }

  get(state: State): T {
    return state.getVariable(this);
  }

  set(state: State, value: T) {
    state.setVariable(this, value);
  }
}

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
