import { CustomError } from 'ts-custom-error';

class ErrorWorkerManager extends CustomError {}

class ErrorWorkerManagerNotStarted extends ErrorWorkerManager {}

export { ErrorWorkerManager, ErrorWorkerManagerNotStarted };
