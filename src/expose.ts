import type {
  WorkerTaskInformation,
  WorkerManifest,
  WorkerResultInternal,
} from './types.js';
import { isMainThread, parentPort } from 'node:worker_threads';
import * as workerErrors from './errors.js';

/**
 * Exposes a worker's handlers for processing tasks received from the parent thread.
 * This can be called within the main thread however it will do nothing.
 *
 * @param workerManifest - An object containing the methods that the worker can handle.
 */
function expose(workerManifest: WorkerManifest) {
  // We don't want to run this in the main thread since it's not acting as a worker
  if (isMainThread) return;
  const handleMessage = async (task: WorkerTaskInformation) => {
    if (task.type === 'initialize') {
      parentPort!.postMessage('initialized');
      return;
    }
    const method = workerManifest[task.type];
    if (method == null) {
      parentPort!.postMessage({
        error: new workerErrors.ErrorWorkerHandlerMissing(),
      });
      return;
    }
    let result: WorkerResultInternal;
    try {
      result = await method(task.data);
    } catch (error) {
      parentPort!.postMessage({ error });
      return;
    }
    parentPort!.postMessage(
      { data: result.data, transferList: result.transferList },
      result.transferList,
    );
  };
  parentPort!.on('message', handleMessage);
  parentPort!.once('close', () => {
    parentPort!.off('message', handleMessage);
  });
}

export { expose };
