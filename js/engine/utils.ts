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

  /** Whether the bag contains any items. */
  get empty(): boolean {
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
    if (this.empty)
      throw new Error('Bag is empty, fill it first');
    return this.shuffledElements[this.shuffledElements.length - 1];
  }

  /** Draw the next element from the bag. */
  pop(): T {
    if (this.empty)
      throw new Error('Bag is empty, fill it first');
    // If the bag is not empty, shuffledElements always contains at least one
    // element.
    const element = this.shuffledElements.pop()!;
    if (this.shuffledElements.length === 0) {
      this.reshuffle();
    }
    return element;
  }
}
