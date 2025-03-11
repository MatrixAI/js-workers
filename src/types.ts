import type { TransferListItem, Worker } from 'node:worker_threads';

type WorkerFactory = () => Worker;

type WorkerTaskInformation<T extends string = string, D = unknown> = {
  type: T;
  data: D;
  transferList?: Array<TransferListItem>;
};

// Input data is any type supported by the HTML structured clone algorithm
type WorkerFunction<I = unknown, O = unknown> = (
  data: I,
  transferList?: Array<TransferListItem>,
) => Promise<WorkerResult<O>>;
type WorkerResult<O = unknown> = {
  data: O;
  transferList?: Array<TransferListItem>;
};
type WorkerResultInternal<O = unknown> = WorkerResult<O> & {
  error?: Error;
};
type WorkerManifest = Record<string, WorkerFunction>;

type TaskCallback<O = unknown> = (
  result: WorkerResult<O>,
  error?: Error,
) => void;

export type {
  WorkerFactory,
  WorkerTaskInformation,
  WorkerFunction,
  WorkerResult,
  WorkerResultInternal,
  WorkerManifest,
  TaskCallback,
};
