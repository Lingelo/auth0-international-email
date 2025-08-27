import * as fs from 'fs-extra';
import * as path from 'path';
import { ProjectConfiguration } from '../core/interfaces/Config';
import { ConfigurationError } from '../core/errors/AppErrors';
import { Logger } from './Logger';

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigLoader {
  private readonly logger: Logger;
  private readonly configCache = new Map<string, { config: ProjectConfiguration; mtime: number }>();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async loadConfiguration(configPath: string): Promise<ProjectConfiguration> {
    const absolutePath = path.resolve(configPath);

    try {
      // Check cache first
      const cached = this.configCache.get(absolutePath);
      if (cached) {
        const stats = await fs.stat(absolutePath);
        if (stats.mtime.getTime() <= cached.mtime) {
          this.logger.debug('Using cached configuration', { configPath });
          return cached.config;
        }
      }

      // Load and parse configuration
      if (!(await fs.pathExists(absolutePath))) {
        throw new ConfigurationError(`Configuration file not found: ${absolutePath}`);
      }

      const content = await fs.readFile(absolutePath, 'utf8');
      const rawConfig = JSON.parse(content);

      // Transform legacy config format to new format
      const config = this.transformLegacyConfig(rawConfig);

      // Validate configuration
      const validation = this.validateConfiguration(config);
      if (!validation.valid) {
        throw new ConfigurationError(
          `Configuration validation failed: ${validation.errors.join(', ')}`
        );
      }

      if (validation.warnings.length > 0) {
        validation.warnings.forEach((warning) =>
          this.logger.warn(`Configuration warning: ${warning}`)
        );
      }

      // Cache the configuration
      const stats = await fs.stat(absolutePath);
      this.configCache.set(absolutePath, {
        config,
        mtime: stats.mtime.getTime(),
      });

      this.logger.info('Configuration loaded successfully', {
        configPath,
        templates: config.templates.length,
        languages: config.languages.length,
      });

      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ConfigurationError(`Invalid JSON in configuration file: ${error.message}`);
      }

      if (error instanceof ConfigurationError) {
        throw error;
      }

      throw new ConfigurationError(
        `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async saveConfiguration(configPath: string, config: ProjectConfiguration): Promise<void> {
    const absolutePath = path.resolve(configPath);

    try {
      // Validate before saving
      const validation = this.validateConfiguration(config);
      if (!validation.valid) {
        throw new ConfigurationError(
          `Cannot save invalid configuration: ${validation.errors.join(', ')}`
        );
      }

      // Ensure directory exists
      await fs.ensureDir(path.dirname(absolutePath));

      // Save configuration
      const content = JSON.stringify(config, null, 2);
      await fs.writeFile(absolutePath, content, 'utf8');

      // Update cache
      const stats = await fs.stat(absolutePath);
      this.configCache.set(absolutePath, {
        config,
        mtime: stats.mtime.getTime(),
      });

      this.logger.info('Configuration saved successfully', { configPath });
    } catch (error) {
      throw new ConfigurationError(
        `Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  validateConfiguration(config: unknown): ConfigValidationResult {
    const result: ConfigValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    };

    // Type check
    if (!config || typeof config !== 'object') {
      result.valid = false;
      result.errors.push('Configuration must be an object');
      return result;
    }

    const cfg = config as Record<string, unknown>;

    // Required fields
    if (!cfg.templates || !Array.isArray(cfg.templates)) {
      result.valid = false;
      result.errors.push('Configuration must have a "templates" array');
    }

    if (!cfg.languages || !Array.isArray(cfg.languages)) {
      result.valid = false;
      result.errors.push('Configuration must have a "languages" array');
    }

    if (result.valid) {
      const typedConfig = cfg as unknown as ProjectConfiguration;

      // Validate templates
      for (let i = 0; i < typedConfig.templates.length; i++) {
        const template = typedConfig.templates[i];
        const prefix = `templates[${i}]`;

        if (!template.name) {
          result.errors.push(`${prefix}.name is required`);
        }

        if (!template.from) {
          result.errors.push(`${prefix}.from is required`);
        } else if (!this.isValidEmail(template.from)) {
          result.warnings.push(`${prefix}.from should be a valid email address`);
        }

        if (!template.subjectKey) {
          result.errors.push(`${prefix}.subjectKey is required`);
        }

        if (typeof template.enabled !== 'boolean') {
          result.warnings.push(`${prefix}.enabled should be a boolean, defaulting to true`);
        }
      }

      // Validate languages
      for (let i = 0; i < typedConfig.languages.length; i++) {
        const language = typedConfig.languages[i];
        const prefix = `languages[${i}]`;

        if (!language.code) {
          result.errors.push(`${prefix}.code is required`);
        } else if (!this.isValidLanguageCode(language.code)) {
          result.warnings.push(`${prefix}.code should be in format like "en-US", "fr-FR"`);
        }

        if (!language.name) {
          result.errors.push(`${prefix}.name is required`);
        }

        if (typeof language.enabled !== 'boolean') {
          result.warnings.push(`${prefix}.enabled should be a boolean, defaulting to true`);
        }

        if (typeof language.priority !== 'number') {
          result.warnings.push(`${prefix}.priority should be a number`);
        }
      }

      // Check for duplicate template names
      const templateNames = typedConfig.templates.map((t) => t.name);
      const duplicateTemplates = templateNames.filter(
        (name, index) => templateNames.indexOf(name) !== index
      );
      if (duplicateTemplates.length > 0) {
        result.errors.push(
          `Duplicate template names: ${[...new Set(duplicateTemplates)].join(', ')}`
        );
      }

      // Check for duplicate language codes
      const languageCodes = typedConfig.languages.map((l) => l.code);
      const duplicateLanguages = languageCodes.filter(
        (code, index) => languageCodes.indexOf(code) !== index
      );
      if (duplicateLanguages.length > 0) {
        result.errors.push(
          `Duplicate language codes: ${[...new Set(duplicateLanguages)].join(', ')}`
        );
      }

      // Validate build configuration if present
      if (typedConfig.build) {
        if (typedConfig.build.maxWorkers && typedConfig.build.maxWorkers < 1) {
          result.warnings.push('build.maxWorkers should be at least 1');
        }
      }
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  async createDefaultConfiguration(): Promise<ProjectConfiguration> {
    return {
      name: 'Auth0 Email Templates',
      version: '1.0.0',
      templates: [
        {
          name: 'welcome_email',
          from: 'noreply@example.com',
          subjectKey: 'welcome.subject',
          enabled: true,
        },
      ],
      languages: [
        {
          code: 'en-US',
          name: 'English (United States)',
          enabled: true,
          priority: 1,
        },
        {
          code: 'fr-FR',
          name: 'French (France)',
          enabled: true,
          priority: 2,
        },
      ],
      build: {
        outputDir: 'dist/output',
        cleanOutput: true,
        parallel: false,
        sourceMaps: false,
        minify: false,
      },
      validation: {
        html: {
          enabled: true,
          strict: false,
        },
        liquid: {
          enabled: true,
          syntax: 'loose',
        },
        translations: {
          checkMissing: true,
          checkUnused: true,
          checkDuplicates: true,
        },
      },
      plugins: [
        {
          name: 'html-validator',
          enabled: true,
        },
        {
          name: 'minifier',
          enabled: false,
        },
      ],
    };
  }

  invalidateCache(configPath?: string): void {
    if (configPath) {
      const absolutePath = path.resolve(configPath);
      this.configCache.delete(absolutePath);
      this.logger.debug('Invalidated configuration cache', { configPath });
    } else {
      this.configCache.clear();
      this.logger.debug('Cleared all configuration cache');
    }
  }

  private transformLegacyConfig(rawConfig: any): ProjectConfiguration {
    // Handle legacy config format (current format)
    if (rawConfig.templates && rawConfig.languages && !rawConfig.name) {
      this.logger.debug('Transforming legacy configuration format');

      return {
        name: 'Auth0 Email Templates',
        version: '1.0.0',
        templates: rawConfig.templates.map((t: any) => ({
          name: t.name,
          from: t.from,
          subjectKey: t.subjectKey,
          enabled: t.enabled !== false,
        })),
        languages: rawConfig.languages.map((l: string, index: number) => ({
          code: l,
          name: this.getLanguageName(l),
          enabled: true,
          priority: index + 1,
        })),
        build: {
          outputDir: 'dist/output',
          cleanOutput: true,
          parallel: false,
          sourceMaps: false,
          minify: false,
        },
        validation: {
          html: { enabled: true, strict: false },
          liquid: { enabled: true },
          translations: { checkMissing: true, checkUnused: true, checkDuplicates: true },
        },
        plugins: [],
      };
    }

    return rawConfig as ProjectConfiguration;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidLanguageCode(code: string): boolean {
    const langCodeRegex = /^[a-z]{2}-[A-Z]{2}$/;
    return langCodeRegex.test(code);
  }

  private getLanguageName(code: string): string {
    const names: Record<string, string> = {
      'en-US': 'English (United States)',
      'fr-FR': 'French (France)',
      'es-ES': 'Spanish (Spain)',
      'de-DE': 'German (Germany)',
      'it-IT': 'Italian (Italy)',
      'pt-BR': 'Portuguese (Brazil)',
      'ja-JP': 'Japanese (Japan)',
      'ko-KR': 'Korean (South Korea)',
      'zh-CN': 'Chinese (Simplified)',
      'ru-RU': 'Russian (Russia)',
    };

    return names[code] || code.toUpperCase();
  }
}
