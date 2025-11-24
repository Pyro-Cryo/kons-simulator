import {
  assertThrows,
  AssertionError,
  assertThat,
} from '../assertions.js';
import {Suite, parameters} from '../testing.js';

export class AssertionsSuite extends Suite {
  testAssertThrowsThrowsErrorIfErrorNotThrown() {
    let raisedAssertionError = false;
    try {
      assertThrows(() => null);
    } catch (assertionError) {
      raisedAssertionError = assertionError instanceof AssertionError;
    }

    if (!raisedAssertionError) {
      throw new AssertionError('assertThrows() did not throw');
    }
  }

  testAssertThrowsThrowsErrorIfWrongTypeOfErrorThrown() {
    let raisedAssertionError = false;
    try {
      assertThrows(() => {
        throw new TypeError();
      }, SyntaxError);
    } catch (assertionError) {
      raisedAssertionError = assertionError instanceof AssertionError;
    }

    if (!raisedAssertionError) {
      throw new AssertionError('assertThrows() did not throw');
    }
  }

  testAssertThrowsReturnsThrownError() {
    const error = new TypeError('My message');
    const returnedError = assertThrows(() => {
      throw error;
    });
    if (returnedError !== error) {
      throw new AssertionError('Expected thrown error to be returned');
    }
  }

  testAssertThrowsDoesNotRaiseIfCorrectErrorThrown() {
    const error = new TypeError('My message');
    const returnedError = assertThrows(() => {
      throw error;
    }, TypeError);
    if (returnedError !== error) {
      throw new AssertionError('Expected thrown error to be returned');
    }
  }

  // testAssertDoesNotRaiseOnTrue() {
  //   assert(true);
  // }

  // testAssertRaisesOnFalse() {
  //   assertThrows(() => assert(false), AssertionError);
  // }

  @parameters(
    [[], []],
    [
      [1, 2, 3],
      [1, 2, 3],
    ],
    [new Uint16Array([1, 2, 3]), [1, 2, 3]],
    [
      new (class {
        *[Symbol.iterator]() {
          yield* [1, 2, 3];
        }
      })(),
      [1, 2, 3],
    ]
  )
  testAssertSequenceEqualsAllowsEqualSequences(
    first: Iterable<unknown>,
    second: Iterable<unknown>
  ) {
    assertThat(first).sequenceEquals(second);
  }

  @parameters(
    [[], [1]],
    [
      [1, 2, 3],
      [1, 2, 4],
    ],
    [[{}], [{}]]
  )
  testAssertSequenceEqualsDisallowsInequalSequences(
    first: Iterable<unknown>,
    second: Iterable<unknown>
  ) {
    assertThrows(() => assertThat(first).sequenceEquals(second));
  }
}
