// This is an example worker script

import { expose } from 'threads/worker';
import worker from '../src/workerModule.js';

expose(worker);
