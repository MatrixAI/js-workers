# js-workers

staging:[![pipeline status](https://gitlab.com/MatrixAI/open-source/js-workers/badges/staging/pipeline.svg)](https://gitlab.com/MatrixAI/open-source/js-workers/commits/staging)
master:[![pipeline status](https://gitlab.com/MatrixAI/open-source/js-workers/badges/master/pipeline.svg)](https://gitlab.com/MatrixAI/open-source/js-workers/commits/master)

Workers is the library for multi-threading in MatrixAI's JavaScript/TypeScript applications. It is based on top of threads.js.

Currently no support for Mobile OSes.

Note that only `ArrayBuffer` can be zero-copy transferred to the worker threads. This means if you are wroking with Node `Buffer` you must first slice and copy the `ArrayBuffer` out of the Node `Buffer`.

```ts
const b = Buffer.from('hello world');
const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
```

The following diagram is an example architecture of using `ArrayBuffer`:

```
┌───────────────────────┐
│      Main Thread      │
│                       │
│     ┌───────────┐     │
│     │Node Buffer│     │
│     └─────┬─────┘     │          ┌────────────────────────┐
│           │           │          │                        │
│     Slice │ Copy      │          │      Worker Thread     │
│           │           │          │                        │
│  ┌────────▼────────┐  │ Transfer │  ┌──────────────────┐  │
│  │Input ArrayBuffer├──┼──────────┼──►                  │  │
│  └─────────────────┘  │          │  └─────────┬────────┘  │
│                       │          │            │           │
│                       │          │    Compute │           │
│                       │          │            │           │
│  ┌─────────────────┐  │          │  ┌─────────▼────────┐  │
│  │                 ◄──┼──────────┼──┤Output ArrayBuffer│  │
│  └─────────────────┘  │ Transfer │  └──────────────────┘  │
│                       │          │                        │
│                       │          │                        │
└───────────────────────┘          └────────────────────────┘
```

See the benchmarks and tests for examples of using this library.

## Installation

```sh
npm install --save @matrixai/workers
```

## Development

Run `nix-shell`, and once you're inside, you can use:

```sh
# install (or reinstall packages from package.json)
npm install
# build the dist
npm run build
# run the repl (this allows you to import from ./src)
npm run ts-node
# run the tests
npm run test
# lint the source code
npm run lint
# automatically fix the source
npm run lintfix
```

## Benchmarks

```sh
npm run bench
```

View benchmarks here: https://github.com/MatrixAI/js-workers/blob/master/benches/results/WorkerManager.chart.html with https://raw.githack.com/

### Docs Generation

```sh
npm run docs
```

See the docs at: https://matrixai.github.io/js-workers/

### Publishing

Publishing is handled automatically by the staging pipeline.

Prerelease:

```sh
# npm login
npm version prepatch --preid alpha # premajor/preminor/prepatch
git push --follow-tags
```

Release:

```sh
# npm login
npm version patch # major/minor/patch
git push --follow-tags
```

Manually:

```sh
# npm login
npm version patch # major/minor/patch
npm run build
npm publish --access public
git push
git push --tags
```
