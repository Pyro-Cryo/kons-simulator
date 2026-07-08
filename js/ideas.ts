import {CLOCK} from './clock.js';
import {Signal} from './signaling.js';
import {Variable} from './variable2.js';

enum Skill {
  COOK,
  CLEAN,
  STUDY,
  CARRY,
  REPAIR,
}

enum Proficiency {
  F,
  FX,
  E,
  D,
  C,
  B,
  A,
}

enum ToolFunction {
  // Example: knife.
  CHOPPING,
  // Example: mop, toilet brush.
  CLEANING_ROUGH,
  // Example: towel, dish brush.
  CLEANING_FINE,
  // Example: cutlery.
  EATING,
}

interface SkillRequirement {
  skill: Skill;
  proficiency: Proficiency;
}

interface SupervisionRequirement {
  // Defaults to zero, i.e. contact is required.
  maxDistance?: number;
  // Skills required by the supervisor.
  skills?: SkillRequirement[];
  // Tools required by the supervisor.
  tools?: ToolFunction[];
}

interface ProcessDefinition {
  id: number;
  description?: string;
  // The time it takes to complete the process, in game minutes.
  time?: number;
  // Whether the process can be stopped and restarted without losing progress.
  pausable?: boolean;
  // If set, the process requires some kind of human input (e.g. studying,
  // chopping vegetables). Otherwise, it happens on its own, provided other
  // requirements are met (e.g. cooking/burning food in an oven).
  supervision?: SupervisionRequirement;
}

const MICROWAVE_PROCESSES: ProcessDefinition[] = [
  {
    id: 0,
    description: 'Öppna luckan',
    supervision: {},
  },
  {
    id: 1,
    description: 'Stäng luckan',
    supervision: {},
  },
  {
    id: 2,
    description: 'Värm mat',
    time: 2,
    pausable: true,
  },
];

abstract class Component<E extends Entity = Entity> {
  private entityInternal?: E;

  get entity(): E {
    if (!this.entityInternal) {
      throw new Error('Attempting to access entity before initialization');
    }
    return this.entityInternal;
  }

  initialize(entity: E) {
    this.entityInternal = entity;
  }

  advance?(delta: number): void;
}

export type CoordinatePair = [number, number];
export type Position = CoordinatePair | null | Positionable;

class Positionable extends Component {
  readonly position = new Variable<Position>(null);
}

class Containable extends Component {
  readonly container = new Variable<Container | null>(null);
}

abstract class Container extends Component {
  readonly onItemAdded = new Signal<Containable>();
  readonly onItemRemoved = new Signal<Containable>();

  /** Whether the item could be added to the container. */
  abstract fits(item: Containable): boolean;
  /** Adds the item to the container and updates the item's `container`. */
  abstract add(item: Containable): void;
  /** Whether the item is in the container. */
  abstract has(item: Containable): boolean;
  /** Removes the item from the container and updates item's `container`. */
  abstract remove(item: Containable): void;
  abstract *items(): Iterator<Containable>;
}

class SlotsContainer extends Container {
  private readonly slots: Containable[] = [];

  constructor(readonly numSlots: number) {
    super();
    if (!(numSlots > 0)) {
      throw new Error(`The number of slots must be positive, got: ${numSlots}`);
    }
  }

  fits(_: Containable): boolean {
    return this.slots.length < this.numSlots;
  }

  add(item: Containable) {
    if (!this.fits(item)) {
      throw new Error(`Container already full, cannot add ${item}`);
    }
    const currentContainer = item.container.get();
    if (currentContainer !== null) {
      currentContainer.remove(item);
    }

    this.slots.push(item);
    this.onItemAdded.invoke(item);
    item.container.set(this);
  }

  has(item: Containable): boolean {
    return this.slots.includes(item);
  }

  remove(item: Containable): void {
    const index = this.slots.indexOf(item);
    if (index === -1) {
      throw new Error(`Not in container: ${item}`);
    }
    this.slots.splice(index, 1);
    this.onItemRemoved.invoke(item);
    item.container.set(null);
  }

  *items(): Iterator<Containable> {
    yield *this.slots;
  }
}

class Skilled extends Component {
  constructor(
    private readonly proficiencies: Map<Skill, Proficiency> = new Map()
  ) {
    super();
  }

