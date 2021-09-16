import type { WorkerModule } from '@/worker';

import os from 'os';
import crypto from 'crypto';
import b from 'benny';
import { spawn, Worker, Transfer } from 'threads';
import Logger, { LogLevel, StreamHandler } from '@matrixai/logger';
import WorkerManager from '@/WorkerManager';
import packageJson from '../package.json';

const logger = new Logger('WorkerManager Bench', LogLevel.WARN, [
  new StreamHandler(),
]);

export default async () => {
  const cores = os.cpus().length;
  logger.warn(`Cores: ${cores}`);
  const workerManager = new WorkerManager<WorkerModule>({ logger });
  await workerManager.start({
    workerFactory: () => spawn(new Worker('../src/worker')),
    cores,
  });
  // 1 MiB worth of data is the ballpark range of data to be worth parallelising
  // 1 KiB of data is still too small
  const bytes = crypto.randomBytes(1024 * 1024);
  const summary = await b.suite(
    'WorkerManager',
    b.add('Call Overhead', async () => {
      // This calls a noop, this will show the overhead costs
      // All parallelised operation can never be faster than this
      // Therefore any call that takes less time than the overhead cost
      // e.g. 1.5ms is not worth parallelising
      await workerManager.call(async (w) => {
        await w.sleep(0);
      });
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
    b.cycle(),
    b.complete(),
    b.save({
      file: 'WorkerManager',
      folder: 'benches/results',
      version: packageJson.version,
      details: true,
    }),
    b.save({
      file: 'WorkerManager',
      folder: 'benches/results',
      format: 'chart.html',
    }),
  );
  await workerManager.stop();
  return summary;
};
