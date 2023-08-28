import type {
  ModuleMethods,
  ModuleThread,
  QueuedTask,
} from './types.js';

interface WorkerManagerInterface<W extends ModuleMethods> {
  destroy(options?: { force?: boolean }): Promise<void>;
  call<T>(f: (worker: ModuleThread<W>) => Promise<T>): Promise<T>;
  queue<T>(
    f: (worker: ModuleThread<W>) => Promise<T>,
  ): QueuedTask<ModuleThread<W>, T>;
  completed(): Promise<void>;
  settled(): Promise<Error[]>;
}

export default WorkerManagerInterface;
