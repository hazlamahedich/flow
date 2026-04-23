export class OrchestratorError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OrchestratorError';
    this.code = code;
  }
}
