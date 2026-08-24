/**
 * Wraps a socket event handler with try/catch so a synchronous failure in the
 * data layer can never crash the process (legacy handlers had no protection).
 */
export function safeHandler<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  return (...args: A): void => {
    try {
      fn(...args);
    } catch (err) {
      console.error('[socket handler error]', err);
    }
  };
}
