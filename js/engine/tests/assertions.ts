import {assertThrows, AssertionError, assertThat} from '../assertions.js';
import {Suite, parameters} from '../testing.js';
import {LinkedList} from '../containers.js';

type MappingLike<V, K = string> =
  | Map<K, V>
  | (K extends string ? {[key: string]: V} : never);

class MyClass {}
const ITERABLE_123 = new (class {
  *[Symbol.iterator]() {
    yield* [1, 2, 3];
  }
})();

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

  @parameters([false], [null], [undefined], [''], [0])
  testIsTruthyThrows(value: unknown) {
    assertThrows(() => assertThat(value).isTruthy(), AssertionError);
    assertThat(value).not.isTruthy();
  }

  @parameters([true], [[]], [{}], ['string'], [() => null], [1])
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

  @parameters([false], [''], [0], [{}])
  testIsNullishThrows(value: unknown) {
    assertThrows(() => assertThat(value).isNullish(), AssertionError);
    assertThat(value).not.isNullish();
  }

  @parameters([null], [undefined])
  testIsNullishPasses(value: unknown) {
    assertThat(value).isNullish();
    assertThrows(() => assertThat(value).not.isNullish(), AssertionError);
  }

  @parameters([1, 2], ['abc', '123'], [NaN, NaN], [{}, {}])
  testEqualsThrows(a: unknown, b: unknown) {
    assertThrows(() => assertThat(a).equals(b), AssertionError);
    assertThat(a).not.equals(b);
  }

  @parameters([null, null], ['123', '123'], [Symbol.iterator, Symbol.iterator])
  testEqualsPasses(a: unknown, b: unknown) {
    assertThat(a).equals(b);
    assertThrows(() => assertThat(a).not.equals(b), AssertionError);
  }

  @parameters([null, MyClass], ['123', Symbol], [new Error(), AssertionError])
  testIsInstanceOfThrows(a: unknown, b: unknown) {
    assertThrows(
      () => assertThat(a).isInstanceOf(b as typeof Object),
      AssertionError
    );
    assertThat(a).not.isInstanceOf(b as typeof Object);
  }

  @parameters(
    [{}, Object],
    [() => null, Function],
    [1, Number],
    ['', String],
    [Symbol(':)'), Symbol],
    [new MyClass(), MyClass],
    [new (class Subclass extends MyClass {})(), MyClass]
  )
  testIsInstanceOfPasses(a: unknown, b: unknown) {
    assertThat(a).isInstanceOf(b as typeof Object);
    assertThrows(
      () => assertThat(a).not.isInstanceOf(b as typeof Object),
      AssertionError
    );
  }

  testAlmostEqualsThrows() {
    assertThrows(() => assertThat(1.0).almostEquals(1.1), AssertionError);
    assertThat(1.0).not.almostEquals(1.1);
  }

  testAlmostEqualsPasses() {
    assertThat(1.0).almostEquals(1.0 + Number.EPSILON);
    assertThrows(
      () => assertThat(1.0).not.almostEquals(1.0 + Number.EPSILON),
      AssertionError
    );
  }

  testIsGreaterThanThrows() {
    assertThrows(() => assertThat(1).isGreaterThan(2), AssertionError);
    assertThat(1).not.isGreaterThan(2);
  }

  testIsGreaterThanPasses() {
    assertThat(2).isGreaterThan(1);
    assertThrows(() => assertThat(2).not.isGreaterThan(1), AssertionError);
  }

  testIsAtLeastThrows() {
    assertThrows(() => assertThat(1).isAtLeast(2), AssertionError);
    assertThat(1).not.isAtLeast(2);
  }

  testIsAtLeastPasses() {
    assertThat(1).isAtLeast(1);
    assertThrows(() => assertThat(1).not.isAtLeast(1), AssertionError);
  }

  testIsLessThanThrows() {
    assertThrows(() => assertThat(2).isLessThan(1), AssertionError);
    assertThat(2).not.isLessThan(1);
  }

  testIsLessThanPasses() {
    assertThat(1).isLessThan(2);
    assertThrows(() => assertThat(1).not.isLessThan(2), AssertionError);
  }

  testIsAtMostThrows() {
    assertThrows(() => assertThat(2).isAtMost(1), AssertionError);
    assertThat(2).not.isAtMost(1);
  }

  testIsAtMostPasses() {
    assertThat(1).isAtMost(1);
    assertThrows(() => assertThat(1).not.isAtMost(1), AssertionError);
  }

  @parameters(['', 'text'], ['abc123', 'abd'], ['abc', 'abc123'])
  testStringContainsThrows(a: string, b: string) {
    assertThrows(() => assertThat(a).contains(b), AssertionError);
    assertThat(a).not.contains(b);
  }

  @parameters(['text', ''], ['abc123', 'bc1'], ['abc123', 'abc'])
  testStringContainsPasses(a: string, b: string) {
    assertThat(a).contains(b);
    assertThrows(() => assertThat(a).not.contains(b), AssertionError);
  }

  testStartsWithThrows() {
    assertThrows(() => assertThat('abc').startsWith('b'), AssertionError);
    assertThat('abc').not.startsWith('b');
  }

  testStartsWithPasses() {
    assertThat('abc').startsWith('ab');
    assertThrows(() => assertThat('abc').not.startsWith('ab'), AssertionError);
  }

  testEndsWithThrows() {
    assertThrows(() => assertThat('abc').endsWith('b'), AssertionError);
    assertThat('abc').not.endsWith('b');
  }

  testEndsWithPasses() {
    assertThat('abc').endsWith('bc');
    assertThrows(() => assertThat('abc').not.endsWith('bc'), AssertionError);
  }

  testStringHasLengthThrows() {
    assertThrows(() => assertThat('abc').hasLength(5), AssertionError);
    assertThat('abc').not.hasLength(5);
  }

  testStringHasLengthPasses() {
    assertThat('abc').hasLength(3);
    assertThrows(() => assertThat('abc').not.hasLength(3), AssertionError);
  }

  testIterableHasLengthThrows() {
    assertThrows(() => assertThat([1, 2, 3]).hasLength(5));
    assertThat([1, 2, 3]).not.hasLength(5);
  }

  @parameters(
    [[], 0],
    [ITERABLE_123, 3],
    [new Uint8Array([1, 2]), 2],
    [new LinkedList([1, 2, 3, 4]), 4]
  )
  testIterableHasLengthPasses(iterable: Iterable<unknown>, length: number) {
    assertThat(iterable).hasLength(length);
    assertThrows(() => assertThat(iterable).not.hasLength(length));
  }

  testIterableIsEmptyThrows() {
    assertThrows(() => assertThat([1]).isEmpty(), AssertionError);
    assertThat([1]).not.isEmpty();
  }

  testIterableIsEmptyPasses() {
    assertThat([]).isEmpty();
    assertThrows(() => assertThat([]).not.isEmpty(), AssertionError);
  }

  testIterableContainsThrows() {
    assertThrows(() => assertThat([1, 2, 3]).contains(4), AssertionError);
    assertThat([1, 2, 3]).not.contains(4);
  }

  testIterableContainsPasses() {
    assertThat([1, 2, 3]).contains(2);
    assertThrows(() => assertThat([1, 2, 3]).not.contains(2), AssertionError);
  }

  testIterableWithCustomEqualityContainsThrows() {
    assertThrows(
      () =>
        assertThat([1, 2, 3])
          .withElementEquality((a, b) => a % 10 === b % 10)
          .contains(4),
      AssertionError
    );
    assertThat([1, 2, 3])
      .withElementEquality((a, b) => a % 10 === b % 10)
      .not.contains(4);
  }

  testIterableWithCustomEqualityContainsPasses() {
    assertThat([1, 2, 3])
      .withElementEquality((a, b) => a % 10 === b % 10)
      .contains(12);
    assertThrows(
      () =>
        assertThat([1, 2, 3])
          .withElementEquality((a, b) => a % 10 === b % 10)
          .not.contains(12),
      AssertionError
    );
  }

  testEveryThrows() {
    assertThrows(
      () => assertThat([1, 2, 3]).every((element) => element > 2),
      AssertionError
    );
    assertThat([1, 2, 3]).not.every((element) => element > 2);
  }

  testEveryPasses() {
    assertThat([1, 2, 3]).every((element) => element > 0);
    assertThrows(
      () => assertThat([1, 2, 3]).not.every((element) => element > 0),
      AssertionError
    );
  }

  testSomeThrows() {
    assertThrows(
      () => assertThat([1, 2, 3]).some((element) => element > 5),
      AssertionError
    );
    assertThat([1, 2, 3]).not.some((element) => element > 5);
  }

  testSomePasses() {
    assertThat([1, 2, 3]).some((element) => element > 2);
    assertThrows(
      () => assertThat([1, 2, 3]).not.some((element) => element > 2),
      AssertionError
    );
  }

  @parameters(
    [[], [1]],
    [
      [1, 2, 3],
      [1, 2, 4],
    ],
    [
      [1, 2, 3],
      [3, 2, 1],
    ],
    [[{}], [{}]]
  )
  testSequenceEqualsThrows(a: Iterable<unknown>, b: Iterable<unknown>) {
    assertThrows(() => assertThat(a).sequenceEquals(b), AssertionError);
    assertThat(a).not.sequenceEquals(b);
  }

  @parameters(
    [[], []],
    [
      [1, 2, 3],
      [1, 2, 3],
    ],
    [new Uint16Array([1, 2, 3]), [1, 2, 3]],
    [ITERABLE_123, [1, 2, 3]]
  )
  testSequenceEqualsPasses(a: Iterable<unknown>, b: Iterable<unknown>) {
    assertThat(a).sequenceEquals(b);
    assertThrows(() => assertThat(a).not.sequenceEquals(b), AssertionError);
  }

  @parameters(
    [[], [1]],
    [
      [1, 2, 3],
      [1, 2, 4],
    ]
  )
  testSequenceEqualsWithCustomEqualityThrows(
    a: Iterable<number>,
    b: Iterable<number>
  ) {
    assertThrows(
      () =>
        assertThat(a)
          .withElementEquality((a, b) => a % 10 === b % 10)
          .sequenceEquals(b),
      AssertionError
    );
    assertThat(a)
      .withElementEquality((a, b) => a % 10 === b % 10)
      .not.sequenceEquals(b);
  }

  @parameters(
    [[], []],
    [
      [1, 2, 3],
      [11, 22, 33],
    ],
    [ITERABLE_123, [11, 22, 33]]
  )
  testSequenceEqualsWithCustomEqualityPasses(
    a: Iterable<number>,
    b: Iterable<number>
  ) {
    assertThat(a)
      .withElementEquality((a, b) => a % 10 === b % 10)
      .sequenceEquals(b);
    assertThrows(
      () =>
        assertThat(a)
          .withElementEquality((a, b) => a % 10 === b % 10)
          .not.sequenceEquals(b),
      AssertionError
    );
  }

  @parameters(
    [[], [1]],
    [
      [1, 2, 3],
      [1, 2, 2, 3],
    ],
    [[{}], [{}]]
  )
  testMultisetEqualsThrows(a: Iterable<unknown>, b: Iterable<unknown>) {
    assertThrows(() => assertThat(a).multisetEquals(b), AssertionError);
    assertThat(a).not.multisetEquals(b);
  }

  @parameters(
    [[], []],
    [
      [1, 2, 3],
      [1, 2, 3],
    ],
    [
      [1, 2, 3],
      [3, 2, 1],
    ],
    [ITERABLE_123, [1, 2, 3]]
  )
  testMultisetEqualsPasses(a: Iterable<unknown>, b: Iterable<unknown>) {
    assertThat(a).multisetEquals(b);
    assertThrows(() => assertThat(a).not.multisetEquals(b), AssertionError);
  }

  @parameters(
    [[], [1]],
    [
      [1, 2, 3],
      [1, 2, 4],
    ]
  )
  testMultisetEqualsWithCustomEqualityThrows(
    a: Iterable<number>,
    b: Iterable<number>
  ) {
    assertThrows(
      () =>
        assertThat(a)
          .withElementEquality((a, b) => a % 10 === b % 10)
          .multisetEquals(b),
      AssertionError
    );
    assertThat(a)
      .withElementEquality((a, b) => a % 10 === b % 10)
      .not.multisetEquals(b);
  }

  @parameters(
    [[], []],
    [
      [1, 2, 3],
      [11, 22, 33],
    ],
    [
      [11, 22, 222, 33],
      [1, 2, 2, 3],
    ],
    [ITERABLE_123, [11, 22, 33]]
  )
  testMultisetEqualsWithCustomEqualityPasses(
    a: Iterable<number>,
    b: Iterable<number>
  ) {
    assertThat(a)
      .withElementEquality((a, b) => a % 10 === b % 10)
      .multisetEquals(b);
    assertThrows(
      () =>
        assertThat(a)
          .withElementEquality((a, b) => a % 10 === b % 10)
          .not.multisetEquals(b),
      AssertionError
    );
  }

  @parameters(
    [[], [1]],
    [
      [1, 2, 3],
      [1, 2, 4],
    ],
    [[{}], [{}]]
  )
  testSetEqualsThrows(a: Iterable<unknown>, b: Iterable<unknown>) {
    assertThrows(() => assertThat(a).setEquals(b), AssertionError);
    assertThat(a).not.setEquals(b);
  }

  @parameters(
    [[], []],
    [
      [1, 2, 3],
      [1, 2, 3],
    ],
    [
      [1, 2, 3, 2],
      [3, 2, 1],
    ],
    [ITERABLE_123, [1, 2, 3]]
  )
  testSetEqualsPasses(a: Iterable<unknown>, b: Iterable<unknown>) {
    assertThat(a).setEquals(b);
    assertThrows(() => assertThat(a).not.setEquals(b), AssertionError);
  }

  @parameters(
    [[], [1]],
    [
      [1, 2, 3],
      [1, 2, 4],
    ]
  )
  testSetEqualsWithCustomEqualityThrows(
    a: Iterable<number>,
    b: Iterable<number>
  ) {
    assertThrows(
      () =>
        assertThat(a)
          .withElementEquality((a, b) => a % 10 === b % 10)
          .setEquals(b),
      AssertionError
    );
    assertThat(a)
      .withElementEquality((a, b) => a % 10 === b % 10)
      .not.setEquals(b);
  }

  @parameters(
    [[], []],
    [
      [1, 2, 3],
      [11, 22, 33],
    ],
    [
      [11, 33, 22, 222],
      [1, 2, 3],
    ],
    [ITERABLE_123, [11, 22, 33]]
  )
  testSetEqualsWithCustomEqualityPasses(
    a: Iterable<number>,
    b: Iterable<number>
  ) {
    assertThat(a)
      .withElementEquality((a, b) => a % 10 === b % 10)
      .setEquals(b);
    assertThrows(
      () =>
        assertThat(a)
          .withElementEquality((a, b) => a % 10 === b % 10)
          .not.setEquals(b),
      AssertionError
    );
  }

  testMappingHasSizeThrows() {
    assertThrows(() => assertThat({a: 1, b: 2}).hasSize(5));
    assertThat({a: 1, b: 2}).not.hasSize(5);
  }

  @parameters(
    [{}, 0],
    [{a: 1, b: 2}, 2],
    [new Map(), 0],
    [
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
      2,
    ]
  )
  testMappingHasSizePasses(mapping: MappingLike<unknown>, size: number) {
    assertThat(mapping).hasSize(size);
    assertThrows(() => assertThat(mapping).not.hasSize(size));
  }

  testMappingIsEmptyThrows() {
    assertThrows(() => assertThat({a: 1, b: 2}).isEmpty(), AssertionError);
    assertThat({a: 1, b: 2}).not.isEmpty();
  }

  testMappingIsEmptyPasses() {
    assertThat({}).isEmpty();
    assertThrows(() => assertThat({}).not.isEmpty(), AssertionError);
  }

  testContainsKeyThrows() {
    assertThrows(
      () => assertThat({a: 1, b: 2}).containsKey('c'),
      AssertionError
    );
    assertThat({a: 1, b: 2}).not.containsKey('c');
  }

  testContainsKeyPasses() {
    assertThat({a: 1, b: 2}).containsKey('a');
    assertThrows(
      () => assertThat({a: 1, b: 2}).not.containsKey('a'),
      AssertionError
    );
  }

  testContainsKeyWithCustomEqualityThrows() {
    assertThrows(
      () =>
        assertThat({a: 1, b: 2})
          .withKeyEquality((a, b) => a.toLowerCase() === b.toLowerCase())
          .containsKey('c'),
      AssertionError
    );
    assertThat({a: 1, b: 2})
      .withKeyEquality((a, b) => a.toLowerCase() === b.toLowerCase())
      .not.containsKey('c');
  }

  testContainsKeyWithCustomEqualityPasses() {
    assertThat({a: 1, b: 2})
      .withKeyEquality((a, b) => a.toLowerCase() === b.toLowerCase())
      .containsKey('A');
    assertThrows(
      () =>
        assertThat({a: 1, b: 2})
          .withKeyEquality((a, b) => a.toLowerCase() === b.toLowerCase())
          .not.containsKey('A'),
      AssertionError
    );
  }

  testContainsValueThrows() {
    assertThrows(
      () => assertThat({a: 1, b: 2}).containsValue(5),
      AssertionError
    );
    assertThat({a: 1, b: 2}).not.containsValue(5);
  }

  testContainsValuePasses() {
    assertThat({a: 1, b: 2}).containsValue(2);
    assertThrows(
      () => assertThat({a: 1, b: 2}).not.containsValue(2),
      AssertionError
    );
  }

  testContainsValueWithCustomEqualityThrows() {
    assertThrows(
      () =>
        assertThat({a: 1, b: 2})
          .withValueEquality((a, b) => a % 10 === b % 10)
          .containsValue(5),
      AssertionError
    );
    assertThat({a: 1, b: 2})
      .withValueEquality((a, b) => a % 10 === b % 10)
      .not.containsValue(5);
  }

  testContainsValueWithCustomEqualityPasses() {
    assertThat({a: 1, b: 2})
      .withValueEquality((a, b) => a % 10 === b % 10)
      .containsValue(22);
    assertThrows(
      () =>
        assertThat({a: 1, b: 2})
          .withValueEquality((a, b) => a % 10 === b % 10)
          .not.containsValue(22),
      AssertionError
    );
  }

  @parameters(
    [{}, {a: 1}],
    [new Map([['a', 1]]), new Map([['a', 2]])],
    [
      {a: 1, b: 2},
      {a: 1, b: 3},
    ],
    [{a: {}}, {a: {}}]
  )
  testMappingEqualsThrows(a: MappingLike<unknown>, b: MappingLike<unknown>) {
    assertThrows(() => assertThat(a).mappingEquals(b), AssertionError);
    assertThat(a).not.mappingEquals(b);
  }

  @parameters(
    [{}, {}],
    [new Map(), new Map()],
    [{}, new Map()],
    [
      {a: 1, b: 2},
      {b: 2, a: 1},
    ],
    [new Map([[1, 100]]), new Map([[1, 100]])],
    [
      {a: 1, b: 2},
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
    ]
  )
  testMappingEqualsPasses(
    a: MappingLike<unknown, string | number>,
    b: MappingLike<unknown, string | number>
  ) {
    assertThat(a).mappingEquals(b);
    assertThrows(() => assertThat(a).not.mappingEquals(b), AssertionError);
  }

  testMappingEqualsWithCustomKeyEqualityThrows() {
    assertThrows(
      () =>
        assertThat({a: 1, b: 2})
          .withKeyEquality((a, b) => a.toLowerCase() === b.toLowerCase())
          .mappingEquals({a: 1, c: 2}),
      AssertionError
    );
    assertThat({a: 1, b: 2})
      .withKeyEquality((a, b) => a.toLowerCase() === b.toLowerCase())
      .not.mappingEquals({a: 1, c: 2});
  }

  testMappingEqualsWithCustomKeyEqualityPasses() {
    assertThat({a: 1, b: 2})
      .withKeyEquality((a, b) => a.toLowerCase() === b.toLowerCase())
      .mappingEquals({A: 1, B: 2});
    assertThrows(
      () =>
        assertThat({a: 1, b: 2})
          .withKeyEquality((a, b) => a.toLowerCase() === b.toLowerCase())
          .not.mappingEquals({A: 1, B: 2}),
      AssertionError
    );
  }

  testMappingEqualsWithCustomValueEqualityThrows() {
    assertThrows(
      () =>
        assertThat({a: 1, b: 2})
          .withValueEquality((a, b) => a % 10 === b % 10)
          .mappingEquals({a: 1, b: 34}),
      AssertionError
    );
    assertThat({a: 1, b: 2})
      .withValueEquality((a, b) => a % 10 === b % 10)
      .not.mappingEquals({a: 1, b: 34});
  }

  testMappingEqualsWithCustomValueEqualityPasses() {
    assertThat({a: 1, b: 2})
      .withValueEquality((a, b) => a % 10 === b % 10)
      .mappingEquals({a: 1, b: 22});
    assertThrows(
      () =>
        assertThat({a: 1, b: 2})
          .withValueEquality((a, b) => a % 10 === b % 10)
          .not.mappingEquals({a: 1, b: 22}),
      AssertionError
    );
  }

  testMappingEqualsWithCustomKeyAndValueEqualityThrows() {
    assertThrows(
      () =>
        assertThat({a: 1, b: 2})
          .withKeyEquality((a, b) => a.toLowerCase() === b.toLowerCase())
          .withValueEquality((a, b) => a % 10 === b % 10)
          .mappingEquals({a: 1, c: 34}),
      AssertionError
    );
    assertThat({a: 1, b: 2})
      .withKeyEquality((a, b) => a.toLowerCase() === b.toLowerCase())
      .withValueEquality((a, b) => a % 10 === b % 10)
      .not.mappingEquals({a: 1, c: 34});
  }

  testMappingEqualsWithCustomKeyAndValueEqualityPasses() {
    assertThat({a: 1, b: 2})
      .withKeyEquality((a, b) => a.toLowerCase() === b.toLowerCase())
      .withValueEquality((a, b) => a % 10 === b % 10)
      .mappingEquals({A: 1, B: 22});
    assertThrows(
      () =>
        assertThat({a: 1, b: 2})
          .withKeyEquality((a, b) => a.toLowerCase() === b.toLowerCase())
          .withValueEquality((a, b) => a % 10 === b % 10)
          .not.mappingEquals({A: 1, B: 22}),
      AssertionError
    );
  }
}
