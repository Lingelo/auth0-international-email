export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: 'json' | 'text' | 'structured';
  outputFile?: string;
  enableColors?: boolean;
}

export class Logger {
  private level: LogLevel = 'info';
  private format: 'json' | 'text' | 'structured' = 'text';
  private enableColors = true;
  private outputs: Array<(entry: LogEntry) => void> = [];

  private readonly levelPriority: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  private readonly colors = {
    error: '\x1b[31m', // Red
    warn: '\x1b[33m', // Yellow
    info: '\x1b[36m', // Cyan
    debug: '\x1b[37m', // White
    reset: '\x1b[0m',
  };

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || 'info';
    this.format = options.format || 'text';
    this.enableColors = options.enableColors !== false;

    // Default console output
    this.outputs.push(this.consoleOutput.bind(this));

    // File output if specified
    if (options.outputFile) {
      this.addFileOutput(options.outputFile);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log('error', message, context, error);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error,
    };

    for (const output of this.outputs) {
      try {
        output(entry);
      } catch (outputError) {
        // Fallback to console.error to avoid infinite loops
        console.error('Logger output failed:', outputError);
      }
    }
  }

  addOutput(outputFn: (entry: LogEntry) => void): void {
    this.outputs.push(outputFn);
  }

  removeOutput(outputFn: (entry: LogEntry) => void): void {
    const index = this.outputs.indexOf(outputFn);
    if (index > -1) {
      this.outputs.splice(index, 1);
    }
  }

  createChildLogger(context: Record<string, unknown>): Logger {
    const child = new Logger({
      level: this.level,
      format: this.format,
      enableColors: this.enableColors,
    });

    // Copy outputs but modify them to include child context
    child.outputs = this.outputs.map((originalOutput) => {
      return (entry: LogEntry) => {
        const enrichedEntry = {
          ...entry,
          context: { ...context, ...entry.context },
        };
        originalOutput(enrichedEntry);
      };
    });

    return child;
  }

  async flush(): Promise<void> {
    // In a real implementation, this would flush any buffered outputs
    // For now, it's a no-op since we're using synchronous outputs
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] <= this.levelPriority[this.level];
  }

  private consoleOutput(entry: LogEntry): void {
    const formatted = this.formatEntry(entry);

    switch (entry.level) {
      case 'error':
        console.error(formatted);
        if (entry.error) {
          console.error(entry.error);
        }
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'debug':
        console.debug(formatted);
        break;
    }
  }

  private formatEntry(entry: LogEntry): string {
    switch (this.format) {
      case 'json':
        return JSON.stringify({
          timestamp: entry.timestamp.toISOString(),
          level: entry.level,
          message: entry.message,
          context: entry.context,
          error: entry.error
            ? {
                name: entry.error.name,
                message: entry.error.message,
                stack: entry.error.stack,
              }
            : undefined,
        });

      case 'structured':
        const parts = [
          entry.timestamp.toISOString(),
          `[${entry.level.toUpperCase()}]`,
          entry.message,
        ];

        if (entry.context && Object.keys(entry.context).length > 0) {
          parts.push(JSON.stringify(entry.context));
        }

        return parts.join(' ');

      case 'text':
      default:
        const timestamp = entry.timestamp.toLocaleTimeString();
        const levelStr = entry.level.toUpperCase().padEnd(5);

        let formatted = `${timestamp} ${levelStr} ${entry.message}`;

        if (this.enableColors) {
          const color = this.colors[entry.level] || '';
          formatted = `${color}${formatted}${this.colors.reset}`;
        }

        if (entry.context && Object.keys(entry.context).length > 0) {
          formatted += ` ${JSON.stringify(entry.context)}`;
        }

        return formatted;
    }
  }

  private addFileOutput(filePath: string): void {
    // In a real implementation, this would add file output
    // For now, we'll just log that it would be added
    this.debug(`File output would be added: ${filePath}`);

    // Example implementation:
    this.outputs.push((entry: LogEntry) => {
      // Would write to file here
      // fs.appendFileSync(filePath, this.formatEntry(entry) + '\n');
    });
  }
}
