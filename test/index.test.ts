import { expect } from 'bupkis';
import { describe, it, type TestContext } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { createMacro } from '../src/index.ts';

/**
 * An arity regression makes `node:test` treat every macro as callback-style,
 * and its default timeout is `Infinity`. Every integration-style test below
 * gets a real timeout so such a regression fails loudly instead of wedging CI.
 *
 * Config-form macros carry this as a default via `testOptions`; bare-function
 * macros have nowhere to put it, so they pass it at each call site.
 */
const TIMEOUT = 5_000;

/**
 * `TestOptions` does not expose `fn` or `name`, so tests which need to read
 * them back require a local view of what {@link createMacro} actually returns.
 */
type MacroResult = {
  fn: (t: TestContext, done?: (result?: unknown) => void) => unknown;
  name?: string;
};

const macroA = createMacro((t, { foo = 'foo' }: { foo?: string }) => {
  expect(foo, 'to equal', 'foo');
});

const macroB = createMacro({
  exec: (t, { foo = 'foo' }: { foo?: string }) => {
    expect(foo, 'to equal', 'foo');
  },
  testOptions: { timeout: TIMEOUT },
  title: ({ foo = 'foo' }) => `macroB(${foo})`,
});

const asyncMacro = createMacro(async (t, { foo }: { foo: string }) => {
  await delay(10);
  expect(foo, 'to equal', 'foo');
});

const callbackMacro = createMacro((t, { foo }: { foo: string }, done) => {
  setTimeout(() => {
    expect(foo, 'to equal', 'foo');
    done();
  }, 10);
});

const titledCallbackMacro = createMacro({
  exec: (t, { foo }: { foo: string }, done) => {
    setTimeout(() => {
      expect(foo, 'to equal', 'foo');
      done();
    }, 10);
  },
  testOptions: { timeout: TIMEOUT },
  title: ({ foo }) => `titledCallbackMacro(${foo})`,
});

const emptyMacro = createMacro<void>(() => {});

/**
 * Reports the name `node:test` actually assigned to the test, by way of
 * {@link TestContext.name}.
 */
const nameAssertingMacro = createMacro((t, expected: string) => {
  expect(t.name, 'to equal', expected);
});

describe('macro tests', () => {
  it('macroA(foo)', macroA({ foo: 'foo' }, { timeout: TIMEOUT }));

  it(macroB({ foo: 'foo' }));

  it('empty macro does very little', emptyMacro());
});

describe('execution styles', () => {
  it('runs a synchronous macro', macroA({ foo: 'foo' }, { timeout: TIMEOUT }));

  it(
    'runs an async macro without "passed a callback but also returned a Promise"',
    asyncMacro({ foo: 'foo' }, { timeout: TIMEOUT }),
  );

  it(
    'runs a callback-style macro',
    callbackMacro({ foo: 'foo' }, { timeout: TIMEOUT }),
  );

  it(titledCallbackMacro({ foo: 'foo' }));

  it('mirrors the implementation arity so node:test picks the right style', () => {
    expect((macroA({ foo: 'foo' }) as MacroResult).fn.length, 'to equal', 1);
    expect(
      (asyncMacro({ foo: 'foo' }) as MacroResult).fn.length,
      'to equal',
      1,
    );
    expect(
      (callbackMacro({ foo: 'foo' }) as MacroResult).fn.length,
      'to equal',
      2,
    );
  });

  it('propagates an error passed to done', async (t) => {
    const failing = createMacro((_t, _options: void, done) => {
      done(new Error('boom'));
    });
    const { fn } = failing() as MacroResult;

    const result = await new Promise((resolve) => {
      fn(t, resolve);
    });

    expect(result, 'to be an', Error, 'and', 'to satisfy', {
      message: 'boom',
    });
  });
});

describe('titles', () => {
  it('derives a title from the macro config', () => {
    expect(macroB({ foo: 'bar' }), 'to satisfy', { name: 'macroB(bar)' });
  });

  it('omits a name when the macro has no title', () => {
    expect(macroA({}), 'not to have property', 'name');
  });

  it('uses a caller-provided title when the macro has no title', () => {
    void it(
      'caller wins',
      nameAssertingMacro('caller wins', { timeout: TIMEOUT }),
    );
  });

  // Documents current precedence: `node:test` spreads `options` *after* the
  // positional arguments, so a macro's own title beats the caller's.
  it('lets a macro title override a caller-provided title', () => {
    const titled = createMacro({
      exec: (t, expected: string) => {
        expect(t.name, 'to equal', expected);
      },
      testOptions: { timeout: TIMEOUT },
      title: (expected: string) => expected,
    });

    void it('THIS TITLE IS DISCARDED', titled('macro title wins'));
  });
});

describe('test option inheritance', () => {
  const defaulted = createMacro({
    exec: (t, { foo }: { foo: string }) => {
      expect(foo, 'to equal', 'foo');
    },
    testOptions: { concurrency: false, timeout: TIMEOUT },
  });

  it('applies the defaults when invoked without test options', () => {
    expect(defaulted({ foo: 'foo' }), 'to satisfy', {
      concurrency: false,
      timeout: TIMEOUT,
    });
  });

  it('lets an invocation override a default of the same name', () => {
    expect(defaulted({ foo: 'foo' }, { timeout: 10 }), 'to satisfy', {
      timeout: 10,
    });
  });

  it('merges with the defaults rather than replacing them', () => {
    expect(defaulted({ foo: 'foo' }, { plan: 1, timeout: 10 }), 'to satisfy', {
      concurrency: false,
      plan: 1,
      timeout: 10,
    });
  });

  // The assertions above only prove the merge produces the right object. These
  // two prove the merged options actually reach `node:test`.
  it('hands a default through to node:test', () => {
    const neverRuns = createMacro({
      exec: (_t, _options: void) => {
        throw new Error('a skipped macro must not run');
      },
      testOptions: { skip: 'the default skip reached node:test' },
    });

    void it('skipped via a macro default', neverRuns());
  });

  it('hands an overridden option through to node:test', (t) => {
    const planned = createMacro({
      // `t` needs an explicit annotation because `t.assert.ok` is an assertion
      // function, and TypeScript refuses to call those through inferred names.
      exec: (t: TestContext, { count }: { count: number }) => {
        for (let i = 0; i < count; i++) {
          t.assert.ok(true);
        }
      },
      testOptions: { plan: 1, timeout: TIMEOUT },
    });

    // Fails as a plan mismatch if the invocation's `plan` does not win.
    t.test('plan overridden to 3', planned({ count: 3 }, { plan: 3 }));
  });
});
