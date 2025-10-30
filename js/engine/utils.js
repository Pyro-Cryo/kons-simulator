/**
 * Returns a randomly shuffled shallow copy of the array.
 */
export function shuffle(array) {
  const result = new Array(array.length);
  for (let i = 0; i < array.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    if (j !== i) result[i] = result[j];
    result[j] = array[i];
  }
  return result;
}

export class InfiniteBag {
  /**
   * @param {any[]} elements
   * @param {number} copies
   */
  constructor(elements = [], copies = 1) {
    this.fill(elements, copies);
  }

  /**
   * @param {any[]} elements
   * @param {number} copies
   */
  fill(elements, copies = 1) {
    if (copies < 0)
      throw new Error(`Number of copies cannot be negative, got: ${copies}`);
    this._elements = [].concat(
      ...elements.map((element) => new Array(copies).fill(element))
    );
    this.reshuffle();
  }

  reshuffle() {
    this._shuffled = shuffle(this._elements);
  }

  peek() {
    if (this._elements.length === 0)
      throw new Element('Bag is empty, fill it first');
    return this._shuffled[this._shuffled.length - 1];
  }

  pop() {
    if (this._elements.length === 0)
      throw new Element('Bag is empty, fill it first');
    const element = this._shuffled.pop();
    if (this._shuffled.length === 0) {
      this.reshuffle();
    }
    return element;
  }
}
