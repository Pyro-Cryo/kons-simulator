import {assertThat} from '../assertions.js';
import {Suite} from '../testing.js';
import {LinkedList, Minheap} from '../containers.js';

export class LinkedListSuite extends Suite {
  testCanPushElement() {
    const list = new LinkedList<number>();
    assertThat(list).isEmpty();

    list.push(2);
    assertThat(list).hasLength(1);
  }

  testCanIterate() {
    const list = new LinkedList<number>();
    list.push(2);
    list.push(4);
    list.push(6);

    let expected = 2;
    for (const item of list) {
      assertThat(item).equals(expected);
      expected += 2;
    }
  }

  testCanPrependElement() {
    const list = new LinkedList<number>();
    list.push(2);
    list.push(3);
    list.prepend(1);

    assertThat(list).sequenceEquals([1, 2, 3]);
  }

  testCanInitializeWithElements() {
    const list = new LinkedList<number>([1, 2, 3]);

    assertThat(list).sequenceEquals([1, 2, 3]);
  }

  testCanConvertToArray() {
    const list = new LinkedList<number>([1, 2, 3]);

    const array = list.toArray();

    assertThat(array).isInstanceOf(Array);
    assertThat(array).sequenceEquals(list);
  }

  testRemoveRemovesLastMatchingElement() {
    const list = new LinkedList<number>([1, 2, 3, 2]);

    const didRemove = list.remove(2);

    assertThat(didRemove).isTruthy();
    assertThat(list).sequenceEquals([1, 2, 3]);
  }

  testRemovingNonexistingElementDoesNotModifyList() {
    const list = new LinkedList<number>([1, 2, 3]);

    const didRemove = list.remove(4);

    assertThat(didRemove).not.isTruthy();
    assertThat(list).sequenceEquals([1, 2, 3]);
  }

  testCanStoreNullAndUndefined() {
    const list = new LinkedList<number | null | undefined>([1, 2, 3]);

    list.push(null);
    list.push(undefined);

    assertThat(list).hasLength(5);
    assertThat(list).sequenceEquals([1, 2, 3, null, undefined]);
  }

  testCanClear() {
    const list = new LinkedList([1, 2, 3]);

    list.clear();

    assertThat(list).isEmpty();
  }

  testFilterIterateRemovesElements() {
    const list = new LinkedList([1, 2, 3]);

    assertThat(list.filterIterate(x => x % 2 === 1)).sequenceEquals([1, 3]);
    assertThat(list).sequenceEquals([1, 3]);
  }
}

export class MinheapSuite extends Suite {
  testCorrectLength() {
    const heap = new Minheap<string>();
    heap.push("a", 1);
    heap.push("b", 2);

    assertThat(heap).hasLength(2);
    assertThat(heap).not.isEmpty();
  }

  testCorrectIsEmpty() {
    assertThat(new Minheap()).isEmpty();
  }

  testPeekReturnsElementWithLowestWeight() {
    const heap = new Minheap<string>();
    heap.push("a", 10);
    heap.push("b", 1);
    heap.push("c", 5);

    assertThat(heap.peek()).equals("b");
  }

  testPeekWeightReturnsElementLowestWeight() {
    const heap = new Minheap<string>();
    heap.push("a", 10);
    heap.push("b", 1);
    heap.push("c", 5);

    assertThat(heap.peekWeight()).equals(1);
  }

  testCanIterateOverElements() {
    const heap = new Minheap<string>();
    heap.push("a", 10);
    heap.push("b", 1);
    heap.push("c", 5);

    assertThat(heap).setEquals(["a", "b", "c"]);
  }

  testCanContainDuplicates() {
    const heap = new Minheap<string>();
    heap.push("a", 10);
    heap.push("a", 1);
    heap.push("a", 5);

    assertThat(heap).multisetEquals(["a", "a", "a"]);
  }

  testPopReturnsLowestElementAndUpdatesHeap() {
    const heap = new Minheap<string>();
    heap.push("a", 10);
    heap.push("b", 1);
    heap.push("c", 5);

    assertThat(heap.pop()).equals("b");
    assertThat(heap).hasLength(2);
    assertThat(heap.peek()).equals("c");
  }

  testPushingAndPoppingElementSortsThem() {
    const heap = new Minheap<string>();
    heap.push("a", 10);
    heap.push("b", 1);
    heap.push("c", 5);
    heap.push("d", -5);

    const sorted = Array.from(new Array(heap.length), () => heap.pop());

    assertThat(heap).isEmpty();
    assertThat(sorted).sequenceEquals(["d", "b", "c", "a"]);
  }
}
