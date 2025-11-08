import {Suite, run, assert, FailResult, PassResult} from './../testing.js';

export class Testing extends Suite {
  async testPassingTestReturnsPassResult() {
    const results = await run(
      class PassingSuite extends Suite {
        testShouldPass() {}
      }
    );

    assert(results.length === 1);
    const [result] = results;
    assert(result.suite === 'PassingSuite');
    assert(result.test === 'testShouldPass');
    assert(result.verdict === 'pass');
  }

  async testFailingTestReturnsFailResult() {
    const results = await run(
      class FailingSuite extends Suite {
        testShouldFail() {
          throw new Error("My message");
        }
      }
    );

    assert(results.length === 1);
    const [result] = results as FailResult[];
    assert(result.suite === 'FailingSuite');
    assert(result.test === 'testShouldFail');
    assert(result.verdict === 'fail');
    assert(result.reason instanceof Error);
    assert(result.reason.message === "My message");
  }

  async testRunsSetupAndTeardownInCorrectOrder() {
    const checkpoints: string[] = [];

    const results = await run(
      class PassingSuite extends Suite {
        constructor() {
          super();
          checkpoints.push("constructor");
        }
        setUp() {
          checkpoints.push("setUp");
        }
        tearDown() {
          checkpoints.push("tearDown");
        }
        tearDownClass() {
          checkpoints.push("tearDownClass");
        }

        testShouldRunFirst() {
          checkpoints.push("testShouldRunFirst");
        }
        testShouldRunSecond() {
          checkpoints.push("testShouldRunSecond");
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
    assert(results.length === 2);
    assert(JSON.stringify(checkpoints) === JSON.stringify(expected));
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
          assert(this.x === 5);
          assert(this.y === 10);
        }
      }
    );

    assert(result.verdict === 'pass');
  }

  async testFailureInSuiteConstructorReturnsFailResult() {
    const results = await run(
      class BuggySuite extends Suite {
        constructor() {
          super();
          throw new Error("My message");
        }
        testShouldBeSkipped() {
          throw new Error("Didn't skip");
        }
      }
    );

    assert(results.length === 1);
    const [result] = results as FailResult[];
    assert(result.suite === 'BuggySuite');
    assert(result.test === 'constructor');
    assert(result.verdict === 'fail');
    assert(result.reason instanceof Error);
    assert(result.reason.message === "My message");
  }

  async testFailureInTearDownClassReturnsFailResult() {
    const results = await run(
      class BuggySuite extends Suite {
        testShouldPass() {}
        tearDownClass() {
          throw new Error("My message");
        }
      }
    );

    // Extra test result for the suite itself.
    assert(results.length === 2);

    const [failResult] = results.filter(result => result.verdict === "fail");
    assert(failResult.suite === 'BuggySuite');
    assert(failResult.test === 'constructor [tearDown]');
    assert(failResult.reason instanceof Error);
    assert(failResult.reason.message === "My message");

    const [passResult] = results.filter(result => result.verdict === "pass");
    assert(passResult.suite === 'BuggySuite');
    assert(passResult.test === 'testShouldPass');
  }

  async testFailureInSetupReturnsFailResult() {
    const results = await run(
      class BuggySuite extends Suite {
        setUp() {
          throw new Error("My message");
        }
        testFailsSetup() {
          throw new Error("Should not reach this");
        }
      }
    );

    assert(results.length === 1);
    const [result] = results as FailResult[];
    assert(result.suite === 'BuggySuite');
    assert(result.test === 'testFailsSetup [setUp]');
    assert(result.verdict === 'fail');
    assert(result.reason instanceof Error);
    assert(result.reason.message === "My message");
  }

  async testFailureInTeardownReturnsFailResult() {
    const results = await run(
      class BuggySuite extends Suite {
        testFailsTeardown() {}
        tearDown() {
          throw new Error("My message");
        }
      }
    );

    assert(results.length === 1);
    const [result] = results as FailResult[];
    assert(result.suite === 'BuggySuite');
    assert(result.test === 'testFailsTeardown [tearDown]');
    assert(result.verdict === 'fail');
    assert(result.reason instanceof Error);
    assert(result.reason.message === "My message");
  }

  async testPassingTestStoresReturnedDataInResult() {
    const [result] = await run(
      class PassingSuite extends Suite {
        testShouldPass(): {key: string} {
          return {key: "value"};
        }
      }
    ) as PassResult<{key: string}>[];

    assert("key" in result.data);
    assert(result.data.key === "value");
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

    assert(results.length === 1);
    assert(results[0].test === "testShouldPass");
  }
}
