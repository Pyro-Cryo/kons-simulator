import type {State} from './state.js';

export type EntityId = number;
export type EntityConstructor<E extends Entity = Entity> = new (
  id: EntityId
) => E;
type RecordOrArray<T> = T[] | Record<string, T>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Callable<R = void> = (...args: any[]) => R;

export interface Advancable {
  advance(state: State, delta: number): void;
}

export class Entity implements Partial<Advancable> {
  advance?(state: State, delta: number): void;
  constructor(readonly id: EntityId) {}
}

export const ENTITY_TYPES: ReadonlySet<EntityConstructor> =
  new Set<EntityConstructor>();

function isEntityClass(object: unknown): object is EntityConstructor {
  if (typeof object !== 'function') {
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

/** Makes the provided Entity subclass (de-)serializable. */
export function registerEntity<E extends Entity>(
  entityClass: EntityConstructor<E>
) {
  (ENTITY_TYPES as Set<EntityConstructor>).add(entityClass);
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

export interface Invocable<T extends Array<unknown>> {
  invoke(state: State, ...args: T): void;
}

// TODO: Add a variant with bound arguments?
export class FunctionReference<
  E extends Entity & {[P in Name]: Callable},
  Name extends keyof E
> {
  constructor(readonly entity: E, readonly member: Name) {}

  invoke(...data: Parameters<E[Name]>) {
    this.entity[this.member](...data);
  }

  serialize(): [E, Name] {
    return [this.entity, this.member];
  }

  static deserialize<
    E extends Entity & {[P in Name]: Callable},
    Name extends keyof E
  >([entity, member]: [E, Name]) {
    return new FunctionReference(entity, member);
  }
}
