import type { WorkerFactory } from '#types.js';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import * as url from 'url';
import WorkerPool from '#WorkerPool.js';
import * as errors from '#errors.js';

const dirname = url.fileURLToPath(new URL('.', import.meta.url));

describe('WorkerPool', () => {
  let pool: WorkerPool;
  const workerFactory: WorkerFactory = () => {
    return new Worker(path.join(dirname, '../dist/worker.js'));
  };

  afterEach(async () => {
    await pool?.terminate(true);
  });

  test('worker pool must have at least 1 worker', async () => {
    expect(() => new WorkerPool(0, workerFactory)).toThrow(
      errors.ErrorWorkerPoolInvalidWorkers,
    );
    expect(() => new WorkerPool(-1, workerFactory)).toThrow(
      errors.ErrorWorkerPoolInvalidWorkers,
    );
    pool = new WorkerPool(1, workerFactory);
    await pool.terminate(true);
  });
  test('can run tasks', async () => {
    pool = new WorkerPool(3, workerFactory);
    const numTasks = 20;
    for (let i = 0; i < numTasks; i++) {
      pool.runTask({ type: 'test', data: undefined }, () => {
        // Do nothing
      });
    }
    await pool.settled();
    await pool.terminate(false);
  });
  test('tasks return expected results', async () => {
    pool = new WorkerPool(1, workerFactory);
    const task1 = new Promise((resolve, reject) => {
      pool.runTask({ type: 'test', data: undefined }, (result, error) => {
        if (error != null) return reject(error);
        return resolve(result);
      });
    });
    await expect(task1).resolves.toEqual({
      data: 'hello world!',
      transferList: undefined,
    });

    const task2 = new Promise((resolve, reject) => {
      pool.runTask({ type: 'add', data: { a: 2, b: 2 } }, (result, error) => {
        if (error != null) return reject(error);
        return resolve(result);
      });
    });
    await expect(task2).resolves.toEqual({ data: 4, transferList: undefined });

    const task3 = new Promise((resolve, reject) => {
      pool.runTask({ type: 'fac', data: 5 }, (result, error) => {
        if (error != null) return reject(error);
        return resolve(result);
      });
    });
    await expect(task3).resolves.toEqual({
      data: 120,
      transferList: undefined,
    });

    const task4 = new Promise((resolve, reject) => {
      pool.runTask({ type: 'sleep', data: 10 }, (result, error) => {
        if (error != null) return reject(error);
        return resolve(result);
      });
    });
    await expect(task4).resolves.toEqual({
      data: undefined,
      transferList: undefined,
    });
  });
  test('WorkerPool handles failure to create worker', async () => {
    pool = new WorkerPool(3, () => new Worker('./badPath'));
    const taskP = new Promise<unknown>((resolve, reject) => {
      pool.runTask({ type: 'test', data: undefined }, (result, error) => {
        if (error != null) return reject(error);
        return resolve(result);
      });
    });
    await expect(taskP).rejects.toThrow(
      errors.ErrorWorkerPoolWorkerCreationFailed,
    );
    await expect(pool.settled()).rejects.toThrow(
      errors.ErrorWorkerPoolWorkerCreationFailed,
    );
    await expect(pool.completed()).rejects.toThrow(
      errors.ErrorWorkerPoolWorkerCreationFailed,
    );
    await pool.terminate(false);
  });
});
