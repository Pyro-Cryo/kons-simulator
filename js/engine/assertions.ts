import {toString} from './utils.js';

type ValueOrSupplier<T> = T | (() => T);
type AssertionErrorData = {[key: string]: unknown};
// Note: type arguments ordered unusually so we can make the key default to
// string.
type MappingLike<V, K = string> =
  | Map<K, V>
  | (K extends string ? {[key: string]: V} : never);
type Equivalence<T> = (a: T, b: T) => boolean;

export class AssertionError extends Error {
  constructor(
    formatString: string,
    public readonly data: AssertionErrorData = {}
  ) {
    super(
      formatString.replaceAll(/\{([a-zA-Z0-9_-]+)\}/g, (_, key: string) =>
        toString(data[key])
      )
    );
  }
}

export function assertThrows(func: () => void): Error;
export function assertThrows<T extends Error>(
  func: () => void,
  errorType: new (...args: never[]) => T
): T;
export function assertThrows(
  func: () => void,
  errorType?: new (...args: never[]) => unknown
): unknown {
  try {
    func();
  } catch (error: unknown) {
    if (errorType === undefined || error instanceof errorType) {
      return error;
    }
    throw new AssertionError(
      'Expected {expected}, but {type} was thrown instead: {value}',
      {
        expected: errorType.name,
        type: (error as Error).constructor.name,
        value: String(error),
      }
    );
  }
  throw new AssertionError('Not thrown: {expected}', {
    expected: (errorType ?? Error).name,
  });
}

let unusedSubjectContext: unknown | null = null;
let unusedSubjectCallback: (context: unknown) => void = console.warn;

/** Register a function to be called when an `assertThat()` has no follow-up. */
export function onUnusedSubject(callback: (context: unknown) => void) {
  unusedSubjectCallback = callback;
}

/** Sets the context passed to onUnusedSubject for `assertThat()` */
export function setUnusedSubjectContext(context: unknown | null) {
  unusedSubjectContext = context;
}

const registry = new FinalizationRegistry((context: unknown) =>
  unusedSubjectCallback(context)
);

class SubjectBase<T> {
  protected invert: boolean = false;
  protected message: ValueOrSupplier<string> = '';
  constructor(protected readonly value: T) {
    if (unusedSubjectContext !== null) {
      registry.register(this, unusedSubjectContext, this);
    }
  }

  withMessage(message: ValueOrSupplier<string>): Omit<this, 'withMessage'> {
    this.message = message;
    return this;
  }

  get not(): Omit<Omit<this, 'not'>, 'withMessage'> {
    this.invert = !this.invert;
    return this;
  }

  protected getMessage(): string {
    const message =
      typeof this.message === 'string' ? this.message : this.message();
    return message ? message + '\n' : '';
  }

  protected evaluate(
    check: boolean,
    message: string,
    invertedMessage: string,
    data: AssertionErrorData = {}
  ) {
    registry.unregister(this);

    if (!check && !this.invert) {
      throw new AssertionError(this.getMessage() + message, {
        value: this.value,
        ...data,
      });
    } else if (check && this.invert) {
      throw new AssertionError(this.getMessage() + invertedMessage, {
        value: this.value,
        ...data,
      });
    }
  }

  isTruthy() {
    this.evaluate(
      !!this.value,
      'Expected truthy value, got: {value}',
      'Expected falsy value, got: {value}'
    );
  }

  isUndefined() {
    this.evaluate(
      this.value === undefined,
      'Expected undefined, got: {value}',
      'Unexpected undefined'
    );
  }

  isNull() {
    this.evaluate(
      this.value === null,
      'Expected null, got: {value}',
      'Unexpected null'
    );
  }

  isNullish() {
    this.evaluate(
      this.value === null || this.value === undefined,
      'Expected nullish value, got: {value}',
      'Unexpected nullish value'
    );
  }

  equals(expected: T) {
    this.evaluate(
      this.value === expected,
      'Expected {expected}, got: {value}',
      'Expected value other than {expected}'
    );
  }

