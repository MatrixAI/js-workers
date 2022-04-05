import { AbstractError } from '@matrixai/errors';

class ErrorWorkerManager<T> extends AbstractError<T> {
  static description = 'WorkerManager error';
}

class ErrorWorkerManagerDestroyed<T> extends ErrorWorkerManager<T> {
  static description = 'WorkerManager is destroyed';
}

export { ErrorWorkerManager, ErrorWorkerManagerDestroyed };
