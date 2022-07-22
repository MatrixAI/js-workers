import type { WorkerModule } from '@/worker';

import os from 'os';
import path from 'path';
import crypto from 'crypto';
import b from 'benny';
import { spawn, Worker, Transfer } from 'threads';
import Logger, { LogLevel, StreamHandler } from '@matrixai/logger';
import WorkerManager from '@/WorkerManager';
import { suiteCommon } from './utils/utils';

const logger = new Logger('WorkerManager Bench', LogLevel.WARN, [
  new StreamHandler(),
]);

async function main() {
  const cores = os.cpus().length;
  logger.warn(`Cores: ${cores}`);
  const workerManager = await WorkerManager.createWorkerManager<WorkerModule>({
    workerFactory: () => spawn(new Worker('../src/worker')),
    cores,
    logger,
  });
  // 1 MiB worth of data is the ballpark range of data to be worth parallelising
  // 1 KiB of data is still too small
  const bytes = crypto.randomBytes(1024 * 1024);
  const summary = await b.suite(
    path.basename(__filename, path.extname(__filename)),
    b.add('Call Overhead', async () => {
      // This calls a noop, this will show the overhead costs
      // All parallelised operation can never be faster than this
      // Therefore any call that takes less time than the overhead cost
      // e.g. 1.5ms is not worth parallelising
      await workerManager.call(async (w) => {
        await w.sleep(0);
      });
    }),
    b.add('Parallel (2) Call Overhead', async () => {
      // Assuming core count greater or equal to 2
      // the performance should be similar to Call Overhead
      await Promise.all([
        workerManager.call(async (w) => {
          await w.sleep(0);
        }),
        workerManager.call(async (w) => {
          await w.sleep(0);
        }),
      ]);
    }),
    b.add('Parallel (2) Queue Overhead', async () => {
      // This should be slightly faster than using call
      // This avoids an unnecessary wrapper into Promise
      await Promise.all([
        workerManager.queue(async (w) => {
          await w.sleep(0);
        }),
        workerManager.queue(async (w) => {
          await w.sleep(0);
        }),
      ]);
    }),
    b.add('JSON stringify of 1 MiB of data', () => {
      JSON.stringify(bytes);
    }),
    b.add('Base64 of 1 MiB of data', () => {
      bytes.toString('base64');
    }),
    b.add('MD5 Hash of 1 MiB of data', () => {
      const hash = crypto.createHash('md5');
      return () => {
        hash.update(bytes);
      };
    }),
    b.add('SHA256 Hash of 1 MiB of data', () => {
      const hash = crypto.createHash('sha256');
      return () => {
        hash.update(bytes);
      };
    }),
    b.add('SHA512 Hash of 1 MiB of data', () => {
      // This will be faster on 64 bit machines compared to sha256
      const hash = crypto.createHash('sha512');
      return () => {
        hash.update(bytes);
      };
    }),
    b.add('Transfer Overhead', async () => {
      // This is the fastest possible ArrayBuffer transfer
      // First with a 1 MiB slice-copy
      // Then with a basic transfer to, and transfer back
      const inputAB = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
      await workerManager.call(async (w) => {
        const outputAB = await w.transferBuffer(Transfer(inputAB));
        return Buffer.from(outputAB);
      });
    }),
    b.add('Slice-Copy of 1 MiB of data', () => {
      // Compare this to Transfer Overhead
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }),
    ...suiteCommon,
  );
  await workerManager.destroy();
  return summary;
}

if (require.main === module) {
  void main();
}

export default main;
