import { BaseCommand, CommandOptions, CommandResult } from './BaseCommand';
import { TemplateService } from '../../core/services/TemplateService';
import { I18nService } from '../../core/services/I18nService';
import { ValidationService } from '../../core/services/ValidationService';
import { CacheService } from '../../core/services/CacheService';
import { ProjectConfiguration } from '../../core/interfaces/Config';
import { Logger } from '../../utils/Logger';
import { ConfigLoader } from '../../utils/ConfigLoader';
import * as path from 'path';

export interface ValidateCommandOptions extends CommandOptions {
  config?: string;
  templates?: boolean;
  translations?: boolean;
  all?: boolean;
  watch?: boolean;
  fix?: boolean;
  verbose?: boolean;
}

export interface ValidationReport {
  templates: Array<{
    name: string;
    valid: boolean;
    errors: number;
    warnings: number;
    issues: Array<{ type: string; message: string; line?: number }>;
  }>;
  translations: Array<{
    language: string;
    valid: boolean;
    errors: number;
    warnings: number;
    missingKeys: string[];
    unusedKeys: string[];
  }>;
  summary: {
    totalTemplates: number;
    validTemplates: number;
    totalLanguages: number;
    validLanguages: number;
    totalErrors: number;
    totalWarnings: number;
  };
}

export class ValidateCommand extends BaseCommand {
  private readonly configLoader: ConfigLoader;
  private readonly cacheService: CacheService;

  constructor(logger: Logger, configLoader: ConfigLoader, cacheService: CacheService) {
    super('validate', 'Validate templates, translations, and configuration', logger);
    this.configLoader = configLoader;
    this.cacheService = cacheService;
  }

