/**
 * HTTP-aware error thrown from controllers and services.
 */
export class AppError extends Error {
  readonly statusCode: number;

  /**
   * Creates an error that the global handler maps to an HTTP status.
   *
   * @param message - Public error message
   * @param statusCode - HTTP status to return
   */
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}
