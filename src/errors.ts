import { CustomError } from 'ts-custom-error';

class ErrorWorkerManager extends CustomError {}

class ErrorWorkerManagerNotRunning extends ErrorWorkerManager {}

export { ErrorWorkerManager, ErrorWorkerManagerNotRunning };
