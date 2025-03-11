import type { Worker } from 'node:worker_threads';
import type { Subscription } from 'rxjs';
import type {
  TaskCallback,
  WorkerFactory,
  WorkerResultInternal,
  WorkerTaskInformation,
} from './types.js';
import { AsyncResource } from 'node:async_hooks';
import { Subject } from 'rxjs';
import * as errors from './errors.js';

/**
 * This defines a `WorkerTask` `AsyncResource` for tracking the life-cycle of a worker task
 * It works with the `Node:Async_hooks` for tracking async resources.
 */
class WorkerTask extends AsyncResource {
  protected callback: TaskCallback;

  constructor(callback: TaskCallback, triggerAsyncId?: number) {
    super('WorkerTask', triggerAsyncId);
    this.callback = callback;
  }

  public done(result: unknown, error: Error) {
    this.runInAsyncScope(this.callback, null, result, error);
    this.emitDestroy();
  }
}

const taskInfoSymbol = Symbol('Task Info Symbol');
type PoolStatus = 'terminated' | 'idle' | 'working' | 'queued';

/**
 * A WorkerPool class that manages a pool of worker threads for parallel processing.
 * This class allows tasks to be distributed among a fixed number of workers, ensuring
 * efficient utilization of resources. It provides mechanisms to queue tasks when all workers
 * are occupied and handles error recovery and worker recreation.
 */
class WorkerPool {
  protected workerFactory: WorkerFactory;
  protected workers: Set<Worker> = new Set();
  protected freeWorkers: Array<Worker> = [];
  protected queue: Array<{
    task: WorkerTaskInformation;
    callback: TaskCallback;
  }> = [];
  protected terminatedError: Error | undefined = undefined;
  protected handleDestroySubscription: Subscription;

  public $workerCreated = new Subject<void>();
  public $workerDestroyed = new Subject<void>();
  public $workerFreed = new Subject<void>();
  public $workerError = new Subject<Error>();
  public $poolStatus = new Subject<PoolStatus>();
  public poolStatus: PoolStatus = 'idle';

  /**
   * Constructs an instance of the Worker Pool class and initializes the specified number of workers.
   *
   * @param workerNum - The number of workers to be created in the pool. Must be at least 1.
   * @param workerFactory - A factory instance responsible for creating workers.
   * @return A Worker Pool instance initialized with the specified workers and configurations.
   * @throws {ErrorWorkerPoolInvalidWorkers} If the value of workerNum is less than 1.
   */
  constructor(workerNum: number, workerFactory: WorkerFactory) {
    if (workerNum < 1) throw new errors.ErrorWorkerPoolInvalidWorkers();
    this.workerFactory = workerFactory;
    for (let i = 0; i < workerNum; i++) {
      this.addWorker();
    }

    this.$workerFreed.subscribe(() => {
      if (this.queue.length > 0) {
        const queuedTask = this.queue.shift()!;
        this.runTask(queuedTask.task, queuedTask.callback);
        if (this.queue.length === 0) this.$poolStatus.next('working');
      } else if (this.freeWorkers.length === this.workers.size) {
        this.$poolStatus.next('idle');
      }
    });

    this.$poolStatus.subscribe((v) => {
      this.poolStatus = v;
    });

    this.handleDestroySubscription = this.$workerDestroyed.subscribe(() => {
      this.addWorker();
    });
  }

  /**
   * Adds a new worker to the worker pool by initializing its lifecycle handlers.
   *
   * This method creates a worker instance using the `workerFactory`, sets up its message and error event handlers,
   * and handles worker initialization, error propagation, task completion, and cleanup when the worker exits.
   * The initialized worker is stored in the list of free workers upon success.
   *
   */
  protected addWorker() {
    const worker = this.workerFactory();
    let workerError: Error;
    let initializing = true;
    const messageHandler = (result: WorkerResultInternal | 'initialized') => {
      if (initializing) {
        if (result !== 'initialized') {
          throw new errors.ErrorWorkerInitializationFailed();
        }
        initializing = false;
        this.freeWorkers.push(worker);
        this.$workerFreed.next();
        return;
      }
      if (result === 'initialized') {
        throw new errors.ErrorWorkersUndefinedBehaviour();
      }
      if (result.error != null) {
        worker[taskInfoSymbol].done(undefined, result.error);
      } else {
        worker[taskInfoSymbol].done(
          { data: result.data, transferList: result.transferList },
          undefined,
        );
      }
      worker[taskInfoSymbol] = undefined;
      this.freeWorkers.push(worker);
      this.$workerFreed.next();
    };
    const errorHandler = (e: Error) => {
      workerError = e;
      if (worker[taskInfoSymbol]) worker[taskInfoSymbol].done(undefined, e);
      else this.$workerError.next(e);
    };
    worker.on('message', messageHandler);
    worker.on('error', errorHandler);
    worker.once('exit', () => {
      worker.off('message', messageHandler);
      worker.off('error', errorHandler);
      this.workers.delete(worker);
      if (
        workerError != null &&
        `${workerError.message}`.includes('Cannot find module')
      ) {
        // If the worker errored then we want to check if it was a failure to load error
        if (this.workers.size === 0 && this.terminatedError == null) {
          this.terminatedError = new errors.ErrorWorkerPoolWorkerCreationFailed(
            workerError.message,
          );
          this.cleanUp(this.terminatedError);
        }
        return;
      }
      this.$workerDestroyed.next();
    });
    worker.once('online', async () => {
      worker.postMessage({ type: 'initialize', data: undefined });
    });
    this.workers.add(worker);
    this.$workerCreated.next();
  }

