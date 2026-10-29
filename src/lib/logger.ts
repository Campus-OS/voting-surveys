export type LogLevel = "info" | "warn" | "error" | "debug";

interface LogPayload {
  requestId?: string;
  context?: string;
  [key: string]: unknown;
}

class Logger {
  private format(level: LogLevel, message: string, payload?: LogPayload): string {
    const timestamp = new Date().toISOString();
    const meta = payload ? ` ${JSON.stringify(payload)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${meta}`;
  }

  info(message: string, payload?: LogPayload): void {
    if (process.env.NODE_ENV !== "test") {
      process.stdout.write(this.format("info", message, payload) + "\n");
    }
  }

  warn(message: string, payload?: LogPayload): void {
    process.stderr.write(this.format("warn", message, payload) + "\n");
  }

  error(message: string, error?: unknown, payload?: LogPayload): void {
    const errDetails = error instanceof Error
      ? { message: error.message, stack: error.stack, name: error.name }
      : { raw: error };

    process.stderr.write(
      this.format("error", message, { ...payload, error: errDetails }) + "\n"
    );
  }

  debug(message: string, payload?: LogPayload): void {
    if (process.env.NODE_ENV === "development") {
      process.stdout.write(this.format("debug", message, payload) + "\n");
    }
  }
}

export const logger = new Logger();
