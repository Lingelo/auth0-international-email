import { BaseGenerator } from './BaseGenerator';
import { LiquidGenerator } from './LiquidGenerator';
import { Logger } from '../utils/Logger';

export interface GeneratorRegistry {
  [key: string]: new (logger: Logger, ...args: unknown[]) => BaseGenerator;
}

export class GeneratorFactory {
  private readonly generators = new Map<string, BaseGenerator>();
  private readonly registry: GeneratorRegistry;
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.registry = {
      liquid: LiquidGenerator,
      html: LiquidGenerator, // HTML templates use Liquid generator
      // Future generators can be added here
      // mustache: MustacheGenerator,
      // handlebars: HandlebarsGenerator,
    };

    this.initializeBuiltInGenerators();
  }

  getGenerator(type: string): BaseGenerator | null {
    const generator = this.generators.get(type);
    if (generator) {
      return generator;
    }

    // Try to create a new generator if it's registered but not instantiated
    const GeneratorClass = this.registry[type];
    if (GeneratorClass) {
      const newGenerator = new GeneratorClass(this.logger);
      this.generators.set(type, newGenerator);
      this.logger.debug(`Created new generator instance: ${type}`);
      return newGenerator;
    }

    this.logger.warn(`No generator found for type: ${type}`);
    return null;
  }

  registerGenerator(
    type: string,
    generatorClass: new (logger: Logger, ...args: unknown[]) => BaseGenerator
  ): void {
    this.registry[type] = generatorClass;
    this.logger.info(`Registered generator: ${type}`);
  }

  getAvailableGenerators(): Array<{ type: string; extensions: string[] }> {
    return Array.from(this.generators.values()).map((generator) => generator.getGeneratorInfo());
  }

  getSupportedTypes(): string[] {
    return Object.keys(this.registry);
  }

  findGeneratorForTemplate(templateName: string, templateType?: string): BaseGenerator | null {
    // If template type is explicitly provided, use it
    if (templateType) {
      return this.getGenerator(templateType);
    }

    // Try to infer from file extension
    const extension = this.extractExtension(templateName);

    for (const generator of this.generators.values()) {
      if (generator.getFileExtensions().includes(extension)) {
        return generator;
      }
    }

    // Default to liquid generator for HTML files
    if (extension === '.html') {
      return this.getGenerator('liquid');
    }

    this.logger.warn(`No suitable generator found for template: ${templateName}`);
    return null;
  }

  async createCustomGenerator(
    type: string,
    generatorDefinition: {
      generate: BaseGenerator['generate'];
      supports: BaseGenerator['supports'];
      getFileExtensions: BaseGenerator['getFileExtensions'];
    }
  ): Promise<void> {
    class CustomGenerator extends BaseGenerator {
      constructor(logger: Logger) {
        super(type, logger);
      }

      async generate(context: Parameters<BaseGenerator['generate']>[0]) {
        return generatorDefinition.generate.call(this, context);
      }

      supports(templateType: string): boolean {
        return generatorDefinition.supports.call(this, templateType);
      }

      getFileExtensions(): string[] {
        return generatorDefinition.getFileExtensions.call(this);
      }
    }

    this.registerGenerator(type, CustomGenerator);
    const generator = new CustomGenerator(this.logger);
    this.generators.set(type, generator);

    this.logger.info(`Created and registered custom generator: ${type}`);
  }

  validateGenerators(): { valid: string[]; invalid: Array<{ type: string; error: string }> } {
    const valid: string[] = [];
    const invalid: Array<{ type: string; error: string }> = [];

    for (const [type, generator] of this.generators.entries()) {
      try {
        // Basic validation - check if generator has required methods
        if (typeof generator.generate !== 'function') {
          invalid.push({ type, error: 'Missing generate method' });
          continue;
        }

        if (typeof generator.supports !== 'function') {
          invalid.push({ type, error: 'Missing supports method' });
          continue;
        }

        if (typeof generator.getFileExtensions !== 'function') {
          invalid.push({ type, error: 'Missing getFileExtensions method' });
          continue;
        }

        // Check if extensions are valid
        const extensions = generator.getFileExtensions();
        if (!Array.isArray(extensions) || extensions.length === 0) {
          invalid.push({ type, error: 'Invalid file extensions' });
          continue;
        }

        valid.push(type);
      } catch (error) {
        invalid.push({
          type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { valid, invalid };
  }

  private initializeBuiltInGenerators(): void {
    // Initialize built-in generators
    for (const type of Object.keys(this.registry)) {
      try {
        this.getGenerator(type); // This will create and cache the generator
      } catch (error) {
        this.logger.error(`Failed to initialize generator: ${type}`, { error });
      }
    }

    this.logger.info(`Initialized ${this.generators.size} generators`);
  }

  private extractExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '';
  }
}
