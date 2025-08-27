import inquirer from 'inquirer';
import { BaseCommand, CommandResult, CommandOptions } from './BaseCommand';
import { Logger } from '../../utils/Logger';
import { ConfigLoader } from '../../utils/ConfigLoader';
import { FileSystemHelper } from '../../utils/FileSystem';
import { TemplateConfiguration, LanguageConfiguration } from '../../core/interfaces/Config';

export class InitCommand extends BaseCommand {
  private configLoader: ConfigLoader;
  private fileSystem: FileSystemHelper;

  constructor(name: string, description: string, logger: Logger, configLoader: ConfigLoader, fileSystem: FileSystemHelper) {
    super(name, description, logger);
    this.configLoader = configLoader;
    this.fileSystem = fileSystem;
  }

  getUsage(): string {
    return 'auth0-template-generator init [options]';
  }

  async execute(options: CommandOptions): Promise<CommandResult> {
    this.logger.info('🚀 Welcome to Auth0 Template Generator Setup');

    try {
      // Check if config already exists
      const configExists = await this.fileSystem.exists('./config.json');
      if (configExists) {
        const { overwrite } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'A config.json file already exists. Do you want to overwrite it?',
            default: false,
          },
        ]);

        if (!overwrite) {
          return this.createSuccessResult('Initialization cancelled.');
        }
      }

      // Project information
      const projectInfo = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Project name:',
          default: 'Auth0 Email Templates',
        },
        {
          type: 'input',
          name: 'version',
          message: 'Version:',
          default: '1.0.0',
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description:',
          default: 'Auth0 internationalized email templates',
        },
      ]);

      // Template configuration
      const templates = await this.configureTemplates();

      // Language configuration
      const languages = await this.configureLanguages();

      // Build configuration
      const buildConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'outputDir',
          message: 'Output directory:',
          default: 'dist/output',
        },
        {
          type: 'confirm',
          name: 'parallel',
          message: 'Enable parallel processing?',
          default: true,
        },
        {
          type: 'number',
          name: 'maxWorkers',
          message: 'Maximum worker processes:',
          default: 4,
        },
        {
          type: 'confirm',
          name: 'sourceMaps',
          message: 'Generate source maps?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'minify',
          message: 'Enable minification?',
          default: false,
        },
      ]);

      // Cache configuration
      const cacheConfig = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'enabled',
          message: 'Enable caching?',
          default: true,
        },
        {
          type: 'list',
          name: 'strategy',
          message: 'Cache strategy:',
          choices: ['memory', 'disk', 'hybrid'],
          default: 'hybrid',
          when: (answers) => answers.enabled,
        },
        {
          type: 'number',
          name: 'ttl',
          message: 'Cache TTL (seconds):',
          default: 3600,
          when: (answers) => answers.enabled,
        },
      ]);

      // Create configuration object
      const config = {
        name: projectInfo.name,
        version: projectInfo.version,
        description: projectInfo.description,
        templates,
        languages,
        build: {
          outputDir: buildConfig.outputDir,
          cleanOutput: true,
          parallel: buildConfig.parallel,
          maxWorkers: buildConfig.maxWorkers,
          sourceMaps: buildConfig.sourceMaps,
          minify: buildConfig.minify,
          watch: false,
        },
        validation: {
          html: {
            enabled: true,
            strict: false,
            rules: {
              doctype: true,
              'lang-attribute': true,
              'no-script-tags': true,
            },
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
            runBefore: ['minifier'],
            options: {
              strict: false,
              format: 'text',
            },
          },
          {
            name: 'minifier',
            enabled: buildConfig.minify,
            runAfter: ['html-validator'],
            options: {
              removeComments: true,
              removeWhitespace: true,
              preserveLineBreaks: false,
            },
          },
        ],
        cache: cacheConfig.enabled
          ? {
              enabled: true,
              ttl: cacheConfig.ttl,
              maxSize: 100,
              strategy: cacheConfig.strategy,
              directory: '.cache',
            }
          : {
              enabled: false,
            },
        monitoring: {
          enabled: true,
          collectMetrics: true,
          logLevel: 'info',
          outputFormat: 'structured',
        },
      };

      // Write configuration file
      await this.fileSystem.writeTextFile('./config.json', JSON.stringify(config, null, 2));

      // Create directory structure
      await this.createDirectoryStructure();

      // Create sample template files
      await this.createSampleFiles(templates, languages);

      this.logger.info('✅ Project initialized successfully!');
      this.logger.info('Next steps:');
      this.logger.info('  1. Edit your templates in the src/templates/ directory');
      this.logger.info('  2. Update translations in the src/languages/ directory');
      this.logger.info('  3. Run "yarn build" to generate your templates');
      this.logger.info('  4. Run "yarn validate" to check your configuration');

      return this.createSuccessResult('Project initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize project', { error });
      return this.createErrorResult(`Initialization failed: ${error}`);
    }
  }

  private async configureTemplates(): Promise<TemplateConfiguration[]> {
    const templates: TemplateConfiguration[] = [];

    this.logger.info('📧 Configure email templates');

    while (true) {
      const templateConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Template name (e.g., welcome_email):',
          validate: (input) => {
            if (!input.trim()) return 'Template name is required';
            if (templates.some((t) => t.name === input)) return 'Template name must be unique';
            return true;
          },
        },
        {
          type: 'input',
          name: 'from',
          message: 'From email address:',
          default: 'noreply@auth0.com',
          validate: (input) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(input) || 'Please enter a valid email address';
          },
        },
        {
          type: 'input',
          name: 'subjectKey',
          message: 'Subject translation key:',
          default: (answers: { name: string }) => `${answers.name}.subject`,
        },
        {
          type: 'confirm',
          name: 'enabled',
          message: 'Enable this template?',
          default: true,
        },
      ]);

      templates.push({
        name: templateConfig.name,
        from: templateConfig.from,
        subjectKey: templateConfig.subjectKey,
        enabled: templateConfig.enabled,
        variables: {},
        preprocessors: [],
        postprocessors: [],
      });

      const { addAnother } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'addAnother',
          message: 'Add another template?',
          default: false,
        },
      ]);

      if (!addAnother) break;
    }

    if (templates.length === 0) {
      // Add default template if none configured
      templates.push({
        name: 'welcome_email',
        from: 'noreply@auth0.com',
        subjectKey: 'welcome.subject',
        enabled: true,
        variables: {},
        preprocessors: [],
        postprocessors: [],
      });
    }

    return templates;
  }

  private async configureLanguages(): Promise<LanguageConfiguration[]> {
    const languages: LanguageConfiguration[] = [];

    this.logger.info('🌍 Configure supported languages');

    const predefinedLanguages = [
      { code: 'en-US', name: 'English (United States)' },
      { code: 'es-ES', name: 'Español (España)' },
      { code: 'es-MX', name: 'Español (México)' },
      { code: 'fr-FR', name: 'Français (France)' },
      { code: 'pt-BR', name: 'Português (Brasil)' },
      { code: 'de-DE', name: 'Deutsch (Deutschland)' },
      { code: 'it-IT', name: 'Italiano (Italia)' },
      { code: 'ja-JP', name: '日本語 (日本)' },
      { code: 'ko-KR', name: '한국어 (대한민국)' },
      { code: 'zh-CN', name: '中文 (中国)' },
    ];

    const { selectedLanguages } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedLanguages',
        message: 'Select languages to support:',
        choices: predefinedLanguages.map((lang) => ({
          name: `${lang.name} (${lang.code})`,
          value: lang.code,
        })),
        default: ['en-US'],
      },
    ]);

    // Configure selected languages
    let priority = 1;
    for (const langCode of selectedLanguages) {
      const langInfo = predefinedLanguages.find((l) => l.code === langCode);
      const langConfig = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'enabled',
          message: `Enable ${langInfo?.name} (${langCode})?`,
          default: langCode === 'en-US',
        },
        {
          type: 'list',
          name: 'fallback',
          message: `Fallback language for ${langCode}:`,
          choices: [
            { name: 'None', value: null },
            ...selectedLanguages
              .filter((code) => code !== langCode)
              .map((code) => ({
                name: predefinedLanguages.find((l) => l.code === code)?.name || code,
                value: code,
              })),
          ],
          default: langCode === 'en-US' ? null : 'en-US',
        },
      ]);

      languages.push({
        code: langCode,
        name: langInfo?.name || langCode,
        enabled: langConfig.enabled,
        priority: priority++,
        fallback: langConfig.fallback,
      });
    }

    return languages;
  }

  private async createDirectoryStructure(): Promise<void> {
    const dirs = [
      'src/templates',
      'src/languages',
      'dist/output',
      '.cache',
      'tests',
    ];

    for (const dir of dirs) {
      await this.fileSystem.ensureDirectory(dir);
      this.logger.debug(`Created directory: ${dir}`);
    }
  }

  private async createSampleFiles(
    templates: TemplateConfiguration[],
    languages: LanguageConfiguration[]
  ): Promise<void> {
    // Create sample template files
    for (const template of templates) {
      const templateContent = this.getSampleTemplate(template.name);
      await this.fileSystem.writeTextFile(
        `src/templates/${template.name}.html`,
        templateContent
      );
    }

    // Create sample language files
    for (const language of languages.filter((l) => l.enabled)) {
      const translations = this.getSampleTranslations(templates, language.code);
      await this.fileSystem.writeTextFile(
        `src/languages/${language.code}.json`,
        JSON.stringify(translations, null, 2)
      );
    }

    this.logger.debug('Created sample template and language files');
  }

  private getSampleTemplate(templateName: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>\${localizeMessage('${templateName}.subject')}</title>
</head>
<body>
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>\${localizeMessage('${templateName}.subject')}</h1>
        <p>\${localizeMessage('${templateName}.greeting')}</p>
        <p>\${localizeMessage('${templateName}.content')}</p>
        <p>
            \${localizeMessage('${templateName}.regards')}<br>
            \${localizeMessage('${templateName}.signature')}
        </p>
    </div>
</body>
</html>`;
  }

  private getSampleTranslations(templates: TemplateConfiguration[], languageCode: string): Record<string, string> {
    const translations: Record<string, string> = {};

    const sampleTranslations: Record<string, Record<string, string>> = {
      'en-US': {
        'welcome_email.subject': 'Welcome to Auth0!',
        'welcome_email.greeting': 'Hello {{user.given_name || user.name || user.email}}!',
        'welcome_email.content': 'Thank you for signing up. We\'re excited to have you on board.',
        'welcome_email.regards': 'Best regards,',
        'welcome_email.signature': 'The Auth0 Team',
        'password_reset.subject': 'Reset Your Password',
        'password_reset.greeting': 'Hello {{user.given_name || user.name || user.email}}!',
        'password_reset.content': 'Click the link below to reset your password.',
        'password_reset.regards': 'Best regards,',
        'password_reset.signature': 'The Auth0 Team',
      },
      'es-ES': {
        'welcome_email.subject': '¡Bienvenido a Auth0!',
        'welcome_email.greeting': '¡Hola {{user.given_name || user.name || user.email}}!',
        'welcome_email.content': 'Gracias por registrarte. Estamos emocionados de tenerte con nosotros.',
        'welcome_email.regards': 'Saludos cordiales,',
        'welcome_email.signature': 'El equipo de Auth0',
        'password_reset.subject': 'Restablecer tu contraseña',
        'password_reset.greeting': '¡Hola {{user.given_name || user.name || user.email}}!',
        'password_reset.content': 'Haz clic en el enlace de abajo para restablecer tu contraseña.',
        'password_reset.regards': 'Saludos cordiales,',
        'password_reset.signature': 'El equipo de Auth0',
      },
      'fr-FR': {
        'welcome_email.subject': 'Bienvenue chez Auth0 !',
        'welcome_email.greeting': 'Bonjour {{user.given_name || user.name || user.email}} !',
        'welcome_email.content': 'Merci de vous être inscrit. Nous sommes ravis de vous accueillir.',
        'welcome_email.regards': 'Cordialement,',
        'welcome_email.signature': 'L\'équipe Auth0',
        'password_reset.subject': 'Réinitialiser votre mot de passe',
        'password_reset.greeting': 'Bonjour {{user.given_name || user.name || user.email}} !',
        'password_reset.content': 'Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe.',
        'password_reset.regards': 'Cordialement,',
        'password_reset.signature': 'L\'équipe Auth0',
      },
    };

    const baseTranslations = sampleTranslations[languageCode] || sampleTranslations['en-US'];

    // Add translations for configured templates
    templates.forEach((template) => {
      const templateKey = template.name;
      if (baseTranslations[`${templateKey}.subject`]) {
        translations[`${templateKey}.subject`] = baseTranslations[`${templateKey}.subject`];
        translations[`${templateKey}.greeting`] = baseTranslations[`${templateKey}.greeting`];
        translations[`${templateKey}.content`] = baseTranslations[`${templateKey}.content`];
        translations[`${templateKey}.regards`] = baseTranslations[`${templateKey}.regards`];
        translations[`${templateKey}.signature`] = baseTranslations[`${templateKey}.signature`];
      } else {
        // Fallback generic translations
        translations[template.subjectKey] = `${template.name} Subject`;
        translations[`${templateKey}.greeting`] = 'Hello {{user.given_name || user.name || user.email}}!';
        translations[`${templateKey}.content`] = `This is the content for ${template.name}.`;
        translations[`${templateKey}.regards`] = 'Best regards,';
        translations[`${templateKey}.signature`] = 'The Auth0 Team';
      }
    });

    return translations;
  }
}