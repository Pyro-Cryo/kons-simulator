import type {Clock} from './clock.js';
import type {Entity, EntityConstructor} from './entity.js';
import type {StringifyParams} from './stateImpl.js';

/**
 * Public API of states. Must be created via createState or State.fork().
 */
export interface State {
  /** Whether this state is a derived planning state or the base state. */
  isPlanning: boolean;
  /**
   * Creates a new derived state based on the current state. It is assumed that
   * the current state is not modified as long as the derived state is in use.
   * @returns A new state that can be updated independently of this state.
   */
  fork(): State;

  /** The state's clock, which can be used to schedule callbacks. */
  clock: Clock;
  /** Advances the clock and all advancable entities by the specified amount. */
  advance(delta: number): void;

  /**
   * Creates an instance of the specified entity class.
   * @param entityClass The class to instantiate.
   * @returns The new instance.
   */
  create<E extends Entity>(entityClass: EntityConstructor<E>): E;
  /**
   * Destroys the specified entity instance.
   * @param entity The entity to delete.
   */
  destroy(entity: Entity): void;
  /** Iterates over all entities that exist in the current state. */
  iterate(): Generator<Entity, void, unknown>;

  /**
   * Serializes the current state to a JSON string. Use createState() to
   * recreate it.
   * @returns A string that can be used to restore this state.
   */
  stringify(params?: Partial<StringifyParams>): string;
}
