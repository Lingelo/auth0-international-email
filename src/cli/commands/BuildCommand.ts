import * as path from 'path';
import { BaseCommand, CommandOptions, CommandResult } from './BaseCommand';
import { TemplateService } from '../../core/services/TemplateService';
import { I18nService } from '../../core/services/I18nService';
import { CacheService } from '../../core/services/CacheService';
import { ValidationService } from '../../core/services/ValidationService';
import { GeneratorFactory } from '../../generators/GeneratorFactory';
import { ProjectConfiguration } from '../../core/interfaces/Config';
import { I18nContext } from '../../core/interfaces/Language';
import { Logger } from '../../utils/Logger';
import { ConfigLoader } from '../../utils/ConfigLoader';

export interface BuildCommandOptions extends CommandOptions {
  config?: string;
  output?: string;
  parallel?: boolean;
  maxWorkers?: number;
  watch?: boolean;
  clean?: boolean;
  verbose?: boolean;
}

export class BuildCommand extends BaseCommand {
  private readonly configLoader: ConfigLoader;
  private readonly cacheService: CacheService;

  constructor(logger: Logger, configLoader: ConfigLoader, cacheService: CacheService) {
    super('build', 'Build and generate internationalized email templates', logger);
    this.configLoader = configLoader;
    this.cacheService = cacheService;
  }

  async execute(options: BuildCommandOptions): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // Load configuration
      const configPath = options.config || 'config.json';
      const config = await this.configLoader.loadConfiguration(configPath);
      
      this.logger.info('Starting build process', {
        templates: config.templates.length,
        languages: config.languages.length,
        parallel: options.parallel ?? config.build?.parallel
      });

      // Clean output directory if requested
      if (options.clean ?? config.build?.cleanOutput) {
        await this.cleanOutputDirectory(options.output || config.build?.outputDir || 'dist/output');
      }

      // Initialize services
      const services = await this.initializeServices(config);
      
      // Build templates
      const buildResult = await this.buildTemplates(config, services, options);
      
      const totalTime = Date.now() - startTime;
      
      if (buildResult.success) {
        this.logger.info('Build completed successfully', {
          duration: this.formatDuration(totalTime),
          templatesBuilt: buildResult.templatesBuilt,
          filesGenerated: buildResult.filesGenerated
        });

        return this.createSuccessResult(
          `Build completed in ${this.formatDuration(totalTime)}`,
          buildResult
        );
      } else {
        return this.createErrorResult('Build failed', buildResult.errors);
      }

    } catch (error) {
      this.logger.error('Build command failed', { error });
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown build error'
      );
    }
  }

  getUsage(): string {
    return 'build [options]\n\n' +
           'Options:\n' +
           '  --config <path>      Path to configuration file (default: config.json)\n' +
           '  --output <path>      Output directory (default: dist/output)\n' +
           '  --parallel           Enable parallel processing\n' +
           '  --max-workers <n>    Maximum number of worker processes\n' +
           '  --watch              Watch for changes and rebuild\n' +
           '  --clean              Clean output directory before build\n' +
           '  --verbose            Enable verbose logging';
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

    const generatorFactory = new GeneratorFactory(this.logger);

    // Initialize i18n service with configured languages
    await i18nService.initialize(config.languages.map(l => l.code));

    return {
      templateService,
      i18nService,
      validationService,
      generatorFactory
    };
  }

  private async buildTemplates(
    config: ProjectConfiguration,
    services: {
      templateService: TemplateService;
      i18nService: I18nService;
      validationService: ValidationService;
      generatorFactory: GeneratorFactory;
    },
    options: BuildCommandOptions
  ) {
    const results = {
      success: true,
      templatesBuilt: 0,
      filesGenerated: 0,
      errors: [] as string[],
      warnings: [] as string[]
    };

    const outputDir = options.output || config.build?.outputDir || 'dist/output';
    const enabledTemplates = config.templates.filter(t => t.enabled);

    // Create I18n context
    const i18nContext: I18nContext = {
      currentLanguage: config.languages[0]?.code || 'en-US',
      fallbackLanguage: config.languages[0]?.code || 'en-US',
      catalogs: new Map()
    };

    // Load all language catalogs into context
    for (const lang of config.languages) {
      if (lang.enabled) {
        try {
          const catalog = await services.i18nService.loadLanguage(lang.code);
          i18nContext.catalogs.set(lang.code, catalog);
        } catch (error) {
          results.errors.push(`Failed to load language ${lang.code}: ${error}`);
          results.success = false;
        }
      }
    }

    // Process templates
    for (const template of enabledTemplates) {
      try {
        this.logger.debug(`Processing template: ${template.name}`);

        // Process the template
        const processedTemplate = await services.templateService.processTemplate(
          {
            name: template.name,
            from: template.from,
            subjectKey: template.subjectKey,
            enabled: template.enabled
          },
          {
            template: {
              name: template.name,
              from: template.from,
              subjectKey: template.subjectKey,
              enabled: template.enabled
            },
            variables: template.variables || {},
            language: i18nContext.currentLanguage
          }
        );

        // Get appropriate generator
        const generator = services.generatorFactory.findGeneratorForTemplate(template.name, 'liquid');
        if (!generator) {
          results.errors.push(`No suitable generator found for template: ${template.name}`);
          results.success = false;
          continue;
        }

        // Generate output files
        const generationResult = await generator.generate({
          template: processedTemplate,
          i18nContext,
          outputDir,
          options: {
            outputDir,
            minify: config.build?.minify || false,
            sourceMaps: config.build?.sourceMaps || false,
            parallel: options.parallel ?? config.build?.parallel,
            maxWorkers: options.maxWorkers ?? config.build?.maxWorkers
          }
        });

        if (generationResult.success) {
          results.templatesBuilt++;
          results.filesGenerated += generationResult.outputFiles.length;
          
          if (generationResult.warnings) {
            results.warnings.push(...generationResult.warnings);
          }
        } else {
          results.success = false;
          if (generationResult.errors) {
            results.errors.push(...generationResult.errors);
          }
        }

      } catch (error) {
        this.logger.error(`Failed to process template ${template.name}`, { error });
        results.errors.push(`Template ${template.name}: ${error instanceof Error ? error.message : String(error)}`);
        results.success = false;
      }
    }

    return results;
  }

  private async cleanOutputDirectory(outputDir: string): Promise<void> {
    const fs = await import('fs-extra');
    
    try {
      if (await fs.pathExists(outputDir)) {
        await fs.emptyDir(outputDir);
        this.logger.info(`Cleaned output directory: ${outputDir}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to clean output directory: ${outputDir}`, { error });
    }
  }
}