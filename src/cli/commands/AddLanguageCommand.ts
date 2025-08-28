import * as fs from 'fs-extra';
import * as path from 'path';
import inquirer from 'inquirer';
import { BaseCommand, CommandOptions, CommandResult } from './BaseCommand';
import { ProjectConfiguration, LanguageConfiguration } from '../../core/interfaces/Config';
import { Logger } from '../../utils/Logger';
import { ConfigLoader } from '../../utils/ConfigLoader';

export interface AddLanguageCommandOptions extends CommandOptions {
  code?: string;
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
      this.logger.info('🌍 Add a new language to your project');

      // Load current configuration first
      const configPath = 'config.json';
      const config = await this.configLoader.loadConfiguration(configPath);

      // If no code provided, run interactive mode
      if (!options.code) {
        const languageInfo = await this.runInteractiveSetup(config);
        options.code = languageInfo.code;
        options.name = languageInfo.name;
        options.copy = languageInfo.copy;
        options.enabled = languageInfo.enabled;
        options.priority = languageInfo.priority;
      }

      // Validate language code format before normalizing
      if (!this.isValidLanguageCode(options.code!)) {
        return this.createErrorResult('Invalid language code format. Use format like "en-US", "fr-FR", etc.');
      }

      const languageCode = options.code!;

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
    return 'add-language [options]\n\n' +
           'Run without options for interactive setup (recommended).\n\n' +
           'Options:\n' +
           '  --code <code>        Language code (e.g., en-US, fr-FR, es-ES)\n' +
           '  --name <name>        Human-readable language name\n' +
           '  --copy <code>        Copy translations from existing language\n' +
           '  --priority <n>       Language priority (default: last)\n' +
           '  --enabled            Enable language (default: true)\n\n' +
           'Examples:\n' +
           '  add-language                                    # Interactive setup\n' +
           '  add-language --code es-ES --name "Spanish (Spain)"\n' +
           '  add-language --code de-DE --copy en-US';
  }

  private async runInteractiveSetup(config: ProjectConfiguration): Promise<{
    code: string;
    name: string;
    copy?: string;
    enabled: boolean;
    priority: number;
  }> {
    const predefinedLanguages = [
      { code: 'en-US', name: 'English (United States)' },
      { code: 'en-GB', name: 'English (United Kingdom)' },
      { code: 'fr-FR', name: 'Français (France)' },
      { code: 'fr-CA', name: 'Français (Canada)' },
      { code: 'es-ES', name: 'Español (España)' },
      { code: 'es-MX', name: 'Español (México)' },
      { code: 'de-DE', name: 'Deutsch (Deutschland)' },
      { code: 'it-IT', name: 'Italiano (Italia)' },
      { code: 'pt-BR', name: 'Português (Brasil)' },
      { code: 'pt-PT', name: 'Português (Portugal)' },
      { code: 'ru-RU', name: 'русский (Россия)' },
      { code: 'ja-JP', name: '日本語 (日本)' },
      { code: 'ko-KR', name: '한국어 (대한민국)' },
      { code: 'zh-CN', name: '中文 (中国)' },
      { code: 'zh-TW', name: '中文 (台灣)' },
      { code: 'ar-SA', name: 'العربية (السعودية)' },
      { code: 'hi-IN', name: 'हिन्दी (भारत)' },
      { code: 'nl-NL', name: 'Nederlands (Nederland)' },
      { code: 'sv-SE', name: 'Svenska (Sverige)' },
      { code: 'da-DK', name: 'Dansk (Danmark)' },
      { code: 'no-NO', name: 'Norsk (Norge)' },
      { code: 'fi-FI', name: 'Suomi (Suomi)' }
    ];

    // Filter out already existing languages
    const existingCodes = new Set(config.languages.map(l => l.code));
    const availableLanguages = predefinedLanguages.filter(lang => !existingCodes.has(lang.code));

    let languageChoice: { method: string };

    if (availableLanguages.length === 0) {
      this.logger.info('ℹ️  All predefined languages are already added. You can add a custom language.');
      languageChoice = { method: 'custom' };
    } else {
      languageChoice = await inquirer.prompt([
        {
          type: 'list',
          name: 'method',
          message: 'How would you like to add a language?',
          choices: [
            {
              name: '🌍 Choose from predefined languages',
              value: 'predefined'
            },
            {
              name: '✏️  Enter custom language details',
              value: 'custom'
            }
          ]
        }
      ]);
    }

    let languageCode: string;
    let languageName: string;

    if (languageChoice.method === 'predefined') {
      const predefinedChoice = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedLanguage',
          message: 'Select a language to add:',
          choices: availableLanguages.map(lang => ({
            name: `${lang.name} (${lang.code})`,
            value: lang
          }))
        }
      ]);
      languageCode = predefinedChoice.selectedLanguage.code;
      languageName = predefinedChoice.selectedLanguage.name;
    } else {
      const customAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'code',
          message: 'Enter language code (e.g., en-US, fr-FR, pt-BR):',
          validate: (input: string) => {
            if (!input.trim()) return 'Language code is required';
            if (!this.isValidLanguageCode(input)) return 'Invalid format. Use format like "en-US", "fr-FR", "pt-BR"';
            if (existingCodes.has(input)) return 'This language already exists';
            return true;
          }
        },
        {
          type: 'input',
          name: 'name',
          message: 'Enter language display name (e.g., "English (Canada)", "Português (Brasil)"):',
          validate: (input: string) => input.trim() ? true : 'Language name is required'
        }
      ]);
      languageCode = customAnswers.code;
      languageName = customAnswers.name;
    }

    // Show current language priorities for reference
    this.logger.info('\n📊 Current language priorities:');
    config.languages
      .sort((a, b) => a.priority - b.priority)
      .forEach((lang, index) => {
        this.logger.info(`  ${lang.priority}. ${lang.name} (${lang.code}) ${lang.enabled ? '✅' : '❌'}`);
      });

    // Additional configuration
    const configAnswers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enabled',
        message: 'Enable this language immediately?',
        default: true
      },
      {
        type: 'list',
        name: 'priorityChoice',
        message: 'How do you want to set the priority?',
        choices: [
          {
            name: `🔄 Add at the end (priority ${config.languages.length + 1})`,
            value: 'end'
          },
          {
            name: '⬆️  Add at the beginning (priority 1, shifts others)',
            value: 'beginning'
          },
          {
            name: '✏️  Enter custom priority',
            value: 'custom'
          }
        ]
      },
      {
        type: 'number',
        name: 'customPriority',
        message: 'Enter priority (lower = higher priority):',
        when: (answers) => answers.priorityChoice === 'custom',
        validate: (input: number) => {
          if (!input || input < 1) return 'Priority must be a positive number';
          if (input > config.languages.length + 1) return `Priority cannot be higher than ${config.languages.length + 1}`;
          return true;
        }
      },
      {
        type: 'list',
        name: 'copyFrom',
        message: 'How do you want to initialize translations?',
        choices: [
          { name: '📝 Start with empty translations (recommended)', value: 'empty' },
          ...config.languages.map(lang => ({
            name: `📋 Copy from ${lang.name} (${lang.code})`,
            value: lang.code
          }))
        ]
      }
    ]);

    // Calculate final priority
    let finalPriority: number;
    switch (configAnswers.priorityChoice) {
      case 'beginning':
        finalPriority = 1;
        // Shift all existing priorities up by 1
        config.languages.forEach(lang => lang.priority++);
        break;
      case 'custom':
        finalPriority = configAnswers.customPriority;
        // Shift priorities of languages with same or higher priority
        config.languages
          .filter(lang => lang.priority >= finalPriority)
          .forEach(lang => lang.priority++);
        break;
      default: // 'end'
        finalPriority = config.languages.length + 1;
        break;
    }

    return {
      code: languageCode,
      name: languageName,
      enabled: configAnswers.enabled,
      priority: finalPriority,
      copy: configAnswers.copyFrom !== 'empty' ? configAnswers.copyFrom : undefined
    };
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