# js-workers

[![pipeline status](https://gitlab.com/MatrixAI/open-source/js-workers/badges/master/pipeline.svg)](https://gitlab.com/MatrixAI/open-source/js-workers/commits/master)

Workers is the common library for multi-threading in MatrixAI's JavaScript/TypeScript applications. It uses the WebWorker API. Later for Mobile OSes, there are multiple potential solutions here using NativeScript or React Native.

1. Benchmarking
2. Transfer of buffers and stuff like that
3. Independent tests and benchmarks. Use benny here...

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

### Docs Generation

```sh
npm run docs
```

See the docs at: https://matrixai.github.io/TypeScript-Demo-Lib/

### Publishing

```sh
# npm login
npm version patch # major/minor/patch
npm run build
npm publish --access public
git push
git push --tags
```
