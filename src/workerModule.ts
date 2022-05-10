import type { TransferDescriptor } from 'threads';
import { Transfer } from 'threads';

import { isWorkerRuntime } from 'threads';

/**
 * Worker object that contains all functions that will be executed in parallel
 * Functions should be using CPU-parallelism not IO-parallelism
 * Most functions should be synchronous, not asynchronous
 * Making them asynchronous does not make a difference to the caller
 * The caller must always await because the functions will run on the pool
 */
const worker = {
  /**
   * Check if we are running in the worker.
   * Only used for testing
   */
  isRunningInWorker(): boolean {
    return isWorkerRuntime();
  },
  /**
   * Sleep synchronously
   * This blocks the entire event loop
   * Only used for testing
   */
  sleep(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    return;
  },
  /**
   * Zero copy demonstration manipulating buffers
   */
  transferBuffer(data: ArrayBuffer): TransferDescriptor<ArrayBuffer> {
    // Zero-copy wrap to use Node Buffer API
    const buffer = Buffer.from(data);
    // Set the last character to 2
    buffer[buffer.byteLength - 1] = '2'.charCodeAt(0);
    // Node Buffer cannot be detached
    // so we transfer the ArrayBuffer instead
    return Transfer(data);
  },
};

type WorkerModule = typeof worker;

export type { WorkerModule };

export default worker;