  async execute(options: ValidateCommandOptions): Promise<CommandResult> {
    try {
      const configPath = options.config || 'config.json';
      const config = await this.configLoader.loadConfiguration(configPath);

      this.logger.info('Starting validation', {
        templates: options.templates || options.all,
        translations: options.translations || options.all,
        watch: options.watch
      });

      const services = await this.initializeServices(config);
      const report = await this.runValidation(config, services, options);

      const success = report.summary.totalErrors === 0;
      
      if (success) {
        this.logger.info('Validation completed successfully', report.summary);
        return this.createSuccessResult('All validations passed', report);
      } else {
        this.logger.error('Validation failed', report.summary);
        return this.createErrorResult(
          `Validation failed: ${report.summary.totalErrors} errors, ${report.summary.totalWarnings} warnings`,
          this.extractErrorMessages(report)
        );
      }

    } catch (error) {
      this.logger.error('Validation command failed', { error });
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown validation error'
      );
    }
  }

  getUsage(): string {
    return 'validate [options]\n\n' +
           'Options:\n' +
           '  --config <path>      Path to configuration file (default: config.json)\n' +
           '  --templates          Validate templates only\n' +
           '  --translations       Validate translations only\n' +
           '  --all                Validate everything (default)\n' +
           '  --watch              Watch for changes and re-validate\n' +
           '  --fix                Attempt to automatically fix issues\n' +
           '  --verbose            Show detailed validation results';
  }

  private async initializeServices(config: ProjectConfiguration) {
    const templateService = new TemplateService(
      path.join(process.cwd(), 'src/templates'),
      this.cacheService,
      this.logger
    );

    const i18nService = new I18nService(
      path.join(process.cwd(), 'src/languages'),
      this.cacheService,
      this.logger
    );

    const validationService = new ValidationService(
      config.validation || {
        html: { enabled: true, strict: false },
        liquid: { enabled: true },
        translations: { checkMissing: true, checkUnused: true, checkDuplicates: true }
      },
      this.logger
    );

    await i18nService.initialize(config.languages.map(l => l.code));

    return {
      templateService,
      i18nService,
      validationService
    };
  }

  private async runValidation(
    config: ProjectConfiguration,
    services: {
      templateService: TemplateService;
      i18nService: I18nService;
      validationService: ValidationService;
    },
    options: ValidateCommandOptions
  ): Promise<ValidationReport> {
    const report: ValidationReport = {
      templates: [],
      translations: [],
      summary: {
        totalTemplates: 0,
        validTemplates: 0,
        totalLanguages: 0,
        validLanguages: 0,
        totalErrors: 0,
        totalWarnings: 0
      }
    };

    // Validate templates
    if (options.templates || options.all || (!options.templates && !options.translations)) {
      report.templates = await this.validateTemplates(config, services);
    }

    // Validate translations
    if (options.translations || options.all || (!options.templates && !options.translations)) {
      report.translations = await this.validateTranslations(config, services);
    }

    // Calculate summary
    report.summary = this.calculateSummary(report);

    return report;
  }

  private async validateTemplates(
    config: ProjectConfiguration,
    services: {
      templateService: TemplateService;
      validationService: ValidationService;
    }
  ) {
    const templateResults = [];
    const enabledTemplates = config.templates.filter(t => t.enabled);

    for (const template of enabledTemplates) {
      try {
        this.logger.debug(`Validating template: ${template.name}`);

        // Load template content
        const content = await services.templateService.loadTemplate(template.name);
        
        // Run validation
        const validationResults = await services.validationService.validateContent(
          content,
          'html',
          { templateName: template.name }
        );

        const errors = validationResults.filter(r => r.type === 'error');
        const warnings = validationResults.filter(r => r.type === 'warning');

        templateResults.push({
          name: template.name,
          valid: errors.length === 0,
          errors: errors.length,
          warnings: warnings.length,
          issues: validationResults.map(r => ({
            type: r.type,
            message: r.message,
            line: r.line
          }))
        });

      } catch (error) {
        templateResults.push({
          name: template.name,
          valid: false,
          errors: 1,
          warnings: 0,
          issues: [{
            type: 'error',
            message: error instanceof Error ? error.message : String(error)
          }]
        });
      }
    }

    return templateResults;
  }

  private async validateTranslations(
    config: ProjectConfiguration,
    services: {
      i18nService: I18nService;
      validationService: ValidationService;
    }
  ) {
    const translationResults = [];
    const enabledLanguages = config.languages.filter(l => l.enabled);

    // Get all translation keys from all languages to check for consistency
    const allKeys = new Set<string>();
    const languageKeys = new Map<string, Set<string>>();

    // First pass: collect all keys
    for (const language of enabledLanguages) {
      try {
        const catalog = await services.i18nService.loadLanguage(language.code);
        const keys = new Set(catalog.entries.keys());
        languageKeys.set(language.code, keys);
        keys.forEach(key => allKeys.add(key));
      } catch (error) {
        this.logger.warn(`Failed to load language ${language.code} for validation`, { error });
      }
    }

    const allKeysArray = Array.from(allKeys);

    // Second pass: validate each language
    for (const language of enabledLanguages) {
      try {
        const keys = languageKeys.get(language.code) || new Set();
        const translationsMap = new Map<string, string>();
        
        // Convert to Map for validation service
        const catalog = await services.i18nService.loadLanguage(language.code);
        catalog.entries.forEach((entry, key) => {
          translationsMap.set(key, entry.value);
        });

        const validationResults = await services.validationService.validateTranslations(
          translationsMap,
          allKeysArray
        );

        const errors = validationResults.filter(r => r.type === 'error');
        const warnings = validationResults.filter(r => r.type === 'warning');

        // Find missing and unused keys
        const missingKeys = allKeysArray.filter(key => !keys.has(key));
        const unusedKeys = Array.from(keys).filter(key => !allKeysArray.includes(key));

        translationResults.push({
          language: language.code,
          valid: errors.length === 0,
          errors: errors.length,
          warnings: warnings.length,
          missingKeys,
          unusedKeys
        });

      } catch (error) {
        translationResults.push({
          language: language.code,
          valid: false,
          errors: 1,
          warnings: 0,
          missingKeys: [],
          unusedKeys: []
        });
      }
    }

    return translationResults;
  }

  private calculateSummary(report: ValidationReport) {
    const summary = {
      totalTemplates: report.templates.length,
      validTemplates: report.templates.filter(t => t.valid).length,
      totalLanguages: report.translations.length,
      validLanguages: report.translations.filter(t => t.valid).length,
      totalErrors: 0,
      totalWarnings: 0
    };

    // Count errors and warnings from templates
    for (const template of report.templates) {
      summary.totalErrors += template.errors;
      summary.totalWarnings += template.warnings;
    }

    // Count errors and warnings from translations
    for (const translation of report.translations) {
      summary.totalErrors += translation.errors;
      summary.totalWarnings += translation.warnings;
    }

    return summary;
  }

  private extractErrorMessages(report: ValidationReport): string[] {
    const errors: string[] = [];

    for (const template of report.templates) {
      for (const issue of template.issues) {
        if (issue.type === 'error') {
          errors.push(`Template ${template.name}: ${issue.message}`);
        }
      }
    }

    for (const translation of report.translations) {
      if (translation.missingKeys.length > 0) {
        errors.push(`Language ${translation.language}: Missing keys: ${translation.missingKeys.join(', ')}`);
      }
    }

    return errors;
  }
}