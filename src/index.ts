/**
 * Provides a simple macro system for `node:test`.
 *
 * @module node-test-macro
 */

import { type TestContext, type TestOptions } from 'node:test';

/**
 * A "macro", as returned by {@link createMacro}.
 *
 * Invoking it yields an object which can be provided directly to `it()`,
 * `test()` or their `only`/`skip`/`todo` variants.
 *
 * @param options The user-defined options.
 * @param testOptions Any additional options for `test`/`it`. Inherits from
 *   {@link MacroConfig['testOptions']}.
 * @returns A `TestOptions` object.
 */
export type Macro<T = unknown> = (
  options: T,
  testOptions?: MacroTestOptions,
) => TestOptions;

/**
 * Object form accepted by {@link createMacro}, for macros which want to derive
 * their own test titles.
 */
export type MacroConfig<T = unknown> = {
  /**
   * The function which implements the macro.
   */
  exec: MacroTestFn<T>;

  /**
   * **Default** test options. Can be overridden when the macro is invoked.
   */
  testOptions?: MacroTestOptions;

  /**
   * The function which derives the test title from the `options`.
   */
  title?: string | TitleFn<T>;
};

/**
 * The implementation of a macro: a `node:test` test function which additionally
 * receives the macro's `options`.
 *
 * Mirrors `TestFn` from `@types/node`: `done` is declared as required, so a
 * macro which wants it can simply call it, and a macro which does not want it
 * omits the parameter entirely.
 */
export type MacroTestFn<T = unknown> = (
  t: TestContext,
  options: T,
  done: (result?: any) => void,
) => Promise<void> | void;

/**
 * `node:test`-specific options which a {@link MacroTestFn} may receive.
 *
 * @remarks
 * Note: neither `fn` nor `name` are flagged as public in the `TestOptions`
 * type.
 */
export type MacroTestOptions = Omit<TestOptions, 'fn' | 'name'>;

/**
 * A function which returns a test title for a given `options` object.
 */
export type TitleFn<T = unknown> = (options: T) => string;

/**
 * A view of {@link MacroTestFn} which may be invoked with or without `done`.
 *
 * `done` is `any` rather than optional because a required parameter is not
 * assignable to an optional one under contravariance, which would make
 * {@link MacroTestFn} incompatible with this type.
 */
type AnyMacroTestFn<T = unknown> = (
  t: TestContext,
  options: T,
  done?: any,
) => Promise<void> | void;

/**
 * Arity at which a {@link TestFn} is considered callback-style.
 */
const CALLBACK_STYLE_ARITY = 3;

/**
 * Builds a reusable, parameterized `node:test` test.
 *
 * @example
 *
 * ```ts
 * const throws = createMacro({
 *   exec: (t, { input }: { input: string }) => {
 *     assert.throws(() => parse(input));
 *   },
 *   title: ({ input }) => `rejects ${input}`,
 * });
 *
 * it(throws({ input: '{' }));
 * ```
 *
 * @param config A {@link MacroTestFn}, or a {@link MacroConfig} which also
 *   derives the test's title.
 * @returns A {@link Macro} to invoke with its options
 */
export const createMacro = <T = unknown>(
  config: MacroConfig<T> | MacroTestFn<T>,
): Macro<T> => {
  const {
    exec,
    testOptions: defaultTestOptions,
    title,
  } = typeof config === 'function'
    ? { exec: config, title: undefined }
    : config;

  const anyExec: AnyMacroTestFn<T> = exec;
  // we can't just check if `done` is `undefined`; we must match the underlying
  // implementation which checks the arity.
  const wrap =
    exec.length >= CALLBACK_STYLE_ARITY
      ? (options: T) => (t: TestContext, done: (result?: any) => void) =>
          anyExec(t, options, done)
      : (options: T) => (t: TestContext) => anyExec(t, options);

  return (options, testOptions) => {
    const opts: TestOptions = {
      ...defaultTestOptions,
      ...testOptions,
      // @ts-expect-error: `fn` is not flagged as public in the `TestOptions` type
      fn: wrap(options),
    };

    const name = typeof title === 'function' ? String(title(options)) : title;
    if (name !== undefined) {
      // @ts-expect-error: `name` is not flagged as public in the `TestOptions` type
      opts.name = name;
    }

    return opts;
  };
};
