import type { ModuleThread } from 'threads';
import type { ModuleMethods } from 'threads/dist/types/master';
import type { QueuedTask } from 'threads/dist/master/pool-types';

import { Pool } from 'threads';
import Logger from '@matrixai/logger';
import WorkerManagerInterface from './WorkerManagerInterface';
import * as errors from './errors';

class WorkerManager<W extends ModuleMethods>
  implements WorkerManagerInterface<W>
{
  protected pool: Pool<ModuleThread<W>>;
  protected logger: Logger;
  protected _started: boolean = false;

  constructor({
    logger,
  }: {
    logger?: Logger;
  } = {}) {
    this.logger = logger ?? new Logger(this.constructor.name);
  }

  get started(): boolean {
    return this._started;
  }

  /**
   * Starts the WorkerManager
   * The workerFactory needs to be a callback:
   * `() => spawn(new Worker(workerPath))`
   * The `spawn` and `Worker` can be imported from `threads`
   * The `workerPath` must point to a worker script
   * The `workerPath` can be either an absolute path or relative path
   * If it is a relative path, it has to be relative to the file location where
   * the function expression is defined
   */
  public async start({
    workerFactory,
    cores,
  }: {
    workerFactory: () => Promise<ModuleThread<W>>;
    cores?: number;
  }) {
    try {
      if (this._started) {
        return;
      }
      this.logger.info('Starting WorkerManager');
      this._started = true;
      this.pool = Pool(workerFactory, cores);
      this.logger.info(`Started WorkerManager`);
    } catch (e) {
      this._started = false;
      throw e;
    }
  }

  public async stop() {
    if (!this._started) {
      return;
    }
    this.logger.info('Stopping WorkerManager');
    await this.pool.terminate();
    this._started = false;
    this.logger.info('Stopped WorkerManager');
  }

  public async call<T>(f: (worker: ModuleThread<W>) => Promise<T>): Promise<T> {
    if (!this._started) {
      throw new errors.ErrorWorkerManagerNotStarted();
    }
    return await this.pool.queue(f);
  }

  public queue<T>(
    f: (worker: ModuleThread<W>) => Promise<T>,
  ): QueuedTask<ModuleThread<W>, T> {
    if (!this._started) {
      throw new errors.ErrorWorkerManagerNotStarted();
    }
    return this.pool.queue(f);
  }

  public async completed(): Promise<void> {
    if (!this._started) {
      throw new errors.ErrorWorkerManagerNotStarted();
    }
    return await this.pool.completed();
  }

  public async settled() {
    if (!this._started) {
      throw new errors.ErrorWorkerManagerNotStarted();
    }
    return await this.pool.settled();
  }
}

export default WorkerManager;
