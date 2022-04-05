import type { ModuleThread } from 'threads';
import type { ModuleMethods } from 'threads/dist/types/master';
import type { QueuedTask } from 'threads/dist/master/pool-types';

interface WorkerManagerInterface<W extends ModuleMethods> {
  destroy(options: { force?: boolean }): Promise<void>;
  call<T>(f: (worker: ModuleThread<W>) => Promise<T>): Promise<T>;
  queue<T>(
    f: (worker: ModuleThread<W>) => Promise<T>,
  ): QueuedTask<ModuleThread<W>, T>;
  completed(): Promise<void>;
  settled(): Promise<Error[]>;
}

export default WorkerManagerInterface;
