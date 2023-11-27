/**
 * A doubly linked list used to store objects.
 * @template T
 */
class LinkedList {
    constructor() {
        this.first = null;
        this.last = null;
        this.count = 0;
    }

    /**
     * Add an object at the end of the list.
     * @param {T} obj
     */
    push(obj) {
        if (this.first === null) {
            this.first = { obj: obj, next: null, prev: null };
            this.last = this.first;
        }
        else {
            let node = { obj: obj, next: null, prev: this.last };
            this.last.next = node;
            this.last = node;
        }
        this.count++;
    }

    /**
     * Add an object at the beginning of the list.
     * @param {T} obj
     */
    prepend(obj) {
        if (this.first === null) {
            this.first = { obj: obj, next: null, prev: null };
            this.last = this.first;
        }
        else {
            let node = { obj: obj, next: this.first, prev: null };
            this.first.prev = node;
            this.first = node;
        }
        this.count++;
    }

    /**
     * Remove the first occurrence of an object from the list. Will iterate
     * over the entire list in the worst case. Returns true if the object
     * was present in the list, and false otherwise.
     * @param {T} obj
     */
    remove(obj) {
        // Iterate backwards since frequently moved objects are likely found near the end.
        for (let current = this.last; current !== null; current = current.prev) {
            if (current.obj === obj) {
                this._remove(current);
                return true;
            }
        }
        return false;
    }

    // Remove a node from the list
    // Note that this accept a linked list node, not the data itself,
    // which you persumably get by iterating through the list using .next
    _remove(node) {
        if (node === this.first) {
            this.first = node.next;
            if (this.first === null)
                this.last = null;
            else
                this.first.prev = null;
        }
        if (node === this.last) {
            this.last = node.prev;
            if (this.last === null)
                this.first = null;
            else
                this.last.next = null;
        }

        if (node.prev !== null)
            node.prev.next = node.next;

        if (node.next !== null)
            node.next.prev = node.prev;

        node.next = undefined;
        node.prev = undefined;
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
     * Iterates over the objects for which the function returns true.
     * Objects for which the function returns false are removed from the list.
     * @param {function(T):boolean} func
     * @yields {T}
     */
    *filterIterate(func) {
        for (let current = this.first; current !== null; current = current.next) {
            if (func(current.obj)) {
                yield current.obj;
            }
            else {
                let c = current.prev;
                this._remove(current);
                current = c ?? this.first;
                if (current === null)
                    break;
                else
                    continue;
            }
        }
    }

    /**
     * @returns {T[]}
     */
    toArray() {
        return [...this];
    }
}

/**
 * A min-heap for storing objects and their weights.
 * Objects with smaller weights are returned first.
 * @template T
 */
class Minheap {
    constructor() {
        this.elements = [];
    }

    get length() {
        return this.elements.length;
    }

    isEmpty() {
        return !this.elements.length;
    }

    /**
     * Gets the object with the lowest weight.
     * @return {T}
     */
    peek() {
        if (this.isEmpty()) {
            throw new Error(`Heap is empty`);
        }
        return this.elements[0].obj;
    }

    /**
     * Gets the lowest weight of any object in the heap.
     * @returns {number}
     */
    peekWeight() {
        if (this.isEmpty()) {
            throw new Error(`Heap is empty`);
        }
        return this.elements[0].weight;
    }

    /**
     * Gets the object with the lowest weight and removes it from the heap.
     * @return {T}
     */
    pop() {
        if (this.isEmpty()) {
            throw new Error(`Heap is empty`);
        }
        const obj = this.elements[0].obj;
        const last = this.elements.pop();
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
            const indexOfSmallest = (
                rightIndex === this.elements.length
                || this.elements[leftIndex].weight <= this.elements[rightIndex].weight
            ) ? leftIndex : rightIndex;
            if (this.elements[i].weight <= this.elements[indexOfSmallest].weight) {
                break;
            }
            [this.elements[i], this.elements[indexOfSmallest]] = [this.elements[indexOfSmallest], this.elements[i]];
            i = indexOfSmallest;
        }

        return obj;
    }

    /**
     * @param {T} obj The object to add to the heap.
     * @param {number} weight The weight of the object.
     */
    push(obj, weight) {
        this.elements.push({ obj: obj, weight: weight });

        let i = this.elements.length - 1;
        while (i > 0) {
            const parentIndex = Math.floor((i - 1) / 2);
            if (this.elements[parentIndex].weight <= this.elements[i].weight) {
                break;
            }
            [this.elements[parentIndex], this.elements[i]] = [this.elements[i], this.elements[parentIndex]];
            i = parentIndex;
        }
    }
}
