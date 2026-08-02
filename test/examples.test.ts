import { it, type TestContext } from 'node:test';

import { createMacro } from '../src/index.ts';

const stringCompare = createMacro(
  (
    t: TestContext,
    { actual, expected }: { actual: string; expected: string },
  ) => {
    t.assert.strictEqual(actual, expected);
  },
);

// the second parameter to stringCompare is a TestOptions object
it(
  'string comparison',
  stringCompare({ actual: 'foo', expected: 'foo' }, { plan: 1 }),
);

const stringCompareWithTitle = createMacro({
  exec: (
    t: TestContext,
    { actual, expected }: { actual: string; expected: string },
  ) => {
    t.assert.strictEqual(actual, expected);
  },
  testOptions: { timeout: 1_000 },
  title: ({ actual, expected }) => `${actual} === ${expected}`,
});

it(stringCompareWithTitle({ actual: 'foo', expected: 'foo' }, { plan: 1 }));