  getProficiency(skill: Skill): Proficiency | undefined {
    return this.proficiencies.get(skill);
  }

  setProficiency(skill: Skill, proficiency: Proficiency) {
    this.proficiencies.set(skill, proficiency);
  }

  meetsRequirement({skill, proficiency}: SkillRequirement): boolean {
    const actualProficiency = this.getProficiency(skill);
    return actualProficiency !== undefined && actualProficiency >= proficiency;
  }
}

interface ActionParams<E extends Entity> {
  action: ActionSpec<E, this>;
  subject: Entity;
  object: E;
}

interface ActionRequirements<E extends Entity, P extends ActionParams<E>> {
  skill?: SkillRequirement;
  predicate?: (params: P) => boolean;
}

interface ActionSpec<E extends Entity, P extends ActionParams<E>> {
  description: string;
  cost?: number;
  // pausable: boolean;
  requirements?: ActionRequirements<E, P>;
  callback: (params: P) => void;
}

class Action<E extends Entity, P extends ActionParams<E>> {
  private progress: number = 0;
  constructor(
    readonly spec: ActionSpec<E, P>,
    private readonly subject: Entity,
    private readonly interactable: Interactable<E>,
    private readonly onComplete: (params: P, surplus: number) => void,
    private readonly params: Omit<P, keyof ActionParams<E>>
  ) {}

  advance(delta: number) {
    this.progress += delta;
    if (this.progress >= (this.spec.cost ?? 0)) {
      this.onComplete(
        {
          subject: this.subject,
          object: this.interactable.entity,
          action: this.spec,
          ...this.params,
        } as P,
        /*surplus=*/ this.progress - (this.spec.cost ?? 0)
      );
    }
  }
}

class Interactable<E extends Entity> extends Component<E> {
  readonly onActionStarted = new Signal<ActionParams<E>>();
  readonly onActionEnded = new Signal<ActionParams<E>>();

  private currentAction: Action<E, ActionParams<E>> | null = null;

  constructor(private readonly actions: ActionSpec<E, never>[]) {
    super();
  }

  isInUse(): boolean {
    return !!this.currentAction;
  }

  getActions(): readonly ActionSpec<E, ActionParams<E>>[] {
    return this.actions as ActionSpec<E, ActionParams<E>>[];
  }

  canPerform(entity: Entity, spec: ActionSpec<E, ActionParams<E>>): boolean;
  canPerform<P extends ActionParams<E>>(
    entity: Entity,
    spec: ActionSpec<E, P>,
    params: Omit<P, keyof ActionParams<E>>
  ): boolean;
  canPerform<P extends ActionParams<E>>(
    entity: Entity,
    spec: ActionSpec<E, P>,
    params?: Omit<P, keyof ActionParams<E>>
  ): boolean {
    if (!this.actions.includes(spec as ActionSpec<E, ActionParams<E>>)) {
      throw new Error(`Spec does not belong to this interactable: ${spec}`);
    }
    if (this.isInUse()) {
      return false;
    }
    if (!spec.requirements) {
      return true;
    }

    const {skill, predicate} = spec.requirements;
    let passesRequirements = true;
    if (skill) {
      passesRequirements =
        entity.getComponentOrUndefined(Skilled)?.meetsRequirement(skill) ??
        false;
    }
    if (passesRequirements && predicate) {
      passesRequirements &&= predicate({
        subject: entity,
        object: this.entity,
        action: spec,
        ...params,
      } as P);
    }
    return passesRequirements;
  }

  advance(delta: number) {
    this.currentAction?.advance(delta);
  }

