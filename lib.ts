import 'colors';
import { equals, pick } from 'ramda';

const verbose = !Boolean(process.env.CI);

interface Check {
  compare: any
  value: any
  type: string
  run: (override?: any) => boolean | Promise<boolean>
  pass: boolean
}

export interface Test {
  name: string
  run: TestFn
  checks: Check[]
  pass: boolean
}

export interface Suite {
  index: number
  name: string
  tests: Test[]
  pass: boolean
}

const _expect = (checks: any[]) => (value: any) => {
  const check: Check = {
    compare: undefined,
    pass: undefined,
    run: undefined,
    type: undefined,
    value: undefined
  }

  const addCheck = (
    type: Check['type'], compare: Check['compare'], run: Check['run']
  ) => {
    check.type = type;
    check.compare = compare;
    check.pass = false;
    check.run = run;
    check.value = value;

    checks.push(check);
  }

  const toContain = (compare: any) => addCheck('contains', compare, () => equals(pick(Object.keys(compare), value), compare));
  const toEqual = (compare: any) => addCheck('equals', compare, () => equals(compare, value));
  const toStrictEqual = (compare: any) => addCheck('===', compare, () => compare === value);
  const toNotEqual = (compare: any) => addCheck('!equals', compare, () => !equals(value, compare));
  const toNotStrictEqual = (compare: any) => addCheck('!==', compare, () => value !== compare);

  const toThrow = (compare?: any) => addCheck('throws', compare, async () => {
    try {
      await value();
      return false;
    } catch(err) {
      check.value = err.message;
      if (!compare || (err.message === compare)) return true;
      return false;
    }
  });

  return {
    toContain,
    toEqual,
    toStrictEqual,
    toNotEqual,
    toNotStrictEqual,
    toThrow
  }
}

export type Expect = ReturnType<typeof _expect>;
export type TestFn = (expect: Expect) => void | Promise<void>

const printValue = (value: any) => {
  try { return JSON.stringify(value); }
  catch(e) {}
  return value;
}

const runCheck = async (check: Check, override?: any) => {
  try {
    check.pass = await check.run(override);
  } catch(e) {
    check.pass = false;
    check.value = e.message;
  }

  // verbose && console.log(`    👍 expected ${check.type} actual: ${printValue(check.value)}`.green);
  if (verbose && !check.pass) {
    console.log(`    👎 expected:\n\t${printValue(check.compare)}\n       !${check.type} actual:\n\t${printValue(check.value)}`.red);
  }

  return check.pass;
}

const suites: Suite[] = [];
let currentSuite = -1;

export const test = async (name: Test['name'], run: Test['run']) => {
  const test: Test = {
    name,
    checks: [],
    pass: true,
    run
  };
  suites[currentSuite].tests.push(test);
}

export const suite = (name: string, addTestCb: () => void) => {
  currentSuite++;
  suites[currentSuite] = {
    index: currentSuite,
    name,
    pass: true,
    tests: []
  };

  addTestCb();
}

export const runAll = async () => {
  let s = 1;
  let allPassed = true;

  for (const suite of suites) {
    verbose && console.log(`\n[${s}/${suites.length}]: ${suite.name}`.cyan);

    let i = 1;
    const total = suite.tests.length;

    for (const test of suite.tests) {
      verbose && console.log(`  * [${i}/${total}]: ${test.name}`.yellow);
      i++;

      try {
        await test.run(_expect(test.checks));

        for (const check of test.checks) {
          if (!(await runCheck(check))) test.pass = false;
        }
      } catch(error) {
        const message = (error?.message || error).split('\n').join('; ');
        console.log(`    👎 error: "${message}"`.red);
        test.pass = false;
      }

      if (test.pass) {
        verbose && console.log(`    👍 ${test.checks.length} checks passed`.green);
      }
    }

    const passed = (suite.tests).filter(t => t.pass).length;
    if (passed !== total) {
      verbose && console.log(`${passed} pass / `.green + `${total - passed} fail `.red);
      suite.pass = false;
      allPassed = false;
    }

    s++;
  }

  const results = suites.map(suite => {
    const tests = suite.tests.map(test => {
      const checks = test.checks.map(check => {
        const { compare, pass, type, value } = check;
        return { compare, pass, type, value };
      });

      const { name, pass } = test;

      return {
        name,
        pass,
        checks,
        success: checks.filter(c => c.pass).length,
        failure: checks.filter(c => !c.pass).length,
        total: checks.length,
      }
    });

    const { name, pass } = suite;

    return {
      name,
      pass,
      tests,
      success: tests.filter(t => t.pass).length,
      failure: tests.filter(t => !t.pass).length,
      total: tests.length,
    }
  });

  return {
    name: new Date().toISOString(),
    pass: allPassed,
    suites: results,
    success: results.filter(s => s.pass).length,
    failure: results.filter(s => !s.pass).length,
    total: results.length,
  };
}
