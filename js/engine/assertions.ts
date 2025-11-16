type ValueOrSupplier<T> = T | (() => T);

export class AssertionError extends Error {}

export function assert(value: unknown, message?: ValueOrSupplier<string>) {
  if (!value) {
    message ??= 'Assertion failed';
    throw new AssertionError(typeof message === 'string' ? message : message());
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
      `Wrong type of exception thrown: ${
        (error as Error).constructor.name
      }, expected ${errorType.name}`
    );
  }
  throw new AssertionError(`Not thrown: ${(errorType ?? Error).name}`);
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
