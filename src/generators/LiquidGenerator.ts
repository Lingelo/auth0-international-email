import * as path from 'path';
import { BaseGenerator, GenerationContext, GenerationResult } from './BaseGenerator';
import { Logger } from '../utils/Logger';

interface A0DeployConfig {
  body: string;
  enabled: boolean;
  from: string;
  subject: string;
  syntax: 'liquid';
  template: string;
}

export class LiquidGenerator extends BaseGenerator {
  constructor(logger: Logger) {
    super('liquid', logger);
  }

  async generate(context: GenerationContext): Promise<GenerationResult> {
    const startTime = Date.now();
    const outputFiles: string[] = [];
    const warnings: string[] = [];

    try {
      await this.ensureOutputDirectory(context.outputDir);

      // Generate the localized HTML template
      const htmlResult = await this.generateLocalizedTemplate(context);
      outputFiles.push(htmlResult.filePath);

      if (htmlResult.warnings) {
        warnings.push(...htmlResult.warnings);
      }

      // Generate the Auth0 deployment configuration
      const configResult = await this.generateDeploymentConfig(context);
      outputFiles.push(configResult.filePath);

      if (configResult.warnings) {
        warnings.push(...configResult.warnings);
      }

      const processingTime = this.calculateProcessingTime(startTime);

      this.logger.info(`Generated Liquid template for ${context.template.metadata.name}`, {
        files: outputFiles,
        processingTime,
        warnings: warnings.length,
      });

      return this.createSuccessResult(
        context.template.metadata,
        outputFiles,
        processingTime,
        warnings.length > 0 ? warnings : undefined
      );
    } catch (error) {
      const processingTime = this.calculateProcessingTime(startTime);
      this.logger.error(
        `Failed to generate Liquid template for ${context.template.metadata.name}`,
        { error }
      );

      return this.createErrorResult(
        context.template.metadata,
        [error instanceof Error ? error.message : String(error)],
        processingTime
      );
    }
  }

  supports(templateType: string): boolean {
    return templateType === 'liquid' || templateType === 'html';
  }

  getFileExtensions(): string[] {
    return ['.html', '.json'];
  }

  private async generateLocalizedTemplate(context: GenerationContext): Promise<{
    filePath: string;
    warnings?: string[];
  }> {
    const { template, i18nContext, outputDir, options } = context;
    const warnings: string[] = [];

    // Process the template content with localization
    let processedContent = await this.processLocalizationCalls(template.content, i18nContext);

    // Apply minification if requested
    if (options.minify) {
      processedContent = this.minifyContent(processedContent);
    }

    // Validate the generated Liquid syntax
    const validationResult = this.validateLiquidSyntax(processedContent);
    if (validationResult.warnings.length > 0) {
      warnings.push(...validationResult.warnings);
    }

    const outputPath = path.join(outputDir, `${template.metadata.name}.html`);
    await this.writeFile(outputPath, processedContent);

    return { filePath: outputPath, warnings };
  }

  private async generateDeploymentConfig(context: GenerationContext): Promise<{
    filePath: string;
    warnings?: string[];
  }> {
    const { template, i18nContext } = context;
    const warnings: string[] = [];

    // Generate the subject with localization
    const localizedSubject = await this.processLocalizationCalls(
      `\${localizeMessage("${template.metadata.subjectKey}")}`,
      i18nContext
    );

    const deployConfig: A0DeployConfig = {
      body: `./${template.metadata.name}.html`,
      enabled: template.metadata.enabled,
      from: template.metadata.from,
      subject: localizedSubject,
      syntax: 'liquid',
      template: template.metadata.name,
    };

    // Validate the configuration
    if (!deployConfig.from || deployConfig.from === 'from@mail.com') {
      warnings.push(
        'Using placeholder email address. Please update the "from" field in production.'
      );
    }

    const configPath = path.join(context.outputDir, `${template.metadata.name}.json`);
    const configContent = JSON.stringify(deployConfig, null, 2);

    await this.writeFile(configPath, configContent);

    return { filePath: configPath, warnings };
  }

  private async processLocalizationCalls(content: string, i18nContext: any): Promise<string> {
    const localizationRegex = /\$\{localizeMessage\(['"`]([^'"`]+)['"`]\)\}/g;

    return content.replace(localizationRegex, (match, key) => {
      return this.generateLiquidConditions(key, i18nContext);
    });
  }

  private generateLiquidConditions(translationKey: string, i18nContext: any): string {
    const languages = Array.from(i18nContext.catalogs.keys());
    const [primaryLanguage, ...secondaryLanguages] = languages;

    const conditions: string[] = [];

    // First condition (if)
    if (primaryLanguage) {
      const catalog = i18nContext.catalogs.get(primaryLanguage);
      const translation = catalog?.entries.get(translationKey);
      const value = translation?.value || `[MISSING: ${translationKey}]`;
      conditions.push(`{% if user.user_metadata.language == '${primaryLanguage}' %}${value}`);
    }

    // Middle conditions (elsif)
    for (const language of secondaryLanguages) {
      const catalog = i18nContext.catalogs.get(language);
      const translation = catalog?.entries.get(translationKey);
      const value = translation?.value || `[MISSING: ${translationKey}]`;
      conditions.push(`{% elsif user.user_metadata.language == '${language}' %}${value}`);
    }

    // Default condition (else)
    if (primaryLanguage) {
      const catalog = i18nContext.catalogs.get(primaryLanguage);
      const translation = catalog?.entries.get(translationKey);
      const value = translation?.value || `[MISSING: ${translationKey}]`;
      conditions.push(`{% else %}${value}{% endif %}`);
    }

    return conditions.join('\n');
  }

  private validateLiquidSyntax(content: string): { warnings: string[] } {
    const warnings: string[] = [];

    // Check for unmatched Liquid tags
    const ifCount = (content.match(/{%\s*if\s/g) || []).length;
    const endifCount = (content.match(/{%\s*endif\s*%}/g) || []).length;

    if (ifCount !== endifCount) {
      warnings.push(`Unmatched Liquid if/endif tags: ${ifCount} if tags, ${endifCount} endif tags`);
    }

    // Check for potential issues with variable access
    const userMetadataAccess = content.match(/user\.user_metadata\.\w+/g) || [];
    const uniqueAccess = [...new Set(userMetadataAccess)];

    if (uniqueAccess.length > 1) {
      warnings.push(`Multiple user_metadata property access detected: ${uniqueAccess.join(', ')}`);
    }

    // Check for empty conditions
    const emptyConditions = content.match(/{%\s*(if|elsif)\s[^%]*%}\s*{%/g);
    if (emptyConditions && emptyConditions.length > 0) {
      warnings.push('Empty Liquid conditions detected');
    }

    return { warnings };
  }
}
