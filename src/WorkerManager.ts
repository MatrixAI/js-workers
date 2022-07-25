import type { ModuleThread } from 'threads';
import type { ModuleMethods } from 'threads/dist/types/master';
import type { QueuedTask } from 'threads/dist/master/pool-types';
import type WorkerManagerInterface from './WorkerManagerInterface';
import { Pool } from 'threads';
import Logger from '@matrixai/logger';
import { CreateDestroy, ready } from '@matrixai/async-init/dist/CreateDestroy';
import * as errors from './errors';

@CreateDestroy()
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
   * If `cores` is set to 0, this creates a useless worker pool
   * Use `undefined` to mean using all cores
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
    logger.info('Creating WorkerManager');
    const workerManager = new this({
      workerFactory,
      cores,
      logger,
    });
    logger.info('Created WorkerManager');
    return workerManager;
  }

  protected pool: Pool<ModuleThread<W>>;
  protected logger: Logger;

  public constructor({
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
  }

  public async destroy({
    force = false,
  }: { force?: boolean } = {}): Promise<void> {
    this.logger.info('Destroying WorkerManager');
    await this.pool.terminate(force);
    this.logger.info('Destroyed WorkerManager');
  }

  @ready(new errors.ErrorWorkerManagerDestroyed())
  public async call<T>(f: (worker: ModuleThread<W>) => Promise<T>): Promise<T> {
    return await this.pool.queue(f);
  }

  @ready(new errors.ErrorWorkerManagerDestroyed())
  public queue<T>(
    f: (worker: ModuleThread<W>) => Promise<T>,
  ): QueuedTask<ModuleThread<W>, T> {
    return this.pool.queue(f);
  }

  @ready(new errors.ErrorWorkerManagerDestroyed())
  public async completed(): Promise<void> {
    return await this.pool.completed();
  }

  @ready(new errors.ErrorWorkerManagerDestroyed())
  public async settled() {
    return await this.pool.settled();
  }
}

export default WorkerManager;
