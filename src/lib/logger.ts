/* eslint-disable @schafevormfenster/prefer-custom-logger -- This IS the logger implementation */
/* eslint-disable @schafevormfenster/one-function-per-file -- Logger facade: shouldLog + writeLog are tightly coupled internals */
import { config } from "@/config";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  component?: string;
  operation?: string;
  requestId?: string;
  durationMs?: number;
  sourceUrl?: string;
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const configLevel = (config.logLevel ?? "info") as LogLevel;
  return LEVEL_ORDER[level] >= (LEVEL_ORDER[configLevel] ?? 1);
}

function writeLog(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => writeLog("debug", message, context),
  info: (message: string, context?: LogContext) => writeLog("info", message, context),
  warn: (message: string, context?: LogContext) => writeLog("warn", message, context),
  error: (message: string, context?: LogContext) => writeLog("error", message, context),
};

/**
 * Alias satisfying the enforce-log-before-throw ESLint rule,
 * which requires the callee object to be named `log`.
 */
export { logger as log };
