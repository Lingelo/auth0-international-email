import { BaseCommand, CommandResult } from './commands/BaseCommand';
import { BuildCommand } from './commands/BuildCommand';
import { ValidateCommand } from './commands/ValidateCommand';
import { AddLanguageCommand } from './commands/AddLanguageCommand';
import { AnalyzeCommand } from './commands/AnalyzeCommand';
import { InitCommand } from './commands/InitCommand';
import { Logger } from '../utils/Logger';
import { ConfigLoader } from '../utils/ConfigLoader';
import { CacheService } from '../core/services/CacheService';
import { FileSystemHelper } from '../utils/FileSystem';

export interface CliOptions {
  verbose?: boolean;
  quiet?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

export class CliApp {
  private readonly commands = new Map<string, BaseCommand>();
  private readonly logger: Logger;
  private readonly configLoader: ConfigLoader;
  private readonly cacheService: CacheService;
  private readonly fileSystem: FileSystemHelper;

  constructor(logger: Logger) {
    this.logger = logger;
    this.configLoader = new ConfigLoader(logger);
    this.cacheService = new CacheService(logger);
    this.fileSystem = new FileSystemHelper(logger);
    this.registerCommands();
  }

  async run(args: string[]): Promise<number> {
    try {
      const { command, options, globalOptions } = this.parseArgs(args);

      // Apply global options
      if (globalOptions.verbose) {
        this.logger.setLevel('debug');
      } else if (globalOptions.quiet) {
        this.logger.setLevel('error');
      } else if (globalOptions.logLevel) {
        this.logger.setLevel(globalOptions.logLevel);
      }

      // Handle special cases
      if (!command || command === 'help') {
        this.showHelp(options.command as string);
        return 0;
      }

      if (command === 'version') {
        this.showVersion();
        return 0;
      }

      // Execute command
      const cmd = this.commands.get(command);
      if (!cmd) {
        this.logger.error(`Unknown command: ${command}`);
        this.showHelp();
        return 1;
      }

      const result = await cmd.execute(options);

      if (result.success) {
        if (result.message) {
          this.logger.info(result.message);
        }
        return 0;
      } else {
        if (result.message) {
          this.logger.error(result.message);
        }
        if (result.errors) {
          result.errors.forEach((error) => this.logger.error(error));
        }
        return 1;
      }
    } catch (error) {
      this.logger.error('CLI application error', { error });
      return 1;
    }
  }

  private registerCommands(): void {
    this.commands.set('init', new InitCommand('init', 'Initialize a new Auth0 template project', this.logger, this.configLoader, this.fileSystem));
    this.commands.set('build', new BuildCommand(this.logger, this.configLoader, this.cacheService));
    this.commands.set(
      'validate',
      new ValidateCommand(this.logger, this.configLoader, this.cacheService)
    );
    this.commands.set('add-language', new AddLanguageCommand(this.logger, this.configLoader));
    this.commands.set(
      'analyze',
      new AnalyzeCommand(this.logger, this.configLoader, this.cacheService)
    );

    this.logger.debug(`Registered ${this.commands.size} CLI commands`);
  }

  private parseArgs(args: string[]): {
    command?: string;
    options: Record<string, unknown>;
    globalOptions: CliOptions;
  } {
    const globalOptions: CliOptions = {};
    const options: Record<string, unknown> = {};
    let command: string | undefined;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Handle global options
      if (arg === '--verbose' || arg === '-v') {
        globalOptions.verbose = true;
        continue;
      }

      if (arg === '--quiet' || arg === '-q') {
        globalOptions.quiet = true;
        continue;
      }

      if (arg === '--log-level') {
        globalOptions.logLevel = args[++i] as CliOptions['logLevel'];
        continue;
      }

      // First non-option argument is the command
      if (!command && !arg.startsWith('--') && !arg.startsWith('-')) {
        command = arg;
        continue;
      }

      // Handle command options
      if (arg.startsWith('--')) {
        const optionName = arg.slice(2);
        const nextArg = args[i + 1];

        // Boolean options
        if (!nextArg || nextArg.startsWith('-')) {
          options[optionName] = true;
        } else {
          // Value options
          options[optionName] = nextArg;
          i++; // Skip next argument as it's the value
        }
        continue;
      }

      if (arg.startsWith('-') && arg.length === 2) {
        const shortOption = arg[1];
        const nextArg = args[i + 1];

        // Map common short options
        const shortToLong: Record<string, string> = {
          c: 'config',
          o: 'output',
          w: 'watch',
          f: 'fix',
          h: 'help',
        };

        const longOption = shortToLong[shortOption] || shortOption;

        if (!nextArg || nextArg.startsWith('-')) {
          options[longOption] = true;
        } else {
          options[longOption] = nextArg;
          i++;
        }
      }
    }

    return { command, options, globalOptions };
  }

  private showHelp(specificCommand?: string): void {
    if (specificCommand) {
      const cmd = this.commands.get(specificCommand);
      if (cmd) {
        console.log(`\n${cmd.getHelp()}\n`);
        return;
      } else {
        console.log(`\nUnknown command: ${specificCommand}\n`);
      }
    }

    console.log(`
Auth0 International Email Template Generator

Usage: auth0-template-generator <command> [options]

Commands:
  init                 Initialize a new Auth0 template project (interactive)
  build                Build and generate internationalized email templates
  validate             Validate templates, translations, and configuration  
  add-language         Add a new language to the project
  analyze              Analyze project structure, translations, and performance
  help [command]       Show help for a specific command
  version              Show version information

Global Options:
  --verbose, -v        Enable verbose logging
  --quiet, -q          Suppress non-error output  
  --log-level <level>  Set logging level (error, warn, info, debug)

Examples:
  auth0-template-generator init                                     # Interactive setup
  auth0-template-generator build --config config.json --output dist/output
  auth0-template-generator validate --templates --verbose
  auth0-template-generator add-language --code es-ES --name "Spanish"

For detailed help on a specific command, use:
  auth0-template-generator help <command>
`);
  }

  private showVersion(): void {
    // In a real implementation, this would read from package.json
    const version = process.env.npm_package_version || '2.0.0';
    console.log(`Auth0 Template Generator v${version}`);
  }

  getAvailableCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  getCommand(name: string): BaseCommand | undefined {
    return this.commands.get(name);
  }

  addCommand(command: BaseCommand): void {
    this.commands.set(command.name, command);
    this.logger.debug(`Added custom command: ${command.name}`);
  }

  removeCommand(name: string): boolean {
    const result = this.commands.delete(name);
    if (result) {
      this.logger.debug(`Removed command: ${name}`);
    }
    return result;
  }
}
