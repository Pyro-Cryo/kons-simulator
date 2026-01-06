import {assertThat} from '../assertions.js';
import {Suite} from '../testing.js';
import {shuffle, InfiniteBag} from '../utils.js';

export class UtilsSuite extends Suite {
  testShuffleReturnsCopyWithSameElements() {
    const array = [1, 2, 3, 4, 5];
    const shuffled = shuffle(array);

    assertThat(shuffled).multisetEquals([1, 2, 3, 4, 5]);
    assertThat(array).sequenceEquals([1, 2, 3, 4, 5]);
  }

  testInfiniteBagIsEmptyBeforeFilling() {
    const bag = new InfiniteBag<number>();

    assertThat(bag.isEmpty()).isTruthy();
    bag.fill([1, 2, 3]);
    assertThat(bag.isEmpty()).not.isTruthy();
  }

  testInfiniteBagAllElementsReturnedEachCycle() {
    const bag = new InfiniteBag([1, 2, 3, 4]);

    for (let cycle = 0; cycle < 10; cycle++) {
      const popped = [bag.pop(), bag.pop(), bag.pop(), bag.pop()];
      assertThat(popped).multisetEquals([1, 2, 3, 4]);
    }
  }

  testInfiniteBagCanReshuffle() {
    const bag = new InfiniteBag([1, 2, 3, 4]);
    bag.pop();
    bag.pop();

    bag.reshuffle();
    const popped = [bag.pop(), bag.pop(), bag.pop(), bag.pop()];

    assertThat(popped).multisetEquals([1, 2, 3, 4]);
  }
}