  isInstanceOf(
    type:
      | (new (...args: unknown[]) => unknown)
      | typeof String
      | typeof Number
      | typeof Symbol
      | typeof Function
      | typeof Object
      | typeof Error
  ) {
    switch (type) {
      case String:
        this.evaluate(
          typeof this.value === 'string',
          'Expected a string, got: {value}',
          'Expected non-string, got: {value}'
        );
        break;
      case Number:
        this.evaluate(
          typeof this.value === 'number',
          'Expected a number, got: {value}',
          'Expected non-number, got: {value}'
        );
        break;
      case Symbol:
        this.evaluate(
          typeof this.value === 'symbol',
          'Expected a symbol, got: {value}',
          'Expected non-symbol, got: {value}'
        );
        break;
      case Function:
        this.evaluate(
          typeof this.value === 'function',
          'Expected a function, got: {value}',
          'Expected non-function, got: {value}'
        );
        break;
      case Object:
        this.evaluate(
          typeof this.value === 'object',
          'Expected an object, got: {value}',
          'Expected non-object, got: {value}'
        );
        break;
      default:
        this.evaluate(
          this.value instanceof type,
          `Expected a(n) {expected}, got: {value} ({type})`,
          `Expected non-{expected}, got: {value}`,
          {expected: type.name, type}
        );
    }
  }
}

class NumberSubject extends SubjectBase<number> {
  almostEquals(expected: number, delta: number = 1e-4) {
    const actualDelta = Math.abs(this.value - expected);
    this.evaluate(
      actualDelta <= delta,
      'Expected value to be within {delta} of {expected}, got: {value} ' +
        '(delta: {actualDelta})',
      'Expected value to be at least {delta} from {expected}, got: {value} ' +
        '(delta: {actualDelta})',
      {expected, delta, actualDelta}
    );
  }

  isGreaterThan(expected: number) {
    this.evaluate(
      this.value > expected,
      'Expected value to be greater than {expected}, got: {value}',
      'Expected value not to be greater than {expected}, got: {value}',
      {expected}
    );
  }

  isGreaterEqual(expected: number) {
    this.evaluate(
      this.value >= expected,
      'Expected value to be greater than or equal to {expected}, got: {value}',
      'Expected value not to be greater than nor equal to {expected}, got: ' +
        '{value}',
      {expected}
    );
  }

  isLessThan(expected: number) {
    this.evaluate(
      this.value < expected,
      'Expected value to be less than {expected}, got: {value}',
      'Expected value not to be less than {expected}, got: {value}',
      {expected}
    );
  }

  isLessEqual(expected: number) {
    this.evaluate(
      this.value <= expected,
      'Expected value to be less than or equal to {expected}, got: {value}',
      'Expected value not to be less than nor equal to {expected}, got: ' +
        '{value}',
      {expected}
    );
  }
}

class IterableSubject<T> extends SubjectBase<Iterable<T>> {
  private equality?: (a: T, b: T) => boolean;

  withElementEquality(
    equality: (a: T, b: T) => boolean
  ): Omit<this, 'withElementEquality'> {
    this.equality = equality;
    return this;
  }

  hasLength(expected: number) {
    let length = (this.value as {length?: number}).length;
    if (typeof length !== 'number') {
      length = 0;
      // Iterator goes brr.
      for (const _ of this.value) {
        length++;
      }
    }

    this.evaluate(
      length === expected,
      'Expected iterable of length {expected}, got: {value} (length: {length})',
      'Expected iterable of length other than {expected}, got: {value}',
      {expected, length}
    );
  }

  isEmpty() {
    let length = (this.value as {length?: number}).length;
    if (typeof length !== 'number') {
      length = 0;
      for (const _ of this.value) {
        length++;
        break;
      }
    }
    this.evaluate(
      length === 0,
      'Expected empty iterable, got: {value}',
      'Expected non-empty iterable, got: {value}'
    );
  }

  /**
   * Checks that the iterable contains the same elements as another, in the same
   * order.
   */
  sequenceEquals(expected: Iterable<T>) {
    const actualIterator = this.value[Symbol.iterator]();
    const expectedIterator = expected[Symbol.iterator]();
    const equality = this.equality ?? referenceEquals;

    let actualResult = actualIterator.next();
    let expectedResult = expectedIterator.next();
    let index = 0;
    let difference = null;

    while (!actualResult.done || !expectedResult.done) {
      if (actualResult.done || expectedResult.done) {
        difference = `actual sequence is ${
          actualResult.done ? 'shorter' : 'longer'
        } than expected: {value} vs. {expected}`;
        break;
      }
      if (!equality(actualResult.value, expectedResult.value)) {
        difference = `elements at index ${index} differ: ${toString(
          actualResult.value
        )} != ${toString(expectedResult.value)}`;
        break;
      }

      actualResult = actualIterator.next();
      expectedResult = expectedIterator.next();
      index++;
    }

    this.evaluate(
      difference === null,
      'Expected sequences to contain the same elements in order, but ' +
        difference,
      'Expected sequences to differ, but they contain the same elements in ' +
        'order: {value}',
      {expected}
    );
  }

