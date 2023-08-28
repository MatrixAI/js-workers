import type { WorkerFactory, WorkerResult } from '#types.js';
import { Worker } from 'node:worker_threads';
import url from 'url';
import path from 'node:path';
import Logger, { LogLevel, StreamHandler } from '@matrixai/logger';
import { destroyed } from '@matrixai/async-init';
import WorkerManager from '#WorkerManager.js';
import * as errors from '#errors.js';
import workerManifest from '#worker.js';

const dirname = url.fileURLToPath(new URL('.', import.meta.url));

describe('WorkerManager', () => {
  const logger = new Logger('WorkerManager Test', LogLevel.WARN, [
    new StreamHandler(),
  ]);

  const workerFactory: WorkerFactory = () => {
    return new Worker(path.join(dirname, '../dist/worker.js'));
  };

  let workerManager: WorkerManager<typeof workerManifest>;

  afterEach(async () => {
    await workerManager?.destroy();
  });

  test('async construction and async destroy', async () => {
    workerManager = await WorkerManager.createWorkerManager({
      workerFactory,
      manifest: workerManifest,
      cores: 1,
      logger,
    });
    expect(workerManager[destroyed]).toBe(false);
    expect(await workerManager.call({ type: 'test', data: undefined })).toEqual(
      { data: 'hello world!' },
    );
    await workerManager.destroy();
    expect(workerManager[destroyed]).toBe(true);
    await expect(
      workerManager.call({ type: 'test', data: undefined }),
    ).rejects.toThrow(errors.ErrorWorkerManagerDestroyed);
  });
  test('starting with 0 worker cores will throw', async () => {
    await expect(
      WorkerManager.createWorkerManager({
        workerFactory,
        manifest: workerManifest,
        cores: 0,
        logger,
      }),
    ).rejects.toThrow(errors.ErrorWorkerPoolInvalidWorkers);
  });
  test('start with 1 worker core', async () => {
    workerManager = await WorkerManager.createWorkerManager({
      workerFactory,
      manifest: workerManifest,
      cores: 1,
      logger,
    });
    expect(await workerManager.call({ type: 'test', data: undefined })).toEqual(
      { data: 'hello world!' },
    );
    await workerManager.destroy();
  });
  test('can await a subset of tasks', async () => {
    // Use all possible cores
    // if you only use 1 core, this test will be much slower
    workerManager = await WorkerManager.createWorkerManager({
      workerFactory,
      manifest: workerManifest,
      cores: 1,
      logger,
    });
    const task = workerManager.call({ type: 'sleep', data: 500 });
    const taskCount = 5;
    const tasks: Array<Promise<unknown>> = [];
    for (let i = 0; i < taskCount; i++) {
      tasks.push(workerManager.call({ type: 'sleep', data: 500 }));
    }
    const rs = await Promise.all(tasks);
    expect(rs.length).toBe(taskCount);
    expect(rs.every((x: WorkerResult) => x.data === undefined)).toBe(true);
    const r = await task;
    expect(r).toEqual({ data: undefined });
    await workerManager.destroy();
  });
  test('queueing up tasks', async () => {
    // Use all possible cores
    // if you only use 1 core, this test will be much slower
    workerManager = await WorkerManager.createWorkerManager({
      workerFactory,
      manifest: workerManifest,
      cores: 1,
      logger,
    });
    const t1 = workerManager.queue({ type: 'sleep', data: 500 });
    const t2 = workerManager.queue({ type: 'sleep', data: 500 });
    const t3 = workerManager.queue({ type: 'sleep', data: 500 });
    const t4 = workerManager.queue({ type: 'sleep', data: 500 });
    await workerManager.completed();
    expect(await t1).toEqual({ data: undefined });
    expect(await t2).toEqual({ data: undefined });
    expect(await t3).toEqual({ data: undefined });
    expect(await t4).toEqual({ data: undefined });
    void workerManager.queue({ type: 'sleep', data: 500 });
    void workerManager.queue({ type: 'sleep', data: 500 });
    void workerManager.queue({ type: 'sleep', data: 500 });
    void workerManager.queue({ type: 'sleep', data: 500 });
    await workerManager.settled();
    await workerManager.destroy();
  });
  test('zero-copy buffer transfer', async () => {
    workerManager = await WorkerManager.createWorkerManager({
      workerFactory,
      manifest: workerManifest,
      cores: 1,
      logger,
    });
    // Creating a new buffer
    const inputBuffer = Buffer.from('hello 1');
    // Extracting the underlying ArrayBuffer
    const input = inputBuffer.buffer.slice(
      inputBuffer.byteOffset,
      inputBuffer.byteOffset + inputBuffer.byteLength,
    );
    // Making call with transfer
    const output = await workerManager.call({
      type: 'transferBuffer',
      data: input,
      transferList: [input],
    });
    // The input ArrayBuffer is detached so the length is now 0
    expect(input.byteLength).toBe(0);
    // The output should be filled with 0xF
    expect(Buffer.from(output.data as ArrayBuffer)).toEqual(
      Buffer.alloc(inputBuffer.byteLength, 0xf),
    );

    await workerManager.destroy();
  });

  test('proxy', async () => {
    const workerManager = await WorkerManager.createWorkerManager<
      typeof workerManifest
    >({
      workerFactory,
      cores: 1,
      manifest: workerManifest,
      logger,
    });
    expect(await workerManager.methods.test()).toEqual({
      data: 'hello world!',
    });
    expect(await workerManager.methods.add({ a: 1, b: 2 })).toEqual({
      data: 3,
    });
    expect(await workerManager.methods.sub({ a: 1, b: 2 })).toEqual({
      data: -1,
    });
    expect(await workerManager.methods.fac(5)).toEqual({ data: 120 });
    expect(await workerManager.methods.sleep(10)).toEqual({ data: undefined });
    const arrayBuffer = new ArrayBuffer(100);
    const result = await workerManager.methods.transferBuffer(arrayBuffer, [
      arrayBuffer,
    ]);
    expect(new Uint8Array(result.data)).toEqual(new Uint8Array(100).fill(0xf));

    await workerManager.destroy();
  });
});
