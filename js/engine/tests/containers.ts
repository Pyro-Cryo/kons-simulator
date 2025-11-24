import {assertThat} from '../assertions.js';
import {Suite} from '../testing.js';
import {LinkedList} from '../containers.js';

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
  }
}