  /**
   * Checks that the iterable contains the same elements as another, in any
   * order.
   */
  multisetEquals(expected: Iterable<T>) {
    const thisCounter = createCounter(this.equality);
    const expectedCounter = createCounter(this.equality);
    thisCounter.pushAll(this.value);
    expectedCounter.pushAll(expected);

    const difference = thisCounter;
    difference.merge(expectedCounter.negated());

    this.evaluate(
      difference.getCounts().length === 0,
      'Expected the same element counts in both multisets, got: {value} vs. ' +
        '{expected} (difference: {difference})',
      'Expected multisets to differ, but they contain the same element ' +
        'counts: {value}',
      {expected, difference}
    );
  }

  /**
   * Checks that the iterable contains the same elements as another, in any
   * order, ignoring duplicates.
   */
  setEquals(expected: Iterable<T>) {
    const thisCounter = createCounter(this.equality);
    const expectedCounter = createCounter(this.equality);
    thisCounter.pushAll(this.value);
    expectedCounter.pushAll(expected);

    const difference = thisCounter.withoutDuplicates();
    difference.merge(expectedCounter.withoutDuplicates().negated());

    this.evaluate(
      difference.getCounts().length === 0,
      'Expected the same elements in both sets, got: {value} vs. {expected} ' +
        '(difference: {difference})',
      'Expected sets to differ, but they contain the same elements: {value}',
      {expected, difference}
    );
  }
}

function getEntries<V, K>(map: MappingLike<V, K>): [K, V][] {
  if (map instanceof Map) {
    return Array.from(map.entries());
  }
  return Object.entries(map) as [K, V][];
}

class MappingSubject<V, K = string> extends SubjectBase<MappingLike<V, K>> {
  private keyEquality?: (a: K, b: K) => boolean;
  private valueEquality?: (a: V, b: V) => boolean;

  withKeyEquality(
    equality: (a: K, b: K) => boolean
  ): Omit<this, 'withKeyEquality'> {
    this.keyEquality = equality;
    return this;
  }

  withValueEquality(
    equality: (a: V, b: V) => boolean
  ): Omit<this, 'withValueEquality'> {
    this.valueEquality = equality;
    return this;
  }

  hasSize(expected: number) {
    const size = getEntries(this.value).length;
    this.evaluate(
      size === expected,
      'Expected mapping of size {expected}, got: {value} (size: {size})',
      'Expected mapping of size other than {expected}, got: {value}',
      {expected, size}
    );
  }

  isEmpty() {
    const size = getEntries(this.value).length;
    this.evaluate(
      size === 0,
      'Expected empty mapping, got: {value} (size: {size})',
      'Expected non-empty mapping, got: {value}',
      {size}
    );
  }

  mappingEquals(expected: MappingLike<V, K>) {
    const keyEquality = this.keyEquality ?? referenceEquals;
    const valueEquality = this.valueEquality ?? referenceEquals;
    // Fairly inefficient since we use a custom equality, but probably doesn't
    // matter in tests. Could be improved for the case with reference equality
    // keys.
    const entryEquality = (a: [K, V], b: [K, V]) =>
      keyEquality(a[0], b[0]) && valueEquality(a[1], b[1]);

    const thisCounter = createCounter<[K, V]>(entryEquality);
    const expectedCounter = createCounter<[K, V]>(entryEquality);
    for (const entry of getEntries(this.value)) {
      thisCounter.push(entry);
    }
    for (const item of getEntries(expected)) {
      expectedCounter.push(item);
    }
    const difference = thisCounter;
    difference.merge(expectedCounter.negated());

    this.evaluate(
      difference.getCounts().length === 0,
      'Expected equivalent mappings, got: {value} vs. {expected} ' +
        '(difference: {difference})',
      'Expected different mappings, but they contain the same entries: {value}',
      {expected, difference}
    );
  }
}

