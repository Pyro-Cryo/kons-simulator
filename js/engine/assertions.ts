type ValueOrSupplier<T> = T | (() => T);
type AssertionErrorData = {[key: string]: unknown};
type MappingLike<V, K = string> =
  | Map<K, V>
  | (K extends string ? {[key: string]: V} : never);

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

function toString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    // TODO: Add specializations.
  }
  return String(value);
}

export function assert(value: unknown, message?: ValueOrSupplier<string>) {
  if (message === undefined) {
    assertThat(value).truthy();
  } else {
    assertThat(value).withMessage(message).truthy();
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

export function assertSequenceEqual<T>(
  first: Iterable<T>,
  second: Iterable<T>,
  message?: ValueOrSupplier<string>
) {
  const firstIterator = first[Symbol.iterator]();
  const secondIterator = second[Symbol.iterator]();
  let firstResult = firstIterator.next();
  let secondResult = secondIterator.next();
  let index = 0;

  while (!firstResult.done || !secondResult.done) {
    assert(
      !firstResult.done && !secondResult.done,
      message ?? 'Lengths of sequences differ'
    );
    assert(
      firstResult.value === secondResult.value,
      message ?? `Elements at index ${index} differ`
    );

    firstResult = firstIterator.next();
    secondResult = secondIterator.next();
    index++;
  }
}

class SubjectBase<T> {
  private invert: boolean = false;
  private message: ValueOrSupplier<string> = '';
  constructor(private readonly value: T) {}

  withMessage(message: ValueOrSupplier<string>): Omit<this, 'withMessage'> {
    this.message = message;
    return this;
  }

  get not(): Omit<Omit<this, 'not'>, 'withMessage'> {
    this.invert = !this.invert;
    return this;
  }

  private getMessage(): string {
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

  truthy() {
    this.evaluate(
      !!this.value,
      'Expected truthy value, got: {value}',
      'Expected falsy value, got: {value}'
    );
  }

  undefined() {
    this.evaluate(
      this.value === undefined,
      'Expected undefined, got: {value}',
      'Unexpected undefined'
    );
  }

  null() {
    this.evaluate(
      this.value === null,
      'Expected null, got: {value}',
      'Unexpected null'
    );
  }

  nullish() {
    this.evaluate(
      this.value === null || this.value === undefined,
      'Expected nullish value, got: {value}',
      'Unexpected nullish value'
    );
  }

  equals(other: unknown) {
    this.evaluate(
      this.value === other,
      'Expected {other}, got: {value}',
      'Expected value other than {other}'
    );
  }

  instanceOf(
    type:
      | (new (...args: unknown[]) => unknown)
      | typeof String
      | typeof Number
      | typeof Symbol
      | typeof Function
      | typeof Object
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
        const name = type.name;
        this.evaluate(
          this.value instanceof type,
          `Expected a(n) ${name}, got: {value}`,
          `Expected non-${name}, got: {value}`
        );
    }
  }
}

class NumberSubject extends SubjectBase<number> {
  almostEquals(other: number) {}
  greaterThan(other: number) {}
  greaterEqual(other: number) {}
  lessThan(other: number) {}
  lessEqual(other: number) {}
}

class IterableSubject<T> extends SubjectBase<Iterable<T>> {
  hasLength(length: number) {}
  isEmpty() {}
  withElementEquality<V>(equality: (a: V, b: V) => boolean) {}
  sameElements(other: Iterable<unknown>) {}
  sameElementCounts(other: Iterable<unknown>) {}
  sequenceEquals(other: Iterable<unknown>) {}
}

class MappingSubject<V, K = string> extends SubjectBase<MappingLike<V, K>> {
  hasSize(length: number) {}
  isEmpty() {}
  mappingEquals(other: MappingLike<V, K>) {}
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
  if (typeof value === "number") {
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
