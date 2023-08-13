import type { WorkerModule } from '#worker.js';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';
import b from 'benny';
import { spawn, Worker, Transfer } from 'threads';
import Logger, { LogLevel, StreamHandler } from '@matrixai/logger';
import { suiteCommon } from './utils/index.js';
import WorkerManager from '#WorkerManager.js';

const filePath = url.fileURLToPath(import.meta.url);

const logger = new Logger('WorkerManager Bench', LogLevel.WARN, [
  new StreamHandler(),
]);

async function main() {
  const cores = 1;
  const workerManager = await WorkerManager.createWorkerManager<WorkerModule>({
    workerFactory: () => spawn(new Worker('../src/worker')),
    cores,
    logger,
  });
  // 1 MiB worth of data is the ballpark range of data to be worth parallelising
  // 1 KiB of data is still too small
  const bytes = crypto.randomBytes(1024 * 1024);
  const summary = await b.suite(
    path.basename(filePath, path.extname(filePath)),
    b.add('call overhead', async () => {
      // This calls a noop, this will show the overhead costs
      // All parallelised operation can never be faster than this
      // Therefore any call that takes less time than the overhead cost
      // e.g. 1.5ms is not worth parallelising
      await workerManager.call(async (w) => {
        await w.sleep(0);
      });
    }),
    b.add('parallel call overhead', async () => {
      // Assuming core count is 1
      // the performance should be half of `call overhead`
      await Promise.all([
        workerManager.call(async (w) => {
          await w.sleep(0);
        }),
        workerManager.call(async (w) => {
          await w.sleep(0);
        }),
      ]);
    }),
    b.add('parallel queue overhead', async () => {
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
    b.add('json stringify of 1 MiB of data', () => {
      JSON.stringify(bytes);
    }),
    b.add('base64 of 1 MiB of data', () => {
      bytes.toString('base64');
    }),
    b.add('md5 Hash of 1 MiB of data', () => {
      const hash = crypto.createHash('md5');
      return () => {
        hash.update(bytes);
      };
    }),
    b.add('sha256 Hash of 1 MiB of data', () => {
      const hash = crypto.createHash('sha256');
      return () => {
        hash.update(bytes);
      };
    }),
    b.add('sha512 Hash of 1 MiB of data', () => {
      // This will be faster on 64 bit machines compared to sha256
      const hash = crypto.createHash('sha512');
      return () => {
        hash.update(bytes);
      };
    }),
    b.add('transfer Overhead', async () => {
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
    b.add('slice-Copy of 1 MiB of data', () => {
      // Compare this to Transfer Overhead
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }),
    ...suiteCommon,
  );
  await workerManager.destroy();
  return summary;
}

if (import.meta.url.startsWith('file:')) {
  const modulePath = url.fileURLToPath(import.meta.url);
  if (process.argv[1] === modulePath) {
    void main();
  }
}

export default main;
