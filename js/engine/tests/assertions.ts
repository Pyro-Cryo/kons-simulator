import {assertThrows, AssertionError, assertThat} from '../assertions.js';
import {Suite, parameters} from '../testing.js';

export class AssertionsSuite extends Suite {
  testAssertThrowsThrowsErrorIfErrorNotThrown() {
    let thrownAssertionError = false;
    try {
      assertThrows(() => null);
    } catch (assertionError) {
      thrownAssertionError = assertionError instanceof AssertionError;
    }

    if (!thrownAssertionError) {
      throw new AssertionError('assertThrows() did not throw');
    }
  }

  testAssertThrowsThrowsErrorIfWrongTypeOfErrorThrown() {
    let thrownAssertionError = false;
    try {
      assertThrows(() => {
        throw new TypeError();
      }, SyntaxError);
    } catch (assertionError) {
      thrownAssertionError = assertionError instanceof AssertionError;
    }

    if (!thrownAssertionError) {
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

  testAssertThrowsDoesNotThrowIfCorrectErrorThrown() {
    const error = new TypeError('My message');
    const returnedError = assertThrows(() => {
      throw error;
    }, TypeError);
    if (returnedError !== error) {
      throw new AssertionError('Expected thrown error to be returned');
    }
  }

  testWithMessageIncludesMessage() {
    const stringMessageError = assertThrows(
      () => assertThat(false).withMessage('My message').isTruthy(),
      AssertionError
    );
    const supplierMessageError = assertThrows(
      () =>
        assertThat(false)
          .withMessage(() => 'My message')
          .isTruthy(),
      AssertionError
    );

    assertThat(stringMessageError.message).contains('My message');
    assertThat(supplierMessageError.message).contains('My message');
  }

  @parameters([false], [null], [undefined], [""], [0])
  testIsTruthyThrows(value: unknown) {
    assertThrows(() => assertThat(value).isTruthy(), AssertionError);
    assertThat(value).not.isTruthy();
  }

  @parameters([true], [[]], [{}], ["string"], [() => null], [1])
  testIsTruthyPasses(value: unknown) {
    assertThat(value).isTruthy();
    assertThrows(() => assertThat(value).not.isTruthy(), AssertionError);
  }

  @parameters([false], [0], [undefined])
  testIsNullThrows(value: unknown) {
    assertThrows(() => assertThat(value).isNull(), AssertionError);
    assertThat(value).not.isNull();
  }

  testIsNullPasses() {
    assertThat(null).isNull();
    assertThrows(() => assertThat(null).not.isNull(), AssertionError);
  }

  @parameters([false], [0], [null])
  testIsUndefinedThrows(value: unknown) {
    assertThrows(() => assertThat(value).isUndefined(), AssertionError);
    assertThat(value).not.isUndefined();
  }

  testIsUndefinedPasses() {
    assertThat(undefined).isUndefined();
    assertThrows(() => assertThat(undefined).not.isUndefined(), AssertionError);
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
