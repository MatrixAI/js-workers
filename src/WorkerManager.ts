import type { WorkerFactory, WorkerManifest, WorkerResult } from './types.js';
import type { TransferListItem } from 'node:worker_threads';
import Logger from '@matrixai/logger';
import { CreateDestroy, ready } from '@matrixai/async-init/CreateDestroy.js';
import { type WorkerTaskInformation } from './types.js';
import * as errors from './errors.js';
import WorkerPool from './WorkerPool.js';

@CreateDestroy()
class WorkerManager<Manifest extends WorkerManifest> {
  /**
   * Creates and initializes a new instance of WorkerManager.
   *
   * @param options - The configuration options for the WorkerManager.
   * @param options.workerFactory - The factory for creating workers.
   * @param options.manifest - The manifest defining the worker capabilities and operations.
   * @param [options.cores=1] - The number of cores to allocate for workers. Defaults to 1.
   * @param [options.logger=new Logger(this.name)] - An optional logger instance for logging activities. Defaults to a new logger.
   * @return A promise that resolves to a new WorkerManager instance.
   */
  public static async createWorkerManager<Manifest extends WorkerManifest>({
    workerFactory,
    manifest,
    cores = 1,
    logger = new Logger(this.name),
  }: {
    workerFactory: WorkerFactory;
    manifest: Manifest;
    cores?: number;
    logger?: Logger;
  }): Promise<WorkerManager<Manifest>> {
    logger.info('Creating WorkerManager');
    const workerManager = new this<Manifest>({
      workerFactory,
      manifest,
      cores,
      logger,
    });
    logger.info('Created WorkerManager');
    return workerManager;
  }

  protected pool: WorkerPool;
  protected logger: Logger;
  /**
   * Methods exposes a fully typed interface for making calls using workers.
   * It provides all the available methods provided by the manifest with proper types applied.
   */
  public methods: Manifest;

  /**
   * Constructs a new instance of the class using the provided parameters.
   *
   * @param config - The configuration for the constructor.
   * @param config.workerFactory - The factory for creating worker instances.
   * @param config.manifest - The manifest containing method definitions.
   * @param config.cores - The number of cores to allocate for the worker pool.
   * @param config.logger - The logger instance for logging messages.
   */
  public constructor({
    workerFactory,
    manifest,
    cores,
    logger,
  }: {
    workerFactory: WorkerFactory;
    manifest: Manifest;
    cores: number;
    logger: Logger;
  }) {
    this.logger = logger;
    this.pool = new WorkerPool(cores, workerFactory);
    this.methods = new Proxy<Manifest>(manifest, {
      get: (_, prop: string | symbol) => {
        if (typeof prop === 'symbol') return;
        return async (
          data: WorkerResult,
          transferList: Array<TransferListItem>,
        ) => {
          const result = await this.call({ type: prop, data, transferList });
          if (result.transferList == null) return { data: result.data };
          return result;
        };
      },
    });
  }

  /**
   * Destroys the WorkerManager instance and terminates its associated pool.
   *
   * @param [params={}] - An optional configuration object.
   * @param [params.force=false] - Indicates whether to forcefully terminate the pool.
   * @return A promise that resolves when the destruction process is complete.
   */
  public async destroy({
    force = false,
  }: { force?: boolean } = {}): Promise<void> {
    this.logger.info('Destroying WorkerManager');
    await this.pool.terminate(force);
    this.logger.info('Destroyed WorkerManager');
  }

  /**
   * Processes a worker task by enqueuing it for execution.
   *
   * @param task - The information about the worker task to be executed.
   * @return A promise that resolves with the result of the worker task execution.
   */
  @ready(new errors.ErrorWorkerManagerDestroyed())
  public async call(task: WorkerTaskInformation): Promise<WorkerResult> {
    return await this.queue(task);
  }

  /**
   * Enqueues a task to be processed by the worker pool.
   *
   * @param task - The task to be processed by the worker pool.
   * @return A promise that resolves with the result of the task or rejects with an error if the task fails or cannot be processed.
   */
  @ready(new errors.ErrorWorkerManagerDestroyed())
  public queue(task: WorkerTaskInformation): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      this.pool.runTask(task, (result, error) => {
        if (error != null) return reject(error);
        return resolve(result);
      });
    });
  }

  /**
   * Returns a promise that resolves when the pool status becomes 'idle',
   * or rejects if the pool status changes to 'terminated' or an error occurs.
   *
   * @return A promise that resolves when the pool is idle or rejects with an error.
   */
  @ready(new errors.ErrorWorkerManagerDestroyed())
  public async completed(): Promise<void> {
    return await this.pool.completed();
  }

  /**
   * Returns a promise that resolves when the pool status becomes 'idle',
   * or rejects if the pool status becomes 'terminated'.
   *
   * @return A promise that resolves once the pool status is 'idle',
   * or rejects if the pool status becomes 'terminated'.
   */
  @ready(new errors.ErrorWorkerManagerDestroyed())
  public async settled() {
    return await this.pool.settled();
  }
}

export default WorkerManager;
