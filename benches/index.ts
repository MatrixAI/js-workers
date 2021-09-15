#!/usr/bin/env node

import fs from 'fs';
import si from 'systeminformation';
import WorkerManagerBench from './WorkerManager.bench';

async function main(): Promise<void> {
  await WorkerManagerBench();
  const systemData = await si.get({
    cpu: '*',
    osInfo: 'platform, distro, release, kernel, arch',
    system: 'model, manufacturer'
  });
  await fs.promises.writeFile(
    'benches/results/system.json',
    JSON.stringify(systemData, null, 2)
  );
}

main();
