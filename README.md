# node-test-macro

> A small utility to create parameterized tests for `node:test` using "macros."

## Install

> Requires Node.js ^22.22.2, ^24.15.0, or >=26.0.0

```shell
npm install node-test-macro -D
```

`node-test-macro` ships both CJS and ESM builds.

## Usage

`node-test-macro` exports `createMacro()`. When invoked, `createMacro()` returns a factory function. This factory function returns a `TestOptions` object which is passed directly to `node:test`'s `test()`/`it()`.

Each macro can accept a user-defined "options" bag which is passed into the `MacroTestFn`. This function is essentially the same as the usual `TestFn`, except it additionally receives the user-defined options as the second parameter.

### Basic

In this form, the macro is implemented as a function which receives the test context and user-defined `options` object.

```ts
import { it, type TestContext } from 'node:test';
import { createMacro } from 'node-test-macro';

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
```

### Advanced

In this form, `createMacro()` accepts a `MacroConfig` object containing at minimum an `exec` function which is the same as the first parameter in the "basic" example.

A `title` function (or `string`) can be provided to derive the test name from the `options` object.

Additionally, a `testOptions` object can be provided to set the _default_ set of test options, which can optionally be overridden when the macro is invoked.

```ts
import { it, type TestContext } from 'node:test';
import { createMacro } from 'node-test-macro';

const stringCompare = createMacro({
  exec: (
    t: TestContext,
    { actual, expected }: { actual: string; expected: string },
  ) => {
    t.assert.strictEqual(actual, expected);
  },
  title: ({ actual, expected }) => `${actual} === ${expected}`,
  testOptions: { timeout: 1_000 },
});

it(stringCompare({ actual: 'foo', expected: 'foo' }, { plan: 1 }));
```

> If for some as-yet-unknown reason you _don't_ want to accept user-defined
> options, you can use `createMacro<void>()`.

## License

Copyright © 2026 Christopher Hiller. Licensed BlueOak-1.0.0
