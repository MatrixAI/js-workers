import type { WorkerModule } from '@/worker';

import { spawn, Worker, Transfer } from 'threads';
import Logger, { LogLevel, StreamHandler } from '@matrixai/logger';
import WorkerManager from '@/WorkerManager';
import * as errors from '@/errors';

describe('WorkerManager', () => {
  const logger = new Logger('WorkerManager Test', LogLevel.WARN, [
    new StreamHandler(),
  ]);
  test('async construction and async destroy', async () => {
    const workerManager = await WorkerManager.createWorkerManager<WorkerModule>({
      workerFactory: () => spawn(new Worker('../src/worker')),
      logger
    });
    expect(workerManager.running).toBe(true);
    expect(workerManager.destroyed).toBe(false);
    expect(await workerManager.call(async () => 1)).toBe(1);
    await workerManager.destroy();
    expect(workerManager.running).toBe(false);
    expect(workerManager.destroyed).toBe(true);
    expect(workerManager.call(async () => 1)).rejects.toThrow(
      errors.ErrorWorkerManagerNotRunning,
    );
  });
  test('start with just 1 worker core', async () => {
    const workerManager = await WorkerManager.createWorkerManager<WorkerModule>({
      workerFactory: () => spawn(new Worker('../src/worker')),
      cores: 1,
      logger
    });
    expect(await workerManager.call(async () => 1)).toBe(1);
    await workerManager.destroy();
  });
  test('call runs in the main thread', async () => {
    const mainPid1 = process.pid;
    const workerManager = await WorkerManager.createWorkerManager<WorkerModule>({
      workerFactory: () => spawn(new Worker('../src/worker')),
      cores: 1,
      logger
    });
    let mainPid2: number;
    let mainPid3: number;
    // Only `w.f()` functions are running in the worker threads
    // the callback passed to `call` is still running in the main thread
    expect(
      await workerManager.call(async (w) => {
        mainPid2 = process.pid;
        const process2 = require('process');
        mainPid3 = process2.pid;
        return await w.isRunningInWorker();
      }),
    ).toBe(true);
    await workerManager.destroy();
    expect(mainPid2!).toBe(mainPid1);
    expect(mainPid3!).toBe(mainPid1);
  });
  test('can await a subset of tasks', async () => {
    // Use all possible cores
    // if you only use 1 core, this test will be much slower
    const workerManager = await WorkerManager.createWorkerManager<WorkerModule>({
      workerFactory: () => spawn(new Worker('../src/worker')),
      logger
    });
    const task = workerManager.call(async (w) => {
      return await w.sleep(500);
    });
    const taskCount = 5;
    const tasks: Array<Promise<unknown>> = [];
    for (let i = 0; i < taskCount; i++) {
      tasks.push(
        workerManager.call(async (w) => {
          return await w.sleep(500);
        }),
      );
    }
    const rs = await Promise.all(tasks);
    expect(rs.length).toBe(taskCount);
    expect(rs.every((x) => x === undefined)).toBe(true);
    const r = await task;
    expect(r).toBeUndefined();
    await workerManager.destroy();
  });
  test('queueing up tasks', async () => {
    // Use all possible cores
    // if you only use 1 core, this test will be much slower
    const workerManager = await WorkerManager.createWorkerManager<WorkerModule>({
      workerFactory: () => spawn(new Worker('../src/worker')),
      logger
    });
    const t1 = workerManager.queue(async (w) => await w.sleep(500));
    const t2 = workerManager.queue(async (w) => await w.sleep(500));
    const t3 = workerManager.queue(async (w) => await w.sleep(500));
    const t4 = workerManager.queue(async (w) => await w.sleep(500));
    await workerManager.completed();
    expect(await t1).toBeUndefined();
    expect(await t2).toBeUndefined();
    expect(await t3).toBeUndefined();
    expect(await t4).toBeUndefined();
    workerManager.queue(async (w) => await w.sleep(500));
    workerManager.queue(async (w) => await w.sleep(500));
    workerManager.queue(async (w) => await w.sleep(500));
    workerManager.queue(async (w) => await w.sleep(500));
    const es = await workerManager.settled();
    expect(es.length).toBe(0);
    await workerManager.destroy();
  });
  test('zero-copy buffer transfer', async () => {
    const workerManager = await WorkerManager.createWorkerManager<WorkerModule>({
      workerFactory: () => spawn(new Worker('../src/worker')),
      cores: 1,
      logger
    });
    const buffer = await workerManager.call(async (w) => {
      // Start with a Node Buffer that is "pooled"
      const inputBuffer = Buffer.from('hello 1');
      // Slice copy out the ArrayBuffer
      const input = inputBuffer.buffer.slice(
        inputBuffer.byteOffset,
        inputBuffer.byteOffset + inputBuffer.byteLength,
      );
      // When the underlying ArrayBuffer is detached
      // this Buffer's byteLength will also become 0
      const inputBuffer_ = Buffer.from(input);
      expect(inputBuffer_.byteLength).toBe(input.byteLength);
      // Zero-copy transfer moves "ownership"
      // input is detached from main thread
      // output is detached from worker thread
      const output = await w.transferBuffer(Transfer(input));
      // Detached ArrayBuffers have byte lengths of 0
      expect(input.byteLength).toBe(0);
      expect(inputBuffer_.byteLength).toBe(0);
      // Zero-copy wrap to use Node Buffer API
      const outputBuffer = Buffer.from(output);
      return outputBuffer;
    });
    expect(buffer).toEqual(Buffer.from('hello 2'));
    await workerManager.destroy();
  });
});
