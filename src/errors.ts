/**
 * Shared with API_SPEC.md § 2.1 — keep literals in sync.
 */
export const ErrorClass = {
  BINARY_NOT_FOUND: 'BINARY_NOT_FOUND',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  TIMEOUT: 'TIMEOUT',
  OUTPUT_TRUNCATED: 'OUTPUT_TRUNCATED',
  SECURITY: 'SECURITY',
  VALIDATION: 'VALIDATION',
  AGENT_ERROR: 'AGENT_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorClass = (typeof ErrorClass)[keyof typeof ErrorClass];

export interface StructuredError {
  errorClass: ErrorClass;
  message: string;
  exitCode?: number;
  stderrExcerpt?: string;
  timedOut?: boolean;
}

export function buildError(
  cls: ErrorClass,
  message: string,
  extras?: Partial<StructuredError>,
): StructuredError {
  return {
    errorClass: cls,
    message,
    ...extras,
  };
}

export class PromptTooLargeError extends Error {
  constructor(
    readonly promptLength: number,
    readonly promptMaxChars: number,
  ) {
    super(
      `Prompt is ${promptLength} characters, which exceeds the ${promptMaxChars}-character limit. Split into smaller tasks or reduce context.`,
    );
    this.name = 'PromptTooLargeError';
  }
}