export function assertThat(value: number): NumberSubject;
export function assertThat<T>(value: Iterable<T>): IterableSubject<T>;
export function assertThat<V, K = string>(
  value: MappingLike<V, K>
): MappingSubject<V, K>;
export function assertThat<
  T extends Exclude<
    unknown,
    number | Iterable<never> | MappingLike<never, never>
  >
>(value: T): SubjectBase<T>;
export function assertThat(value: unknown): SubjectBase<unknown> {
  if (typeof value === 'number') {
    return new NumberSubject(value);
  }
  if (
    value instanceof Map ||
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return new MappingSubject(value as MappingLike<unknown, unknown>);
  }
  if ((value as {[Symbol.iterator]?: unknown})[Symbol.iterator]) {
    return new IterableSubject(value as Iterable<unknown>);
  }
  return new SubjectBase(value);
}

export function referenceEquals<T>(a: T, b: T) {
  return a === b;
}

/** Object that keeps track of how many of each item has been added. */
interface Counter<T> {
  push(item: T): void;
  push(item: T, count: number): void;
  pushAll(items: Iterable<T>): void;
  merge(other: Counter<T>): void;
  negated(): Counter<T>;
  /** Returns a new counter with all counts (including negative counts) to 1. */
  withoutDuplicates(): Counter<T>;
  /**
   * Returns the count of each pushed item, excluding those with a count of
   * zero.
   */
  getCounts(): ReadonlyArray<readonly [T, number]>;
}

/**
 * Counter with support for custom equivalence relations. Useful if the items
 * are arrays, objects etc. where something other than reference equivalence is
 * desire, but horribly inefficient (O(N^2) to count N items). It imposes no
 * additional requirements on the elements (comparability, hashability etc.).
 */
class CustomEqualityCounter<T> implements Counter<T> {
  private counts: [T, number][] = [];
  constructor(private equality: Equivalence<T>) {}

  private static fromCounts<T>(
    counts: [T, number][],
    equality: Equivalence<T>
  ): Counter<T> {
    const counter = new CustomEqualityCounter(equality);
    counter.counts = counts;
    return counter;
  }

  push(item: T, count: number = 1) {
    if (count === 0) {
      return;
    }

    const index = this.counts.findIndex(([i, _]) => this.equality(item, i));
    if (index === -1) {
      this.counts.push([item, 1]);
    } else if (this.counts[index][1] === -count) {
      this.counts.splice(index, 1);
    } else {
      this.counts[index][1] += count;
    }
  }

  pushAll(items: Iterable<T>) {
    for (const item of items) {
      this.push(item);
    }
  }

  merge(other: Counter<T>) {
    for (const [item, count] of other.getCounts()) {
      this.push(item, count);
    }
  }

  negated(): Counter<T> {
    return CustomEqualityCounter.fromCounts(
      this.counts.map(([item, count]) => [item, -count]),
      this.equality
    );
  }

  withoutDuplicates() {
    return CustomEqualityCounter.fromCounts(
      this.counts.map(([item, _]) => [item, 1]),
      this.equality
    );
  }

  getCounts(): ReadonlyArray<readonly [T, number]> {
    return this.counts;
  }
}

/**
 * Counter for items with reference equivalence, making it (probably)
 * considerably faster than CustomEqualityCounter.
 */
class MapCounter<T> implements Counter<T> {
  private counts: Map<T, number> = new Map();

  push(item: T, count: number = 1) {
    const currentCount = this.counts.get(item) ?? 0;
    if (currentCount === -count) {
      this.counts.delete(item);
    } else {
      this.counts.set(item, currentCount + count);
    }
  }

  pushAll(items: Iterable<T>) {
    for (const item of items) {
      this.push(item);
    }
  }

  merge(other: Counter<T>) {
    for (const [item, count] of other.getCounts()) {
      this.push(item, count);
    }
  }

  negated(): Counter<T> {
    const counter = new MapCounter<T>();
    counter.counts = new Map(
      this.getCounts().map(([item, count]) => [item, -count])
    );
    return counter;
  }

  withoutDuplicates() {
    const counter = new MapCounter<T>();
    counter.counts = new Map(this.getCounts().map(([item, _]) => [item, 1]));
    return counter;
  }

  getCounts(): ReadonlyArray<readonly [T, number]> {
    return Array.from(this.counts.entries());
  }
}

function createCounter<T>(
  equality: Equivalence<T> = referenceEquals
): Counter<T> {
  if (equality === referenceEquals) {
    return new MapCounter();
  }
  return new CustomEqualityCounter(equality);
}
