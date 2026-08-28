import { describe, expect, it, vi } from 'vitest';

import { createSerialTaskQueue } from './serial-task-queue';

describe('createSerialTaskQueue', () => {
  it('waits for the active task before starting the next one', async () => {
    let releaseFirst!: () => void;
    const firstTask = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const started: number[] = [];
    const task = vi.fn(async (value: number) => {
      started.push(value);
      if (value === 1) await firstTask;
    });
    const enqueue = createSerialTaskQueue(task);

    const first = enqueue(1);
    const second = enqueue(2);
    await Promise.resolve();

    expect(started).toEqual([1]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(started).toEqual([1, 2]);
  });
});
