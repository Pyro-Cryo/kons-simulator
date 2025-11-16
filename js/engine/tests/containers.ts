import {assert, assertSequenceEqual} from '../assertions.js';
import {Suite} from '../testing.js';
import {LinkedList} from '../containers.js';

export class LinkedListSuite extends Suite {
  testCanPushElement() {
    const list = new LinkedList<number>();
    assert(list.length === 0);

    list.push(2);
    assert(list.length === 1);
  }

  testCanIterate() {
    const list = new LinkedList<number>();
    list.push(2);
    list.push(4);
    list.push(6);

    let expected = 2;
    for (const item of list) {
      assert(item === expected);
      expected += 2;
    }
  }

  testCanPrependElement() {
    const list = new LinkedList<number>();
    list.push(2);
    list.push(3);
    list.prepend(1);

    assertSequenceEqual(list, [1, 2, 3]);
  }

  testCanInitializeWithElements() {
    const list = new LinkedList<number>([1, 2, 3]);

    assertSequenceEqual(list, [1, 2, 3]);
  }

  testCanConvertToArray() {
    const list = new LinkedList<number>([1, 2, 3]);

    const array = list.toArray();

    assert(array instanceof Array);
    assertSequenceEqual(array, list);
  }

  testRemoveRemovesLastMatchingElement() {
    const list = new LinkedList<number>([1, 2, 3, 2]);

    const didRemove = list.remove(2);

    assert(didRemove);
    assertSequenceEqual(list, [1, 2, 3]);
  }

  testRemovingNonexistingElementDoesNotModifyList() {
    const list = new LinkedList<number>([1, 2, 3]);

    const didRemove = list.remove(4);

    assert(!didRemove);
    assertSequenceEqual(list, [1, 2, 3]);
  }

  testCanStoreNullAndUndefined() {
    const list = new LinkedList<number | null | undefined>([1, 2, 3]);

    list.push(null);
    list.push(undefined);

    assert(list.length === 5);
  }
}
