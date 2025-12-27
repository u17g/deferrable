type Result<T, E = Error> = [value: T, error: undefined] | [value: undefined, error: E];

/**
 * A deferred callback registered via `defer(...)`.
 *
 * It will be executed after the main callback finishes (either resolved or rejected),
 * in **LIFO** order. If it throws/rejects, `deferrable` fails fast with that error.
 */
export type DeferredCallback<T, E = Error> = (
  /**
   * The result of the main callback:
   * - `[value, undefined]` on success
   * - `[undefined, error]` on failure
   */
  result: [value: T, error: undefined] | [value: undefined, error: E],
) => void | Promise<void>;

/**
 * Register a deferred callback to be executed later (LIFO).
 *
 * @example
 * await deferrable(async (defer): Promise<number> => {
 *   defer(async ([value, err]) => {
 *     // cleanup / rollback
 *   });
 *   return 42;
 * });
 */
export type Defer<T, E = Error> = (exec: DeferredCallback<T, E>) => void;

function ok<T>(value: T): Result<T, never> {
  return [value, undefined];
};

function failure<E = Error>(error: E): Result<never, E> {
  return [undefined, error];
};

async function wrap<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    return failure(error as E);
  }
}

/**
 * Deferrable execution.
 *
 * This function is used to execute a function with a deferrable execution stack - LIFO.
 *
 * @param fn - The function to execute.
 * @returns The result of the function.
 *
 * @example
 *
 *  await deferrable(async (defer): Promise<string> => {
 *    defer(async ([result, err]) => {
 *      if (err) {
 *        console.error(err);
 *      } else {
 *        console.log(result);
 *      }
 *    });
 *
 *    return "Hello, world!";
 *  });
 */
export async function deferrable<T, E = Error>(
  fn: (defer: Defer<T, E>) => Promise<T>,
): Promise<T> {
  const stack: Parameters<Parameters<typeof fn>[0]>[0][] = [];
  const defer: Parameters<typeof fn>[0] = (exec) => {
    stack.push(exec);
  };
  const result = await wrap<T, E>(fn(defer));
  const [value, mainError] = result;
  while (stack.length) {
    const exec = stack.pop()!;
    try {
      await exec(result);
    } catch (error) {
      throw error;
    }
  }
  if (mainError !== undefined) {
    throw mainError;
  }
  return value as T;
};