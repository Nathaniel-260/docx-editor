export function createSerialTaskQueue<Args extends unknown[]>(task: (...args: Args) => Promise<void>) {
  let queue = Promise.resolve();

  return (...args: Args) => {
    const pending = queue.then(() => task(...args));
    queue = pending.catch(() => undefined);
    return pending;
  };
}
