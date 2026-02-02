import {assertThat} from '../engine/assertions.js';
import {Suite} from '../engine/testing.js';
import {JsonSerializer} from '../serialization.js';

export class SerializationSuite extends Suite {
  testCanSerialize() {
    const serializer = new JsonSerializer();
    class X {
      constructor(readonly x = 1234) {}
    }
    class Y {
      constructor(
        readonly x: X,
        readonly z: string
      ) {}
    }
    const S = Symbol("S");
    serializer.addClass(
      X,
      (x: X) => x.x,
      (s) => new X(s)
    );
    serializer.addClass(
      Y,
      (y: Y) => ({xParam: y.x.x, z: y.z}),
      (s) => new Y(new X(s.xParam), s.z)
    );
    serializer.addSymbol(S);

    const str = serializer.stringify([
      1,
      2,
      {a: 3, b: 4, c: {d: 5}},
      null,
      undefined,
      false,
      S,
      new X(),
      new Y(new X(), 'hello'),
      [1, 2, [3, 4], {a: 5, b: {c: 6}, d: new X()}],
    ]);
    console.log(str);
    const parsed = serializer.parse(str) as unknown[];
    assertThat(parsed[7]).isInstanceOf(X);

    console.log("Parsed:", parsed);
  }

  testSomethingElse() {
    
    class Abc {
      constructor(readonly x: number) {}
    }
    const a = new Abc(123);
    console.log(a);
  }
}
