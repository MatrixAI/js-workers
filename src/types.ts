type ModuleMethods = {
  [methodName: string]: (...args: any) => any;
};
type ModuleThread<Methods = any> = any;
type QueuedTask<ThreadType, Return> = any;

export type {
  ModuleMethods,
  ModuleThread,
  QueuedTask
};
