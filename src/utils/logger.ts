export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

const sanitizeMeta = (meta?: Record<string, unknown>): Record<string, unknown> | undefined => {
  if (!meta) return undefined;
  const sanitized = { ...meta };
  const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'jwt', 'database_url', 'db_url'];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
};

class Logger {
  private formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): LogPayload {
    const sanitized = sanitizeMeta(meta);
    const payload: LogPayload = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };
    if (sanitized) {
      payload.meta = sanitized;
    }
    return payload;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    const payload = this.formatLog(LogLevel.INFO, message, meta);
    console.log(`[${payload.timestamp}] [INFO] ${payload.message}`, payload.meta ? JSON.stringify(payload.meta) : '');
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    const payload = this.formatLog(LogLevel.WARN, message, meta);
    console.warn(`[${payload.timestamp}] [WARN] ${payload.message}`, payload.meta ? JSON.stringify(payload.meta) : '');
  }

  error(message: string, meta?: Record<string, unknown>): void {
    const payload = this.formatLog(LogLevel.ERROR, message, meta);
    console.error(`[${payload.timestamp}] [ERROR] ${payload.message}`, payload.meta ? JSON.stringify(payload.meta) : '');
  }
}

export const logger = new Logger();
