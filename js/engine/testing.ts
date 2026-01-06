import {setUnusedSubjectContext} from './assertions.js';

type TestName = `test${string}`;
type Verdict = 'pass' | 'fail' | 'skip';
const PARAMETERIZED_TESTS = Symbol('PARAMETERIZED_TESTS');

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
export interface UnusedSubjectContext {
  suite: string;
  test: string;
}

export class Suite {
  setUp?(): void;
  tearDown?(): void;
  tearDownClass?(): void;
  [testName: TestName]:
    | ((...args: never[]) => unknown)
    | ((...args: never[]) => Promise<unknown>);
}

type SuiteWithParameterizedTests = Suite & {[PARAMETERIZED_TESTS]: Set<string>};

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
  const matchingKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(suite))
    .concat(Object.keys(suite))
    .filter((key) => key.startsWith('test')) as TestName[];
  const parameterizedTests = (suite as Partial<SuiteWithParameterizedTests>)[
    PARAMETERIZED_TESTS
  ];

  return matchingKeys.filter((key) => {
    if (parameterizedTests?.has(key)) {
      return false;
    }
    if (!(suite[key] instanceof Function)) {
      console.warn(`Not a test function: ${suiteName}.${key}`);
      return false;
    }
    if (suite[key].length !== 0) {
      // The method takes arguments.
      console.warn(
        `Parameterized test function without decorator: ${suiteName}.${key}`
      );
    }
    return true;
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
        () => {
          setUnusedSubjectContext({suite: suiteName, test: testName});
          suite.setUp?.();
        },
        () => {
          suite.tearDown?.();
          setUnusedSubjectContext(null);
        }
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

// https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/#writing-well-typed-decorators
export function parameters<
  This extends Suite,
  T extends (...args: never[]) => void
>(
  ...args: Parameters<T>[]
): (
  func: T,
  context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: Parameters<T>) => void
  >
) => void {
  return (
    func: T,
    context: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: Parameters<T>) => void
    >
  ) => {
    const name = context.name;
    if (typeof name !== 'string' || !name.startsWith('test')) {
      throw new Error(
        `@parameters() can only be used on test methods, got: ${String(name)}`
      );
    }
    context.addInitializer(function () {
      const suite = this as unknown as SuiteWithParameterizedTests;
      // Add each parameterized variant as a separate test.
      args.forEach((params, i) => {
        suite[`${name as TestName} (${i})`] = func.bind(suite, ...params);
      });
      // Flag original function definition to ignore it.
      suite[PARAMETERIZED_TESTS] ??= new Set();
      suite[PARAMETERIZED_TESTS].add(name);
    });
  };
}
