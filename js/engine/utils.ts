/**
 * Returns a randomly shuffled shallow copy of the array.
 */
export function shuffle<T>(array: readonly T[]): T[] {
  const result = new Array<T>(array.length);
  for (let i = 0; i < array.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    if (j !== i) result[i] = result[j];
    result[j] = array[i];
  }
  return result;
}

/**
 * Container that produces items in a random order, analogous to a deck of
 * cards. The `pop()` method can be used to draw the top card, and the deck is
 * reshuffled when the last card is drawn. This creates a more consistent
 * distribution than just randomly sampling an array with replacement.
 */
export class InfiniteBag<T> {
  /** The items in the bag, used to refill `shuffledElements`. */
  private elements: readonly T[] = [];
  /**
   * The items to be drawn from the bag, consumed from the end. If the bag is
   * filled (i.e., `elements` is not empty), this array always contains at least
   * one element to ensure `peek()` works. */
  private shuffledElements: T[] = [];

  /**
   * Creates an inifinte bag with the specified elements.
   * @param elements The elements that the bag produces.
   * @param copies The number of times each element will be duplicated before
   *     being placed in the bag.
   */
  constructor(elements: readonly T[] = [], copies: number = 1) {
    this.fill(elements, copies);
  }

  /** Whether the bag contains no items. */
  isEmpty(): boolean {
    return this.elements.length === 0;
  }

  /**
   * Replaces the content of the inifinte bag.
   * @param elements The elements that the bag produces.
   * @param copies The number of times each element will be duplicated before
   *     being placed in the bag.
   */
  fill(elements: readonly T[], copies: number = 1) {
    if (copies < 0)
      throw new Error(`Number of copies cannot be negative, got: ${copies}`);
    this.elements = elements.flatMap((element) =>
      new Array(copies).fill(element)
    );
    this.reshuffle();
  }

  /** Reshuffles the bag, resetting the random distribution of elements. */
  reshuffle() {
    this.shuffledElements = shuffle(this.elements);
  }

  /** Peek at the next element in the bag without drawing. */
  peek(): T {
    if (this.isEmpty()) throw new Error('Bag is empty, fill it first');
    return this.shuffledElements[this.shuffledElements.length - 1];
  }

  /** Draw the next element from the bag. */
  pop(): T {
    if (this.isEmpty()) throw new Error('Bag is empty, fill it first');
    // If the bag is not empty, shuffledElements always contains at least one
    // element.
    const element = this.shuffledElements.pop()!;
    if (this.shuffledElements.length === 0) {
      this.reshuffle();
    }
    return element;
  }
}

/**
 * Returns a comma-separated string of the elements of the given array. If the
 * array contains more than `max` elements, elements in the middle are omitted,
 * and the number of omitted elements are written out.
 */
export function summarizeLongArray<T>(array: T[], max: number = 10): string {
  let stringArray;
  if (array.length <= max) {
    stringArray = array.map(toString);
  } else {
    const numBefore = Math.max(0, Math.floor(max / 2));
    stringArray = array
      .slice(0, numBefore)
      .map(toString)
      .concat(
        [`(${array.length - max + 1} omitted)`],
        array.slice(array.length - (max - 1 - numBefore)).map(toString)
      );
  }
  return stringArray.join(', ');
}

/** Converts the provided value to a reasonable string representation. */
export function toString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Array) {
    return `[${summarizeLongArray(value, 11)}]`;
  }

  if (typeof value === 'object' && value !== null) {
    if (
      Object.getOwnPropertyNames(Object.getPrototypeOf(value)).indexOf(
        'toString'
      )
    ) {
      // Object defines its own string representation.
      return String(value);
    }
    const typeName =
      (value as {[Symbol.toStringTag]?: string})[Symbol.toStringTag] ??
      (value as {constructor: {name: string}}).constructor.name;
    const entries =
      value instanceof Map
        ? Array.from(value.entries())
        : Object.entries(value);
    return `${typeName}(${summarizeLongArray(entries, 9)})`;
  }

  return String(value);
}