  perform(
    entity: Entity,
    spec: ActionSpec<E, ActionParams<E>>,
    params?: unknown,
    initialProgress?: number
  ): Promise<number>;
  perform<P extends ActionParams<E>>(
    entity: Entity,
    spec: ActionSpec<E, P>,
    params: Omit<P, keyof ActionParams<E>>,
    initialProgress?: number
  ): Promise<number>;
  perform<P extends ActionParams<E>>(
    entity: Entity,
    spec: ActionSpec<E, P>,
    params: Omit<P, keyof ActionParams<E>>,
    initialProgress = 0
  ): Promise<number> {
    if (!this.canPerform(entity, spec, params)) {
      throw new Error(
        `Entity ${entity} cannot currently perform ${spec} on ${this}`
      );
    }

    // Use withResolvers instead of new Promise(resolve => ...) to ensure that
    // tasks that can be completed instantly are completed immediately in the
    // current microtask.
    const {promise, resolve} = Promise.withResolvers<number>();
    this.currentAction = new Action<E, ActionParams<E>>(
      spec as ActionSpec<E, ActionParams<E>>,
      entity,
      this,
      (mergedParams, surplus) => {
        this.currentAction = null;
        try {
          spec.callback(mergedParams as P);
        } catch (e) {
          console.error(e);
        }
        this.onActionEnded.invoke(mergedParams);
        resolve(surplus);
      },
      params
    );

    this.onActionStarted.invoke({
      action: spec,
      subject: entity,
      object: this.entity,
      ...params,
    } as P);
    this.currentAction.advance(initialProgress);
    return promise;
  }
}

class Heatable extends Component {
  constructor(private baseTemp: number) {
    super();
  }
}

type ComponentType<T = Component> = {new (...args: never[]): T};

class Entity {
  private readonly components = new Map<ComponentType, Component>();

  constructor(components: Component[]) {
    for (const component of components) {
      if (this.hasComponent(component.constructor as ComponentType)) {
        throw new Error(
          `Cannot have duplicate components (${component.constructor.name}), ` +
            `got: ${components.map((c) => c.constructor.name).join(', ')}`
        );
      }
      this.components.set(component.constructor as ComponentType, component);
    }
  }

  initialize() {
    for (const component of this.components.values()) {
      component.initialize(this);
    }
  }

  hasComponent<T>(componentType: ComponentType<T>): boolean {
    return !!this.getComponentOrUndefined(componentType);
  }

  getComponent<T>(componentType: ComponentType<T>): T {
    const component = this.getComponentOrUndefined(componentType);
    if (!component) {
      throw new Error(`Found no component ${componentType.name} on entity`);
    }
    return component;
  }

  getComponentOrUndefined<T>(componentType: ComponentType<T>): T | undefined {
    return (this.components as Map<ComponentType<T>, T>).get(componentType);
  }

  advance(delta: number) {
    for (const component of this.components.values()) {
      component.advance?.(delta);
    }
  }
}

class Microwave extends Entity {
  readonly isDoorOpen = new Variable<boolean>(false);

  constructor() {
    super([
      new SlotsContainer(1),
      new Interactable<Microwave>([
        {
          description: 'Öppna dörr',
          requirements: {predicate: () => !this.isDoorOpen.get()},
          callback: () => this.isDoorOpen.set(true),
        },
        {
          description: 'Stäng dörr',
          requirements: {predicate: () => this.isDoorOpen.get()},
          callback: () => this.isDoorOpen.set(false),
        },
        {
          description: 'Sätt in',
          requirements: {
            predicate: ({item}: {item: Containable}) =>
              this.isDoorOpen.get() &&
              this.getComponent(SlotsContainer).fits(item),
          },
          callback: ({item}: {item: Containable}) =>
            this.getComponent(SlotsContainer).add(item),
        },
        {
          description: 'Ta ut',
          requirements: {
            predicate: ({item}: {item: Containable}) =>
              this.isDoorOpen.get() &&
              this.getComponent(SlotsContainer).has(item),
          },
          callback: ({item}: {item: Containable}) =>
            this.getComponent(SlotsContainer).remove(item),
        },
        {
          // TODO
          description: 'Värm',
          requirements: {
            predicate: () =>
              this.isDoorOpen.get() &&
              [...this.getComponent(SlotsContainer).items()].length,
          },
          callback: ({item}: {item: Containable}) =>
            this.getComponent(SlotsContainer).add(item),
        },
      ]),
    ]);
  }
}

export class Busy {
  readonly duration: number | undefined = undefined;
  constructor(
    readonly description: string | undefined,
    readonly startedAt: number,
    readonly endsAt: number | undefined
  ) {
    if (this.endsAt !== undefined && this.endsAt > this.startedAt) {
      this.duration = this.endsAt - this.startedAt;
    }
  }

  getProgress(): number | undefined {
    if (!this.duration) {
      return undefined;
    }
    return Math.max(
      0,
      Math.min(1, (CLOCK.now() - this.startedAt) / this.duration)
    );
  }
}
