// This is an example worker script
// note that it cannot use `@/` imports

import { expose } from 'threads/worker';
import worker from '../src/workerModule.js';

expose(worker);

export type { WorkerModule } from '../src/oldworkerModule.js';
