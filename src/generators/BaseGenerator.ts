import { ProcessedTemplate, TemplateMetadata } from '../core/interfaces/Template';
import { I18nContext } from '../core/interfaces/Language';
import { Logger } from '../utils/Logger';

export interface GeneratorOptions {
  outputDir: string;
  minify?: boolean;
  sourceMaps?: boolean;
  parallel?: boolean;
  maxWorkers?: number;
}

export interface GenerationResult {
  template: TemplateMetadata;
  outputFiles: string[];
  processingTime: number;
  success: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface GenerationContext {
  template: ProcessedTemplate;
  i18nContext: I18nContext;
  outputDir: string;
  options: GeneratorOptions;
}

export abstract class BaseGenerator {
  protected readonly logger: Logger;
  protected readonly type: string;

  constructor(type: string, logger: Logger) {
    this.type = type;
    this.logger = logger;
  }

  abstract generate(context: GenerationContext): Promise<GenerationResult>;

  abstract supports(templateType: string): boolean;

  abstract getFileExtensions(): string[];

  protected async ensureOutputDirectory(outputDir: string): Promise<void> {
    const fs = await import('fs-extra');
    await fs.ensureDir(outputDir);
  }

  protected calculateProcessingTime(startTime: number): number {
    return Date.now() - startTime;
  }

  protected createSuccessResult(
    template: TemplateMetadata,
    outputFiles: string[],
    processingTime: number,
    warnings?: string[]
  ): GenerationResult {
    return {
      template,
      outputFiles,
      processingTime,
      success: true,
      warnings,
    };
  }

  protected createErrorResult(
    template: TemplateMetadata,
    errors: string[],
    processingTime: number
  ): GenerationResult {
    return {
      template,
      outputFiles: [],
      processingTime,
      success: false,
      errors,
    };
  }

  protected async writeFile(filePath: string, content: string): Promise<void> {
    const fs = await import('fs-extra');
    const path = await import('path');

    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf8');

    this.logger.debug(`Generated file: ${filePath}`);
  }

  protected minifyContent(
    content: string,
    options?: { removeComments?: boolean; removeWhitespace?: boolean }
  ): string {
    let minified = content;

    if (options?.removeComments !== false) {
      // Remove HTML comments
      minified = minified.replace(/<!--[\s\S]*?-->/g, '');
    }

    if (options?.removeWhitespace !== false) {
      // Remove extra whitespace
      minified = minified.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
    }

    return minified;
  }

  getGeneratorInfo(): { type: string; extensions: string[] } {
    return {
      type: this.type,
      extensions: this.getFileExtensions(),
    };
  }
}
