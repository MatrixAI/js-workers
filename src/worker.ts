import type { WorkerManifest } from './types.js';
import { expose } from './expose.js';

/**
 * This is an example worker script used purely for example and internal testing
 */
const worker = {
  /**
   * A test function that returns the string 'hello world!'.
   */
  test: async (): Promise<{ data: 'hello world!' }> => {
    return { data: 'hello world!' };
  },
  /**
   * Adds two parameters `a` and `b` together.
   */
  add: async (data: { a: number; b: number }) => {
    return { data: data.a + data.b };
  },
  /**
   * Subtracts two parameters `a` and `b` together.
   */
  sub: async (data: { a: number; b: number }) => {
    return { data: data.a - data.b };
  },
  fac: async (data: number) => {
    let acc = 1;
    for (let i = 1; i <= data; i++) {
      acc = acc * i;
    }
    return { data: acc };
  },
  /**
   * Sleeps for the provided amount of time in milliseconds.
   * @param data
   */
  sleep: async (data: number) => {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, data);
      // Prevent holding the process open
      timer.unref();
    });
    return { data: undefined };
  },
  /**
   * Test function that takes a transferred ArrayBuffer and fills it with 0x0F bytes.
   */
  transferBuffer: async (data: ArrayBuffer, _transferList?: [ArrayBuffer]) => {
    const buffer = Buffer.from(data, 0, data.byteLength);
    buffer.fill(0xf);
    return { data, transferList: [data] };
  },
} satisfies WorkerManifest;

expose(worker);

export default worker;
