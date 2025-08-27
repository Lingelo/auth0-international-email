import * as fs from 'fs-extra';
import * as path from 'path';
import { BaseCommand, CommandOptions, CommandResult } from './BaseCommand';
import { ProjectConfiguration, LanguageConfiguration } from '../../core/interfaces/Config';
import { Logger } from '../../utils/Logger';
import { ConfigLoader } from '../../utils/ConfigLoader';

export interface AddLanguageCommandOptions extends CommandOptions {
  code: string;
  name?: string;
  interactive?: boolean;
  copy?: string; // Copy translations from existing language
  priority?: number;
  enabled?: boolean;
}

export class AddLanguageCommand extends BaseCommand {
  private readonly configLoader: ConfigLoader;

  constructor(logger: Logger, configLoader: ConfigLoader) {
    super('add-language', 'Add a new language to the project', logger);
    this.configLoader = configLoader;
  }

  async execute(options: AddLanguageCommandOptions): Promise<CommandResult> {
    try {
      const missing = this.validateRequiredOptions(options, ['code']);
      if (missing.length > 0) {
        return this.createErrorResult(`Missing required options: ${missing.join(', ')}`);
      }

      const languageCode = options.code.toLowerCase();
      
      // Validate language code format
      if (!this.isValidLanguageCode(languageCode)) {
        return this.createErrorResult('Invalid language code format. Use format like "en-US", "fr-FR", etc.');
      }

      // Load current configuration
      const configPath = 'config.json';
      const config = await this.configLoader.loadConfiguration(configPath);

      // Check if language already exists
      if (config.languages.some(l => l.code === languageCode)) {
        return this.createErrorResult(`Language ${languageCode} already exists in the project`);
      }

      let languageData: { [key: string]: string } = {};

      // Handle interactive mode or copy from existing language
      if (options.interactive) {
        languageData = await this.interactiveLanguageSetup(languageCode, config);
      } else if (options.copy) {
        languageData = await this.copyLanguageData(options.copy, config);
      } else {
        languageData = await this.createEmptyLanguageData(config);
      }

      // Create language file
      const languageFilePath = path.join(process.cwd(), 'src/languages', `${languageCode}.json`);
      await this.createLanguageFile(languageFilePath, languageData);

      // Update configuration
      const newLanguageConfig: LanguageConfiguration = {
        code: languageCode,
        name: options.name || this.getLanguageName(languageCode),
        enabled: options.enabled !== false,
        priority: options.priority || config.languages.length + 1
      };

      config.languages.push(newLanguageConfig);

      // Sort languages by priority
      config.languages.sort((a, b) => a.priority - b.priority);

      // Save updated configuration
      await this.configLoader.saveConfiguration(configPath, config);

      this.logger.info(`Added new language: ${languageCode}`, {
        name: newLanguageConfig.name,
        translationsCount: Object.keys(languageData).length,
        enabled: newLanguageConfig.enabled
      });

      return this.createSuccessResult(
        `Successfully added language ${languageCode}`,
        {
          language: newLanguageConfig,
          filePath: languageFilePath,
          translationsCount: Object.keys(languageData).length
        }
      );

    } catch (error) {
      this.logger.error('Add language command failed', { error });
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  getUsage(): string {
    return 'add-language --code <code> [options]\n\n' +
           'Options:\n' +
           '  --code <code>        Language code (e.g., en-US, fr-FR, es-ES)\n' +
           '  --name <name>        Human-readable language name\n' +
           '  --interactive        Interactive setup with prompts\n' +
           '  --copy <code>        Copy translations from existing language\n' +
           '  --priority <n>       Language priority (default: last)\n' +
           '  --enabled            Enable language (default: true)\n\n' +
           'Examples:\n' +
           '  add-language --code es-ES --name "Spanish (Spain)"\n' +
           '  add-language --code de-DE --copy en-US --interactive\n' +
           '  add-language --code ja-JP --priority 1';
  }

  private isValidLanguageCode(code: string): boolean {
    // Basic validation for language codes like en-US, fr-FR, etc.
    const pattern = /^[a-z]{2}-[A-Z]{2}$/;
    return pattern.test(code);
  }

  private async interactiveLanguageSetup(
    languageCode: string, 
    config: ProjectConfiguration
  ): Promise<{ [key: string]: string }> {
    this.logger.info(`Interactive setup for language: ${languageCode}`);
    
    // In a real implementation, this would use a proper CLI prompt library
    // For now, we'll create empty translations and log what would be asked
    
    this.logger.info('Interactive mode would ask:');
    this.logger.info('- Language display name');
    this.logger.info('- Whether to copy from existing language');
    this.logger.info('- Initial translations for each key');
    
    return this.createEmptyLanguageData(config);
  }

  private async copyLanguageData(
    sourceLanguageCode: string,
    config: ProjectConfiguration
  ): Promise<{ [key: string]: string }> {
    // Check if source language exists
    const sourceLanguage = config.languages.find(l => l.code === sourceLanguageCode);
    if (!sourceLanguage) {
      throw new Error(`Source language ${sourceLanguageCode} not found`);
    }

    const sourceFilePath = path.join(process.cwd(), 'src/languages', `${sourceLanguageCode}.json`);
    
    if (!await fs.pathExists(sourceFilePath)) {
      throw new Error(`Source language file not found: ${sourceFilePath}`);
    }

    try {
      const sourceContent = await fs.readFile(sourceFilePath, 'utf8');
      const sourceData = JSON.parse(sourceContent);
      
      this.logger.info(`Copied ${Object.keys(sourceData).length} translations from ${sourceLanguageCode}`);
      
      return sourceData;
    } catch (error) {
      throw new Error(`Failed to read source language file: ${error}`);
    }
  }

  private async createEmptyLanguageData(config: ProjectConfiguration): Promise<{ [key: string]: string }> {
    // Get all unique translation keys from existing languages
    const allKeys = new Set<string>();
    
    for (const language of config.languages) {
      try {
        const languageFilePath = path.join(process.cwd(), 'src/languages', `${language.code}.json`);
        
        if (await fs.pathExists(languageFilePath)) {
          const content = await fs.readFile(languageFilePath, 'utf8');
          const data = JSON.parse(content);
          Object.keys(data).forEach(key => allKeys.add(key));
        }
      } catch (error) {
        this.logger.warn(`Failed to read existing language file for ${language.code}`, { error });
      }
    }

    // Create empty translations for all keys
    const emptyData: { [key: string]: string } = {};
    allKeys.forEach(key => {
      emptyData[key] = `[TODO: ${key}]`;
    });

    this.logger.info(`Created empty translation file with ${allKeys.size} keys to translate`);
    
    return emptyData;
  }

  private async createLanguageFile(filePath: string, data: { [key: string]: string }): Promise<void> {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    this.logger.debug(`Created language file: ${filePath}`);
  }

  private getLanguageName(languageCode: string): string {
    // Simple mapping of common language codes to names
    const languageNames: { [key: string]: string } = {
      'en-US': 'English (United States)',
      'en-GB': 'English (United Kingdom)',
      'fr-FR': 'French (France)',
      'fr-CA': 'French (Canada)',
      'es-ES': 'Spanish (Spain)',
      'es-MX': 'Spanish (Mexico)',
      'de-DE': 'German (Germany)',
      'it-IT': 'Italian (Italy)',
      'pt-BR': 'Portuguese (Brazil)',
      'pt-PT': 'Portuguese (Portugal)',
      'ru-RU': 'Russian (Russia)',
      'ja-JP': 'Japanese (Japan)',
      'ko-KR': 'Korean (South Korea)',
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      'ar-SA': 'Arabic (Saudi Arabia)',
      'hi-IN': 'Hindi (India)',
      'nl-NL': 'Dutch (Netherlands)',
      'sv-SE': 'Swedish (Sweden)',
      'da-DK': 'Danish (Denmark)',
      'no-NO': 'Norwegian (Norway)',
      'fi-FI': 'Finnish (Finland)'
    };

    return languageNames[languageCode] || languageCode.toUpperCase();
  }
}