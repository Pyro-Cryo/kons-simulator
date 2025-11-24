import {assertThat, assertThrows} from '../assertions.js';
import {Suite, run, PassResult, FailResult, parameters} from '../testing.js';

export class TestingSuite extends Suite {
  async testPassingTestReturnsPassResult() {
    const results = await run(
      class PassingSuite extends Suite {
        testShouldPass() {}
      }
    );

    assertThat(results).hasLength(1);
    const [result] = results;
    assertThat(result.suite).equals('PassingSuite');
    assertThat(result.test).equals('testShouldPass');
    assertThat(result.verdict).equals('pass');
  }

  async testFailingTestReturnsFailResult() {
    const results = await run(
      class FailingSuite extends Suite {
        testShouldFail() {
          throw new Error('My message');
        }
      }
    );

    assertThat(results).hasLength(1);
    const [result] = results as FailResult[];
    assertThat(result.suite).equals('FailingSuite');
    assertThat(result.test).equals('testShouldFail');
    assertThat(result.verdict).equals('fail');
    assertThat(result.reason).isInstanceOf(Error);
    assertThat(result.reason.message).equals('My message');
  }

  async testRunsSetupAndTeardownInCorrectOrder() {
    const checkpoints: string[] = [];

    const results = await run(
      class PassingSuite extends Suite {
        constructor() {
          super();
          checkpoints.push('constructor');
        }
        setUp() {
          checkpoints.push('setUp');
        }
        tearDown() {
          checkpoints.push('tearDown');
        }
        tearDownClass() {
          checkpoints.push('tearDownClass');
        }

        testShouldRunFirst() {
          checkpoints.push('testShouldRunFirst');
        }
        testShouldRunSecond() {
          checkpoints.push('testShouldRunSecond');
        }
      }
    );

    const expected = [
      'constructor',
      'setUp',
      'testShouldRunFirst',
      'tearDown',
      'setUp',
      'testShouldRunSecond',
      'tearDown',
      'tearDownClass',
    ];
    assertThat(results).hasLength(2);
    assertThat(checkpoints).sequenceEquals(expected);
  }

  async testTestFunctionsCanReferenceInstanceVariables() {
    const [result] = await run(
      class PassingSuite extends Suite {
        private readonly x = 5;
        private y: number = 0;

        setUp() {
          this.y = this.x * 2;
        }
        testShouldPass() {
          assertThat(this.x).equals(5);
          assertThat(this.y).equals(10);
        }
      }
    );

    assertThat(result.verdict).equals('pass');
  }

  async testFailureInSuiteConstructorReturnsFailResult() {
    const results = await run(
      class BuggySuite extends Suite {
        constructor() {
          super();
          throw new Error('My message');
        }
        testShouldBeSkipped() {
          throw new Error("Didn't skip");
        }
      }
    );

    assertThat(results).hasLength(1);
    const [result] = results as FailResult[];
    assertThat(result.suite).equals('BuggySuite');
    assertThat(result.test).equals('constructor');
    assertThat(result.verdict).equals('fail');
    assertThat(result.reason).isInstanceOf(Error);
    assertThat(result.reason.message).equals('My message');
  }

  async testFailureInTearDownClassReturnsFailResult() {
    const results = await run(
      class BuggySuite extends Suite {
        testShouldPass() {}
        tearDownClass() {
          throw new Error('My message');
        }
      }
    );

    // Extra test result for the suite itself.
    assertThat(results).hasLength(2);

    const [failResult] = results.filter((result) => result.verdict === 'fail');
    assertThat(failResult.suite).equals('BuggySuite');
    assertThat(failResult.test).equals('constructor [tearDown]');
    assertThat(failResult.reason).isInstanceOf(Error);
    assertThat(failResult.reason.message).equals('My message');

    const [passResult] = results.filter((result) => result.verdict === 'pass');
    assertThat(passResult.suite).equals('BuggySuite');
    assertThat(passResult.test).equals('testShouldPass');
  }

  async testFailureInSetupReturnsFailResult() {
    const results = await run(
      class BuggySuite extends Suite {
        setUp() {
          throw new Error('My message');
        }
        testFailsSetup() {
          throw new Error('Should not reach this');
        }
      }
    );

    assertThat(results).hasLength(1);
    const [result] = results as FailResult[];
    assertThat(result.suite).equals('BuggySuite');
    assertThat(result.test).equals('testFailsSetup [setUp]');
    assertThat(result.verdict).equals('fail');
    assertThat(result.reason).isInstanceOf(Error);
    assertThat(result.reason.message).equals('My message');
  }

