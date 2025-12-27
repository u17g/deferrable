type Result<T, E = Error> = [value: T, error: undefined] | [value: undefined, error: E];

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
  fn: (defer: (exec: (result: [value: T, error: undefined] | [value: undefined, error: E]) => void | Promise<void>) => void) => Promise<T>,
): Promise<T> {
  const stack: Parameters<Parameters<typeof fn>[0]>[0][] = [];
  const defer: Parameters<typeof fn>[0] = (exec) => {
    stack.push(exec);
  };
  const result = await wrap<T, E>(fn(defer));
  while (stack.length) {
    const exec = stack.pop()!;
    try {
      await exec(result);
    } catch { }
  }
  const [value, error] = result;
  if (error !== undefined) throw error;
  return value as T;
};
