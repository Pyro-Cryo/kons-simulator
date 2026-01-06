/** A doubly linked list node. */
interface Node<T> {
  obj: T;
  prev: Node<T> | null;
  next: Node<T> | null;
}

/**
 * A doubly linked list used to store objects.
 */
export class LinkedList<T> {
  // If the first node is null iff the last node is null iff the count is zero.
  private first: Node<T> | null = null;
  private last: Node<T> | null = null;
  private count: number = 0;

  constructor(elements: Iterable<T> = []) {
    this.first = null;
    this.last = null;
    this.count = 0;

    for (const obj of elements) {
      this.push(obj);
    }
  }

  /** The length of the linked list. */
  get length(): number {
    return this.count;
  }

  /** Whether the list contains no items. */
  isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * Adds an object at the end of the list.
   */
  push(obj: T) {
    const node = {obj: obj, next: null, prev: this.last};
    if (this.last === null) {
      // The list is empty.
      this.first = node;
    } else {
      // Insert the node at the end.
      this.last.next = node;
    }
    this.last = node;
    this.count++;
  }

  /**
   * Adds an object at the beginning of the list.
   */
  prepend(obj: T) {
    const node = {obj: obj, next: this.first, prev: null};
    if (this.first === null) {
      // The list is empty.
      this.last = node;
    } else {
      // Insert the node at the beginning.
      this.first.prev = node;
    }
    this.first = node;
    this.count++;
  }

  /**
   * Removes the last occurrence of an object from the list. Will iterate
   * over the entire list in the worst case.
   * @param {T} obj
   * @returns true if the object was present in the list, and false otherwise.
   */
  remove(obj: T): boolean {
    // Iterate backwards since frequently moved objects are likely found near
    // the end.
    for (let current = this.last; current !== null; current = current.prev) {
      if (current.obj === obj) {
        this.removeNode(current);
        return true;
      }
    }
    return false;
  }

  /**
   * Removes a node from the list.
   */
  private removeNode(node: Node<T>) {
    if (node === this.first) {
      // The node was first, so point `first` to the second node (if there is
      // one).
      this.first = node.next;
    }
    if (node === this.last) {
      // The node was last, so point `last` to the second last node (if there is
      // one).
      this.last = node.prev;
    }
    if (node.prev !== null) {
      // Tell the node's preceding neighbor to point to the node's succeeding
      // neighbor instead, if there is one.
      node.prev.next = node.next;
    }
    if (node.next !== null) {
      // Tell the node's succeeding neighbor to point to the node's preceding
      // neighbor instead, if there is one.
      node.next.prev = node.prev;
    }

    this.count--;
  }

  clear() {
    this.first = null;
    this.last = null;
    this.count = 0;
  }

  /**
   * @yields {T}
   */
  *[Symbol.iterator]() {
    for (let current = this.first; current !== null; current = current.next) {
      yield current.obj;
    }
  }

  /**
   * Iterates over the objects for which the predicate returns true. Objects
   * for which the function returns false are removed from the list.
   */
  *filterIterate(predicate: (obj: T) => boolean): Generator<T> {
    for (let current = this.first; current !== null; current = current.next) {
      if (predicate(current.obj)) {
        yield current.obj;
      } else {
        // `current` will be moved forward by the loop, so point it to the
        // previous node and remove the current one.
        const prev = current.prev;
        this.removeNode(current);
        current = prev ?? this.first;
        if (current === null) {
          // The list has been emptied.
          break;
        }
      }
    }
  }

  toArray(): T[] {
    return [...this];
  }
}

interface HeapNode<T> {
  obj: T;
  weight: number;
}

/**
 * A min-heap for storing objects and their weights.
 * Objects with smaller weights are returned first.
 */
export class Minheap<T> {
  private elements: HeapNode<T>[] = [];

  get length() {
    return this.elements.length;
  }

  isEmpty() {
    return !this.elements.length;
  }

  /**
   * Gets the object with the lowest weight.
   */
  peek(): T {
    if (this.isEmpty()) {
      throw new Error(`Heap is empty`);
    }
    return this.elements[0].obj;
  }

  /**
   * Gets the lowest weight of any object in the heap.
   * @returns {number}
   */
  peekWeight(): number {
    if (this.isEmpty()) {
      throw new Error(`Heap is empty`);
    }
    return this.elements[0].weight;
  }

  /**
   * Gets the object with the lowest weight and removes it from the heap.
   * @return {T}
   */
  pop(): T {
    if (this.isEmpty()) {
      throw new Error(`Heap is empty`);
    }
    const obj = this.elements[0].obj;
    const last = this.elements.pop()!;
    if (this.isEmpty()) {
      return obj;
    }
    // Replace root with last element.
    this.elements[0] = last;

    let i = 0;
    // Swap with smallest child until heap property restored.
    while (true) {
      const leftIndex = 2 * i + 1;
      if (leftIndex >= this.elements.length) {
        break;
      }
      const rightIndex = leftIndex + 1;
      const indexOfSmallest =
        rightIndex === this.elements.length ||
        this.elements[leftIndex].weight <= this.elements[rightIndex].weight
          ? leftIndex
          : rightIndex;
      if (this.elements[i].weight <= this.elements[indexOfSmallest].weight) {
        break;
      }
      [this.elements[i], this.elements[indexOfSmallest]] = [
        this.elements[indexOfSmallest],
        this.elements[i],
      ];
      i = indexOfSmallest;
    }

    return obj;
  }

  /**
   * @param obj The object to add to the heap.
   * @param weight The weight of the object.
   */
  push(obj: T, weight: number) {
    this.elements.push({obj: obj, weight: weight});

    let i = this.elements.length - 1;
    while (i > 0) {
      const parentIndex = Math.floor((i - 1) / 2);
      if (this.elements[parentIndex].weight <= this.elements[i].weight) {
        break;
      }
      [this.elements[parentIndex], this.elements[i]] = [
        this.elements[i],
        this.elements[parentIndex],
      ];
      i = parentIndex;
    }
  }

  /**
   * The smallest element is yielded first but the remaining elements are not in
   * any particular order.
   * @yields {T}
   */
  *[Symbol.iterator]() {
    for (const element of this.elements) {
      yield element.obj;
    }
  }
}