  /**
   * Executes a task using an available worker. If no workers are free, the task is added to the queue.
   *
   * @param task - The task information to be executed by a worker, including type, data, and transfer list.
   * @param callback - The callback function to handle the outcome of the executed task.
   */
  public runTask(task: WorkerTaskInformation, callback: TaskCallback) {
    if (this.terminatedError != null) throw this.terminatedError;
    if (this.freeWorkers.length === 0) {
      this.queue.push({ task, callback });
      if (this.queue.length === 1) this.$poolStatus.next('queued');
      return;
    }

    const wasIdle = this.freeWorkers.length === this.workers.size;
    const worker = this.freeWorkers.pop()!;
    if (wasIdle) this.$poolStatus.next('working');
    worker[taskInfoSymbol] = new WorkerTask(callback);
    worker.postMessage(
      { type: task.type, data: task.data, transferList: task.transferList },
      task.transferList,
    );
  }

  /**
   * Terminates the worker pool by stopping all workers, preventing new tasks, and cleaning up resources.
   *
   * @param force - Determines whether to force termination immediately (true) or wait for existing tasks to complete (false).
   * @return A promise that resolves when all workers are terminated and resources are cleaned up.
   */
  public async terminate(force: boolean) {
    if (this.terminatedError != null) return;
    this.terminatedError = new errors.ErrorWorkerPoolWorkerTerminated();
    // Prevent new tasks and wait for exising queue to drain
    if (!force) await this.settled();
    // Prevent terminations from creating new workers
    this.handleDestroySubscription.unsubscribe();
    const workerTerminatePs: Array<Promise<number>> = [];
    for (const worker of this.workers) {
      workerTerminatePs.push(worker.terminate());
    }
    await Promise.all(workerTerminatePs);
    this.cleanUp(this.terminatedError);
  }

  protected cleanUp(terminatedError: Error): void {
    // Cleaning up remaining queue and observables
    let task = this.queue.pop();
    while (task != null) {
      const workerTask = new WorkerTask(task.callback);
      workerTask.done(undefined, terminatedError);
      task = this.queue.pop();
    }
    this.$poolStatus.next('terminated');
    // Cleaning up subjects
    this.$workerCreated.complete();
    this.$workerDestroyed.complete();
    this.$workerFreed.complete();
    this.$workerError.complete();
    this.$poolStatus.complete();
  }

  /**
   * Returns a promise that resolves when the pool status becomes 'idle',
   * or rejects if the pool status changes to 'terminated' or an error occurs.
   *
   * @return A promise that resolves when the pool is idle or rejects with an error.
   */
  public completed(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.poolStatus === 'idle') return resolve();
      if (this.poolStatus === 'terminated') {
        return reject(this.terminatedError!);
      }
      const errorSubscription = this.$workerError.subscribe((e) => {
        errorSubscription.unsubscribe();
        stateSubscription.unsubscribe();
        reject(e);
      });
      const stateSubscription = this.$poolStatus.subscribe((v) => {
        if (v === 'idle') {
          errorSubscription.unsubscribe();
          stateSubscription.unsubscribe();
          return resolve();
        }
        if (v === 'terminated') {
          errorSubscription.unsubscribe();
          stateSubscription.unsubscribe();
          return reject(this.terminatedError!);
        }
      });
    });
  }

  /**
   * Returns a promise that resolves when the pool status becomes 'idle',
   * or rejects if the pool status becomes 'terminated'.
   *
   * @return A promise that resolves once the pool status is 'idle',
   * or rejects if the pool status becomes 'terminated'.
   */
  public settled(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.poolStatus === 'idle') return resolve();
      if (this.poolStatus === 'terminated') {
        return reject(this.terminatedError!);
      }
      const subscription = this.$poolStatus.subscribe((v) => {
        if (v === 'idle') {
          subscription.unsubscribe();
          return resolve();
        }
        if (v === 'terminated') {
          subscription.unsubscribe();
          return reject(this.terminatedError!);
        }
      });
    });
  }
}

export default WorkerPool;
