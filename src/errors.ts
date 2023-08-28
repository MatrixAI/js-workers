import { AbstractError } from '@matrixai/errors';

class ErrorWorkers<T> extends AbstractError<T> {
  static description = 'Workers domain error';
}

class ErrorWorkersUndefinedBehaviour<T> extends ErrorWorkers<T> {
  static description = 'You should never see this error';
}

class ErrorWorkerManager<T> extends ErrorWorkers<T> {
  static description = 'WorkerManager error';
}

class ErrorWorkerManagerDestroyed<T> extends ErrorWorkerManager<T> {
  static description = 'WorkerManager is destroyed';
}

class ErrorWorkerPool<T> extends ErrorWorkers<T> {
  static description = 'WorkerPool error';
}

class ErrorWorkerPoolInvalidWorkers<T> extends ErrorWorkerPool<T> {
  static description = 'You must have at minimum 1 worker';
}

class ErrorWorkerPoolWorkerCreationFailed<T> extends ErrorWorkerPool<T> {
  static description = 'Failed to create workers when creating a WorkerPool';
}

class ErrorWorkerPoolWorkerTerminated<T> extends ErrorWorkerPool<T> {
  static description = 'Worker pool is terminated';
}

class ErrorWorker<T> extends ErrorWorkers<T> {
  static description = 'Worker error';
}

class ErrorWorkerHandlerMissing<T> extends ErrorWorker<T> {
  static description = 'Worker has not exposed a handler of this name';
}

class ErrorWorkerInitializationFailed<T> extends ErrorWorker<T> {
  static description =
    'Worker failed to initialize with an initialization message';
}

export {
  ErrorWorkers,
  ErrorWorkersUndefinedBehaviour,
  ErrorWorkerManager,
  ErrorWorkerManagerDestroyed,
  ErrorWorkerPool,
  ErrorWorkerPoolInvalidWorkers,
  ErrorWorkerPoolWorkerCreationFailed,
  ErrorWorkerPoolWorkerTerminated,
  ErrorWorker,
  ErrorWorkerHandlerMissing,
  ErrorWorkerInitializationFailed,
};
