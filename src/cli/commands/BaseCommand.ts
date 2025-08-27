import { Logger } from '../../utils/Logger';

export interface CommandOptions {
  [key: string]: unknown;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
  errors?: string[];
}

export abstract class BaseCommand {
  protected readonly logger: Logger;
  public readonly name: string;
  public readonly description: string;

  constructor(name: string, description: string, logger: Logger) {
    this.name = name;
    this.description = description;
    this.logger = logger;
  }

  abstract execute(options: CommandOptions): Promise<CommandResult>;

  abstract getUsage(): string;

  getHelp(): string {
    return `${this.description}\n\nUsage: ${this.getUsage()}`;
  }

  protected createSuccessResult(message?: string, data?: unknown): CommandResult {
    return {
      success: true,
      message,
      data
    };
  }

  protected createErrorResult(message: string, errors?: string[]): CommandResult {
    return {
      success: false,
      message,
      errors
    };
  }

  protected validateRequiredOptions(options: CommandOptions, required: string[]): string[] {
    const missing: string[] = [];
    
    for (const option of required) {
      if (!(option in options) || options[option] === undefined || options[option] === null) {
        missing.push(option);
      }
    }
    
    return missing;
  }

  protected async confirmAction(message: string, defaultValue = false): Promise<boolean> {
    // In a real implementation, this would prompt the user
    // For now, we'll return the default value
    this.logger.info(`Confirmation required: ${message}`);
    return defaultValue;
  }

  protected formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }
    
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  protected formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}