export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      stack: this.stack
    };
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, context?: { file?: string; line?: number; column?: number }) {
    super(message, context);
  }
}

export class TemplateNotFoundError extends AppError {
  readonly code = 'TEMPLATE_NOT_FOUND';
  readonly statusCode = 404;

  constructor(templateName: string) {
    super(`Template '${templateName}' not found`, { templateName });
  }
}

export class LanguageNotFoundError extends AppError {
  readonly code = 'LANGUAGE_NOT_FOUND';
  readonly statusCode = 404;

  constructor(languageCode: string) {
    super(`Language '${languageCode}' not found`, { languageCode });
  }
}

export class TranslationMissingError extends AppError {
  readonly code = 'TRANSLATION_MISSING';
  readonly statusCode = 400;

  constructor(key: string, language: string) {
    super(`Translation missing for key '${key}' in language '${language}'`, { key, language });
  }
}

export class ConfigurationError extends AppError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly statusCode = 500;

  constructor(message: string, context?: Record<string, unknown>) {
    super(`Configuration error: ${message}`, context);
  }
}

export class PluginError extends AppError {
  readonly code = 'PLUGIN_ERROR';
  readonly statusCode = 500;

  constructor(pluginName: string, message: string) {
    super(`Plugin '${pluginName}' error: ${message}`, { pluginName });
  }
}

export class BuildError extends AppError {
  readonly code = 'BUILD_ERROR';
  readonly statusCode = 500;

  constructor(message: string, context?: Record<string, unknown>) {
    super(`Build error: ${message}`, context);
  }
}