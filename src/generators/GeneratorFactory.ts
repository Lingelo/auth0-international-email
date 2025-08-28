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