  async testFailureInTeardownReturnsFailResult() {
    const results = await run(
      class BuggySuite extends Suite {
        testFailsTeardown() {}
        tearDown() {
          throw new Error('My message');
        }
      }
    );

    assertThat(results).hasLength(1);
    const [result] = results as FailResult[];
    assertThat(result.suite).equals('BuggySuite');
    assertThat(result.test).equals('testFailsTeardown [tearDown]');
    assertThat(result.verdict).equals('fail');
    assertThat(result.reason).isInstanceOf(Error);
    assertThat(result.reason.message).equals('My message');
  }

  async testPassingTestStoresReturnedDataInResult() {
    const [result] = (await run(
      class PassingSuite extends Suite {
        testShouldPass(): {key: string} {
          return {key: 'value'};
        }
      }
    )) as PassResult<{key: string}>[];

    // TODO: Add contains, containsKey, containsValue
    assertThat('key' in result.data).isTruthy();
    assertThat(result.data.key).equals('value');
  }

  async testIgnoresHelperFunctionsWithoutTestPrefix() {
    const results = await run(
      class SuiteWithHelper extends Suite {
        testShouldPass() {
          this.myHelper();
        }
        myHelper() {}
      }
    );

    assertThat(results).hasLength(1);
    assertThat(results[0].test).equals('testShouldPass');
  }

  // Yes, this more or less tests itself...
  async testHandlesAsyncTests() {
    const results = await run(
      class SuiteWithHelper extends Suite {
        async testShouldPass(): Promise<number> {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return 123;
        }
        myHelper() {}
      }
    );

    assertThat(results).hasLength(1);
    const [result] = results as PassResult<number>[];
    assertThat(result.test).equals('testShouldPass');
    assertThat(result.verdict).equals('pass');
    assertThat(result.data).equals(123);
  }

  async testParametersCreatesOneTestPerParameterSet() {
    const results = await run(
      class SuiteWithParameterizedTest extends Suite {
        @parameters([5, false], [1, true], [2, true])
        testIsEven(x: number, expectEven: boolean) {
          assertThat(!(x % 2)).equals(expectEven);
        }
      }
    );

    assertThat(results).hasLength(3);
    assertThat(
      results.every((r) => r.test.startsWith('testIsEven'))
    ).isTruthy();
    assertThat(results.filter((r) => r.verdict === 'pass')).hasLength(2);
    assertThat(results.filter((r) => r.verdict === 'fail')).hasLength(1);
  }

  async testParametersBindsThisCorrectlyAndRunsSetupBetweenTests() {
    const results = await run(
      class SuiteWithParameterizedTest extends Suite {
        x: number = 1;
        setUp() {
          this.x = 15;
        }

        @parameters([5], [3])
        testIsDivisible(y: number) {
          assertThat(this.x).equals(15);
          this.x /= y;
          assertThat(this.x % 1).equals(0);
        }
      }
    );

    assertThat(results).hasLength(2);
    assertThat(results.every((result) => result.verdict === 'pass')).isTruthy();
  }

  async testParametersCanParameterizeMultipleTests() {
    const results = await run(
      class SuiteWithParameterizedTest extends Suite {
        @parameters([5, 5], [3, 3])
        testIsEqual(x: number, y: number) {
          assertThat(x).equals(y);
        }

        @parameters([0], [false], [''])
        testIsFalsy(x: unknown) {
          assertThat(x).not.isTruthy();
        }
      }
    );

    assertThat(results).hasLength(5);
    assertThat(results.every((result) => result.verdict === 'pass')).isTruthy();
    assertThat(
      results.filter((r) => r.test.startsWith('testIsEqual'))
    ).hasLength(2);
    assertThat(
      results.filter((r) => r.test.startsWith('testIsFalsy'))
    ).hasLength(3);
  }

  async testParametersErrorOnDecoratingNonTestMethod() {
    assertThrows(
      () =>
        class SuiteWithParameterizedTest extends Suite {
          // Method does not begin with "test".
          @parameters([5, 5], [3, 3])
          helper(x: number, y: number): number {
            return x * y;
          }
        }
    );
  }
}
