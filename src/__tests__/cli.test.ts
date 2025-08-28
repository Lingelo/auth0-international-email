import { Logger } from '../utils/Logger';
import { CliApp } from '../cli/CliApp';

describe('CLI Integration', () => {
  let logger: Logger;
  let cli: CliApp;

  beforeEach(() => {
    logger = new Logger({ level: 'error', format: 'json' }); // Suppress logs in tests
    cli = new CliApp(logger);
  });

  describe('Command Registration', () => {
    it('should register all expected commands', () => {
      const commands = cli.getAvailableCommands();

      expect(commands).toContain('init');
      expect(commands).toContain('build');
      expect(commands).toContain('validate');
      expect(commands).toContain('add-language');
      expect(commands).toContain('analyze');
    });

    it('should provide command instances', () => {
      const buildCommand = cli.getCommand('build');
      const initCommand = cli.getCommand('init');

      expect(buildCommand).toBeDefined();
      expect(initCommand).toBeDefined();
      expect(buildCommand?.name).toBe('build');
      expect(initCommand?.name).toBe('init');
    });

    it('should return undefined for non-existent commands', () => {
      const nonExistentCommand = cli.getCommand('non-existent');
      expect(nonExistentCommand).toBeUndefined();
    });
  });

  describe('Help System', () => {
    it('should handle help command', async () => {
      const exitCode = await cli.run(['help']);
      expect(exitCode).toBe(0);
    });

    it('should handle version command', async () => {
      const exitCode = await cli.run(['version']);
      expect(exitCode).toBe(0);
    });

    it('should handle unknown command gracefully', async () => {
      const exitCode = await cli.run(['unknown-command']);
      expect(exitCode).toBe(1);
    });
  });

  describe('Global Options', () => {
    it('should handle verbose flag', async () => {
      const exitCode = await cli.run(['--verbose', 'help']);
      expect(exitCode).toBe(0);
    });

    it('should handle quiet flag', async () => {
      const exitCode = await cli.run(['--quiet', 'help']);
      expect(exitCode).toBe(0);
    });

    it('should handle log level option', async () => {
      const exitCode = await cli.run(['--log-level', 'debug', 'help']);
      expect(exitCode).toBe(0);
    });
  });
});
