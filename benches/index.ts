#!/usr/bin/env node

import WorkerManagerBench from './WorkerManager.bench';

async function main(): Promise<void> {
  await WorkerManagerBench();
}

main();
