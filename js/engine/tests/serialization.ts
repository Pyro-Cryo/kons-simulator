import {assertThat, assertThrows} from '../assertions.js';
import {parameters, Suite} from '../testing.js';
import {JsonSerializer, TEST_ONLY} from '../serialization.js';

export class SerializationSuite extends Suite {
  serializer: JsonSerializer = new JsonSerializer();
  setUp() {
    this.serializer = new JsonSerializer();
  }

  testAddSymbolRejectsSymbolsWithoutDescription() {
    assertThrows(() => this.serializer.addSymbol(Symbol()));
  }

  testAddSymbolRejectsAlreadyRegistered() {
    const symbol = Symbol('description');
    this.serializer.addSymbol(symbol);

    assertThrows(() => this.serializer.addSymbol(symbol));
  }

  testAddClassRejectsAlreadyRegisteredClass() {
    class X {}
    this.serializer.addClass(
      X,
      (_) => null,
      (_) => new X()
    );

    assertThrows(() =>
      this.serializer.addClass(
        X,
        (_) => null,
        (_) => new X()
      )
    );
  }

  testAddClassRejectsAlreadyRegisteredKey() {
    class X {}
    class Y {}
    const customKey = 'abc123';

    this.serializer.addClass(
      X,
      (_) => null,
      (_) => new X(),
      customKey
    );

    assertThrows(() =>
      this.serializer.addClass(
        Y,
        (_) => null,
        (_) => new Y(),
        customKey
      )
    );
  }

  testRoundtripObject() {
    const object = {a: 123, b: 'string', c: false, d: undefined, e: null};

    const serialized = this.serializer.stringify(object);
    const deserialized = this.serializer.parse(serialized) as typeof object;

    assertThat(deserialized).mappingEquals(object);
  }

  testRoundtripArray() {
    const array = [123, 'string', false, undefined, null];

    const serialized = this.serializer.stringify(array);
    const deserialized = this.serializer.parse(serialized) as typeof array;

    assertThat(deserialized).sequenceEquals(array);
  }

  testRoundtripCustomObject() {
    class X {
      constructor(readonly num: number) {}
    }
    this.serializer.addClass(
      X,
      (x) => x.num,
      (num) => new X(num)
    );
    const x = new X(123);

    const serialized = this.serializer.stringify(x);
    const deserialized = this.serializer.parse(serialized) as X;

    assertThat(deserialized).isInstanceOf(X);
    assertThat(deserialized.num).equals(x.num);
    assertThat(deserialized)
      .withMessage('Expected a different instance')
      .not.equals(x);
  }

  testRoundtripDirectlyNestedObjects() {
    class X {
      constructor(readonly num: number) {}
    }
    class Y {
      constructor(readonly x: X) {}
    }
    this.serializer.addClass(
      X,
      (x) => x.num,
      (num) => new X(num)
    );
    // The serializer for Y relies on X being subsequently serializable.
    this.serializer.addClass(
      Y,
      (y) => y.x,
      (x) => new Y(x)
    );
    const y = new Y(new X(123));

    const serialized = this.serializer.stringify(y);
    const deserialized = this.serializer.parse(serialized) as Y;

    assertThat(deserialized).isInstanceOf(Y);
    assertThat(deserialized.x).isInstanceOf(X);
    assertThat(deserialized.x)
      .withMessage('Expected a different instance')
      .not.equals(y.x);
    assertThat(deserialized.x.num).equals(123);
  }

  testRoundtripIndirectlyNestedObjects() {
    class X {
      constructor(readonly num: number) {}
    }
    class Y {
      constructor(readonly x: X) {}
    }
    this.serializer.addClass(
      X,
      (x) => x.num,
      (num) => new X(num)
    );
    this.serializer.addClass(
      Y,
      (y) => ({x: y.x, extraKey: 'extraValue'}),
      ({x}) => new Y(x)
    );
    const y = new Y(new X(123));
    const serialized = this.serializer.stringify(y);
    const deserialized = this.serializer.parse(serialized) as Y;

    assertThat(deserialized).isInstanceOf(Y);
    assertThat(deserialized.x).isInstanceOf(X);
    assertThat(deserialized.x)
      .withMessage('Expected a different instance')
      .not.equals(y.x);
    assertThat(deserialized.x.num).equals(123);
  }

  testStringifyRejectsObjectsWithReservedKeys() {
    assertThrows(() => {
      this.serializer.stringify({[TEST_ONLY.TYPE]: 'DoesNotExist'});
    });
  }

  testStringifyRejectsSerializedObjectsWithReservedKeys() {
    class X {
      constructor(readonly num = 123) {}
    }
    this.serializer.addClass(
      X,
      (x) => ({[TEST_ONLY.TYPE]: x.num}),
      (serialized) => new X(serialized[TEST_ONLY.TYPE])
    );

    assertThrows(() => {
      this.serializer.stringify(new X());
    });
  }

  @parameters(
    [new (class Unregistered {})()],
    [Symbol('Unregistered')],
    [123n],
    [() => 123]
  )
  testStringifyRejectsUnsupportedObject(value: unknown) {
    assertThrows(() => {
      this.serializer.stringify(value);
    });
  }
}
