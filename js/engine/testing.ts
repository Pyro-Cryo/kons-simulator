type TestName = `test${string}`;
type Verdict = 'pass' | 'fail' | 'skip';

export interface PassResult<T = undefined> {
  suite: string;
  test: string;
  verdict: 'pass';
  data: T;
}

export interface FailResult {
  suite: string;
  test: string;
  verdict: 'fail';
  reason: Error;
}

export interface SkipResult {
  suite: string;
  test: string;
  verdict: 'skip';
  reason: string;
}

export type Result<T = unknown> = PassResult<T> | FailResult | SkipResult;

export class Suite {
  setUp?(): void;
  tearDown?(): void;
  tearDownClass?(): void;
  [testName: TestName]: (() => unknown) | (() => Promise<unknown>);
}

class AssertionError extends Error {}

export function assert(value: unknown, message?: string | (() => string)) {
  if (!value) {
    message ??= 'Assertion failed';
    throw new AssertionError(typeof message === 'string' ? message : message());
  }
}

function wrapLogResult(logResult?: (result: Result) => void) {
  if (!logResult) {
    return logResult;
  }

  return (result: Result) => {
    try {
      logResult(result);
    } catch (logError) {
      console.warn('Error logging result:', logError);
    }
  };
}

function getTestNames(suite: Suite, suiteName: string): TestName[] {
  const matchingKeys = Object.getOwnPropertyNames(
    Object.getPrototypeOf(suite)
  ).filter((key) => key.startsWith('test')) as TestName[];

  return matchingKeys.filter((key) => {
    const isFunction = suite[key] instanceof Function;
    if (!isFunction) {
      console.warn(`Not a test function: ${suiteName}.${key}`);
    }
    return isFunction;
  });
}

class Test<T = undefined> {
  constructor(
    readonly suiteName: string,
    private readonly testName: string | (() => string),
    private readonly test: () => T | Promise<T>,
    private readonly setUp?: () => void | Promise<void>,
    private readonly tearDown?: () => void | Promise<void>
  ) {}

  getTestName() {
    if (typeof this.testName === 'string') {
      return this.testName;
    }
    return this.testName();
  }

  async run(): Promise<Result<T>> {
    let result: Result<T> | null = null;
    try {
      try {
        this.setUp?.();
      } catch (setUpError) {
        result = {
          suite: this.suiteName,
          test: `${this.getTestName()} [setUp]`,
          verdict: 'fail',
          reason: setUpError as Error,
        };
        return Promise.resolve(result);
      }
      let returned = this.test();
      if (returned instanceof Promise) {
        returned = await returned;
      }
      result = {
        suite: this.suiteName,
        test: this.getTestName(),
        verdict: 'pass',
        data: returned,
      };
    } catch (error) {
      result = {
        suite: this.suiteName,
        test: this.getTestName(),
        verdict: 'fail',
        reason: error as Error,
      };
    } finally {
      try {
        this.tearDown?.();
      } catch (tearDownError) {
        if (result?.verdict !== 'fail') {
          result = {
            suite: this.suiteName,
            test: `${this.getTestName()} [tearDown]`,
            verdict: 'fail',
            reason: tearDownError as Error,
          };
        }
      }
    }

    return Promise.resolve(result);
  }
}

async function runSuite(
  suiteClass: new () => Suite,
  logResult?: (result: Result) => void
): Promise<Result[]> {
  logResult = wrapLogResult(logResult);

  const suiteName = suiteClass.name;
  const setupResult = await new Test(
    suiteName,
    'constructor',
    () => new suiteClass()
  ).run();
  if (setupResult.verdict !== 'pass') {
    // Failed to set up suite.
    logResult?.(setupResult);
    return [setupResult];
  }

  const suite = setupResult.data;
  const tests = getTestNames(suite, suiteName).map(
    (testName) =>
      new Test(
        suiteName,
        testName,
        suite[testName].bind(suite),
        () => suite.setUp?.(),
        () => suite.tearDown?.()
      )
  );

  const results: Result[] = [];
  let testIndex = 0;
  const suiteResult = await new Test(
    suiteName,
    /* testName=*/ () =>
      testIndex < tests.length ? tests[testIndex].getTestName() : 'constructor',
    async () => {
      for (; testIndex < tests.length; testIndex++) {
        const result = await tests[testIndex].run();
        logResult?.(result);
        results.push(result);
      }
    },
    /*setUp=*/ undefined,
    () => suite.tearDownClass?.()
  ).run();

  if (suiteResult.verdict !== 'pass') {
    logResult?.(suiteResult);
    results.push(suiteResult);

    // Skip remaining tests.
    for (; testIndex < tests.length; testIndex++) {
      const result: SkipResult = {
        suite: suiteName,
        test: tests[testIndex].getTestName(),
        verdict: 'skip',
        reason: 'Error while running suite',
      };
      logResult?.(result);
      results.push(result);
    }
  }

  return results;
}

export async function run(
  suites: (typeof Suite)[] | typeof Suite,
  logResult?: (result: Result) => void
) {
  if (!(suites instanceof Array)) {
    suites = [suites];
  }
  const results: Result[] = [];
  for (const suite of suites) {
    results.push(...(await runSuite(suite, logResult)));
  }
  return results;
}

const VERDICT_COLORS: Record<Verdict, string> = {
  skip: 'gray',
  pass: 'green',
  fail: 'red',
};

/** Logs one or more results (or a promise thereof) to the console. */
export function logResults(
  results: Result | Result[] | Promise<Result | Result[]>,
  table: boolean = false
) {
  if (!(results instanceof Promise)) {
    results = Promise.resolve(results);
  }
  results.then((resolvedResults) => {
    if (!(resolvedResults instanceof Array)) {
      resolvedResults = [resolvedResults];
    }
    if (table) {
      console.table(resolvedResults);
      return;
    }

    resolvedResults.forEach((result) => {
      const message = `%c${result.suite}.${result.test}`;
      const style = `color: ${VERDICT_COLORS[result.verdict]}`;
      const data = result.verdict === 'pass' ? result.data : result.reason;
      if (data === undefined) {
        console.log(message, style);
      } else {
        console.log(`${message}: %O`, style, data);
      }
    });
  });
}
