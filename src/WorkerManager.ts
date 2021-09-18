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
  /**
   * Creates the WorkerManager
   * The workerFactory needs to be a callback:
   * `() => spawn(new Worker(workerPath))`
   * The `spawn` and `Worker` can be imported from `threads`
   * The `workerPath` must point to a worker script
   * The `workerPath` can be either an absolute path or relative path
   * If it is a relative path, it has to be relative to the file location where
   * the function expression is defined
   */
  public static async createWorkerManager<W extends ModuleMethods>({
    workerFactory,
    cores,
    logger = new Logger(this.name),
  }: {
    workerFactory: () => Promise<ModuleThread<W>>;
    cores?: number;
    logger?: Logger;
  }): Promise<WorkerManager<W>> {
    const workerManager = new WorkerManager({
      workerFactory,
      cores,
      logger,
    });
    return workerManager;
  }

  protected pool: Pool<ModuleThread<W>>;
  protected logger: Logger;
  protected _running: boolean = false;
  protected _destroyed: boolean = false;

  protected constructor({
    workerFactory,
    cores,
    logger,
  }: {
    workerFactory: () => Promise<ModuleThread<W>>;
    cores?: number;
    logger: Logger;
  }) {
    this.logger = logger;
    this.pool = Pool(workerFactory, cores);
    this._running = true;
  }

  get running(): boolean {
    return this._running;
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  public async destroy(): Promise<void> {
    if (this._destroyed) {
      return;
    }
    this.logger.info('Destroying WorkerManager');
    await this.pool.terminate();
    this._running = false;
    this._destroyed = true;
    this.logger.info('Destroyed WorkerManager');
  }

  public async call<T>(f: (worker: ModuleThread<W>) => Promise<T>): Promise<T> {
    if (!this._running) {
      throw new errors.ErrorWorkerManagerNotRunning();
    }
    return await this.pool.queue(f);
  }

  public queue<T>(
    f: (worker: ModuleThread<W>) => Promise<T>,
  ): QueuedTask<ModuleThread<W>, T> {
    if (!this._running) {
      throw new errors.ErrorWorkerManagerNotRunning();
    }
    return this.pool.queue(f);
  }

  public async completed(): Promise<void> {
    if (!this._running) {
      throw new errors.ErrorWorkerManagerNotRunning();
    }
    return await this.pool.completed();
  }

  public async settled() {
    if (!this._running) {
      throw new errors.ErrorWorkerManagerNotRunning();
    }
    return await this.pool.settled();
  }
}

export default WorkerManager;
