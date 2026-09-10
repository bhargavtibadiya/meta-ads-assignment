import { env } from '../../config/env.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  readonly [key: string]: string | number | boolean | null;
}

interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

// ============================================================================
// LOGGER
// ============================================================================

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Writes a structured log line to stdout/stderr when the level is enabled.
 *
 * @param level - Severity of the line
 * @param message - Human-readable event summary
 * @param fields - Optional structured context (no secrets)
 * @returns void
 */
function writeLog(level: LogLevel, message: string, fields?: LogFields): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[env.LOG_LEVEL]) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    process.stderr.write(`${line}\n`);
    return;
  }

  process.stdout.write(`${line}\n`);
}

export const logger: Logger = {
  debug(message: string, fields?: LogFields): void {
    writeLog('debug', message, fields);
  },
  info(message: string, fields?: LogFields): void {
    writeLog('info', message, fields);
  },
  warn(message: string, fields?: LogFields): void {
    writeLog('warn', message, fields);
  },
  error(message: string, fields?: LogFields): void {
    writeLog('error', message, fields);
  },
};
